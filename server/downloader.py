"""Orchestration between the API and the provider layer.

Provider-agnostic on purpose: it validates that the input is a real URL,
resolves which provider (if any) will handle it, then delegates preparation.
The YouTube-only restriction is expressed as "only the YouTube provider is
registered" — an unknown host resolves to no provider and is rejected cleanly.
"""

from __future__ import annotations

import logging
from urllib.parse import urlsplit

from . import errors, providers
from .jobs import Job
from .models import Preferences
from .providers.base import ProviderResult

log = logging.getLogger("fetcher.downloader")


def _validate_structure(url: str) -> str:
    """Ensure this is at least a syntactically valid http(s) URL and return it
    with a scheme attached. Raises INVALID_URL otherwise — this runs before any
    network call, so a garbage string never reaches yt-dlp."""
    raw = (url or "").strip()
    if not raw:
        raise errors.FetcherError(errors.INVALID_URL)
    candidate = raw if "://" in raw else "https://" + raw
    parts = urlsplit(candidate)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise errors.FetcherError(errors.INVALID_URL)
    # A hostname with no dot (e.g. "localhost", "watch") isn't a real site.
    if "." not in parts.hostname:
        raise errors.FetcherError(errors.INVALID_URL)
    return candidate


def check_supported(url: str) -> None:
    """Fast, network-free validation: is this a syntactically valid URL for an
    enabled provider? Raises INVALID_URL / UNSUPPORTED_PROVIDER otherwise. Used
    by the API to reject bad input before spawning a worker."""
    normalized = _validate_structure(url)
    if providers.resolve(normalized) is None:
        raise errors.FetcherError(errors.UNSUPPORTED_PROVIDER)


def prepare_media(url: str, mode: str, preferences: Preferences, job: Job) -> ProviderResult:
    normalized = _validate_structure(url)

    provider = providers.resolve(normalized)
    if provider is None:
        # Structurally fine, but not a site we allow yet (YouTube only).
        raise errors.FetcherError(errors.UNSUPPORTED_PROVIDER)

    log.info("prepare job=%s provider=%s mode=%s host=%s",
             job.id, provider.name, mode, urlsplit(normalized).hostname)
    result = provider.prepare(normalized, mode, preferences, job)
    log.info("prepared job=%s file=%s (%s)", job.id, result.filename, result.media_type)
    return result
