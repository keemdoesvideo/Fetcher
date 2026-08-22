"""Instagram provider.

Instagram walls off logged-out access — yt-dlp gets an "empty media response"
for reels/posts unless it has login cookies. So this provider is opt-in on
cookies: set FETCHER_COOKIES_FROM_BROWSER or FETCHER_COOKIES_FILE (see the
README) and Fetcher uses that session. Without cookies it returns a clear
"needs login" error rather than failing cryptically. No credentials are ever
stored in the repo — cookies stay on the user's machine.

Matches media URLs only — posts (/p/), reels (/reel/, /reels/), and IGTV
(/tv/), including the /<user>/reel/<code> form — not profiles, stories, or
explore pages.
"""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from .ytdlp_base import YtdlpProvider, normalize_url


class InstagramProvider(YtdlpProvider):
    name = "instagram"
    USES_COOKIES = True
    ALLOWED_HOSTS = {
        "instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am",
    }
    _MEDIA_RE = re.compile(r"/(p|reel|reels|tv)/[^/]+")

    def matches(self, url: str) -> bool:
        parts = urlsplit(normalize_url(url))
        host = (parts.hostname or "").lower()
        if host not in self.ALLOWED_HOSTS:
            return False
        return self._MEDIA_RE.search(parts.path.lower()) is not None
