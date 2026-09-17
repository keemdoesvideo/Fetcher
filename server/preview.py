"""Smart same-origin preview proxy for Fetcher's scrub-to-trim UI.

The preview layer decides whether a trimmer is useful before exposing a media
source. Video gets a trimmer for 60+ minute or estimated 5+ minute fetches.
Audio gets an audio-only trimmer at 10+ minutes. Waveform generation is kept on
a separate endpoint so the panel can open immediately instead of waiting for
FFmpeg to scan an hour-long audio stream.
"""

from __future__ import annotations

import logging
import re
import struct
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import uuid
from typing import Optional

from . import config, errors
from .diagnostics import find_ffmpeg

log = logging.getLogger("fetcher.preview")

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_SEG_RE = re.compile(r"^[A-Za-z0-9._\-]+$")
_PREVIEW_QUALITY = 480
_DIRECT_PROTOCOLS = {"http", "https"}
_HLS_PROTOCOLS = {"m3u8", "m3u8_native"}

_VIDEO_LONG_SECONDS = 60 * 60
_AUDIO_LONG_SECONDS = 10 * 60
_HEAVY_SECONDS = 5 * 60
_EST_BYTES_PER_SECOND = 6 * 1024 * 1024
_INFO_CACHE_TTL = 8 * 60
_WAVEFORM_BARS = 280

_HEIGHT_CAP = {
    "4k": 2160,
    "1440p": 1440,
    "1080p": 1080,
    "720p": 720,
    "480p": 480,
}


class _PreviewStore:
    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._lock = threading.Lock()

    def _create(self, payload: dict) -> str:
        pid = uuid.uuid4().hex
        payload = dict(payload)
        payload["created"] = time.time()
        with self._lock:
            self._purge_locked()
            self._sessions[pid] = payload
        return pid

    def create_hls(self, playlist_url: str, base_dir: str) -> str:
        return self._create({
            "kind": "hls",
            "playlist_url": playlist_url,
            "base_dir": base_dir,
        })

    def create_direct(self, source_url: str, headers: dict, media_type: str) -> str:
        return self._create({
            "kind": "direct",
            "source_url": source_url,
            "headers": headers,
            "media_type": media_type,
        })

    def get(self, pid: str) -> Optional[dict]:
        if not pid or not pid.isalnum():
            return None
        with self._lock:
            return self._sessions.get(pid)

    def set_waveform(self, pid: str, peaks: list[float]) -> None:
        with self._lock:
            session = self._sessions.get(pid)
            if session is not None:
                session["waveform"] = peaks

    def _purge_locked(self) -> None:
        cutoff = time.time() - config.JOB_TTL_SECONDS
        stale = [key for key, value in self._sessions.items() if value["created"] < cutoff]
        for key in stale:
            self._sessions.pop(key, None)


store = _PreviewStore()
_info_cache: dict[str, tuple[float, dict]] = {}
_info_cache_lock = threading.Lock()


def _fetch(url: str, timeout: int = 20, headers: Optional[dict] = None):
    request_headers = {"User-Agent": _UA}
    if headers:
        request_headers.update({str(k): str(v) for k, v in headers.items() if v is not None})
    req = urllib.request.Request(url, headers=request_headers)
    return urllib.request.urlopen(req, timeout=timeout)


def _protocol(fmt: dict) -> str:
    return str(fmt.get("protocol") or "").lower()


def _is_video(fmt: dict) -> bool:
    return bool(fmt.get("url")) and fmt.get("vcodec") not in (None, "none")


def _is_audio(fmt: dict) -> bool:
    return bool(fmt.get("url")) and fmt.get("acodec") not in (None, "none")


def _is_muxed(fmt: dict) -> bool:
    return _is_video(fmt) and _is_audio(fmt)


def _score_video_preview(fmt: dict):
    height = fmt.get("height")
    distance = abs((height if isinstance(height, (int, float)) else 9999) - _PREVIEW_QUALITY)
    ext_penalty = 0 if str(fmt.get("ext") or "").lower() == "mp4" else 1
    codec = str(fmt.get("vcodec") or "").lower()
    codec_penalty = 0 if ("avc" in codec or "h264" in codec) else 1
    return (distance, ext_penalty, codec_penalty)


def _pick_preview_format(info: dict, prefer_hls: bool = False) -> tuple[str, dict] | tuple[None, None]:
    """Pick a lightweight browser-previewable video source.

    Twitch VODs deliberately prefer HLS because that was the known-good path
    before smart conditional previews were added. Other providers prefer a
    single-file muxed HTTP source for efficient byte-range seeking.
    """
    formats = [fmt for fmt in info.get("formats", []) if _is_video(fmt)]
    direct_muxed = [
        fmt for fmt in formats
        if _is_muxed(fmt) and _protocol(fmt) in _DIRECT_PROTOCOLS
    ]
    hls_muxed = [
        fmt for fmt in formats
        if _is_muxed(fmt) and _protocol(fmt) in _HLS_PROTOCOLS
    ]
    direct_video = [fmt for fmt in formats if _protocol(fmt) in _DIRECT_PROTOCOLS]
    hls_video = [fmt for fmt in formats if _protocol(fmt) in _HLS_PROTOCOLS]

    groups = (
        [("hls", hls_muxed), ("hls", hls_video), ("direct", direct_muxed), ("direct", direct_video)]
        if prefer_hls
        else [("direct", direct_muxed), ("hls", hls_muxed), ("direct", direct_video), ("hls", hls_video)]
    )
    for kind, candidates in groups:
        if candidates:
            candidates.sort(key=_score_video_preview)
            return kind, candidates[0]
    return None, None


def _pick_audio_preview_format(info: dict) -> dict | None:
    formats = [
        fmt for fmt in info.get("formats", [])
        if _is_audio(fmt) and _protocol(fmt) in _DIRECT_PROTOCOLS
    ]
    if not formats:
        return None

    audio_only = [fmt for fmt in formats if fmt.get("vcodec") in (None, "none")]
    candidates = audio_only or formats

    def score(fmt: dict):
        ext = str(fmt.get("ext") or "").lower()
        ext_penalty = 0 if ext in {"m4a", "mp4", "aac"} else 1
        abr = fmt.get("abr") or fmt.get("tbr") or 128
        try:
            abr = float(abr)
        except (TypeError, ValueError):
            abr = 128
        return (ext_penalty, abs(abr - 96))

    candidates.sort(key=score)
    return candidates[0]


def _ydl_options(provider=None, player_client: str | None = None, cookiefile: str | None = None) -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "js_runtimes": {name: {} for name in config.JS_RUNTIMES},
    }
    if player_client:
        opts["extractor_args"] = {"youtube": {"player_client": [player_client]}}
    if cookiefile:
        opts["cookiefile"] = cookiefile
    elif provider is not None and getattr(provider, "USES_COOKIES", False):
        if config.COOKIES_FROM_BROWSER:
            opts["cookiesfrombrowser"] = tuple(config.COOKIES_FROM_BROWSER.split(":"))
        if config.COOKIES_FILE:
            opts["cookiefile"] = config.COOKIES_FILE
    return opts


def _unwrap_info(info: dict | None) -> dict:
    info = info or {}
    if isinstance(info, dict) and info.get("entries"):
        entries = [entry for entry in info["entries"] if entry]
        return entries[0] if entries else info
    return info


def _cached_info(url: str) -> dict | None:
    now = time.time()
    with _info_cache_lock:
        cached = _info_cache.get(url)
        if not cached:
            return None
        created, info = cached
        if now - created > _INFO_CACHE_TTL:
            _info_cache.pop(url, None)
            return None
        return info


def _store_info(url: str, info: dict) -> dict:
    with _info_cache_lock:
        if len(_info_cache) > 80:
            oldest = sorted(_info_cache.items(), key=lambda item: item[1][0])[:20]
            for key, _ in oldest:
                _info_cache.pop(key, None)
        _info_cache[url] = (time.time(), info)
    return info


def _extract_info(url: str, provider=None) -> dict:
    cached = _cached_info(url)
    if cached is not None:
        return cached

    try:
        import yt_dlp
    except ImportError as exc:
        raise errors.FetcherError(errors.YTDLP_MISSING, detail=str(exc)) from exc

    is_youtube = bool(provider is not None and getattr(provider, "name", "") == "youtube")

    # On the hosted Fetcher Mac, a dedicated YouTube service session is already
    # configured because the static outbound IP is bot-gated. Prefer that known-
    # good route instead of paying for four failed anonymous metadata attempts.
    attempts: list[tuple[str | None, str | None]] = []
    if is_youtube and config.YOUTUBE_COOKIES_FILE:
        attempts.append(("mweb", config.YOUTUBE_COOKIES_FILE))
    attempts.append((None, None))
    if is_youtube:
        attempts.extend([
            ("android_vr", None),
            ("web_embedded", None),
            ("mweb", None),
        ])

    last_exc: Exception | None = None
    for player_client, cookiefile in attempts:
        try:
            with yt_dlp.YoutubeDL(_ydl_options(provider, player_client, cookiefile)) as ydl:
                info = _unwrap_info(ydl.extract_info(url, download=False))
            if info:
                return _store_info(url, info)
        except Exception as exc:
            last_exc = exc
            if not is_youtube:
                break
            log.debug(
                "preview metadata attempt client=%s cookies=%s failed: %s",
                player_client or "default",
                bool(cookiefile),
                exc,
            )

    raise errors.FetcherError(
        errors.EXTRACTION_FAILED,
        detail=str(last_exc or "unable to inspect media"),
    )


def _strip_internal_fragment(url: str) -> tuple[str, str, str]:
    parts = urllib.parse.urlsplit(url)
    pairs = urllib.parse.parse_qsl(parts.fragment, keep_blank_values=True)
    mode = "video"
    quality = "best"
    kept: list[tuple[str, str]] = []
    for key, value in pairs:
        if key == "__fetcher_mode":
            mode = "audio" if value == "audio" else "video"
        elif key == "__fetcher_vq":
            quality = (value or "best").lower()
        else:
            kept.append((key, value))
    fragment = urllib.parse.urlencode(kept)
    clean = urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, fragment))
    return clean, mode, quality


def _format_bytes(fmt: dict, duration: float) -> int:
    for key in ("filesize", "filesize_approx"):
        value = fmt.get(key)
        if isinstance(value, (int, float)) and value > 0:
            return int(value)
    bitrate = fmt.get("tbr")
    if not bitrate:
        vbr = fmt.get("vbr") or 0
        abr = fmt.get("abr") or 0
        try:
            bitrate = float(vbr) + float(abr)
        except (TypeError, ValueError):
            bitrate = 0
    try:
        bitrate = float(bitrate or 0)
    except (TypeError, ValueError):
        bitrate = 0
    if bitrate > 0 and duration > 0:
        return int(bitrate * 1000 / 8 * duration)
    return 0


def _estimate_video_download(info: dict, quality: str, duration: float) -> tuple[int, float]:
    formats = [fmt for fmt in info.get("formats", []) if _is_video(fmt)]
    if not formats:
        return 0, 0.0

    cap = _HEIGHT_CAP.get(quality)
    capped = [
        fmt for fmt in formats
        if cap is None or not isinstance(fmt.get("height"), (int, float)) or fmt.get("height") <= cap
    ]
    candidates = capped or formats

    def rank(fmt: dict):
        height = fmt.get("height") if isinstance(fmt.get("height"), (int, float)) else 0
        tbr = fmt.get("tbr") if isinstance(fmt.get("tbr"), (int, float)) else 0
        return (height, tbr)

    video_fmt = max(candidates, key=rank)
    total = _format_bytes(video_fmt, duration)
    if not _is_muxed(video_fmt):
        audios = [
            fmt for fmt in info.get("formats", [])
            if _is_audio(fmt) and fmt.get("vcodec") in (None, "none")
        ]
        if audios:
            audio_fmt = max(audios, key=lambda fmt: float(fmt.get("abr") or fmt.get("tbr") or 0))
            total += _format_bytes(audio_fmt, duration)

    height = video_fmt.get("height") or 0
    processing = 75 if isinstance(height, (int, float)) and height >= 1440 else 35
    estimated_seconds = (total / _EST_BYTES_PER_SECOND if total else 0) + processing
    return total, estimated_seconds


def _headers_for(info: dict, fmt: dict) -> dict:
    headers = {"User-Agent": _UA}
    headers.update(info.get("http_headers") or {})
    headers.update(fmt.get("http_headers") or {})
    return {str(key): str(value) for key, value in headers.items() if value is not None}


def _waveform_peaks(source_url: str, headers: dict) -> list[float]:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        return []

    cmd = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin"]
    safe_headers = []
    for key, value in headers.items():
        if "\r" in key or "\n" in key or "\r" in value or "\n" in value:
            continue
        safe_headers.append(f"{key}: {value}\r\n")
    if safe_headers:
        cmd.extend(["-headers", "".join(safe_headers)])
    cmd.extend([
        "-i", source_url,
        "-vn", "-ac", "1", "-ar", "24",
        "-f", "f32le", "pipe:1",
    ])

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=75,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.debug("waveform generation failed: %s", exc)
        return []
    if proc.returncode != 0 or not proc.stdout:
        log.debug("waveform ffmpeg failed: %s", proc.stderr[-800:].decode("utf-8", "replace"))
        return []

    count = len(proc.stdout) // 4
    if count <= 0:
        return []
    samples = struct.unpack(f"<{count}f", proc.stdout[: count * 4])
    bucket = max(1, len(samples) // _WAVEFORM_BARS)
    peaks = []
    for index in range(_WAVEFORM_BARS):
        chunk = samples[index * bucket : (index + 1) * bucket]
        if not chunk:
            break
        peaks.append(max(abs(value) for value in chunk))
    if not peaks:
        return []

    ordered = sorted(peaks)
    normalizer = ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))] or max(ordered) or 1.0
    return [round(min(1.0, peak / normalizer), 4) for peak in peaks]


def resolve(url: str, provider=None) -> dict:
    clean_url, mode, video_quality = _strip_internal_fragment(url)
    info = _extract_info(clean_url, provider=provider)
    duration = float(info.get("duration") or 0)
    title = info.get("title") or "preview"

    if mode == "audio":
        if duration < _AUDIO_LONG_SECONDS:
            return {"show": False, "kind": "audio", "duration": duration, "title": title}
        fmt = _pick_audio_preview_format(info)
        if not fmt:
            return {"show": False, "kind": "audio", "duration": duration, "title": title}
        headers = _headers_for(info, fmt)
        ext = str(fmt.get("ext") or "").lower()
        media_type = "audio/mp4" if ext in {"m4a", "mp4", "aac"} else "audio/webm"
        pid = store.create_direct(fmt["url"], headers, media_type)
        return {
            "show": True,
            "previewId": pid,
            "kind": "audio",
            "duration": duration,
            "title": title,
            "waveformPending": True,
        }

    estimated_bytes, estimated_seconds = _estimate_video_download(info, video_quality, duration)
    should_show = duration >= _VIDEO_LONG_SECONDS or estimated_seconds >= _HEAVY_SECONDS
    if not should_show:
        return {
            "show": False,
            "kind": "video",
            "duration": duration,
            "title": title,
            "estimatedBytes": estimated_bytes,
            "estimatedSeconds": round(estimated_seconds),
        }

    provider_name = str(getattr(provider, "name", "") or "").lower()
    kind, fmt = _pick_preview_format(info, prefer_hls=(provider_name == "twitch"))
    if not fmt or not kind:
        return {
            "show": False,
            "kind": "video",
            "duration": duration,
            "title": title,
            "estimatedBytes": estimated_bytes,
            "estimatedSeconds": round(estimated_seconds),
        }

    if kind == "hls":
        playlist_url = fmt["url"]
        path = playlist_url.split("?", 1)[0]
        base_dir = path.rsplit("/", 1)[0] + "/"
        pid = store.create_hls(playlist_url, base_dir)
    else:
        headers = _headers_for(info, fmt)
        ext = str(fmt.get("ext") or "").lower()
        media_type = "video/webm" if ext == "webm" else "video/mp4"
        pid = store.create_direct(fmt["url"], headers, media_type)

    return {
        "show": True,
        "previewId": pid,
        "kind": kind,
        "mediaKind": "video",
        "duration": duration,
        "title": title,
        "width": fmt.get("width"),
        "height": fmt.get("height"),
        "estimatedBytes": estimated_bytes,
        "estimatedSeconds": round(estimated_seconds),
    }


def waveform(pid: str) -> list[float] | None:
    session = store.get(pid)
    if not session or session.get("kind") != "direct":
        return None
    media_type = str(session.get("media_type") or "")
    if not media_type.startswith("audio/"):
        return None
    cached = session.get("waveform")
    if isinstance(cached, list):
        return cached
    peaks = _waveform_peaks(session["source_url"], dict(session.get("headers") or {}))
    store.set_waveform(pid, peaks)
    return peaks


def proxy_playlist(pid: str) -> Optional[str]:
    session = store.get(pid)
    if not session or session.get("kind") != "hls":
        return None

    with _fetch(session["playlist_url"]) as response:
        text = response.read().decode("utf-8", "replace")

    out = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("http"):
            out.append("seg/" + urllib.parse.quote(stripped, safe=""))
        else:
            out.append(line)
    return "\n".join(out) + "\n"


def proxy_segment(pid: str, name: str):
    session = store.get(pid)
    if not session or session.get("kind") != "hls" or not _SEG_RE.match(name or ""):
        return None

    seg_url = session["base_dir"] + name
    response = _fetch(seg_url, timeout=25)
    media_type = response.headers.get("Content-Type") or "video/mp2t"

    def gen():
        try:
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            response.close()

    return gen(), media_type


def proxy_media(pid: str, range_header: Optional[str] = None):
    session = store.get(pid)
    if not session or session.get("kind") != "direct":
        return None

    headers = dict(session.get("headers") or {})
    if range_header:
        headers["Range"] = range_header

    response = _fetch(session["source_url"], timeout=30, headers=headers)
    status = getattr(response, "status", 200)
    media_type = response.headers.get("Content-Type") or session.get("media_type") or "video/mp4"

    passthrough = {"Cache-Control": "no-store"}
    for name in ("Content-Range", "Content-Length", "Accept-Ranges", "ETag", "Last-Modified"):
        value = response.headers.get(name)
        if value:
            passthrough[name] = value

    def gen():
        try:
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            response.close()

    return gen(), media_type, status, passthrough
