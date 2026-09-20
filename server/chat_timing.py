"""Timing helpers for Twitch replay chat.

Twitch replay comments can share the same coarse timestamp, especially in busy
chat. ``readable`` mode keeps message order but gently fans same-second bursts
across a short window so the overlay does not dump several bubbles on one frame.
The original absolute VOD offsets remain untouched; only the relative ``at``
value used by preview/export is adjusted.
"""

from __future__ import annotations

import math


def apply(payload: dict, mode: str = "readable") -> dict:
    mode = "original" if mode == "original" else "readable"
    payload["timingMode"] = mode
    messages = payload.get("messages")
    if mode == "original" or not isinstance(messages, list) or len(messages) < 2:
        return payload

    # Work in original order first, then restore strict chronological ordering.
    ordered = [m for m in messages if isinstance(m, dict)]
    ordered.sort(key=lambda item: (float(item.get("offset") or 0.0), str(item.get("id") or "")))

    groups: list[list[dict]] = []
    current: list[dict] = []
    current_second: int | None = None
    for message in ordered:
        try:
            absolute = float(message.get("offset") or 0.0)
        except (TypeError, ValueError):
            absolute = 0.0
        second = int(math.floor(max(0.0, absolute)))
        if current and second != current_second:
            groups.append(current)
            current = []
        current.append(message)
        current_second = second
    if current:
        groups.append(current)

    section_start = float(payload.get("start") or 0.0)
    for index, group in enumerate(groups):
        if len(group) <= 1:
            continue
        try:
            first_abs = float(group[0].get("offset") or section_start)
        except (TypeError, ValueError):
            first_abs = section_start
        base_at = max(0.0, first_abs - section_start)

        # Keep the burst inside the same general moment and leave breathing room
        # before the next timestamp group. A busy 4-message burst becomes roughly
        # 0ms / 180ms / 360ms / 540ms instead of all appearing in one frame.
        next_at = None
        if index + 1 < len(groups):
            try:
                next_abs = float(groups[index + 1][0].get("offset") or 0.0)
                next_at = max(0.0, next_abs - section_start)
            except (TypeError, ValueError):
                next_at = None
        available = 0.72
        if next_at is not None:
            available = max(0.0, min(0.72, next_at - base_at - 0.04))
        spacing = min(0.18, available / max(1, len(group) - 1)) if available > 0 else 0.0
        for offset, message in enumerate(group):
            message["at"] = round(base_at + spacing * offset, 3)

    messages.sort(key=lambda item: (float(item.get("at") or 0.0), str(item.get("id") or "")))
    return payload
