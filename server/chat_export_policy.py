"""Shared limits for queued Twitch chat overlay exports.

The base renderer started life with deliberately tiny beta limits. Fetcher now
runs chat exports as serialized background jobs and cleans finished files after
delivery, so the practical ceiling can be much higher without keeping permanent
media on the host.
"""

from __future__ import annotations

from . import chat_export, errors

MAX_CHAT_EXPORT_SECONDS = 20 * 60


def validate_request(fmt: str, resolution: str, fps: int, duration: float) -> None:
    """Validate an overlay export using Fetcher's current 20-minute ceiling."""
    if fmt not in chat_export._FORMATS or resolution not in chat_export._RESOLUTIONS or fps not in {30, 60}:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="check those export settings and try again",
        )
    if duration <= 0:
        raise errors.FetcherError(errors.INVALID_SECTION)
    if duration > MAX_CHAT_EXPORT_SECONDS:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="chat exports can be up to 20 minutes at a time",
        )


def install() -> None:
    """Make the proven renderer use this policy without duplicating it."""
    chat_export.validate_request = validate_request
