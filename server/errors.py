"""Structured, user-safe error handling.

Every failure the API can return is a FetcherError with a stable machine code
and a friendly, Fetcher-voice message. Raw exceptions / stack traces are logged
server-side but never sent to the browser. The frontend only needs the friendly
message (to show under the mascot) and, optionally, the code.
"""

from __future__ import annotations

# Stable error codes. The frontend doesn't branch on these today, but they give
# us a contract for later and keep logs greppable.
INVALID_URL = "invalid_url"
UNSUPPORTED_PROVIDER = "unsupported_provider"
VIDEO_UNAVAILABLE = "video_unavailable"
RESTRICTED = "restricted"
BOT_CHECK = "bot_check"
EXTRACTION_FAILED = "extraction_failed"
MEDIA_UNAVAILABLE = "media_unavailable"
FFMPEG_MISSING = "ffmpeg_missing"
YTDLP_MISSING = "ytdlp_missing"
TIMEOUT = "timeout"
BACKEND_ERROR = "backend_error"
JOB_NOT_FOUND = "job_not_found"

# Friendly, lowercase, Fetcher-voice copy. These are the only strings the UI
# ever shows for an error.
FRIENDLY = {
    INVALID_URL: "that doesn't look like a link fetcher can fetch",
    UNSUPPORTED_PROVIDER: "fetcher only fetches youtube links for now",
    VIDEO_UNAVAILABLE: "that video isn't available — it may be private or removed",
    RESTRICTED: "that one's age- or login-restricted, so fetcher can't reach it",
    BOT_CHECK: "youtube wants to verify fetcher isn't a bot — this video needs extra setup",
    EXTRACTION_FAILED: "fetcher couldn't read that video — give it another try",
    MEDIA_UNAVAILABLE: "that quality isn't available for this video",
    FFMPEG_MISSING: "fetcher's media tools aren't set up yet (ffmpeg is missing)",
    YTDLP_MISSING: "fetcher's downloader isn't set up yet (yt-dlp is missing)",
    TIMEOUT: "that took too long — try again, or pick a lower quality",
    BACKEND_ERROR: "something went wrong on fetcher's end — try again",
    JOB_NOT_FOUND: "that download expired — fetch it again",
}

# HTTP status per code. Client-fixable problems are 4xx; our problems are 5xx.
HTTP_STATUS = {
    INVALID_URL: 400,
    UNSUPPORTED_PROVIDER: 400,
    VIDEO_UNAVAILABLE: 404,
    RESTRICTED: 403,
    BOT_CHECK: 403,
    EXTRACTION_FAILED: 502,
    MEDIA_UNAVAILABLE: 422,
    FFMPEG_MISSING: 503,
    YTDLP_MISSING: 503,
    TIMEOUT: 504,
    BACKEND_ERROR: 500,
    JOB_NOT_FOUND: 404,
}


class FetcherError(Exception):
    """An error safe to surface to the client.

    `code` is one of the constants above; `message` overrides the default
    friendly copy when useful; `detail` is technical context for the server
    log only and is never serialized to the client.
    """

    def __init__(self, code: str, message: str | None = None, detail: str | None = None):
        self.code = code
        self.message = message or FRIENDLY.get(code, FRIENDLY[BACKEND_ERROR])
        self.detail = detail
        super().__init__(self.detail or self.message)

    @property
    def http_status(self) -> int:
        return HTTP_STATUS.get(self.code, 500)

    def to_public(self) -> dict:
        """The only shape that ever reaches the browser."""
        return {"error": {"code": self.code, "message": self.message}}
