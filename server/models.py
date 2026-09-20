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
    # Optional time-range trim for any video-capable source. Free-form timecodes
    # (e.g. "1:23:00") are parsed + validated server-side; blank = whole.
    start: Optional[str] = Field(default=None, max_length=16)
    end: Optional[str] = Field(default=None, max_length=16)

# Prepare now returns a tiny {jobId, mode} dict and the client polls
# /api/progress for status/percent, so there's no fixed response model here.


class PreviewRequest(BaseModel):
    """Open a same-origin scrub-preview session for a video-capable URL."""
    url: str = Field(..., min_length=1, max_length=2048)


class ChatCaptureRequest(BaseModel):
    """Read replay-chat messages from a selected VOD time range."""
    url: str = Field(..., min_length=1, max_length=2048)
    start: str = Field(..., min_length=1, max_length=16)
    end: str = Field(..., min_length=1, max_length=16)
    timingMode: Literal["original", "readable"] = "readable"
    hideBots: bool = False

    # Optional editor decisions keyed by Twitch replay-message id. These are
    # ephemeral request data only; Fetcher never persists chat edits server-side.
    hiddenMessageIds: list[str] = Field(default_factory=list, max_length=500)
    highlightedMessageIds: list[str] = Field(default_factory=list, max_length=500)
    onlyMessageId: Optional[str] = Field(default=None, max_length=256)


class ChatExportRequest(ChatCaptureRequest):
    """Render a loaded Twitch replay-chat range as an editing overlay."""
    format: Literal["prores", "webm", "greenscreen"] = "prores"
    resolution: Literal["1080p", "720p"] = "1080p"
    fps: Literal[30, 60] = 30

    # Overall chat presentation. These change placement/entry motion while
    # keeping the same message content, Twitch badges and third-party cosmetics.
    chatLook: Literal["bubble", "fade-stack", "ticker", "staggered", "spotlight", "emote-cloud"] = "bubble"
    entryAnimation: Literal["slide", "fade", "pop", "float", "instant"] = "slide"
    chatFont: Literal["system", "arial", "helvetica", "verdana", "georgia", "courier"] = "system"

    # Visual parity controls. 20 reference pixels at 1080p maps to the spacing
    # Fetcher's original browser preview used on its desktop stage.
    bubbleWidth: Literal["uniform", "auto"] = "uniform"
    bubbleGap: int = Field(default=20, ge=8, le=40)
    messageLifetime: float = Field(default=12.0, ge=4.0, le=30.0)
    maxVisible: int = Field(default=7, ge=3, le=12)

    # Full can target common editing/social canvases. Tight ignores the aspect
    # preset and sizes the encoded frame around the largest chat stack instead.
    canvasMode: Literal["full", "tight"] = "full"
    canvasAspect: Literal["16:9", "9:16", "4:5", "1:1"] = "16:9"
    canvasPadding: int = Field(default=32, ge=0, le=160)

    # Optional message cue. Custom sounds are sent as a small data URL so the
    # public instance never needs persistent uploads; the renderer caps decoded
    # input to 2 MB / 2 seconds.
    soundPreset: Literal["off", "pop", "tick", "bubble", "custom"] = "off"
    soundVolume: int = Field(default=65, ge=0, le=100)
    soundMinGapMs: int = Field(default=120, ge=0, le=1000)
    soundData: Optional[str] = Field(default=None, max_length=3_000_000)