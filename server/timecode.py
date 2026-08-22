"""Parse user-entered timecodes for section trimming.

Accepts plain seconds ("90"), m:ss ("1:30"), or h:mm:ss ("1:02:03"). Pure — it
raises ValueError on bad input; the API layer turns that into a friendly error.
"""

from __future__ import annotations

from typing import Optional, Tuple

# When only a start is given, download to the end of the media. yt-dlp clamps an
# over-long end to the real duration, so a large sentinel means "to the end".
_OPEN_END = 10 ** 9


def parse_timestamp(value: Optional[str]) -> Optional[float]:
    """'1:23', '1:02:03', '90', '90.5' -> seconds. None/blank -> None."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    parts = value.split(":")
    if len(parts) > 3:
        raise ValueError("too many ':' groups")
    total = 0.0
    for part in parts:
        part = part.strip()
        try:
            n = float(part)
        except ValueError as exc:
            raise ValueError(f"not a number: {part!r}") from exc
        if n < 0:
            raise ValueError("negative time")
        total = total * 60 + n
    return total


def parse_section(start: Optional[str], end: Optional[str]) -> Optional[Tuple[float, float]]:
    """Both blank -> None (whole media). Otherwise a (start, end) seconds tuple
    (end is a large sentinel when only a start was given). Raises ValueError if
    the times are malformed or end is not after start."""
    s = parse_timestamp(start)
    e = parse_timestamp(end)
    if s is None and e is None:
        return None
    s = 0.0 if s is None else s
    e_val = _OPEN_END if e is None else e
    if e is not None and e_val <= s:
        raise ValueError("end must be after start")
    return (s, e_val)
