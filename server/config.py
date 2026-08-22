"""Runtime configuration for the Fetcher backend.

Everything here is dev-oriented and overridable via environment variables so
the defaults stay sane without a config file. Keeping it in one module means
the rest of the backend never reaches for os.environ directly.
"""

from __future__ import annotations

import os
from pathlib import Path

# --- Paths -----------------------------------------------------------------
# The frontend lives one level up from this package (the Fetcher project root).
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent

# Per-job temp working directories live here. Gitignored — never committed,
# never permanent. Each fetch gets its own uuid subdirectory underneath.
TEMP_ROOT: Path = Path(
    os.environ.get("FETCHER_TEMP_ROOT", str(PROJECT_ROOT / ".fetcher-tmp"))
)

# --- Server ----------------------------------------------------------------
HOST: str = os.environ.get("FETCHER_HOST", "127.0.0.1")
PORT: int = int(os.environ.get("FETCHER_PORT", "8765"))

# --- yt-dlp / FFmpeg -------------------------------------------------------
# Optional explicit FFmpeg location. When unset, yt-dlp (and our diagnostics)
# discover ffmpeg on PATH. Point this at a folder or the binary itself to
# override — useful if FFmpeg isn't on PATH.
FFMPEG_LOCATION: str | None = os.environ.get("FETCHER_FFMPEG_LOCATION") or None

# JavaScript runtimes yt-dlp may use for YouTube extraction (its supported EJS
# mechanism — modern YouTube needs one to solve player challenges). We enable
# the common ones and let yt-dlp pick whichever is actually installed; Deno is
# yt-dlp's own default, Node is ubiquitous. Override with a comma-separated list.
JS_RUNTIMES: list[str] = [
    r.strip().lower()
    for r in os.environ.get("FETCHER_JS_RUNTIMES", "node,deno").split(",")
    if r.strip()
]

# --- Login cookies (opt-in; only used by providers that need it, e.g. Instagram)
# yt-dlp's supported mechanisms — nothing is stored in the repo. Set ONE of:
#   FETCHER_COOKIES_FROM_BROWSER = chrome | firefox | edge | brave  (optionally
#       "chrome:Profile 1" for a specific profile) — reads the session from a
#       browser you're already logged into.
#   FETCHER_COOKIES_FILE = C:\path\to\cookies.txt  — an exported cookies file.
COOKIES_FROM_BROWSER: str | None = os.environ.get("FETCHER_COOKIES_FROM_BROWSER") or None
COOKIES_FILE: str | None = os.environ.get("FETCHER_COOKIES_FILE") or None

# --- Job lifecycle ---------------------------------------------------------
# How long a prepared job may sit before the stale sweeper reclaims it. Covers
# abandoned downloads (user closed the tab before the browser fetched the file).
JOB_TTL_SECONDS: int = int(os.environ.get("FETCHER_JOB_TTL", str(30 * 60)))

# How often the background sweeper runs.
SWEEP_INTERVAL_SECONDS: int = int(os.environ.get("FETCHER_SWEEP_INTERVAL", str(5 * 60)))

# Hard ceiling on a single prepare (extraction + download + merge/transcode)
# before we give up and return a friendly timeout error. Generous enough for a
# large 4K merge on a home connection.
PREPARE_TIMEOUT_SECONDS: int = int(os.environ.get("FETCHER_PREPARE_TIMEOUT", str(6 * 60)))

# A generous ceiling for long-form full downloads (e.g. a whole Twitch VOD, which
# can run to hours / many GB). Used only when no section trim is requested.
LONG_TIMEOUT_SECONDS: int = int(os.environ.get("FETCHER_LONG_TIMEOUT", str(45 * 60)))

# Longest filename (without extension) we'll hand back to the browser.
MAX_FILENAME_STEM: int = 120
