"""X (Twitter) provider.

Public video tweets extract fine logged-out via yt-dlp — no cookies needed
(unlike Instagram). Matches status URLs only (`/…/status/<id>`, incl. `/i/status/`
and `/i/web/status/`) on x.com and twitter.com; profiles and timelines aren't
media. A text/image tweet yields a clean "no media" error. Video + audio, using
the shared H.264/AAC pipeline.
"""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from .ytdlp_base import YtdlpProvider, normalize_url


class XProvider(YtdlpProvider):
    name = "x"
    ALLOWED_HOSTS = {
        "x.com", "www.x.com", "mobile.x.com",
        "twitter.com", "www.twitter.com", "mobile.twitter.com",
    }
    _STATUS_RE = re.compile(r"/status/\d+")

    def matches(self, url: str) -> bool:
        parts = urlsplit(normalize_url(url))
        host = (parts.hostname or "").lower()
        if host not in self.ALLOWED_HOSTS:
            return False
        return self._STATUS_RE.search(parts.path) is not None
