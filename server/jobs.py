"""Temporary per-fetch job storage.

Every fetch gets its own uuid working directory under TEMP_ROOT so concurrent
downloads can never clobber one another. A job holds the prepared file until the
browser streams it, after which it's deleted. A background sweeper reclaims
abandoned jobs (tab closed before the download started) once they age past the
TTL. Nothing here is persisted — media is never kept permanently.
"""

from __future__ import annotations

import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from . import config


class JobCancelled(Exception):
    """Raised from inside yt-dlp's progress hooks to abort a running job when
    the client cancels or the job times out."""


# Job status values the frontend polls on. 'preparing' is the brief window
# before the first byte; 'downloading'/'processing' carry a progress %; the rest
# are terminal.
PREPARING = "preparing"
DOWNLOADING = "downloading"
PROCESSING = "processing"   # FFmpeg merge (video) / convert (audio)
READY = "ready"
ERROR = "error"
CANCELLED = "cancelled"

TERMINAL = {READY, ERROR, CANCELLED}


@dataclass
class Job:
    id: str
    dir: Path
    created_at: float = field(default_factory=time.time)

    # Live state polled via /api/progress.
    status: str = PREPARING
    progress: float = 0.0             # 0..100 for the active download phase
    stage: str = "starting"          # short human label, e.g. "downloading", "merging"
    mode: Optional[str] = None        # video | audio

    # Set on terminal failure (friendly, client-safe).
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # Optional (start, end) seconds for a section trim; None = whole media.
    section: Optional[tuple[float, float]] = None
    # Per-job prepare timeout (long-form full downloads get a longer one).
    timeout: Optional[float] = None

    # Cancellation / timeout signalling.
    cancel_event: threading.Event = field(default_factory=threading.Event)
    timed_out: bool = False

    # Populated once the media is prepared and ready to stream.
    filepath: Optional[Path] = None   # absolute path to the prepared file on disk
    filename: Optional[str] = None    # sanitized, user-facing download name
    media_type: Optional[str] = None  # e.g. video/mp4, audio/mpeg
    title: Optional[str] = None

    @property
    def ready(self) -> bool:
        return (
            self.status == READY
            and self.filepath is not None
            and self.filepath.is_file()
        )


class JobStore:
    """Thread-safe registry of active jobs plus their on-disk directories."""

    def __init__(self, temp_root: Path):
        self._temp_root = temp_root
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._temp_root.mkdir(parents=True, exist_ok=True)

    # --- lifecycle ---------------------------------------------------------
    def create(self) -> Job:
        """Allocate a job and a fresh, isolated working directory for it."""
        job_id = uuid.uuid4().hex
        job_dir = self._temp_root / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        job = Job(id=job_id, dir=job_dir)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        # Guard against anything that isn't a plain uuid hex — no path parts.
        if not job_id or not job_id.isalnum():
            return None
        with self._lock:
            return self._jobs.get(job_id)

    def finalize(self, job: Job, filepath: Path, filename: str, media_type: str,
                 title: Optional[str] = None) -> None:
        job.filepath = filepath
        job.filename = filename
        job.media_type = media_type
        job.title = title
        job.progress = 100.0
        job.stage = "done"
        job.status = READY

    def mark_failed(self, job: Job, status: str, code: Optional[str] = None,
                    message: Optional[str] = None) -> None:
        """Terminal failure/cancel: record the outcome and delete any partial
        media, but KEEP the job record so /api/progress can report the result.
        The empty record is reclaimed later by the sweeper."""
        job.status = status
        job.error_code = code
        job.error_message = message
        _empty_dir(job.dir)

    def remove(self, job_id: str) -> None:
        """Drop a job from the registry and delete its directory. Safe to call
        more than once and never raises on a missing/half-gone directory."""
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job is not None:
            _safe_rmtree(job.dir)

    # --- maintenance -------------------------------------------------------
    def sweep_stale(self, ttl_seconds: int) -> int:
        """Remove jobs older than ttl_seconds. Returns how many were reclaimed."""
        now = time.time()
        with self._lock:
            stale = [j for j in self._jobs.values() if now - j.created_at > ttl_seconds]
            for job in stale:
                self._jobs.pop(job.id, None)
        for job in stale:
            _safe_rmtree(job.dir)
        return len(stale)

    def purge_all(self) -> None:
        """Wipe everything — used on clean startup so a crashed previous run
        doesn't leak orphaned directories."""
        with self._lock:
            self._jobs.clear()
        if self._temp_root.exists():
            for child in self._temp_root.iterdir():
                _safe_rmtree(child)

    def active_count(self) -> int:
        with self._lock:
            return len(self._jobs)


def _safe_rmtree(path: Path) -> None:
    try:
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        elif path.exists():
            path.unlink(missing_ok=True)
    except Exception:
        # Best-effort cleanup: a locked file on Windows shouldn't crash a request.
        pass


def _empty_dir(path: Path) -> None:
    """Delete everything inside a directory but leave the directory itself."""
    try:
        if not path.is_dir():
            return
        for child in path.iterdir():
            _safe_rmtree(child)
    except Exception:
        pass


class StaleSweeper:
    """Simple background timer that periodically reclaims stale jobs."""

    def __init__(self, store: JobStore, interval: int, ttl: int, logger=None):
        self._store = store
        self._interval = max(30, interval)
        self._ttl = ttl
        self._logger = logger
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, name="fetcher-sweeper", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.wait(self._interval):
            try:
                reclaimed = self._store.sweep_stale(self._ttl)
                if reclaimed and self._logger:
                    self._logger.info("stale sweeper reclaimed %d job(s)", reclaimed)
            except Exception as exc:  # pragma: no cover
                if self._logger:
                    self._logger.warning("stale sweeper error: %s", exc)


# Module-level singleton used by the app.
store = JobStore(config.TEMP_ROOT)
