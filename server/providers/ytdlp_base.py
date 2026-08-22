"""Shared yt-dlp provider machinery.

`YtdlpProvider` implements the whole prepare() flow on top of the official
yt_dlp.YoutubeDL Python API (never a shelled-out command string): format
selection, the download + FFmpeg step, live progress/cancel hooks, safe
filenames, and error classification. Concrete providers (YouTube, TikTok, …)
subclass it and usually only declare their allowed hosts; they can override
`_video_format()` for site-specific quirks (e.g. TikTok's watermark).

All site- and yt-dlp-specific logic lives behind this boundary — the API and
frontend never see it.
"""

from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import urlsplit

from .. import config, errors
from .. import jobs as jobstate
from ..diagnostics import find_ffmpeg
from ..jobs import Job, JobCancelled
from ..models import Preferences
from ..naming import build_download_name
from .base import Provider, ProviderResult

# Requested label -> max height. "best" has no cap.
HEIGHT_CAP = {"4k": 2160, "1440p": 1440, "1080p": 1080, "720p": 720, "480p": 480}

# "best" audio -> LAME V0 VBR (~245 kbps avg, transparent); numeric labels are
# treated as CBR kbps by FFmpegExtractAudio. yt-dlp reads values <10 as VBR
# quality, otherwise as a CBR bitrate.
AUDIO_QUALITY = {"best": "0", "320": "320", "256": "256", "192": "192", "128": "128"}


def normalize_url(url: str) -> str:
    """Add a scheme if the user pasted a bare 'youtube.com/...' link."""
    url = (url or "").strip()
    if "://" not in url:
        url = "https://" + url
    return url


def host_of(url: str) -> str:
    return (urlsplit(normalize_url(url)).hostname or "").lower()


class _YtdlpLogger:
    """Routes yt-dlp's chatter into the given logger at sane levels and keeps
    the last error line so we can classify failures precisely."""

    def __init__(self, log: logging.Logger):
        self._log = log
        self.last_error: str | None = None

    def debug(self, msg):
        # yt-dlp prefixes real debug lines with '[debug] '.
        if not str(msg).startswith("[debug] "):
            self._log.debug(msg)

    def info(self, msg):
        self._log.debug(msg)

    def warning(self, msg):
        self._log.warning(msg)

    def error(self, msg):
        self.last_error = str(msg)
        self._log.error(msg)


class YtdlpProvider(Provider):
    """Base for every yt-dlp-backed provider. Subclasses set `name` and
    `ALLOWED_HOSTS`; everything else is shared."""

    name = "ytdlp"
    ALLOWED_HOSTS: set[str] = set()
    # Providers whose sites require login (Instagram) set this so configured
    # cookies are applied only for them — never silently for YouTube etc.
    USES_COOKIES = False

    def __init__(self):
        self.log = logging.getLogger(f"fetcher.{self.name}")

    def matches(self, url: str) -> bool:
        return host_of(url) in self.ALLOWED_HOSTS

    # --- format selection --------------------------------------------------
    def _video_format(self, preferences: Preferences) -> str:
        """Default: honour the saved quality, degrading to the next-best at or
        below it rather than failing on an exact miss. Providers with no
        resolution ladder (e.g. TikTok) override this."""
        cap = HEIGHT_CAP.get((preferences.videoQuality or "best").lower())
        if cap is None:  # "best"
            return "bestvideo*+bestaudio/best"
        return (
            f"bestvideo[height<={cap}]+bestaudio/best[height<={cap}]"
            f"/bestvideo*+bestaudio/best"
        )

    def _base_opts(self, job: Job):
        ffmpeg = find_ffmpeg()
        if not ffmpeg:
            raise errors.FetcherError(errors.FFMPEG_MISSING)
        ydl_logger = _YtdlpLogger(self.log)
        opts = {
            # Fixed, server-controlled output path — the user's title never
            # touches the filesystem path (traversal-proof by construction).
            "outtmpl": str(job.dir / "source.%(ext)s"),
            # Enable JS runtimes yt-dlp can use for player challenges (YouTube);
            # harmless for providers that don't need them.
            "js_runtimes": {name: {} for name in config.JS_RUNTIMES},
            "noplaylist": True,           # a playlist URL fetches just the item
            "quiet": True,
            "no_warnings": False,
            "noprogress": True,
            "consoletitle": False,
            "overwrites": True,
            "windowsfilenames": True,
            "retries": 3,
            "fragment_retries": 3,
            "concurrent_fragment_downloads": 4,
            # Bound network stalls so a hung connection can't ignore cancel/timeout.
            "socket_timeout": 30,
            "ffmpeg_location": str(Path(ffmpeg).parent),
            "logger": ydl_logger,
            "progress_hooks": [self._make_progress_hook(job)],
            "postprocessor_hooks": [self._make_postprocessor_hook(job)],
        }
        # Login cookies — only for providers that need them (e.g. Instagram),
        # only if the user opted in. Never applied to sites that don't need it.
        if self.USES_COOKIES:
            if config.COOKIES_FROM_BROWSER:
                opts["cookiesfrombrowser"] = tuple(config.COOKIES_FROM_BROWSER.split(":"))
            if config.COOKIES_FILE:
                opts["cookiefile"] = config.COOKIES_FILE

        # Section trim (e.g. a slice of a Twitch VOD): download only the segments
        # in range and cut at keyframe boundaries. We deliberately DON'T force
        # keyframes at the cuts — that path re-encodes and, for Twitch's HLS,
        # produced a broken file (MPEG-2 video + MP3 mis-tagged as mp4a, which
        # Windows refuses to play). A keyframe-aligned stream copy keeps the real
        # H.264/AAC codecs intact; the trade-off is cuts land on the nearest
        # keyframe (a second or two off exact) rather than frame-precise.
        if job.section:
            from yt_dlp.utils import download_range_func
            opts["download_ranges"] = download_range_func(None, [job.section])
            opts["force_keyframes_at_cuts"] = False
        return opts, ydl_logger

    # --- progress + cancellation ------------------------------------------
    @staticmethod
    def _make_progress_hook(job: Job):
        """yt-dlp calls this repeatedly while downloading. It writes live
        progress onto the job and aborts (via JobCancelled) if the client asked
        to cancel — the only way to stop yt-dlp mid-download."""
        def hook(d):
            if job.cancel_event.is_set():
                raise JobCancelled()
            status = d.get("status")
            if status == "downloading":
                job.status = jobstate.DOWNLOADING
                job.stage = "downloading"
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                done = d.get("downloaded_bytes") or 0
                if total:
                    job.progress = max(0.0, min(100.0, done / total * 100.0))
            elif status == "finished":
                job.status = jobstate.PROCESSING
                job.stage = "processing"
                job.progress = 100.0
        return hook

    @staticmethod
    def _make_postprocessor_hook(job: Job):
        def hook(d):
            if job.cancel_event.is_set():
                raise JobCancelled()
            if d.get("status") == "started":
                job.status = jobstate.PROCESSING
                name = (d.get("postprocessor") or "").lower()
                job.stage = "converting" if "extractaudio" in name else "merging"
        return hook

    def _video_opts(self, preferences: Preferences, job: Job):
        opts, ydl_logger = self._base_opts(job)
        opts.update({
            "format": self._video_format(preferences),
            # Resolution first, then prefer H.264 + AAC at that resolution so the
            # MP4 is maximally compatible — without ever dropping resolution.
            # (Above 1080p a source may only offer VP9/AV1; we remux that into
            # MP4 as-is rather than transcoding. No unnecessary re-encoding.)
            "format_sort": ["res", "vcodec:h264", "acodec:aac", "ext:mp4:m4a"],
            "merge_output_format": "mp4",
        })
        return opts, ydl_logger

    def _audio_opts(self, preferences: Preferences, job: Job):
        opts, ydl_logger = self._base_opts(job)
        quality = AUDIO_QUALITY.get((preferences.audioQuality or "best").lower(), "0")
        opts.update({
            "format": "bestaudio/best",
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,
            }],
        })
        return opts, ydl_logger

    # --- prepare -----------------------------------------------------------
    def prepare(self, url: str, mode: str, preferences: Preferences, job: Job) -> ProviderResult:
        try:
            import yt_dlp  # imported lazily so a missing install is a clean error
        except ImportError as exc:
            raise errors.FetcherError(errors.YTDLP_MISSING, detail=str(exc)) from exc

        url = normalize_url(url)
        if mode == "audio":
            opts, ydl_logger = self._audio_opts(preferences, job)
            ext, media_type = "mp3", "audio/mpeg"
        else:
            opts, ydl_logger = self._video_opts(preferences, job)
            ext, media_type = "mp4", "video/mp4"

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
        except JobCancelled:
            # Client cancelled (or timed out) mid-download — let the worker
            # decide the terminal status; never dress this up as a failure.
            raise
        except yt_dlp.utils.DownloadError as exc:
            # yt-dlp may wrap our cancellation in a DownloadError; unwrap it.
            if job.cancel_event.is_set():
                raise JobCancelled() from exc
            raise self._classify(str(exc), ydl_logger.last_error) from exc
        except errors.FetcherError:
            raise
        except Exception as exc:  # pragma: no cover - unexpected
            if job.cancel_event.is_set():
                raise JobCancelled() from exc
            self.log.exception("Unexpected yt-dlp failure")
            raise errors.FetcherError(errors.EXTRACTION_FAILED, detail=str(exc)) from exc

        # A playlist URL (despite noplaylist) can hand back an entries list.
        if isinstance(info, dict) and info.get("entries"):
            entries = [e for e in info["entries"] if e]
            info = entries[0] if entries else info

        filepath = self._locate_output(job.dir, ext)
        if filepath is None:
            raise errors.FetcherError(
                errors.MEDIA_UNAVAILABLE,
                detail=f"No .{ext} produced in {job.dir}",
            )

        title = (info or {}).get("title") or "fetch"
        creator = (
            (info or {}).get("uploader")
            or (info or {}).get("channel")
            or (info or {}).get("uploader_id")
        )
        filename = build_download_name(
            title, creator, ext, style=(preferences.filenameStyle or "clean")
        )
        return ProviderResult(
            filepath=filepath, filename=filename, media_type=media_type, title=title
        )

    def _locate_output(self, job_dir: Path, ext: str) -> Path | None:
        exact = job_dir / f"source.{ext}"
        if exact.is_file():
            return exact
        # Fallback: any file with the expected extension (largest wins).
        candidates = sorted(
            (p for p in job_dir.glob(f"*.{ext}") if p.is_file()),
            key=lambda p: p.stat().st_size,
            reverse=True,
        )
        return candidates[0] if candidates else None

    # --- error classification ---------------------------------------------
    def _classify(self, message: str, last_error: str | None) -> errors.FetcherError:
        """Map a yt-dlp error string onto a friendly, structured error. The
        original message is preserved as `detail` for the server log only.
        Covers phrases seen across YouTube and TikTok."""
        text = f"{message} {last_error or ''}".lower()

        def has(*needles: str) -> bool:
            return any(n in text for n in needles)

        if has("sign in to confirm you", "not a bot", "po token", "po_token"):
            code = errors.BOT_CHECK
        elif has("empty media response", "login required", "rate-limit reached or login",
                 "cookies-from-browser", "requested content is not available",
                 "use --cookies", "login to access"):
            code = errors.LOGIN_REQUIRED
        elif has("confirm your age", "age-restricted", "age restricted",
                 "inappropriate for some", "members-only", "members only",
                 "join this channel", "ip address is blocked", "region",
                 "not available in your country", "login required",
                 "sign in", "log in to"):
            code = errors.RESTRICTED
        elif has("private video", "video unavailable", "removed by the user",
                 "no longer available", "account associated", "has been terminated",
                 "this video is not available", "content isn't available",
                 "item doesn't exist", "video currently unavailable", "unavailable"):
            code = errors.VIDEO_UNAVAILABLE
        elif has("requested format is not available", "requested format not available",
                 "no video formats", "only images are available",
                 "no video could be found"):
            code = errors.MEDIA_UNAVAILABLE
        else:
            code = errors.EXTRACTION_FAILED

        return errors.FetcherError(code, detail=message)
