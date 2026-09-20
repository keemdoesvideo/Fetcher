"""Render shim for edits, Twitch events, social canvases and 7TV overlays.

``chat_export_plus`` owns the proven renderer. This wrapper temporarily teaches
it Fetcher's synthetic event badges, decorates user-highlighted messages,
composites 7TV zero-width modifiers over their base emote, renders real Twitch
badge artwork, and can either shrink the encoded frame around the chat or reshape
the normal full frame for common social-video aspect ratios. Chat exports are
serialized by ``chat_routes`` so these short-lived patches cannot overlap another
render.
"""

from __future__ import annotations

from collections import deque
import math
import threading

from . import chat_badge_render, chat_export_plus

_lock = threading.Lock()


def _has_zero_width(message: dict) -> bool:
    return any(
        isinstance(fragment, dict)
        and fragment.get("emoteUrl")
        and fragment.get("zeroWidth")
        for fragment in (message.get("fragments") or [])
    )


def _prepare_zero_width(
    pil,
    message: dict,
    assets: dict,
    style,
    body_font,
    name_font,
    badge_font,
    bubble_width: str,
):
    """Lay out one message with 7TV zero-width modifiers sharing the base slot."""
    base = chat_export_plus.base
    dummy = pil.Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    measure = pil.ImageDraw.Draw(dummy)
    inner_max = max(180, style.stack_width - 2 * style.pad_x - 2 * style.shadow_pad)
    line_h = max(style.emote_height, round(style.font_size * 1.35))
    name_h = round(style.name_size * 1.25)
    badge_h = max(round(style.badge_size * 1.55), round(name_h * 0.72))
    gap_after_name = max(3, round(style.font_size * 0.18))

    badges = []
    badge_gap = max(3, round(style.font_size * 0.18))
    name_x = 0
    for badge in message.get("badges") or []:
        if not isinstance(badge, dict):
            continue
        label = base._BADGES.get(str(badge.get("setId") or ""))
        if not label:
            continue
        bw = base._text_width(measure, label, badge_font) + max(8, round(style.badge_size * 0.7))
        badges.append((label, bw))
        name_x += bw + badge_gap

    user_name = str((message.get("user") or {}).get("displayName") or "viewer")
    user_w = base._text_width(measure, user_name, name_font)
    name_row_w = name_x + user_w

    # Body tokens are (kind, payload, x, line-index, width). Zero-width emotes
    # reuse the previous emote's visual slot and therefore never advance ``x``.
    tokens = []
    x = 0
    line = 0
    line_widths = [0]
    emote_margin = max(2, round(style.font_size * 0.08))
    last_emote_slot = None
    pending_space = ""

    def new_line():
        nonlocal x, line, last_emote_slot
        line += 1
        x = 0
        line_widths.append(0)
        last_emote_slot = None

    def flush_space():
        nonlocal x, pending_space, last_emote_slot
        if not pending_space:
            return
        width = base._text_width(measure, pending_space, body_font)
        if x == 0:
            pending_space = ""
            return
        if x + width > inner_max:
            new_line()
            pending_space = ""
            return
        tokens.append(("text", pending_space, x, line, width))
        x += width
        line_widths[line] = max(line_widths[line], x)
        pending_space = ""
        last_emote_slot = None

    for fragment in message.get("fragments") or []:
        if not isinstance(fragment, dict):
            continue

        emote_url = base._normalise_url(fragment.get("emoteUrl") or "")
        asset = assets.get(emote_url) if emote_url else None
        if asset:
            if fragment.get("zeroWidth") and last_emote_slot is not None:
                # A 7TV zero-width modifier overlays the previous emote and does
                # not consume the typed separator or any horizontal layout space.
                pending_space = ""
                slot_x, slot_line, slot_width = last_emote_slot
                overlay_w = asset.frames[0].width
                overlay_x = slot_x + round((slot_width - overlay_w) / 2)
                overlay_x = max(0, overlay_x)
                tokens.append(("emote", asset, overlay_x, slot_line, 0))
                line_widths[slot_line] = max(
                    line_widths[slot_line], overlay_x + overlay_w
                )
                continue

            flush_space()
            token_w = asset.frames[0].width + emote_margin * 2
            if x and x + token_w > inner_max:
                new_line()
            content_x = x + emote_margin
            tokens.append(("emote", asset, content_x, line, token_w))
            last_emote_slot = (content_x, line, asset.frames[0].width)
            x += token_w
            line_widths[line] = max(line_widths[line], x)
            continue

        text = str(fragment.get("text") or "")
        for piece in base._split_text(text):
            if not piece:
                continue
            if piece.isspace():
                pending_space += piece
                continue

            flush_space()
            token_w = base._text_width(measure, piece, body_font)
            if x and x + token_w > inner_max:
                new_line()
            tokens.append(("text", piece, x, line, token_w))
            x += token_w
            line_widths[line] = max(line_widths[line], x)
            last_emote_slot = None

    # Trailing whitespace has no visible value inside the bubble, so unlike a
    # separator between normal tokens it can safely be omitted.
    if not tokens:
        fallback = str(message.get("text") or "")
        if fallback:
            tw = min(inner_max, base._text_width(measure, fallback, body_font))
            tokens.append(("text", fallback, 0, 0, tw))
            line_widths = [tw]

    body_w = max(line_widths or [0])
    lines = max(1, len(line_widths))
    content_w = max(name_row_w, body_w, round(style.font_size * 3.0))
    if bubble_width == "uniform":
        box_w = style.stack_width
    else:
        box_w = min(style.stack_width, content_w + 2 * style.pad_x)
    box_h = style.pad_y * 2 + name_h + gap_after_name + lines * line_h
    canvas_w = box_w + style.shadow_pad * 2
    canvas_h = box_h + style.shadow_pad * 2
    image = pil.Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = pil.ImageDraw.Draw(image)

    rect = (
        style.shadow_pad,
        style.shadow_pad,
        style.shadow_pad + box_w,
        style.shadow_pad + box_h,
    )
    shadow_offset = max(2, round(style.shadow_pad * 0.45))
    shadow_rect = (
        rect[0] + shadow_offset,
        rect[1] + shadow_offset,
        rect[2] + shadow_offset,
        rect[3] + shadow_offset,
    )
    draw.rounded_rectangle(shadow_rect, radius=style.radius, fill=(0, 0, 0, 42))
    draw.rounded_rectangle(
        rect,
        radius=style.radius,
        fill=(18, 18, 22, 220),
        outline=(255, 255, 255, 22),
        width=max(1, round(style.width / 1920)),
    )

    origin_x = style.shadow_pad + style.pad_x
    origin_y = style.shadow_pad + style.pad_y
    cursor_x = origin_x
    badge_bg = (145, 70, 255, 64)
    badge_fg = (217, 195, 255, 255)
    for label, bw in badges:
        top = origin_y + max(0, (name_h - badge_h) // 2)
        draw.rounded_rectangle(
            (cursor_x, top, cursor_x + bw, top + badge_h),
            radius=max(3, round(style.badge_size * 0.3)),
            fill=badge_bg,
        )
        tw = base._text_width(draw, label, badge_font)
        draw.text(
            (cursor_x + (bw - tw) / 2, top + max(0, (badge_h - style.badge_size) / 2 - 1)),
            label,
            font=badge_font,
            fill=badge_fg,
        )
        cursor_x += bw + badge_gap

    user_color = base._safe_color((message.get("user") or {}).get("color") or "")
    draw.text((cursor_x, origin_y), user_name, font=name_font, fill=user_color)

    body_y = origin_y + name_h + gap_after_name
    placements = []
    for kind, payload, tx, line_index, _token_w in tokens:
        y = body_y + line_index * line_h
        if kind == "text":
            draw.text((origin_x + tx, y), str(payload), font=body_font, fill=(255, 255, 255, 255))
        else:
            asset = payload
            ey = y + max(0, (line_h - asset.frames[0].height) // 2)
            placements.append(base.EmotePlacement(asset=asset, x=origin_x + tx, y=ey))

    try:
        at = float(message.get("at") or 0.0)
    except (TypeError, ValueError):
        at = 0.0
    return chat_export_plus._Prepared(at=max(0.0, at), base=image, emotes=placements)


def _decorate_highlight(pil, prepared, message: dict, style):
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


def _decorated_prepare(original):
    def prepare(pil, message, assets, style, body_font, name_font, badge_font, bubble_width):
        event = message.get("event") if isinstance(message.get("event"), dict) else None
        if event:
            event_type = str(event.get("type") or "").strip()
            label = str(event.get("label") or event_type.upper() or "EVENT").strip()
            if event_type and label:
                chat_export_plus.base._BADGES[f"event-{event_type}"] = label

        # The proven layout measures text badges. Register a short placeholder for
        # artwork-only badge sets so uncommon Twitch badges still reserve enough
        # room in auto-width bubbles; the placeholder is replaced after layout.
        chat_badge_render.register_fallback_labels(
            message,
            chat_export_plus.base._BADGES,
        )

        if _has_zero_width(message):
            prepared = _prepare_zero_width(
                pil, message, assets, style, body_font, name_font, badge_font, bubble_width
            )
        else:
            prepared = original(
                pil, message, assets, style, body_font, name_font, badge_font, bubble_width
            )

        prepared = chat_badge_render.redraw_name_row(
            pil,
            prepared,
            message,
            assets,
            style,
            name_font,
            badge_font,
            chat_export_plus.base,
        )
        return _decorate_highlight(pil, prepared, message, style)

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
    """Resize a render style around the largest stack this clip can actually show."""
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
        original_collect_urls = chat_export_plus.base._collect_emote_urls
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
        chat_export_plus.base._collect_emote_urls = chat_badge_render.collector_with_badges(
            original_collect_urls,
            chat_export_plus.base,
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
            chat_export_plus.base._collect_emote_urls = original_collect_urls
            chat_export_plus.base._BADGES.clear()
            chat_export_plus.base._BADGES.update(original_badges)
