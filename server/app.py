"""Fetcher FastAPI app.

Serves the existing frontend and the real prepare/download flow from a single
local origin (so there's no CORS to configure). The frontend is served from a
strict allowlist — the backend source and the temp job directories are never
reachable over HTTP.

Endpoints:
  GET  /                      -> the Fetch page (project-fetcher.html)
  GET  /<allowed asset>       -> css/js/settings.html (allowlist only)
  GET  /api/health           -> environment diagnostics
  POST /api/prepare          -> prepare media, return {jobId, filename, mode}
  GET  /api/download/{jobId} -> stream the prepared file, then clean it up
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

from . import config, diagnostics, downloader, errors
from . import jobs as jobstate
from .jobs import JobCancelled, StaleSweeper, store
from .models import PrepareRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fetcher.app")

# The only files reachable over HTTP, with their content types.
ALLOWED_ASSETS: dict[str, str] = {
    "project-fetcher.html": "text/html; charset=utf-8",
    "settings.html": "text/html; charset=utf-8",
    "fetcher-theme.css": "text/css; charset=utf-8",
    "fetcher-prefs.js": "application/javascript; charset=utf-8",
}

_sweeper = StaleSweeper(
    store, config.SWEEP_INTERVAL_SECONDS, config.JOB_TTL_SECONDS, logger=log
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    report = diagnostics.run_diagnostics()
    print(diagnostics.format_banner(report))
    if not report["ok"]:
        log.warning("Fetcher started with unmet dependencies — fetches will return "
                    "a setup error until the items above are fixed.")
    # A previous crashed run could leave orphaned temp dirs; start clean.
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
    # Log the technical detail; return only the friendly shape.
    log.info("client error %s: %s", err.code, err.detail or err.message)
    return JSONResponse(status_code=err.http_status, content=err.to_public())


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError):
    # A malformed request body (e.g. missing/empty url) becomes our friendly
    # invalid-url shape rather than FastAPI's raw validation dump.
    return _error_response(errors.FetcherError(errors.INVALID_URL, detail=str(exc)))


# --- API -------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return diagnostics.run_diagnostics()


def _run_job(job, url: str, mode: str, preferences) -> None:
    """Background worker: the actual yt-dlp download + FFmpeg step. Runs in its
    own thread so /api/prepare can return immediately and the client can poll
    progress. A watchdog enforces the prepare timeout by requesting cancellation
    (flagged as a timeout so the outcome is reported correctly)."""
    def _on_timeout():
        job.timed_out = True
        job.cancel_event.set()

    timer = threading.Timer(config.PREPARE_TIMEOUT_SECONDS, _on_timeout)
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
    except Exception as exc:  # pragma: no cover - unexpected
        log.exception("job %s failed unexpectedly", job.id)
        store.mark_failed(job, jobstate.ERROR, errors.BACKEND_ERROR,
                          errors.FRIENDLY[errors.BACKEND_ERROR])
    finally:
        timer.cancel()


@app.post("/api/prepare")
async def prepare(req: PrepareRequest):
    # Reject obviously-bad input synchronously (fast, no worker thread) so the
    # client hears about a non-YouTube or malformed URL immediately.
    try:
        downloader.check_supported(req.url)
    except errors.FetcherError as err:
        return _error_response(err)

    job = store.create()
    job.mode = req.mode
    threading.Thread(
        target=_run_job,
        args=(job, req.url, req.mode, req.preferences),
        name=f"fetcher-job-{job.id[:8]}",
        daemon=True,
    ).start()
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

    # Delete the whole job directory once the response has finished streaming —
    # media is never kept permanently. Abandoned jobs are caught by the sweeper.
    cleanup = BackgroundTask(store.remove, job.id)
    return FileResponse(
        path=str(job.filepath),
        media_type=job.media_type or "application/octet-stream",
        filename=job.filename,          # Starlette adds RFC 5987 encoding for us
        background=cleanup,
    )


# --- Frontend (allowlist only) --------------------------------------------
# Dev tool: never let the browser cache the frontend, so edits (and removals,
# like the mascot) always show up on a plain reload — no stale-cache surprises.
_NO_CACHE = {"Cache-Control": "no-store, max-age=0"}


@app.get("/")
async def index():
    return FileResponse(
        str(config.PROJECT_ROOT / "project-fetcher.html"),
        media_type="text/html; charset=utf-8",
        headers=_NO_CACHE,
    )


@app.get("/{asset}")
async def asset(asset: str):
    media_type = ALLOWED_ASSETS.get(asset)
    if media_type is None:
        return JSONResponse(status_code=404, content={"error": {"code": "not_found",
                                                                 "message": "not found"}})
    return FileResponse(str(config.PROJECT_ROOT / asset), media_type=media_type,
                        headers=_NO_CACHE)
