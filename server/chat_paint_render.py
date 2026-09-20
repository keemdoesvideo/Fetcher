"""Pillow helpers for 7TV username paints in exported chat overlays."""

from __future__ import annotations

import math


def _hex_rgba(value: object, alpha: object = 1.0) -> tuple[int, int, int, int] | None:
    raw = str(value or "").strip()
    if len(raw) != 7 or not raw.startswith("#"):
        return None
    try:
        r = int(raw[1:3], 16)
        g = int(raw[3:5], 16)
        b = int(raw[5:7], 16)
        a = max(0.0, min(1.0, float(alpha)))
    except (TypeError, ValueError):
        return None
    return r, g, b, round(a * 255)


def _badge_cursor_x(pil, message: dict, assets: dict, style, badge_font, base) -> int:
    """Return the username x-position used by the badge renderer/layout."""
    name_h = round(style.name_size * 1.25)
    badge_h = max(round(style.badge_size * 1.55), round(name_h * 0.72))
    badge_gap = max(3, round(style.font_size * 0.18))
    cursor_x = style.shadow_pad + style.pad_x

    dummy = pil.Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    measure = pil.ImageDraw.Draw(dummy)
    for badge in message.get("badges") or []:
        if not isinstance(badge, dict):
            continue
        url = base._normalise_url(badge.get("imageUrl") or "")
        asset = assets.get(url) if url else None
        if asset and asset.frames:
            frame = asset.frames[0]
            target_h = max(12, badge_h)
            target_w = max(1, round(frame.width * (target_h / max(1, frame.height))))
            cursor_x += target_w + badge_gap
            continue

        set_id = str(badge.get("setId") or "")
        label = str(base._BADGES.get(set_id) or badge.get("title") or "").strip()
        if not label:
            continue
        bw = base._text_width(measure, label, badge_font) + max(8, round(style.badge_size * 0.7))
        cursor_x += bw + badge_gap
    return round(cursor_x)


def _stops(paint: dict) -> list[tuple[float, tuple[int, int, int, int]]]:
    output = []
    for item in paint.get("stops") or []:
        if not isinstance(item, dict):
            continue
        color = _hex_rgba(item.get("color"), item.get("alpha", 1.0))
        if not color:
            continue
        try:
            at = max(0.0, min(1.0, float(item.get("at") or 0.0)))
        except (TypeError, ValueError):
            continue
        output.append((at, color))
    output.sort(key=lambda item: item[0])
    return output


def _mix(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float):
    t = max(0.0, min(1.0, t))
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def _sample(stops, t: float):
    if not stops:
        return 255, 255, 255, 255
    if t <= stops[0][0]:
        return stops[0][1]
    if t >= stops[-1][0]:
        return stops[-1][1]
    for index in range(1, len(stops)):
        left_at, left_color = stops[index - 1]
        right_at, right_color = stops[index]
        if t <= right_at:
            span = max(1e-6, right_at - left_at)
            return _mix(left_color, right_color, (t - left_at) / span)
    return stops[-1][1]


def _gradient_image(pil, width: int, height: int, paint: dict):
    kind = str(paint.get("kind") or "solid")
    if kind == "solid":
        color = _hex_rgba(paint.get("color"), paint.get("alpha", 1.0)) or (255, 255, 255, 255)
        return pil.Image.new("RGBA", (width, height), color)

    stops = _stops(paint)
    if not stops:
        color = _hex_rgba(paint.get("color"), paint.get("alpha", 1.0)) or (255, 255, 255, 255)
        return pil.Image.new("RGBA", (width, height), color)

    repeat = bool(paint.get("repeat"))
    stop_min = stops[0][0]
    stop_max = stops[-1][0]
    repeat_span = max(1e-6, stop_max - stop_min)

    def normalize(t: float) -> float:
        t = max(0.0, min(1.0, t))
        if repeat and repeat_span < 0.999:
            return stop_min + ((t - stop_min) % repeat_span)
        return t

    pixels = []
    if kind == "radial":
        cx = (width - 1) / 2.0
        cy = (height - 1) / 2.0
        rx = max(1.0, width / 2.0)
        ry = max(1.0, height / 2.0)
        for y in range(height):
            ny = (y - cy) / ry
            for x in range(width):
                nx = (x - cx) / rx
                t = min(1.0, math.sqrt(nx * nx + ny * ny))
                pixels.append(_sample(stops, normalize(t)))
    else:
        # CSS/7TV linear-gradient angles: 0deg points upward, 90deg right.
        try:
            angle = math.radians(float(paint.get("angle") or 0.0) % 360.0)
        except (TypeError, ValueError):
            angle = 0.0
        dx = math.sin(angle)
        dy = -math.cos(angle)
        cx = (width - 1) / 2.0
        cy = (height - 1) / 2.0
        projections = [
            (x - cx) * dx + (y - cy) * dy
            for x, y in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))
        ]
        low, high = min(projections), max(projections)
        span = max(1e-6, high - low)
        for y in range(height):
            for x in range(width):
                projection = (x - cx) * dx + (y - cy) * dy
                pixels.append(_sample(stops, normalize((projection - low) / span)))

    image = pil.Image.new("RGBA", (width, height), (0, 0, 0, 0))
    image.putdata(pixels)
    return image


def _shadow_padding(paint: dict, scale: float) -> int:
    extent = 2.0
    for shadow in paint.get("shadows") or []:
        if not isinstance(shadow, dict):
            continue
        try:
            extent = max(
                extent,
                abs(float(shadow.get("x") or 0.0)) * scale + float(shadow.get("radius") or 0.0) * scale,
                abs(float(shadow.get("y") or 0.0)) * scale + float(shadow.get("radius") or 0.0) * scale,
            )
        except (TypeError, ValueError):
            continue
    return max(2, min(96, math.ceil(extent) + 2))


def redraw_username(pil, prepared, message: dict, assets: dict, style, name_font, badge_font, base):
    """Replace the normal Twitch solid username with its resolved 7TV paint."""
    user = message.get("user") if isinstance(message.get("user"), dict) else {}
    paint = user.get("paint") if isinstance(user.get("paint"), dict) else None
    if not paint:
        return prepared

    user_name = str(user.get("displayName") or "viewer")
    if not user_name:
        return prepared

    image = prepared.base
    draw = pil.ImageDraw.Draw(image)
    origin_y = style.shadow_pad + style.pad_y
    cursor_x = _badge_cursor_x(pil, message, assets, style, badge_font, base)
    name_h = round(style.name_size * 1.25)
    name_w = max(1, base._text_width(draw, user_name, name_font))

    # Remove the solid-colour username drawn by the proven base renderer, without
    # disturbing badges immediately to its left or the message body below it.
    clear_right = min(image.width - style.shadow_pad, cursor_x + name_w + 4)
    draw.rectangle(
        (cursor_x, origin_y, max(cursor_x + 1, clear_right), origin_y + name_h),
        fill=(18, 18, 22, 220),
    )

    scale = max(0.5, float(style.name_size) / 14.0)
    pad = _shadow_padding(paint, scale)
    layer_w = max(2, name_w + pad * 2 + 4)
    layer_h = max(2, name_h + pad * 2 + 4)
    mask = pil.Image.new("L", (layer_w, layer_h), 0)
    mask_draw = pil.ImageDraw.Draw(mask)
    mask_draw.text((pad, pad), user_name, font=name_font, fill=255)

    try:
        from PIL import ImageFilter
    except ImportError:
        ImageFilter = None

    # 7TV paints may carry glow/drop-shadow definitions. Draw those first so the
    # final gradient/solid glyphs stay crisp on top.
    if ImageFilter is not None:
        for shadow in paint.get("shadows") or []:
            if not isinstance(shadow, dict):
                continue
            color = _hex_rgba(shadow.get("color"), shadow.get("alpha", 1.0))
            if not color:
                continue
            try:
                dx = round(float(shadow.get("x") or 0.0) * scale)
                dy = round(float(shadow.get("y") or 0.0) * scale)
                radius = max(0.0, min(60.0, float(shadow.get("radius") or 0.0) * scale))
            except (TypeError, ValueError):
                continue
            shifted = pil.Image.new("L", (layer_w, layer_h), 0)
            shifted.paste(mask, (dx, dy))
            if radius > 0.01:
                shifted = shifted.filter(ImageFilter.GaussianBlur(radius=radius))
            alpha_factor = color[3] / 255.0
            if alpha_factor < 0.999:
                shifted = shifted.point(lambda value, factor=alpha_factor: round(value * factor))
            shadow_layer = pil.Image.new("RGBA", (layer_w, layer_h), (color[0], color[1], color[2], 0))
            shadow_layer.putalpha(shifted)
            image.alpha_composite(shadow_layer, (cursor_x - pad, origin_y - pad))

    fill = _gradient_image(pil, layer_w, layer_h, paint)
    transparent = pil.Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    painted = pil.Image.composite(fill, transparent, mask)
    image.alpha_composite(painted, (cursor_x - pad, origin_y - pad))
    return prepared
