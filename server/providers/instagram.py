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

from .. import errors
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

    def _classify(self, message: str, last_error: str | None) -> errors.FetcherError:
        """Keep Instagram's actionable cookie hint local to Instagram.

        LOGIN_REQUIRED is shared by all providers, so the global copy must stay
        provider-neutral; otherwise a TikTok login/rate-limit response can be
        mislabeled as an Instagram problem in the UI.
        """
        err = super()._classify(message, last_error)
        if err.code == errors.LOGIN_REQUIRED:
            return errors.FetcherError(
                errors.LOGIN_REQUIRED,
                message="instagram needs you to be logged in — enable cookies in the readme, then retry",
                detail=err.detail or message,
            )
        return err
