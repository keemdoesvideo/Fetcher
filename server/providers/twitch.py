"""Twitch provider — clips only.

Scoped deliberately to Twitch **clips** (short, self-contained). Full VODs are
hours long (they'd blow the per-job timeout) and live channels aren't a file, so
both are intentionally out of scope: a VOD/live URL simply doesn't match and is
reported as unsupported.

This is the first provider whose match is path-aware, not just host-based —
clips.twitch.tv is always a clip, while on twitch.tv/www/m we only accept
`/clip/` paths. It also excludes Twitch's "portrait-*" vertical renders in favour
of the standard landscape clip.
"""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from ..models import Preferences
from .ytdlp_base import HEIGHT_CAP, YtdlpProvider, normalize_url


class TwitchProvider(YtdlpProvider):
    name = "twitch"

    _CLIP_HOSTS = {"clips.twitch.tv"}
    _CHANNEL_HOSTS = {"twitch.tv", "www.twitch.tv", "m.twitch.tv"}
    _VOD_RE = re.compile(r"^/videos/\d+")

    def matches(self, url: str) -> bool:
        parts = urlsplit(normalize_url(url))
        host = (parts.hostname or "").lower()
        path = parts.path.lower()
        if host in self._CLIP_HOSTS:
            return True
        if host in self._CHANNEL_HOSTS:
            # Clips (/<channel>/clip/<slug>) and VODs (/videos/<id>) — but not
            # live channels (just /<channel>), which aren't a finished file.
            return "/clip/" in path or self._VOD_RE.match(path) is not None
        return False

    def _is_vod(self, url: str) -> bool:
        return self._VOD_RE.match(urlsplit(normalize_url(url)).path.lower()) is not None

    def long_form(self, url: str) -> bool:
        # A whole VOD can run to hours / many GB; clips are short.
        return self._is_vod(url)

    def _video_format(self, preferences: Preferences) -> str:
        cap = HEIGHT_CAP.get((preferences.videoQuality or "best").lower())
        # Twitch clips are progressive MP4 in a resolution ladder, plus mobile
        # "portrait-*" vertical crops we don't want. Take the best standard
        # render at or below the requested height, degrading gracefully.
        if cap is None:
            return "best[format_id!^=portrait]/best"
        return (
            f"best[height<={cap}][format_id!^=portrait]"
            f"/best[height<={cap}]"
            f"/best[format_id!^=portrait]/best"
        )
