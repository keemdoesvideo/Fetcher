"""Twitch provider — clips and finished VODs.

Twitch clips are short progressive files, while VODs are long-form HLS media.
Live channels are intentionally unsupported because they are not finished files.
"""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from .. import jobs as jobstate
from ..jobs import Job
from ..models import Preferences
from .base import ProviderResult
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

    def prepare(
        self,
        url: str,
        mode: str,
        preferences: Preferences,
        job: Job,
    ) -> ProviderResult:
        # yt-dlp resolves Twitch VOD metadata and the HLS playlist inside the same
        # extract_info(download=True) call that performs the actual fetch. On very
        # long/trimmed VODs that means progress hooks may not fire for a while,
        # leaving the UI stuck on "sniffing it out…" even though the real media
        # operation is underway. Mark VODs as an active download up front; the
        # normal hooks will replace the indeterminate state with a percentage when
        # yt-dlp provides byte/fragment totals.
        if self._is_vod(url):
            job.status = jobstate.DOWNLOADING
            job.stage = "downloading"
            job.progress = 0.0
        return super().prepare(url, mode, preferences, job)

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
