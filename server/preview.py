"""HLS preview proxy for long-form sources (Twitch VODs).

Lets the browser play a VOD *inside* Fetcher for scrub-to-trim. Two problems it
solves: Twitch's CDN sends no CORS headers (so a page can't load segments
directly), and a VOD is huge. So we proxy the HLS same-origin, and because HLS
loads on demand, hls.js only pulls the few segments the user actually scrubs to —
never the whole VOD.

A preview session holds just the CDN URL for one VOD variant; the segment
endpoint is locked to that base (validated names, no open proxy / SSRF). Sessions
are short-lived and swept by TTL.
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

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# Segment filenames we'll proxy — plain names only (e.g. "0.ts", "12-muted.ts").
_SEG_RE = re.compile(r"^[A-Za-z0-9._\-]+$")

_PREVIEW_QUALITY = 480  # target preview height; we pick the closest available


class _PreviewStore:
    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self, playlist_url: str, base_dir: str) -> str:
        pid = uuid.uuid4().hex
        with self._lock:
            self._purge_locked()
            self._sessions[pid] = {
                "playlist_url": playlist_url,
                "base_dir": base_dir,
                "created": time.time(),
            }
        return pid

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


def _fetch(url: str, timeout: int = 20):
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    return urllib.request.urlopen(req, timeout=timeout)


def _pick_preview_format(info: dict) -> Optional[dict]:
    """Pick an HLS video variant near _PREVIEW_QUALITY for smooth scrubbing."""
    vids = [
        f for f in info.get("formats", [])
        if f.get("vcodec") not in (None, "none") and f.get("url")
    ]
    if not vids:
        return None
    vids.sort(key=lambda f: abs((f.get("height") or 9999) - _PREVIEW_QUALITY))
    return vids[0]


def resolve(url: str) -> dict:
    """Extract a preview-quality HLS variant for a VOD and open a proxy session.
    Returns {previewId, duration, title, width, height}."""
    try:
        import yt_dlp
    except ImportError as exc:
        raise errors.FetcherError(errors.YTDLP_MISSING, detail=str(exc)) from exc

    try:
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as y:
            info = y.extract_info(url, download=False)
    except Exception as exc:
        raise errors.FetcherError(errors.EXTRACTION_FAILED, detail=str(exc)) from exc

    if isinstance(info, dict) and info.get("entries"):
        entries = [e for e in info["entries"] if e]
        info = entries[0] if entries else info

    fmt = _pick_preview_format(info or {})
    if not fmt:
        raise errors.FetcherError(errors.MEDIA_UNAVAILABLE, detail="no HLS variant for preview")

    playlist_url = fmt["url"]
    # Segments are relative to the playlist's directory (query stripped).
    path = playlist_url.split("?", 1)[0]
    base_dir = path.rsplit("/", 1)[0] + "/"

    pid = store.create(playlist_url, base_dir)
    return {
        "previewId": pid,
        "duration": info.get("duration"),
        "title": info.get("title"),
        "width": fmt.get("width"),
        "height": fmt.get("height"),
    }


def proxy_playlist(pid: str) -> Optional[str]:
    """Fetch the CDN playlist and rewrite each segment to our same-origin proxy
    (relative 'seg/<name>', resolved against /api/preview/{pid}/index.m3u8)."""
    sess = store.get(pid)
    if not sess:
        return None
    with _fetch(sess["playlist_url"]) as r:
        text = r.read().decode("utf-8", "replace")

    out = []
    for line in text.splitlines():
        s = line.strip()
        if s and not s.startswith("#") and not s.startswith("http"):
            out.append("seg/" + urllib.parse.quote(s, safe=""))
        else:
            out.append(line)
    return "\n".join(out) + "\n"


def proxy_segment(pid: str, name: str):
    """Return (chunk_iterator, media_type) for one segment, or None. Locked to
    the session's base URL and a safe filename — never an arbitrary URL."""
    sess = store.get(pid)
    if not sess or not _SEG_RE.match(name or ""):
        return None
    seg_url = sess["base_dir"] + name
    resp = _fetch(seg_url, timeout=25)
    media_type = resp.headers.get("Content-Type") or "video/mp2t"

    def gen():
        try:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            resp.close()

    return gen(), media_type
