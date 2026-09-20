"""HTTP routes for Fetcher's chat-capture beta.

Kept in a small router registrar so the feature can evolve independently of the
core download API while it is experimental.
"""

from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from . import chat_capture, errors, limits, timecode
from .models import ChatCaptureRequest

log = logging.getLogger("fetcher.chat")
_chat_window = limits.RequestWindow(max_requests=12, window_seconds=5 * 60)


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


def register(app) -> None:
    """Attach beta chat endpoints to the main FastAPI app once."""
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
                content={
                    "error": {
                        "code": "busy",
                        "message": "too many chat captures at once. give fetcher a moment.",
                    }
                },
            )
        try:
            section = timecode.parse_section(req.start, req.end)
            if section is None or section[1] >= 10 ** 9:
                raise errors.FetcherError(
                    errors.INVALID_SECTION,
                    message="choose both a start and end time for chat capture",
                )
            return chat_capture.fetch_twitch_chat(req.url, section[0], section[1])
        except ValueError as exc:
            return _error(errors.FetcherError(errors.INVALID_SECTION, detail=str(exc)))
        except errors.FetcherError as err:
            return _error(err)
