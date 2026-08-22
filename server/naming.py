"""Safe, cross-platform filename construction.

The browser-facing download name is derived from untrusted video metadata, so it
is aggressively sanitized: no path separators, none of Windows' reserved
characters, no reserved device names, no leading/trailing dots or spaces, and a
length cap. The result is only ever used in a Content-Disposition header — never
as an on-disk path — but we sanitize as if it could be, defence in depth.
"""

from __future__ import annotations

import re

from . import config

# Characters illegal on Windows (superset of macOS/Linux needs) plus control chars.
_ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_WHITESPACE = re.compile(r"\s+")
# Windows reserved device names (case-insensitive), with or without extension.
_RESERVED = {
    "con", "prn", "aux", "nul",
    *(f"com{i}" for i in range(1, 10)),
    *(f"lpt{i}" for i in range(1, 10)),
}


def sanitize_stem(value: str, fallback: str = "fetch") -> str:
    """Clean an arbitrary title into a safe filename stem (no extension)."""
    if not value:
        return fallback
    # Drop directory traversal outright, then illegal characters.
    value = value.replace("/", " ").replace("\\", " ")
    value = _ILLEGAL.sub("", value)
    value = _WHITESPACE.sub(" ", value).strip()
    # Trailing dots/spaces are invalid on Windows.
    value = value.strip(" .")
    if not value:
        return fallback
    if value.split(".")[0].lower() in _RESERVED:
        value = f"_{value}"
    if len(value) > config.MAX_FILENAME_STEM:
        value = value[: config.MAX_FILENAME_STEM].strip(" .")
    return value or fallback


def build_download_name(title: str | None, creator: str | None, ext: str,
                        style: str = "clean") -> str:
    """Compose the final download filename.

    clean    -> "Title - Creator.ext"
    original -> "Title.ext" (the source-derived title, still sanitized)
    """
    ext = ext.lstrip(".").lower() or "bin"
    title = (title or "").strip()

    if style == "original":
        stem = sanitize_stem(title, fallback="fetch")
        return f"{stem}.{ext}"

    creator = (creator or "").strip()
    if creator and creator.lower() not in title.lower():
        combined = f"{title} - {creator}"
    else:
        combined = title
    stem = sanitize_stem(combined, fallback="fetch")
    return f"{stem}.{ext}"
