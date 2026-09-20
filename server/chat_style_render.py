"""Alternative layout/entry styles for rendered Twitch chat overlays.

The core bubble renderer remains the source of truth for typography, badges,
7TV cosmetics and emotes. This module only changes how prepared messages enter
and how they are arranged on the transparent canvas. That keeps the new visual
styles compatible with the fidelity work already validated in Fetcher.
"""

from __future__ import annotations

import hashlib

from . import chat_export_plus


LOOKS = {"bubble", "fade-stack", "ticker", "staggered", "emote-cloud"}
ANIMATIONS = {"slide", "fade", "pop", "float", "instant"}


def normalise_look(value: str) -> str:
    value = str(value or "bubble").strip().lower()
    return value if value in LOOKS else "bubble"


def normalise_animation(value: str) -> str:
    value = str(value or "slide").strip().lower()
    return value if value in ANIMATIONS else "slide"


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


def transform_prepared(pil, payload: dict, prepared: list, style, look: str):
    """Turn normal prepared messages into emote-only cloud items when needed."""
    look = normalise_look(look)
    if look != "emote-cloud":
        return prepared

    messages = [message for message in (payload.get("messages") or []) if isinstance(message, dict)]
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
    enter_seconds = 0.26
    progress = min(1.0, age / enter_seconds) if enter_seconds else 1.0
    eased = chat_export_plus.base._ease_out(progress)
    opacity = 1.0
    y_offset = 0
    scale = 1.0

    animation = normalise_animation(animation)
    if animation == "slide":
        opacity = eased
        y_offset = round((1.0 - eased) * 14)
    elif animation == "fade":
        opacity = progress
    elif animation == "pop":
        opacity = eased
        scale = 0.88 + 0.12 * eased
    elif animation == "float":
        opacity = eased
        y_offset = round((1.0 - eased) * 20)
        scale = 0.97 + 0.03 * eased
    elif animation == "instant":
        opacity = 1.0

    if age > message_ttl - chat_export_plus.base._LEAVE_SECONDS:
        opacity *= max(0.0, (message_ttl - age) / chat_export_plus.base._LEAVE_SECONDS)

    if scale < 0.999 or scale > 1.001:
        nw = max(1, round(image.width * scale))
        nh = max(1, round(image.height * scale))
        image = image.resize((nw, nh), pil.Image.Resampling.LANCZOS)

    return _opacity(pil, image, opacity), y_offset


def frame_renderer(look: str, animation: str):
    look = normalise_look(look)
    animation = normalise_animation(animation)

    def render(pil, prepared, t: float, style, green: bool, message_ttl: float, max_visible: int, visible_gap: int):
        bg = (0, 255, 0, 255) if green else (0, 0, 0, 0)
        canvas = pil.Image.new("RGBA", (style.width, style.height), bg)
        active = [item for item in prepared if item.at <= t < item.at + message_ttl]
        if len(active) > max_visible:
            active = active[-max_visible:]
        if not active:
            return canvas

        if look == "emote-cloud":
            # Emotes drift independently across the canvas. The exact placement
            # is deterministic per replay-message id, so preview/export feels
            # stable instead of random on every render.
            for item in active:
                image, enter_offset = _message_image(pil, item, t, message_ttl, animation)
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
                x = round((style.width - image.width) * x_ratio + drift * min(1.0, age / max(1.0, message_ttl)))
                y = round((style.height - image.height) * y_ratio - age * 7 + enter_offset)
                x = max(0, min(style.width - image.width, x))
                y = max(0, min(style.height - image.height, y))
                canvas.alpha_composite(image, (x, y))
            return canvas

        if look == "ticker":
            item = active[-1]
            image, enter_offset = _message_image(pil, item, t, message_ttl, animation)
            x = max(0, round((style.width - image.width) / 2))
            y = max(0, style.height - style.stack_bottom - image.height + enter_offset)
            canvas.alpha_composite(image, (x, y))
            return canvas

        rendered = [_message_image(pil, item, t, message_ttl, animation) for item in active]
        effective_gap = visible_gap - style.shadow_pad * 2
        total_h = sum(image.height for image, _ in rendered)
        if rendered:
            total_h += effective_gap * (len(rendered) - 1)
        y = style.height - style.stack_bottom - total_h

        for index, (image, enter_offset) in enumerate(rendered):
            x = style.stack_left
            if look == "staggered":
                x += (index % 3) * max(8, round(style.width * 0.012))
            elif look == "fade-stack":
                # Old messages stay readable but recede softly so the newest
                # line naturally gets the viewer's attention.
                distance = len(rendered) - 1 - index
                fade = max(0.38, 1.0 - distance * 0.16)
                image = _opacity(pil, image, fade)
            canvas.alpha_composite(image, (round(x), round(y + enter_offset)))
            y += image.height + effective_gap
        return canvas

    return render
