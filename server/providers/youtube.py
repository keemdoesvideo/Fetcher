"""YouTube provider.

Wraps the official yt_dlp.YoutubeDL Python API (never a shelled-out command
string) and is the only place that knows about YouTube or yt-dlp. It:

  * accepts only the four allowed YouTube hosts (watch URLs + Shorts),
  * picks a format honouring Fetcher's saved quality preference, degrading to
    the next-best available rather than failing on an exact miss,
  * merges/remuxes video to MP4 and extracts audio to MP3 via FFmpeg,
  * builds a safe, user-facing filename,
  * and translates yt-dlp failures into friendly, structured FetcherErrors.

PO Tokens: this implements yt-dlp's standard extraction path only. If YouTube
starts demanding a PO Token for important formats, that surfaces here as a
BOT_CHECK error (logged with the real reason) — the fix is yt-dlp's supported
PO Token Provider plugin, documented in the README, not a homemade workaround.
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

log = logging.getLogger("fetcher.youtube")

# Exactly the hosts the task allows — no arbitrary yt-dlp sites slip through.
ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}

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
    """Routes yt-dlp's chatter into the server log at sane levels and keeps the
    last error line so we can classify failures precisely."""

    def __init__(self):
        self.last_error: str | None = None

    def debug(self, msg):
        # yt-dlp prefixes real debug lines with '[debug] '.
        if not str(msg).startswith("[debug] "):
            log.debug(msg)

    def info(self, msg):
        log.debug(msg)

    def warning(self, msg):
        log.warning(msg)

    def error(self, msg):
        self.last_error = str(msg)
        log.error(msg)


class YouTubeProvider(Provider):
    name = "youtube"

    def matches(self, url: str) -> bool:
        return host_of(url) in ALLOWED_HOSTS

    # --- format selection --------------------------------------------------
    def _video_format(self, preferences: Preferences) -> str:
        cap = HEIGHT_CAP.get((preferences.videoQuality or "best").lower())
        if cap is None:  # "best"
            return "bestvideo*+bestaudio/best"
        # Prefer the highest stream at or below the cap; never fail merely
        # because the exact height is missing — fall back to overall best.
        return (
            f"bestvideo[height<={cap}]+bestaudio/best[height<={cap}]"
            f"/bestvideo*+bestaudio/best"
        )

    def _base_opts(self, job: Job) -> dict:
        ffmpeg = find_ffmpeg()
        if not ffmpeg:
            raise errors.FetcherError(errors.FFMPEG_MISSING)
        ydl_logger = _YtdlpLogger()
        opts = {
            # Fixed, server-controlled output path — the user's title never
            # touches the filesystem path (traversal-proof by construction).
            "outtmpl": str(job.dir / "source.%(ext)s"),
            # Enable JS runtimes yt-dlp can use for YouTube's player challenges;
            # it uses whichever is installed (see config.JS_RUNTIMES).
            "js_runtimes": {name: {} for name in config.JS_RUNTIMES},
            "noplaylist": True,           # a playlist URL fetches just the video
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
                # A stream finished; a merge/convert step usually follows.
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
            # Resolution first, then prefer H.264 video + AAC audio at that
            # resolution so the merged MP4 is maximally compatible (QuickTime,
            # older players) — without ever dropping resolution to get there.
            # Compatibility edge case: YouTube only offers H.264 up to 1080p, so
            # above 1080p (e.g. "Best"/"4K" on a 4K source) the best stream is
            # VP9/AV1. We remux that into MP4 as-is rather than transcoding to
            # H.264 — a remux keeps quality and stays fast, and AV1/VP9-in-MP4
            # plays in all current browsers. No unnecessary re-encoding.
            "format_sort": ["res", "vcodec:h264", "acodec:aac", "ext:mp4:m4a"],
            # Merge/remux the result into MP4. Remux, not re-encode: yt-dlp only
            # transcodes if the container truly can't hold the streams.
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
            log.exception("Unexpected yt-dlp failure")
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
        original message is preserved as `detail` for the server log only."""
        text = f"{message} {last_error or ''}".lower()

        def has(*needles: str) -> bool:
            return any(n in text for n in needles)

        if has("sign in to confirm you", "not a bot", "po token", "po_token"):
            code = errors.BOT_CHECK
        elif has("confirm your age", "age-restricted", "age restricted",
                 "inappropriate for some", "members-only", "members only",
                 "join this channel"):
            code = errors.RESTRICTED
        elif has("private video", "video unavailable", "removed by the user",
                 "no longer available", "account associated", "has been terminated",
                 "this video is not available", "unavailable"):
            code = errors.VIDEO_UNAVAILABLE
        elif has("requested format is not available", "requested format not available",
                 "no video formats", "only images are available"):
            code = errors.MEDIA_UNAVAILABLE
        elif has("is not a valid url", "unable to extract", "unsupported url"):
            code = errors.EXTRACTION_FAILED
        else:
            code = errors.EXTRACTION_FAILED

        return errors.FetcherError(code, detail=message)
