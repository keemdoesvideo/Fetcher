"""SoundCloud provider.

A thin, audio-only subclass of YtdlpProvider. SoundCloud hosts tracks (no
video), so it declares MODES = {"audio"} — the API rejects a video request for
a SoundCloud link, and the frontend greys out the Video toggle when it detects
one. Audio uses the shared path: yt-dlp takes the best available audio and
FFmpeg writes MP3 at the chosen quality.

Short share links (on.soundcloud.com/…) are followed by yt-dlp to the track.
"""

from __future__ import annotations

from .ytdlp_base import YtdlpProvider


class SoundCloudProvider(YtdlpProvider):
    name = "soundcloud"
    MODES = {"audio"}
    ALLOWED_HOSTS = {
        "soundcloud.com", "www.soundcloud.com", "m.soundcloud.com",
        "on.soundcloud.com",
    }
