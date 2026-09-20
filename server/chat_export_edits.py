"""Small render shim for per-message edits and Twitch event badges.

``chat_export_plus`` owns the proven renderer. Rather than duplicate that large
module, this wrapper temporarily teaches it Fetcher's synthetic event badges and
decorates user-highlighted messages. Chat exports are serialized by
``chat_routes`` so these short-lived patches cannot overlap another render.
"""

from __future__ import annotations

import threading

from . import chat_export_plus

_lock = threading.Lock()


def _decorated_prepare(original):
    def prepare(pil, message, assets, style, body_font, name_font, badge_font, bubble_width):
        # Event messages carry a synthetic badge such as ``event-bits``. Register
        # its actual per-message label immediately before layout so amounts like
        # "500 BITS" or "5× GIFT" survive into the exported overlay.
        event = message.get("event") if isinstance(message.get("event"), dict) else None
        if event:
            event_type = str(event.get("type") or "").strip()
            label = str(event.get("label") or event_type.upper() or "EVENT").strip()
            if event_type and label:
                chat_export_plus.base._BADGES[f"event-{event_type}"] = label

        prepared = original(
            pil, message, assets, style, body_font, name_font, badge_font, bubble_width
        )
        if not message.get("_fetcherHighlight"):
            return prepared

        image = prepared.base
        draw = pil.ImageDraw.Draw(image)
        pad = max(1, int(style.shadow_pad))
        rect = (pad, pad, max(pad + 1, image.width - pad), max(pad + 1, image.height - pad))
        glow_width = max(3, round(style.width / 640))
        line_width = max(2, round(style.width / 960))

        # A soft outer accent plus a crisp purple edge keeps manually highlighted
        # chat obvious without changing the text/emote artwork underneath it.
        try:
            draw.rounded_rectangle(
                rect,
                radius=style.radius,
                outline=(145, 70, 255, 74),
                width=glow_width,
            )
            inset = max(1, line_width)
            inner = (
                rect[0] + inset,
                rect[1] + inset,
                rect[2] - inset,
                rect[3] - inset,
            )
            draw.rounded_rectangle(
                inner,
                radius=max(2, style.radius - inset),
                outline=(190, 143, 255, 235),
                width=line_width,
            )
        except Exception:
            pass
        return prepared

    return prepare


def render(*args, **kwargs):
    """Render through the existing pipeline with edits + event labels enabled."""
    with _lock:
        original_prepare = chat_export_plus._prepare_message
        original_badges = dict(chat_export_plus.base._BADGES)
        chat_export_plus._prepare_message = _decorated_prepare(original_prepare)
        try:
            return chat_export_plus.render(*args, **kwargs)
        finally:
            chat_export_plus._prepare_message = original_prepare
            chat_export_plus.base._BADGES.clear()
            chat_export_plus.base._BADGES.update(original_badges)
