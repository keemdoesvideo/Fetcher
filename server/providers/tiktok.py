"""TikTok provider.

A thin subclass of YtdlpProvider. Two TikTok specifics:

  * Hosts include the short share domains (vm./vt.tiktok.com), which yt-dlp
    follows through their redirects to the real video.
  * Watermark: TikTok exposes a watermarked "download" format alongside the
    clean playback streams. We exclude it so fetched videos are never stamped.

TikTok has no resolution ladder (clips are a single vertical size), so the
saved video-quality preference doesn't meaningfully apply here — we always take
the best clean stream. Audio mode reuses the shared path: yt-dlp picks TikTok's
direct audio and FFmpeg writes it out as MP3 at the chosen quality.
"""

from __future__ import annotations

from ..models import Preferences
from .ytdlp_base import YtdlpProvider


class TikTokProvider(YtdlpProvider):
    name = "tiktok"
    ALLOWED_HOSTS = {
        "tiktok.com", "www.tiktok.com", "m.tiktok.com",
        "vm.tiktok.com", "vt.tiktok.com",
    }

    def _video_format(self, preferences: Preferences) -> str:
        # Pick the best NON-watermarked progressive stream (TikTok's watermarked
        # copy has format_id "download", so we exclude it). Prefer H.264 for
        # universal playback: TikTok also offers HEVC (bytevc1) encodes, often at
        # higher resolution, but HEVC-in-MP4 doesn't play in every browser — so
        # we take the best clean H.264 first, then any clean stream (e.g. HEVC if
        # that's all there is), then fall back to best of all as a last resort.
        return (
            "best[vcodec^=h264][format_id!=download]"
            "/best[vcodec^=avc][format_id!=download]"
            "/best[format_id!=download]"
            "/best"
        )
