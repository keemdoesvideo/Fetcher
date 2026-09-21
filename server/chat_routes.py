"""HTTP routes for Fetcher's chat-capture beta.

Kept in a small router registrar so the feature can evolve independently of the
core download API while it is experimental.
"""

from __future__ import annotations

import logging
import threading

from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

from . import (
    chat_7tv_badges,
    chat_badges,
    chat_capture,
    chat_edits,
    chat_emotes,
    chat_events,
    chat_export,
    chat_export_policy,
    chat_export_styled,
    chat_filters,
    chat_paints,
    chat_timing,
    config,
    errors,
    limits,
    timecode,
)
from . import jobs as jobstate
from .jobs import JobCancelled, store
from .models import ChatCaptureRequest, ChatExportRequest

chat_export_policy.install()

log = logging.getLogger("fetcher.chat")
_chat_window = limits.RequestWindow(max_requests=12, window_seconds=5 * 60)
_export_window = limits.RequestWindow(max_requests=6, window_seconds=10 * 60)
_render_gate = threading.BoundedSemaphore(1)


def _client_key(request: Request) -> str:
    direct = request.client.host if request.client else "unknown"
    if direct in {"127.0.0.1", "::1"}:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded[:96]
    return (direct or "unknown")[:96]


def _error(err: errors.FetcherError) -> JSONResponse:
    log.info("chat error %s: %s", err.code, err.detail or err.message)
    return JSONResponse(status_code=err.http_status, content=err.to_public())


def _enrich_emotes(payload: dict) -> dict:
    video_id = str(payload.get("vodId") or "")
    if not video_id:
        return payload
    try:
        channel = chat_emotes.twitch_channel_for_vod(video_id, chat_capture._TWITCH_CLIENT_ID)
        channel_id = str(channel.get("id") or "")
        if not channel_id:
            return payload
        payload["channel"] = channel
        catalog, providers = chat_emotes.catalog_for_channel(channel_id)
        resolved = chat_emotes.enrich_messages(payload.get("messages") or [], catalog)
        payload["emoteProviders"] = providers
        payload["thirdPartyEmotes"] = resolved
        log.info(
            "chat emotes vod=%s channel=%s catalog=%s resolved=%s providers=%s",
            video_id,
            channel.get("login") or channel_id,
            len(catalog),
            resolved,
            ",".join(providers) or "none",
        )
    except Exception:
        log.exception("third-party emote enrichment failed for vod=%s", video_id)
    return payload


def _enrich_badges(payload: dict) -> dict:
    video_id = str(payload.get("vodId") or "")
    if not video_id:
        return payload
    try:
        channel = payload.get("channel") if isinstance(payload.get("channel"), dict) else {}
        if not channel.get("id"):
            channel = chat_emotes.twitch_channel_for_vod(video_id, chat_capture._TWITCH_CLIENT_ID)
            if channel:
                payload["channel"] = channel
        channel_id = str(channel.get("id") or "")
        channel_login = str(channel.get("login") or "")
        if not channel_id and not channel_login:
            return payload
        catalog = chat_badges.catalog_for_channel(
            channel_id,
            channel_login,
            chat_capture._TWITCH_CLIENT_ID,
        )
        resolved = chat_badges.enrich_messages(payload.get("messages") or [], catalog)
        payload["twitchBadgeArtwork"] = resolved
        log.info(
            "chat badges vod=%s channel=%s catalog=%s resolved=%s",
            video_id,
            channel_login or channel_id,
            len(catalog),
            resolved,
        )
    except Exception:
        log.exception("Twitch badge enrichment failed for vod=%s", video_id)
    return payload


def _enrich_paints(payload: dict) -> dict:
    try:
        payload = chat_paints.apply(payload)
        log.info(
            "7TV paints messages=%s users=%s",
            payload.get("sevenTvPaints", 0),
            payload.get("sevenTvPaintUsers", 0),
        )
    except Exception:
        log.exception("7TV paint enrichment failed")
    return payload


def _enrich_7tv_badges(payload: dict) -> dict:
    try:
        payload = chat_7tv_badges.apply(payload)
        log.info(
            "7TV badges messages=%s users=%s",
            payload.get("sevenTvBadges", 0),
            payload.get("sevenTvBadgeUsers", 0),
        )
    except Exception:
        log.exception("7TV badge enrichment failed")
    return payload


def _prepare_payload(payload: dict, req: ChatCaptureRequest) -> dict:
    payload = _enrich_emotes(payload)
    payload = _enrich_badges(payload)
    payload = chat_filters.apply(payload, hide_bots=req.hideBots)
    payload = chat_edits.apply(
        payload,
        hidden_ids=req.hiddenMessageIds,
        highlighted_ids=req.highlightedMessageIds,
        only_message_id=req.onlyMessageId,
    )
    payload = _enrich_paints(payload)
    payload = _enrich_7tv_badges(payload)
    payload = chat_events.apply(payload)
    payload = chat_timing.apply(payload, req.timingMode)
    return payload


def _section(req: ChatCaptureRequest) -> tuple[float, float]:
    try:
        section = timecode.parse_section(req.start, req.end)
    except ValueError as exc:
        raise errors.FetcherError(errors.INVALID_SECTION, detail=str(exc)) from exc
    if section is None or section[1] >= 10 ** 9:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="choose both a start and end time for chat capture",
        )
    return section


def _render_worker(job, req: ChatExportRequest, section: tuple[float, float]) -> None:
    try:
        job.status = jobstate.PROCESSING
        job.stage = "reading chat"
        job.progress = 1.0
        payload = chat_capture.fetch_twitch_chat(req.url, section[0], section[1])
        if job.cancel_event.is_set():
            raise JobCancelled()

        job.stage = "resolving emotes"
        job.progress = 3.0
        payload = _prepare_payload(payload, req)
        output, filename, media_type = chat_export_styled.render(
            payload,
            job,
            req.format,
            req.resolution,
            req.fps,
            visual_look=req.visualLook,
            chat_layout=req.chatLayout,
            chat_look=req.chatLook,
            entry_animation=req.entryAnimation,
            stack_motion=req.stackMotion,
            chat_font=req.chatFont,
            bubble_width=req.bubbleWidth,
            bubble_gap=req.bubbleGap,
            bubble_scale=req.bubbleScale,
            message_ttl=req.messageLifetime,
            max_visible=req.maxVisible,
            canvas_mode=req.canvasMode,
            canvas_aspect=req.canvasAspect,
            canvas_padding=req.canvasPadding,
            sound_preset=req.soundPreset,
            sound_volume=req.soundVolume,
            sound_min_gap_ms=req.soundMinGapMs,
            sound_data=req.soundData,
        )
        store.finalize(job, output, filename, media_type, title="Twitch chat overlay")
        log.info(
            "chat export job %s ready: %s (abandoned-file ttl=%ss)",
            job.id,
            filename,
            job.retention_seconds or config.JOB_TTL_SECONDS,
        )
    except JobCancelled:
        log.info("chat export job %s cancelled", job.id)
        store.mark_failed(job, jobstate.CANCELLED)
    except errors.FetcherError as err:
        log.info("chat export job %s error %s: %s", job.id, err.code, err.detail or err.message)
        store.mark_failed(job, jobstate.ERROR, err.code, err.message)
    except Exception:
        log.exception("chat export job %s failed", job.id)
        store.mark_failed(job, jobstate.ERROR, errors.BACKEND_ERROR, errors.FRIENDLY[errors.BACKEND_ERROR])
    finally:
        _render_gate.release()


def register(app) -> None:
    if getattr(app.state, "fetcher_chat_registered", False):
        return
    app.state.fetcher_chat_registered = True

    @app.post("/api/chat/twitch")
    def twitch_chat(req: ChatCaptureRequest, request: Request):
        key = _client_key(request)
        if not _chat_window.allow(key):
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": "30"},
                content={"error": {"code": "busy", "message": "too many chat captures at once. give fetcher a moment."}},
            )
        try:
            section = _section(req)
            payload = chat_capture.fetch_twitch_chat(req.url, section[0], section[1])
            return _prepare_payload(payload, req)
        except errors.FetcherError as err:
            return _error(err)

    @app.post("/api/chat/export")
    def twitch_chat_export(req: ChatExportRequest, request: Request):
        key = _client_key(request)
        if not _export_window.allow(key):
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": "60"},
                content={"error": {"code": "busy", "message": "easy there — give chat export a minute before starting another render."}},
            )
        try:
            section = _section(req)
            duration = section[1] - section[0]
            chat_export.validate_request(req.format, req.resolution, req.fps, duration)
            if req.soundPreset == "custom" and not req.soundData:
                raise errors.FetcherError(
                    errors.INVALID_SECTION,
                    message="choose a custom message sound first, or turn message sound off",
                )
        except errors.FetcherError as err:
            return _error(err)

        if not _render_gate.acquire(blocking=False):
            return JSONResponse(
                status_code=503,
                headers={"Retry-After": "20"},
                content={"error": {"code": "busy", "message": "another chat overlay is rendering right now — try again in a moment."}},
            )

        try:
            job = store.create()
            job.mode = "video"
            job.section = section
            job.retention_seconds = config.CHAT_EXPORT_TTL_SECONDS
            job.delivery_timeout_seconds = config.DELIVERY_TTL_SECONDS
            job.status = jobstate.PROCESSING
            job.stage = "queued"
            thread = threading.Thread(
                target=_render_worker,
                args=(job, req, section),
                name=f"fetcher-chat-export-{job.id[:8]}",
                daemon=True,
            )
            thread.start()
        except Exception:
            _render_gate.release()
            log.exception("failed to start chat export")
            return _error(errors.FetcherError(errors.BACKEND_ERROR))

        return {
            "jobId": job.id,
            "format": req.format,
            "resolution": req.resolution,
            "fps": req.fps,
            "maxDurationSeconds": chat_export_policy.MAX_CHAT_EXPORT_SECONDS,
            "abandonedTtlSeconds": config.CHAT_EXPORT_TTL_SECONDS,
        }

    @app.get("/api/chat/download/{job_id}")
    def twitch_chat_download(job_id: str):
        job = store.get(job_id)
        if job is None or not job.ready:
            return _error(errors.FetcherError(errors.JOB_NOT_FOUND))
        if not store.begin_delivery(job):
            return _error(errors.FetcherError(errors.JOB_NOT_FOUND))
        cleanup = BackgroundTask(store.remove, job.id)
        return FileResponse(
            path=str(job.filepath),
            media_type=job.media_type or "application/octet-stream",
            filename=job.filename,
            headers={"Cache-Control": "no-store"},
            background=cleanup,
        )
