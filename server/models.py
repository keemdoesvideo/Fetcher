"""Request/response schemas for the Fetcher API.

Deliberately small and provider-agnostic: the frontend speaks in modes
(video/audio) and the same preference vocabulary Settings already uses. It has
no idea yt-dlp or YouTube exist.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Mode = Literal["video", "audio"]


class Preferences(BaseModel):
    """Mirror of the values Settings stores (see fetcher-prefs.js). All optional
    so a caller can send only what's relevant to the chosen mode; the provider
    falls back to sensible defaults for anything missing."""

    filenameStyle: Optional[str] = "clean"     # clean | original
    videoQuality: Optional[str] = None         # best | 4k | 1440p | 1080p | 720p | 480p
    videoFormat: Optional[str] = None          # mp4 (fixed for now)
    audioQuality: Optional[str] = None         # best | 320 | 256 | 192 | 128
    audioFormat: Optional[str] = None          # mp3 (fixed for now)

    # Ignore anything unexpected rather than 422-ing the whole request.
    model_config = {"extra": "ignore"}


class PrepareRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    mode: Mode = "video"
    preferences: Preferences = Field(default_factory=Preferences)
    # Optional time-range trim (long-form sources like Twitch VODs). Free-form
    # timecodes (e.g. "1:23:00") parsed + validated server-side; blank = whole.
    start: Optional[str] = Field(default=None, max_length=16)
    end: Optional[str] = Field(default=None, max_length=16)

# Prepare now returns a tiny {jobId, mode} dict and the client polls
# /api/progress for status/percent, so there's no fixed response model here.


class PreviewRequest(BaseModel):
    """Open an HLS preview-proxy session for a long-form URL (VOD scrub-to-trim)."""
    url: str = Field(..., min_length=1, max_length=2048)
