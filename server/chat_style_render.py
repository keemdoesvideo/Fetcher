"""Style Lab layout and motion renderer for Twitch chat exports.

Visual skins are selected independently in the browser. This module handles the
parts that change temporal/layout behaviour in the encoded overlay so Stack,
Ticker, Float, Spotlight and related modes keep export parity.
"""

from __future__ import annotations

import hashlib
import math

from . import chat_export_plus


LAYOUTS = {"stack", "top-down", "ticker", "float", "sticker", "spotlight", "emote-cloud"}
ANIMATIONS = {"rise", "fade", "pop", "spring", "glide", "type", "wipe", "glitch", "instant", "slide", "float"}
STACK_MOTIONS = {"smooth", "spring", "instant"}


def normalise_layout(value: str) -> str:
    value = str(value or "stack").strip().lower()
    aliases = {
        "bubble": "stack",
        "fade-stack": "stack",
        "staggered": "sticker",
    }
    value = aliases.get(value, value)
    return value if value in LAYOUTS else "stack"


def normalise_look(value: str) -> str:
    """Backward-compatible alias used by older wrapper code."""
    return normalise_layout(value)


def normalise_animation(value: str) -> str:
    value = str(value or "rise").strip().lower()
    aliases = {"slide": "rise", "float": "rise"}
    value = aliases.get(value, value)
    return value if value in ANIMATIONS else "rise"


def normalise_stack_motion(value: str) -> str:
    value = str(value or "smooth").strip().lower()
    return value if value in STACK_MOTIONS else "smooth"


def _seed(value: object) -> int:
    raw = str(value or "message").encode("utf-8", "replace")
    return int.from_bytes(hashlib.blake2s(raw, digest_size=4).digest(), "big")


def _opacity(pil, image, amount: float):
    amount = max(0.0, min(1.0, float(amount)))
    if amount >= 0.999:
        return image
    result = image.copy()
    alpha = result.getchannel("A").point(lambda value: round(value * amount))
    result.putalpha(alpha)
    return result


def _clip_horizontal(pil, image, progress: float, *, stepped: bool = False):
    progress = max(0.0, min(1.0, float(progress)))
    if stepped:
        progress = math.floor(progress * 12.0) / 12.0
    width = max(1, round(image.width * progress))
    result = pil.Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(image.crop((0, 0, width, image.height)), (0, 0))
    return result


def _clip_vertical(pil, image, progress: float):
    progress = max(0.0, min(1.0, float(progress)))
    height = max(1, round(image.height * progress))
    result = pil.Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(image.crop((0, 0, image.width, height)), (0, 0))
    return result


def _spring(progress: float) -> float:
    progress = max(0.0, min(1.0, progress))
    value = 1.0 - math.exp(-6.0 * progress) * math.cos(9.0 * progress)
    return max(0.0, min(1.08, value))


def transform_prepared(pil, payload: dict, prepared: list, style, layout: str):
    """Attach deterministic placement data, or reduce to emotes for cloud mode."""
    layout = normalise_layout(layout)
    messages = [message for message in (payload.get("messages") or []) if isinstance(message, dict)]

    if layout != "emote-cloud":
        for message, item in zip(messages, prepared):
            seed = _seed(message.get("id") or message.get("text"))
            item._fetcher_seed = seed
            item._fetcher_float_x = 0.06 + ((seed & 0xFF) / 255.0) * 0.46
            item._fetcher_float_y = 0.10 + (((seed >> 8) & 0xFF) / 255.0) * 0.68
            item._fetcher_rotation = -2.6 + (((seed >> 16) & 0xFF) / 255.0) * 5.2
        return prepared

    transformed = []
    pad = max(4, round(style.emote_height * 0.16))
    for message, item in zip(messages, prepared):
        placements = list(getattr(item, "emotes", []) or [])
        if not placements:
            continue
        min_x = min(int(p.x) for p in placements)
        min_y = min(int(p.y) for p in placements)
        max_x = max(int(p.x) + int(p.asset.frames[0].width) for p in placements)
        max_y = max(int(p.y) + int(p.asset.frames[0].height) for p in placements)
        width = max(1, max_x - min_x + pad * 2)
        height = max(1, max_y - min_y + pad * 2)
        transparent = pil.Image.new("RGBA", (width, height), (0, 0, 0, 0))
        rebased = [
            chat_export_plus.base.EmotePlacement(
                asset=p.asset,
                x=int(p.x) - min_x + pad,
                y=int(p.y) - min_y + pad,
            )
            for p in placements
        ]
        cloud = chat_export_plus._Prepared(at=float(item.at), base=transparent, emotes=rebased)
        seed = _seed(message.get("id") or message.get("text"))
        cloud._fetcher_cloud_x = 0.08 + ((seed & 0xFF) / 255.0) * 0.76
        cloud._fetcher_cloud_y = 0.12 + (((seed >> 8) & 0xFF) / 255.0) * 0.62
        cloud._fetcher_cloud_scale = 0.86 + (((seed >> 16) & 0xFF) / 255.0) * 0.50
        cloud._fetcher_cloud_drift = -18 + (((seed >> 24) & 0xFF) / 255.0) * 36
        transformed.append(cloud)
    return transformed


def _message_image(pil, item, t: float, message_ttl: float, animation: str):
    image = item.base.copy()
    elapsed_ms = max(0.0, t - item.at) * 1000.0
    for placement in item.emotes:
        frame = placement.asset.frame_at(elapsed_ms)
        image.alpha_composite(frame, (placement.x, placement.y))

    age = max(0.0, t - item.at)
    enter_seconds = max(0.001, chat_export_plus.base._ENTER_SECONDS)
    progress = min(1.0, age / enter_seconds)
    eased = chat_export_plus.base._ease_out(progress)
    opacity = 1.0
    y_offset = 0
    x_offset = 0
    scale = 1.0

    animation = normalise_animation(animation)
    if animation == "rise":
        opacity = eased
        y_offset = round((1.0 - eased) * 14)
        scale = 0.985 + 0.015 * eased
    elif animation == "fade":
        opacity = progress
    elif animation == "pop":
        opacity = eased
        scale = 0.86 + 0.14 * eased
    elif animation == "spring":
        amount = _spring(progress)
        opacity = min(1.0, progress * 2.2)
        y_offset = round((1.0 - amount) * 12)
        scale = 0.90 + 0.10 * amount
    elif animation == "glide":
        opacity = eased
        x_offset = round((1.0 - eased) * -28)
    elif animation == "type":
        opacity = min(1.0, progress * 1.6)
        image = _clip_horizontal(pil, image, progress, stepped=True)
    elif animation == "wipe":
        opacity = min(1.0, progress * 1.8)
        image = _clip_vertical(pil, image, eased)
    elif animation == "glitch":
        opacity = min(1.0, progress * 3.0)
        if progress < 0.78:
            phase = int(progress * 10) % 4
            x_offset = (-8, 6, -3, 2)[phase]
    elif animation == "instant":
        opacity = 1.0

    if age > message_ttl - chat_export_plus.base._LEAVE_SECONDS:
        opacity *= max(0.0, (message_ttl - age) / chat_export_plus.base._LEAVE_SECONDS)

    if abs(scale - 1.0) > 0.001:
        nw = max(1, round(image.width * scale))
        nh = max(1, round(image.height * scale))
        image = image.resize((nw, nh), pil.Image.Resampling.LANCZOS)

    return _opacity(pil, image, opacity), y_offset, x_offset


def _stack_ease(progress: float, motion: str) -> float:
    motion = normalise_stack_motion(motion)
    if motion == "instant":
        return 1.0
    if motion == "spring":
        return _spring(progress)
    return chat_export_plus.base._ease_out(progress)


def _residual_shift(item, active, rendered_by_item, t: float, effective_gap: int, motion: str, direction: int) -> float:
    if motion == "instant":
        return 0.0
    shift = 0.0
    duration = 0.34 if motion == "smooth" else 0.46
    for newer in active:
        if newer.at <= item.at:
            continue
        age = max(0.0, t - newer.at)
        if age >= duration:
            continue
        progress = min(1.0, age / duration)
        ease = _stack_ease(progress, motion)
        image = rendered_by_item.get(id(newer))
        if image is None:
            continue
        step = image[0].height + effective_gap
        shift += step * (1.0 - ease) * direction
    return shift


def frame_renderer(layout: str, animation: str, stack_motion: str = "smooth"):
    layout = normalise_layout(layout)
    animation = normalise_animation(animation)
    stack_motion = normalise_stack_motion(stack_motion)

    def render(pil, prepared, t: float, style, green: bool, message_ttl: float, max_visible: int, visible_gap: int):
        bg = (0, 255, 0, 255) if green else (0, 0, 0, 0)
        canvas = pil.Image.new("RGBA", (style.width, style.height), bg)
        active = [item for item in prepared if item.at <= t < item.at + message_ttl]
        if len(active) > max_visible:
            active = active[-max_visible:]
        if not active:
            return canvas

        if layout == "emote-cloud":
            for item in active:
                image, enter_y, enter_x = _message_image(pil, item, t, message_ttl, animation)
                age = max(0.0, t - item.at)
                cloud_scale = float(getattr(item, "_fetcher_cloud_scale", 1.0))
                if abs(cloud_scale - 1.0) > 0.01:
                    image = image.resize(
                        (max(1, round(image.width * cloud_scale)), max(1, round(image.height * cloud_scale))),
                        pil.Image.Resampling.LANCZOS,
                    )
                x_ratio = float(getattr(item, "_fetcher_cloud_x", 0.5))
                y_ratio = float(getattr(item, "_fetcher_cloud_y", 0.5))
                drift = float(getattr(item, "_fetcher_cloud_drift", 0.0))
                x = round((style.width - image.width) * x_ratio + drift * min(1.0, age / max(1.0, message_ttl)) + enter_x)
                y = round((style.height - image.height) * y_ratio - age * 7 + enter_y)
                x = max(0, min(style.width - image.width, x))
                y = max(0, min(style.height - image.height, y))
                canvas.alpha_composite(image, (x, y))
            return canvas

        if layout in {"ticker", "spotlight"}:
            item = active[-1]
            image, enter_y, enter_x = _message_image(pil, item, t, message_ttl, animation)
            x = max(0, round((style.width - image.width) / 2 + enter_x))
            if layout == "spotlight":
                y = max(0, round(style.height * 0.62 - image.height / 2 + enter_y))
            else:
                y = max(0, style.height - style.stack_bottom - image.height + enter_y)
            canvas.alpha_composite(image, (x, y))
            return canvas

        if layout == "float":
            for item in active:
                image, enter_y, enter_x = _message_image(pil, item, t, message_ttl, animation)
                x_ratio = float(getattr(item, "_fetcher_float_x", 0.12))
                y_ratio = float(getattr(item, "_fetcher_float_y", 0.25))
                x = round((style.width - image.width) * x_ratio + enter_x)
                y = round((style.height - image.height) * y_ratio + enter_y)
                x = max(0, min(style.width - image.width, x))
                y = max(0, min(style.height - image.height, y))
                canvas.alpha_composite(image, (x, y))
            return canvas

        rendered = []
        rendered_by_item = {}
        for item in active:
            entry = _message_image(pil, item, t, message_ttl, animation)
            rendered.append((item, entry[0], entry[1], entry[2]))
            rendered_by_item[id(item)] = entry

        effective_gap = visible_gap - style.shadow_pad * 2
        total_h = sum(image.height for _item, image, _y, _x in rendered)
        if rendered:
            total_h += effective_gap * (len(rendered) - 1)

        if layout == "top-down":
            y = style.stack_bottom
            direction = -1
        else:
            y = style.height - style.stack_bottom - total_h
            direction = 1

        for index, (item, image, enter_y, enter_x) in enumerate(rendered):
            x = style.stack_left + enter_x
            if layout == "sticker":
                x += (index % 3) * max(8, round(style.width * 0.012))
                angle = float(getattr(item, "_fetcher_rotation", 0.0))
                if abs(angle) > 0.05:
                    image = image.rotate(angle, resample=pil.Image.Resampling.BICUBIC, expand=True)
            residual = _residual_shift(item, active, rendered_by_item, t, effective_gap, stack_motion, direction)
            draw_y = round(y + enter_y + residual)
            canvas.alpha_composite(image, (round(x), draw_y))
            y += image.height + effective_gap
        return canvas

    return render
