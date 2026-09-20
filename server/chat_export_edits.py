"""Small render shim for per-message highlight accents.

``chat_export_plus`` owns the proven renderer. Rather than duplicate that large
module, this wrapper temporarily decorates its prepared message image when the
payload carries Fetcher's internal highlight marker. Chat exports are serialized
by ``chat_routes`` so the short-lived patch cannot overlap another render.
"""

from __future__ import annotations

import threading

from . import chat_export_plus

_lock = threading.Lock()


def _decorated_prepare(original):
    def prepare(pil, message, assets, style, body_font, name_font, badge_font, bubble_width):
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

        # A soft outer accent plus a crisp purple edge keeps highlighted chat
        # obvious without changing the text/emote artwork underneath it.
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
    """Render through the existing pipeline with highlight decoration enabled."""
    with _lock:
        original = chat_export_plus._prepare_message
        chat_export_plus._prepare_message = _decorated_prepare(original)
        try:
            return chat_export_plus.render(*args, **kwargs)
        finally:
            chat_export_plus._prepare_message = original
