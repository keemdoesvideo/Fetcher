"""Fetcher FastAPI app.

Serves the frontend and the prepare/download flow from a single origin. Frontend
files are served from a strict allowlist; backend source and temp job directories
are never reachable over HTTP.
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from . import config, diagnostics, downloader, errors, limits, preview, timecode, visits
from . import jobs as jobstate
from .jobs import JobCancelled, StaleSweeper, store
from .models import PrepareRequest, PreviewRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fetcher.app")

ALLOWED_ASSETS: dict[str, str] = {
    "project-fetcher.html": "text/html; charset=utf-8",
    "image.html": "text/html; charset=utf-8",
    "chat.html": "text/html; charset=utf-8",
    "settings.html": "text/html; charset=utf-8",
    "donate.html": "text/html; charset=utf-8",
    "about.html": "text/html; charset=utf-8",
    "updates.html": "text/html; charset=utf-8",
    "fetcher-theme.css": "text/css; charset=utf-8",
    "fetcher-shell.css": "text/css; charset=utf-8",
    "fetcher-main.css": "text/css; charset=utf-8",
    "fetcher-settings.css": "text/css; charset=utf-8",
    "fetcher-trimmer.css": "text/css; charset=utf-8",
    "fetcher-launch.css": "text/css; charset=utf-8",
    "fetcher-prefs.js": "application/javascript; charset=utf-8",
    "fetcher-nav.js": "application/javascript; charset=utf-8",
    "fetcher-main.js": "application/javascript; charset=utf-8",
    "fetcher-settings.js": "application/javascript; charset=utf-8",
    "fetcher-trimmer.js": "application/javascript; charset=utf-8",
    "fetcher-launch.js": "application/javascript; charset=utf-8",
    "fetcher-ailincia.js": "application/javascript; charset=utf-8",
    "fetcher-vitaviita.js": "application/javascript; charset=utf-8",
    "fetcher-suki.js": "application/javascript; charset=utf-8",
    "fetcher-wahibah.js": "application/javascript; charset=utf-8",
    "fetcher-stonakah.js": "application/javascript; charset=utf-8",
    "fetcher-kaywordley.js": "application/javascript; charset=utf-8",
    "fetcher-jackigoe.js": "application/javascript; charset=utf-8",
    "fetcher-deenapie.js": "application/javascript; charset=utf-8",
    "fetcher-turnuptaco.js": "application/javascript; charset=utf-8",
    "fetcher-iaar.js": "application/javascript; charset=utf-8",
    "fetcher-melisae.js": "application/javascript; charset=utf-8",
    "fetcher-luumi.js": "application/javascript; charset=utf-8",
    "fetcher-shanjuanita.js": "application/javascript; charset=utf-8",
    "fetcher-favicon.svg": "image/svg+xml",
    "apple-touch-icon.png": "image/png",
    "fetcher-social-card.png": "image/png",
    "site.webmanifest": "application/manifest+json",
    "paw-cursor-light.svg": "image/svg+xml",
    "paw-cursor-dark.svg": "image/svg+xml",
    "hls.min.js": "application/javascript; charset=utf-8",
    "found-you.mp3": "audio/mpeg",
}

_sweeper = StaleSweeper(
    store, config.SWEEP_INTERVAL_SECONDS, config.JOB_TTL_SECONDS, logger=log
)
_visits = visits.VisitCounter(config.VISITS_FILE)

# Public-instance protection. These limits are in-memory only and reset whenever
# Fetcher restarts. They exist to stop one browser from consuming the whole Mac.
_fetch_gate = limits.FetchGate(
    max_global=4,
    max_per_client=2,
    max_starts=20,
    window_seconds=10 * 60,
)
_preview_window = limits.RequestWindow(max_requests=24, window_seconds=5 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    report = diagnostics.run_diagnostics()
    print(diagnostics.format_banner(report))
    if not report["ok"]:
        log.warning(
            "Fetcher started with unmet dependencies — fetches will return a setup "
            "error until the items above are fixed."
        )
    store.purge_all()
    _sweeper.start()
    log.info("Fetcher listening on http://%s:%s/", config.HOST, config.PORT)
    try:
        yield
    finally:
        _sweeper.stop()
        store.purge_all()


app = FastAPI(title="Fetcher", version="0.2.0", lifespan=lifespan)


def _error_response(err: errors.FetcherError) -> JSONResponse:
    log.info("client error %s: %s", err.code, err.detail or err.message)
    return JSONResponse(status_code=err.http_status, content=err.to_public())


def _client_key(request: Request) -> str:
    """Best-effort client key for in-memory limits.

    In production Caddy talks to FastAPI over localhost, so X-Forwarded-For is
    trusted only when the direct peer is loopback. Direct local development uses
    request.client.host normally.
    """
    direct = request.client.host if request.client else "unknown"
    if direct in {"127.0.0.1", "::1"}:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded[:96]
    return (direct or "unknown")[:96]


def _busy_response(reason: str | None) -> JSONResponse:
    if reason == "client":
        message = "you already have two fetches running. let those finish first."
        status, retry = 429, "20"
    elif reason == "rate":
        message = "easy there — give fetcher a minute before starting more downloads."
        status, retry = 429, "60"
    else:
        message = "fetcher is busy fetching for other people. try again in a moment."
        status, retry = 503, "20"
    return JSONResponse(
        status_code=status,
        headers={"Retry-After": retry},
        content={"error": {"code": "busy", "message": message}},
    )


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError):
    return _error_response(errors.FetcherError(errors.INVALID_URL, detail=str(exc)))


# --- API -------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return diagnostics.run_diagnostics()


class VisitClaim(BaseModel):
    token: str = ""


@app.get("/api/visits")
async def visits_total():
    return {"count": _visits.total(), "capacity": config.WELCOME_CAPACITY}


@app.post("/api/visits/claim")
async def visits_claim(req: VisitClaim):
    number, total = _visits.claim(req.token)
    return {
        "number": number,
        "total": total,
        "capacity": config.WELCOME_CAPACITY,
        "withinFirst": number <= config.WELCOME_CAPACITY,
    }


def _run_job(job, url: str, mode: str, preferences, client_key: str) -> None:
    def _on_timeout():
        job.timed_out = True
        job.cancel_event.set()

    timer = threading.Timer(job.timeout or config.PREPARE_TIMEOUT_SECONDS, _on_timeout)
    timer.daemon = True
    timer.start()
    try:
        result = downloader.prepare_media(url, mode, preferences, job)
        store.finalize(job, result.filepath, result.filename, result.media_type, result.title)
        log.info("job %s ready: %s", job.id, result.filename)
    except JobCancelled:
        if job.timed_out:
            log.info("job %s timed out", job.id)
            store.mark_failed(job, jobstate.ERROR, errors.TIMEOUT, errors.FRIENDLY[errors.TIMEOUT])
        else:
            log.info("job %s cancelled by client", job.id)
            store.mark_failed(job, jobstate.CANCELLED)
    except errors.FetcherError as err:
        if job.timed_out:
            store.mark_failed(job, jobstate.ERROR, errors.TIMEOUT, errors.FRIENDLY[errors.TIMEOUT])
        else:
            log.info("job %s error %s: %s", job.id, err.code, err.detail or err.message)
            store.mark_failed(job, jobstate.ERROR, err.code, err.message)
    except Exception:
        log.exception("job %s failed unexpectedly", job.id)
        store.mark_failed(
            job, jobstate.ERROR, errors.BACKEND_ERROR, errors.FRIENDLY[errors.BACKEND_ERROR]
        )
    finally:
        timer.cancel()
        _fetch_gate.release(client_key)


@app.get("/api/detect")
async def detect(url: str = ""):
    provider = downloader.detect(url)
    if provider is None:
        return {"supported": False, "provider": None, "modes": [], "longForm": False}
    return {
        "supported": True,
        "provider": provider.name,
        "modes": sorted(provider.MODES),
        "longForm": provider.long_form(url),
    }


# --- HLS preview proxy (VOD scrub-to-trim) --------------------------------
@app.post("/api/preview")
def preview_open(req: PreviewRequest, request: Request):
    client_key = _client_key(request)
    if not _preview_window.allow(client_key):
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": "30"},
            content={
                "error": {
                    "code": "busy",
                    "message": "too many previews at once. give fetcher a moment.",
                }
            },
        )
    try:
        provider = downloader.resolve_provider(req.url)
        if not provider.long_form(req.url):
            raise errors.FetcherError(
                errors.MEDIA_UNAVAILABLE, detail="preview is only for long-form sources"
            )
        info = preview.resolve(req.url)
    except errors.FetcherError as err:
        return _error_response(err)
    info["playlist"] = f"/api/preview/{info['previewId']}/index.m3u8"
    return info


@app.get("/api/preview/{pid}/index.m3u8")
def preview_playlist(pid: str):
    text = preview.proxy_playlist(pid)
    if text is None:
        return _error_response(errors.FetcherError(errors.JOB_NOT_FOUND))
    return Response(
        content=text,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/preview/{pid}/seg/{name}")
def preview_segment(pid: str, name: str):
    result = preview.proxy_segment(pid, name)
    if result is None:
        return _error_response(errors.FetcherError(errors.JOB_NOT_FOUND))
    chunks, media_type = result
    return StreamingResponse(
        chunks, media_type=media_type, headers={"Cache-Control": "no-store"}
    )


@app.post("/api/prepare")
async def prepare(req: PrepareRequest, request: Request):
    try:
        provider = downloader.resolve_provider(req.url)
        if not provider.supports(req.mode):
            raise errors.FetcherError(errors.MODE_UNSUPPORTED)
        try:
            section = timecode.parse_section(req.start, req.end)
        except ValueError as exc:
            raise errors.FetcherError(errors.INVALID_SECTION, detail=str(exc))
    except errors.FetcherError as err:
        return _error_response(err)

    client_key = _client_key(request)
    accepted, reason = _fetch_gate.acquire(client_key)
    if not accepted:
        return _busy_response(reason)

    try:
        job = store.create()
        job.mode = req.mode
        job.section = section
        job.timeout = (
            config.LONG_TIMEOUT_SECONDS
            if (section is None and provider.long_form(req.url))
            else config.PREPARE_TIMEOUT_SECONDS
        )
        worker = threading.Thread(
            target=_run_job,
            args=(job, req.url, req.mode, req.preferences, client_key),
            name=f"fetcher-job-{job.id[:8]}",
            daemon=True,
        )
        worker.start()
    except Exception:
        _fetch_gate.release(client_key)
        log.exception("failed to start fetch job")
        return _error_response(errors.FetcherError(errors.BACKEND_ERROR))

    return {"jobId": job.id, "mode": req.mode}


@app.get("/api/progress/{job_id}")
async def progress(job_id: str):
    job = store.get(job_id)
    if job is None:
        return _error_response(errors.FetcherError(errors.JOB_NOT_FOUND))
    body = {
        "status": job.status,
        "stage": job.stage,
        "progress": round(job.progress, 1),
        "mode": job.mode,
    }
    if job.status == jobstate.READY:
        body["filename"] = job.filename
    elif job.status == jobstate.ERROR:
        body["error"] = {"code": job.error_code, "message": job.error_message}
    return body


@app.post("/api/cancel/{job_id}")
async def cancel(job_id: str):
    job = store.get(job_id)
    if job is not None and job.status not in jobstate.TERMINAL:
        job.cancel_event.set()
        log.info("cancel requested for job %s", job_id)
    return {"ok": True}


@app.get("/api/download/{job_id}")
async def download(job_id: str):
    job = store.get(job_id)
    if job is None or not job.ready:
        return _error_response(errors.FetcherError(errors.JOB_NOT_FOUND))

    cleanup = BackgroundTask(store.remove, job.id)
    return FileResponse(
        path=str(job.filepath),
        media_type=job.media_type or "application/octet-stream",
        filename=job.filename,
        background=cleanup,
    )


# --- Frontend ---------------------------------------------------------------
_NO_CACHE = {"Cache-Control": "no-cache"}
_FAVICON_LINK = '<link rel="icon" type="image/svg+xml" href="/fetcher-favicon.svg">'
_LAUNCH_HEAD = """
<meta name="description" content="Fetcher is a small, free media tool by Hahkeemi. Paste a link, choose video or audio, and save it cleanly.">
<meta name="theme-color" content="#F2F0EA" id="fetcher-theme-color">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Fetcher">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="canonical" href="https://fetcher.hahkeemi.com/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fetcher">
<meta property="og:title" content="Fetcher — paste. pick. fetch.">
<meta property="og:description" content="Save video and audio without the clutter. A small free tool by Hahkeemi.">
<meta property="og:url" content="https://fetcher.hahkeemi.com/">
<meta property="og:image" content="https://fetcher.hahkeemi.com/fetcher-social-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Fetcher — paste. pick. fetch. by Hahkeemi">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Fetcher — paste. pick. fetch.">
<meta name="twitter:description" content="Save video and audio without the clutter. A small free tool by Hahkeemi.">
<meta name="twitter:image" content="https://fetcher.hahkeemi.com/fetcher-social-card.png">
<link rel="stylesheet" href="/fetcher-launch.css">
<script defer src="/fetcher-launch.js"></script>
<script defer src="/fetcher-ailincia.js"></script>
<script defer src="/fetcher-vitaviita.js"></script>
<script defer src="/fetcher-suki.js"></script>
<script defer src="/fetcher-wahibah.js"></script>
<script defer src="/fetcher-stonakah.js"></script>
<script defer src="/fetcher-kaywordley.js"></script>
<script defer src="/fetcher-jackigoe.js"></script>
<script defer src="/fetcher-deenapie.js"></script>
<script defer src="/fetcher-turnuptaco.js"></script>
<script defer src="/fetcher-iaar.js"></script>
<script defer src="/fetcher-melisae.js"></script>
<script defer src="/fetcher-luumi.js"></script>
<script defer src="/fetcher-shanjuanita.js"></script>
""".strip()


def _render_html(filename: str, status_code: int = 200) -> Response:
    text = (config.PROJECT_ROOT / filename).read_text(encoding="utf-8")

    favicon_start = text.find('<link rel="icon"')
    if favicon_start >= 0:
        favicon_end = text.find('>', favicon_start)
        if favicon_end >= 0:
            text = text[:favicon_start] + _FAVICON_LINK + text[favicon_end + 1 :]

    # The old Ko-fi placeholder survives only in the two intentionally
    # coming-soon pages. Keep those designs frozen while fixing the destination.
    text = text.replace("https://ko-fi.com/keemdoesvideo", "https://ko-fi.com/hahkeemi")

    if 'id="fetcher-theme-color"' not in text:
        head_end = text.find("</head>")
        if head_end >= 0:
            text = text[:head_end] + _LAUNCH_HEAD + "\n" + text[head_end:]

    return Response(
        content=text,
        media_type="text/html; charset=utf-8",
        headers=_NO_CACHE,
        status_code=status_code,
    )


@app.get("/")
async def index():
    return _render_html("project-fetcher.html")


@app.get("/{asset:path}")
async def asset(asset: str):
    media_type = ALLOWED_ASSETS.get(asset)
    if media_type is not None:
        if media_type.startswith("text/html"):
            return _render_html(asset)
        return FileResponse(
            str(config.PROJECT_ROOT / asset), media_type=media_type, headers=_NO_CACHE
        )

    # Keep unknown API paths machine-readable while human-facing bad links get
    # Fetcher's branded 404 page.
    if asset == "api" or asset.startswith("api/"):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "not_found", "message": "not found"}},
        )
    return _render_html("404.html", status_code=404)
