"""Provider interface.

A provider takes a validated URL + mode + preferences and a job (which owns an
isolated temp directory), prepares the media on disk, and returns where it landed
plus the user-facing filename. All site- and yt-dlp-specific logic lives behind
this boundary; the API and frontend never see it.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..jobs import Job
from ..models import Preferences


@dataclass
class ProviderResult:
    filepath: Path            # prepared file on disk (inside the job dir)
    filename: str             # sanitized, user-facing download name
    media_type: str           # MIME type for the download response
    title: Optional[str] = None


class Provider:
    """Base class. Subclasses set `name` and implement matches()/prepare()."""

    name: str = "base"

    # Which fetch modes this provider can produce. Most sites do both; audio-only
    # sources (e.g. SoundCloud) narrow this to {"audio"}, and the UI adapts —
    # greying out the modes a link can't deliver. Order-independent (a set).
    MODES: set[str] = {"video", "audio"}

    def supports(self, mode: str) -> bool:
        return mode in self.MODES

    def long_form(self, url: str) -> bool:
        """True if this URL can be very long (hours / many GB) — e.g. a full
        Twitch VOD. The API grants such a full download a longer timeout, and the
        UI offers a section trim. Default False (clips, tracks, normal videos)."""
        return False

    def matches(self, url: str) -> bool:
        raise NotImplementedError

    def prepare(self, url: str, mode: str, preferences: Preferences, job: Job) -> ProviderResult:
        raise NotImplementedError
