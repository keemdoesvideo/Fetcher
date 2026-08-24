"""Fetcher FastAPI app.

Serves the existing frontend and the real prepare/download flow from a single
local origin (so there's no CORS to configure). The frontend is served from a
strict allowlist — the backend source and the temp job directories are never
reachable over HTTP.

Endpoints:
  GET  /                      -> the Fetch page (project-fetcher.html)
  GET  /<allowed asset>       -> allowlisted frontend assets only
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
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from . import config, diagnostics, downloader, errors, preview, timecode, visits
from . import jobs as jobstate
from .jobs import JobCancelled, StaleSweeper, store
from .models import PrepareRequest, PreviewRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fetcher.app")

# The only files reachable over HTTP, with their content types. Shell styling and
# cursor artwork are ordinary static assets now; navigation JS no longer embeds
# either of them as generated data.
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
    "fetcher-prefs.js": "application/javascript; charset=utf-8",
    "fetcher-nav.js": "application/javascript; charset=utf-8",
    "fetcher-main.js": "application/javascript; charset=utf-8",
    "fetcher-settings.js": "application/javascript; charset=utf-8",
    "fetcher-trimmer.js": "application/javascript; charset=utf-8",
    "paw-cursor-light.svg": "image/svg+xml",
    "paw-cursor-dark.svg": "image/svg+xml",
    "hls.min.js": "application/javascript; charset=utf-8",
    "found-you.mp3": "audio/mpeg",
}

_sweeper = StaleSweeper(
    store, config.SWEEP_INTERVAL_SECONDS, config.JOB_TTL_SECONDS, logger=log
)

# Persistent visitor counter (welcome card + About stats).
_visits = visits.VisitCounter(config.VISITS_FILE)


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


@app.exception_handler(errors.FetcherError)
async def _handle_fetcher_error(_request: Request, exc: errors.FetcherError):
    return _error_response(exc)


@app.exception_handler(RequestValidationError)
async def _handle_validation_error(_request: Request, exc: RequestValidationError):
    log.info("validation error: %s", exc)
    return _error_response(errors.InvalidRequestError())


@app.exception_handler(Exception)
async def _handle_unexpected(_request: Request, exc: Exception):
    log.exception("unexpected server error")
    return _error_response(errors.UnexpectedFetcherError())


@app.get("/api/health")
def health():
    return diagnostics.run_diagnostics()


@app.post("/api/prepare")
def prepare(request: PrepareRequest):
    job = store.create()

    def worker():
        try:
            downloader.prepare(job, request)
        except JobCancelled:
            store.mark_cancelled(job)
        except errors.FetcherError as exc:
            store.mark_error(job, exc)
        except Exception as exc:
            log.exception("prepare worker failed for job %s", job.id)
            store.mark_error(job, errors.UnexpectedFetcherError(detail=str(exc)))

    thread = threading.Thread(target=worker, name=f"fetcher-job-{job.id[:8]}", daemon=True)
    thread.start()
    return {"jobId": job.id, "filename": None, "mode": request.mode}


@app.get("/api/progress/{job_id}")
def progress(job_id: str):
    job = store.get(job_id)
    if not job:
        raise errors.JobNotFoundError()
    return jobstate.public_progress(job)


@app.post("/api/cancel/{job_id}")
def cancel(job_id: str):
    job = store.get(job_id)
    if not job:
        raise errors.JobNotFoundError()
    store.cancel(job)
    return {"ok": True}


@app.get("/api/download/{job_id}")
def download(job_id: str):
    job = store.get(job_id)
    if not job:
        raise errors.JobNotFoundError()
    if job.status != "ready" or not job.output_path or not job.output_path.exists():
        raise errors.JobNotReadyError()
    path = job.output_path
    filename = job.filename or path.name
    return StreamingResponse(
        downloader.stream_and_cleanup(job, path),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/detect")
def detect(url: str):
    return downloader.detect(url)


@app.post("/api/preview")
def create_preview(request: PreviewRequest):
    return preview.create(request)


@app.get("/api/preview/{preview_id}/manifest")
def preview_manifest(preview_id: str):
    return preview.manifest(preview_id)


@app.get("/api/preview/{preview_id}/{segment}")
def preview_segment(preview_id: str, segment: str):
    return preview.segment(preview_id, segment)


@app.delete("/api/preview/{preview_id}")
def delete_preview(preview_id: str):
    preview.delete(preview_id)
    return Response(status_code=204)


@app.post("/api/visits/claim")
def claim_visit(request: visits.VisitClaim):
    return _visits.claim(request.token)


@app.get("/api/visits/stats")
def visit_stats():
    return _visits.stats()


@app.get("/")
def root():
    return FileResponse(config.PROJECT_ROOT / "project-fetcher.html")


@app.get("/{asset_name}")
def asset(asset_name: str):
    media_type = ALLOWED_ASSETS.get(asset_name)
    if not media_type:
        return Response(status_code=404)
    return FileResponse(config.PROJECT_ROOT / asset_name, media_type=media_type)
