"""YouTube provider.

A thin subclass of YtdlpProvider (see ytdlp_base.py) — it only declares the
allowed YouTube hosts (watch URLs + Shorts). Everything else — quality-aware
format selection, MP4 merge / MP3 extraction, progress/cancel, filenames, error
mapping — is the shared yt-dlp machinery.

PO Tokens: this implements yt-dlp's standard extraction path only. If YouTube
starts demanding a PO Token for important formats, that surfaces as a BOT_CHECK
error (logged with the real reason) — the fix is yt-dlp's supported PO Token
Provider plugin, documented in the README, not a homemade workaround.
"""

from __future__ import annotations

from .ytdlp_base import YtdlpProvider


class YouTubeProvider(YtdlpProvider):
    name = "youtube"
    # Exactly the hosts we allow — no arbitrary yt-dlp sites slip through.
    ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
