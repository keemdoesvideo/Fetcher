"""Render shim for message edits, Twitch events and alternate chat canvases.

``chat_export_plus`` owns the proven renderer. This wrapper temporarily teaches
it Fetcher's synthetic event badges, decorates user-highlighted messages, and
can either shrink the encoded frame around the chat or reshape the normal full
frame for common social-video aspect ratios. Chat exports are serialized by
``chat_routes`` so these short-lived patches cannot overlap another render.
"""

from __future__ import annotations

from collections import deque
import math
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


def _even(value: float) -> int:
    """Video codecs used here are happiest with even frame dimensions."""
    return max(2, int(math.ceil(float(value) / 2.0) * 2))


def _reshape_style(style, aspect: str) -> None:
    """Turn the normal landscape style into a social-video full frame.

    Font, badge and emote sizes stay at the selected 1080p/720p scale. Only the
    canvas and available bubble width change, so a vertical export does not make
    chat text mysteriously tiny just because its frame is narrow.
    """
    if aspect == "16:9":
        return

    short_edge = int(style.height)
    if aspect == "9:16":
        width, height = short_edge, round(short_edge * 16 / 9)
    elif aspect == "4:5":
        width, height = short_edge, round(short_edge * 5 / 4)
    elif aspect == "1:1":
        width, height = short_edge, short_edge
    else:
        return

    width = _even(width)
    height = _even(height)
    side_margin = max(12, round(width * 0.05))

    style.width = width
    style.height = height
    style.stack_left = side_margin
    style.stack_bottom = max(12, round(height * 0.05))
    style.stack_width = max(180, min(int(style.stack_width), width - side_margin * 2))


def _tighten_style(style, prepared, *, bubble_gap: int, message_ttl: float, max_visible: int, padding: int) -> None:
    """Resize a render style around the largest stack this clip can actually show.

    Message artwork is prepared using the normal 1080p/720p reference style first,
    so font/emote/bubble sizes remain identical to full-frame exports. Only the
    final encoded canvas and stack origin change.
    """
    if not prepared:
        return

    scale = max(0.01, float(style.height) / 1080.0)
    pad = max(0, round(max(0, int(padding)) * scale))
    visible_gap = round(max(8, min(40, int(bubble_gap))) * scale)
    effective_gap = visible_gap - int(style.shadow_pad) * 2
    ttl = max(4.0, min(30.0, float(message_ttl)))
    visible_limit = max(3, min(12, int(max_visible)))

    max_width = max(int(item.base.width) for item in prepared)

    active = deque()
    active_height = 0
    max_stack_height = 0
    for item in prepared:
        at = float(item.at)
        while active and at - active[0][0] >= ttl:
            _old_at, old_height = active.popleft()
            active_height -= old_height
        height = int(item.base.height)
        active.append((at, height))
        active_height += height
        while len(active) > visible_limit:
            _old_at, old_height = active.popleft()
            active_height -= old_height
        count = len(active)
        stack_height = active_height + (effective_gap * (count - 1) if count > 1 else 0)
        max_stack_height = max(max_stack_height, stack_height)

    # Entry animation can shift a bubble down by up to 8 px. Keep that motion
    # inside the frame even when the user chooses zero extra padding.
    motion_pad = 8
    style.width = _even(max_width + pad * 2)
    style.height = _even(max_stack_height + pad * 2 + motion_pad)
    style.stack_left = pad
    style.stack_bottom = pad + motion_pad


def _prepared_with_canvas(
    original,
    *,
    canvas_mode: str,
    canvas_aspect: str,
    bubble_gap: int,
    message_ttl: float,
    max_visible: int,
    padding: int,
):
    def prepare_messages(pil, payload, assets, style, job, bubble_width):
        # Full-frame social presets must reshape before message layout so wrapping
        # respects the narrower vertical/square canvas. Tight mode deliberately
        # keeps the proven landscape chat sizing, then crops around the result.
        if canvas_mode == "full":
            _reshape_style(style, canvas_aspect)
        prepared = original(pil, payload, assets, style, job, bubble_width)
        if canvas_mode == "tight":
            _tighten_style(
                style,
                prepared,
                bubble_gap=bubble_gap,
                message_ttl=message_ttl,
                max_visible=max_visible,
                padding=padding,
            )
        return prepared

    return prepare_messages


def render(*args, **kwargs):
    """Render through the existing pipeline with edits/events/canvas options."""
    canvas_mode = str(kwargs.pop("canvas_mode", "full") or "full").lower()
    if canvas_mode not in {"full", "tight"}:
        canvas_mode = "full"
    canvas_aspect = str(kwargs.pop("canvas_aspect", "16:9") or "16:9")
    if canvas_aspect not in {"16:9", "9:16", "4:5", "1:1"}:
        canvas_aspect = "16:9"
    canvas_padding = max(0, min(160, int(kwargs.pop("canvas_padding", 32))))
    bubble_gap = int(kwargs.get("bubble_gap", 20))
    message_ttl = float(kwargs.get("message_ttl", 12.0))
    max_visible = int(kwargs.get("max_visible", 7))

    with _lock:
        original_prepare = chat_export_plus._prepare_message
        original_prepare_messages = chat_export_plus._prepare_messages
        original_badges = dict(chat_export_plus.base._BADGES)
        chat_export_plus._prepare_message = _decorated_prepare(original_prepare)
        chat_export_plus._prepare_messages = _prepared_with_canvas(
            original_prepare_messages,
            canvas_mode=canvas_mode,
            canvas_aspect=canvas_aspect,
            bubble_gap=bubble_gap,
            message_ttl=message_ttl,
            max_visible=max_visible,
            padding=canvas_padding,
        )
        try:
            result = chat_export_plus.render(*args, **kwargs)
            if isinstance(result, tuple) and len(result) == 3:
                output, filename, media_type = result
                suffix = ""
                if canvas_mode == "tight":
                    suffix = "-tight"
                elif canvas_aspect != "16:9":
                    suffix = "-" + canvas_aspect.replace(":", "x")
                if suffix:
                    dot = filename.rfind(".")
                    if dot > 0:
                        filename = filename[:dot] + suffix + filename[dot:]
                    else:
                        filename += suffix
                return output, filename, media_type
            return result
        finally:
            chat_export_plus._prepare_message = original_prepare
            chat_export_plus._prepare_messages = original_prepare_messages
            chat_export_plus.base._BADGES.clear()
            chat_export_plus.base._BADGES.update(original_badges)
