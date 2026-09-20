"""Shared limits for queued Twitch chat overlay exports.

The base renderer started life with deliberately tiny beta limits. Fetcher now
runs chat exports as serialized background jobs and cleans finished files after
delivery, so the practical ceiling can be much higher without keeping permanent
media on the host.
"""

from __future__ import annotations

import subprocess

from . import chat_export, chat_export_plus, errors

MAX_CHAT_EXPORT_SECONDS = 20 * 60
_LONG_MUX_TIMEOUT_SECONDS = 30 * 60


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


def _mux_sound_long(ffmpeg: str, video, output, sound, fmt: str) -> None:
    """Attach message audio without the old 90-second mux timeout."""
    if fmt == "prores":
        audio_args = ["-c:a", "pcm_s16le"]
    elif fmt == "webm":
        audio_args = ["-c:a", "libopus", "-b:a", "128k"]
    else:
        audio_args = ["-c:a", "aac", "-b:a", "192k"]

    command = [
        ffmpeg,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(video),
        "-i",
        str(sound),
        "-c:v",
        "copy",
    ] + audio_args + ["-shortest"]
    if fmt in {"prores", "greenscreen"}:
        command += ["-movflags", "+faststart"]
    command.append(str(output))

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=_LONG_MUX_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise errors.FetcherError(
            errors.BACKEND_ERROR,
            message="the overlay rendered, but attaching its message sound took too long",
            detail=str(exc),
        ) from exc

    if result.returncode != 0 or not output.is_file() or output.stat().st_size <= 0:
        raise errors.FetcherError(
            errors.BACKEND_ERROR,
            message="the overlay rendered, but its message sound couldn't be attached",
            detail=(result.stderr or "")[-1800:],
        )


def install() -> None:
    """Make the proven renderer use the long-export policy consistently."""
    chat_export.validate_request = validate_request
    chat_export_plus._mux_sound = _mux_sound_long
