"""Provider layer.

Each provider knows how to recognise and prepare media from one family of
sites. Today there is exactly one — YouTube — but the registry is how new
providers (TikTok, Vimeo, …) will be added later without the API or frontend
changing. Resolution is "first provider that claims the URL wins".
"""

from __future__ import annotations

from .base import Provider, ProviderResult
from .youtube import YouTubeProvider

# Ordered registry. YouTube is the only enabled provider for this pass.
REGISTRY: list[Provider] = [YouTubeProvider()]


def resolve(url: str) -> Provider | None:
    for provider in REGISTRY:
        if provider.matches(url):
            return provider
    return None


__all__ = ["Provider", "ProviderResult", "REGISTRY", "resolve"]
