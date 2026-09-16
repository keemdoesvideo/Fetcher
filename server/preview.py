"""Same-origin preview proxy for scrub-to-trim.

Fetcher previews any supported video-capable URL without downloading the whole
asset first. HLS sources (notably Twitch VODs) are proxied segment-by-segment.
Ordinary video URLs (YouTube, TikTok, X, Instagram, clips, etc.) use a low-res
muxed HTTP format and proxy browser Range requests to the source CDN so seeking
only transfers the bytes the player asks for.

Preview sessions contain only source URLs returned by yt-dlp for an already
whitelisted provider. The browser never supplies an arbitrary proxy target.
"""

from __future__ import annotations

import re
import threading
import time
import urllib.parse
import urllib.request
import uuid
from typing import Optional

from . import config, errors

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Twitch's HLS playlists use simple relative segment names. Keep this endpoint
# deliberately narrow rather than turning it into a general-purpose URL proxy.
_SEG_RE = re.compile(r"^[A-Za-z0-9._\-]+$")

_PREVIEW_QUALITY = 480
_DIRECT_PROTOCOLS = {"http", "https"}
_HLS_PROTOCOLS = {"m3u8", "m3u8_native"}


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

    def _purge_locked(self) -> None:
        cutoff = time.time() - config.JOB_TTL_SECONDS
        stale = [k for k, v in self._sessions.items() if v["created"] < cutoff]
        for k in stale:
            self._sessions.pop(k, None)


store = _PreviewStore()


def _fetch(url: str, timeout: int = 20, headers: Optional[dict] = None):
    request_headers = {"User-Agent": _UA}
    if headers:
        request_headers.update({str(k): str(v) for k, v in headers.items() if v is not None})
    req = urllib.request.Request(url, headers=request_headers)
    return urllib.request.urlopen(req, timeout=timeout)


def _is_video(fmt: dict) -> bool:
    return bool(fmt.get("url")) and fmt.get("vcodec") not in (None, "none")


def _is_muxed(fmt: dict) -> bool:
    return _is_video(fmt) and fmt.get("acodec") not in (None, "none")


def _protocol(fmt: dict) -> str:
    return str(fmt.get("protocol") or "").lower()


def _score(fmt: dict):
    height = fmt.get("height")
    distance = abs((height if isinstance(height, (int, float)) else 9999) - _PREVIEW_QUALITY)
    # At the same rough resolution prefer MP4/H.264 because browsers seek it
    # reliably and every Fetcher target browser can decode it.
    ext_penalty = 0 if str(fmt.get("ext") or "").lower() == "mp4" else 1
    codec = str(fmt.get("vcodec") or "").lower()
    codec_penalty = 0 if ("avc" in codec or "h264" in codec) else 1
    return (distance, ext_penalty, codec_penalty)


def _pick_preview_format(info: dict) -> tuple[str, dict] | tuple[None, None]:
    """Choose a small, browser-friendly source for interactive scrubbing.

    Prefer a single-file muxed HTTP stream. That path works for normal hosted
    videos and supports cheap byte-range seeking. Fall back to HLS for sources
    such as Twitch VODs, then finally a direct video-only stream if a provider
    exposes no muxed preview format.
    """
    formats = [f for f in info.get("formats", []) if _is_video(f)]

    direct_muxed = [
        f for f in formats
        if _is_muxed(f) and _protocol(f) in _DIRECT_PROTOCOLS
    ]
    if direct_muxed:
        direct_muxed.sort(key=_score)
        return "direct", direct_muxed[0]

    hls_muxed = [
        f for f in formats
        if _is_muxed(f) and _protocol(f) in _HLS_PROTOCOLS
    ]
    if hls_muxed:
        hls_muxed.sort(key=_score)
        return "hls", hls_muxed[0]

    direct_video = [f for f in formats if _protocol(f) in _DIRECT_PROTOCOLS]
    if direct_video:
        direct_video.sort(key=_score)
        return "direct", direct_video[0]

    hls_video = [f for f in formats if _protocol(f) in _HLS_PROTOCOLS]
    if hls_video:
        hls_video.sort(key=_score)
        return "hls", hls_video[0]

    return None, None


def _ydl_options(provider=None) -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "js_runtimes": {name: {} for name in config.JS_RUNTIMES},
    }
    # Match the normal provider path for sources such as Instagram that require
    # an authenticated session when the operator explicitly configured one.
    if provider is not None and getattr(provider, "USES_COOKIES", False):
        if config.COOKIES_FROM_BROWSER:
            opts["cookiesfrombrowser"] = tuple(config.COOKIES_FROM_BROWSER.split(":"))
        if config.COOKIES_FILE:
            opts["cookiefile"] = config.COOKIES_FILE
    return opts


def resolve(url: str, provider=None) -> dict:
    """Resolve a low-bandwidth preview source and create a proxy session."""
    try:
        import yt_dlp
    except ImportError as exc:
        raise errors.FetcherError(errors.YTDLP_MISSING, detail=str(exc)) from exc

    try:
        with yt_dlp.YoutubeDL(_ydl_options(provider)) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise errors.FetcherError(errors.EXTRACTION_FAILED, detail=str(exc)) from exc

    if isinstance(info, dict) and info.get("entries"):
        entries = [entry for entry in info["entries"] if entry]
        info = entries[0] if entries else info

    info = info or {}
    kind, fmt = _pick_preview_format(info)
    if not fmt or not kind:
        raise errors.FetcherError(errors.MEDIA_UNAVAILABLE, detail="no browser-previewable video format")

    if kind == "hls":
        playlist_url = fmt["url"]
        path = playlist_url.split("?", 1)[0]
        base_dir = path.rsplit("/", 1)[0] + "/"
        pid = store.create_hls(playlist_url, base_dir)
    else:
        source_url = fmt["url"]
        headers = {}
        headers.update(info.get("http_headers") or {})
        headers.update(fmt.get("http_headers") or {})
        ext = str(fmt.get("ext") or "").lower()
        media_type = "video/webm" if ext == "webm" else "video/mp4"
        pid = store.create_direct(source_url, headers, media_type)

    return {
        "previewId": pid,
        "kind": kind,
        "duration": info.get("duration"),
        "title": info.get("title"),
        "width": fmt.get("width"),
        "height": fmt.get("height"),
    }


def proxy_playlist(pid: str) -> Optional[str]:
    """Proxy an HLS playlist and rewrite relative segment names same-origin."""
    sess = store.get(pid)
    if not sess or sess.get("kind") != "hls":
        return None

    with _fetch(sess["playlist_url"]) as response:
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
    """Return (chunk_iterator, media_type) for one safe HLS segment."""
    sess = store.get(pid)
    if not sess or sess.get("kind") != "hls" or not _SEG_RE.match(name or ""):
        return None

    seg_url = sess["base_dir"] + name
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
    """Proxy a direct media source, preserving byte-range semantics for seeking."""
    sess = store.get(pid)
    if not sess or sess.get("kind") != "direct":
        return None

    headers = dict(sess.get("headers") or {})
    if range_header:
        headers["Range"] = range_header

    response = _fetch(sess["source_url"], timeout=30, headers=headers)
    status = getattr(response, "status", 200)
    media_type = response.headers.get("Content-Type") or sess.get("media_type") or "video/mp4"

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
