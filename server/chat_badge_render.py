"""Small helpers for rendering Twitch badge artwork in exported chat bubbles."""

from __future__ import annotations


def collector_with_badges(original, base):
    """Prioritize badge artwork in the shared image-asset loader."""
    def collect(payload: dict) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()
        limit = int(getattr(base, "_MAX_UNIQUE_EMOTES", 220))

        # Badges are tiny and repeated heavily, so load their handful of unique
        # URLs first. A very emote-heavy clip should not crowd badge artwork out.
        for message in payload.get("messages") or []:
            if not isinstance(message, dict):
                continue
            for badge in message.get("badges") or []:
                if not isinstance(badge, dict):
                    continue
                url = base._normalise_url(badge.get("imageUrl") or "")
                if url and url not in seen:
                    seen.add(url)
                    urls.append(url)
                    if len(urls) >= limit:
                        return urls

        for url in original(payload):
            url = base._normalise_url(url)
            if url and url not in seen:
                seen.add(url)
                urls.append(url)
                if len(urls) >= limit:
                    break
        return urls

    return collect


def register_fallback_labels(message: dict, badge_labels: dict[str, str]) -> None:
    """Ensure artwork-only badge sets reserve horizontal room during layout."""
    for badge in message.get("badges") or []:
        if not isinstance(badge, dict):
            continue
        set_id = str(badge.get("setId") or "").strip()
        if not set_id or set_id in badge_labels:
            continue
        if badge.get("imageUrl"):
            # This placeholder is measured/drawn by the proven layout then wiped
            # and replaced by the real image below. It intentionally over-reserves
            # a little width so auto-width bubbles never clip uncommon badges.
            badge_labels[set_id] = "BADGE"
        elif badge.get("title"):
            badge_labels[set_id] = str(badge.get("title") or "BADGE")[:16]


def _fallback_label(base, badge: dict) -> str:
    set_id = str(badge.get("setId") or "")
    return str(base._BADGES.get(set_id) or badge.get("title") or "").strip()


def redraw_name_row(pil, prepared, message: dict, assets: dict, style, name_font, badge_font, base):
    """Replace temporary text badges with Twitch's real badge images."""
    badges = [badge for badge in (message.get("badges") or []) if isinstance(badge, dict)]
    if not any(badge.get("imageUrl") for badge in badges):
        return prepared

    image = prepared.base
    draw = pil.ImageDraw.Draw(image)
    name_h = round(style.name_size * 1.25)
    badge_h = max(round(style.badge_size * 1.55), round(name_h * 0.72))
    badge_gap = max(3, round(style.font_size * 0.18))
    origin_x = style.shadow_pad + style.pad_x
    origin_y = style.shadow_pad + style.pad_y

    # Clear only the padded name-row interior. This leaves the rounded bubble
    # border/shadow and the message body completely untouched.
    right = max(origin_x + 1, image.width - style.shadow_pad - style.pad_x)
    draw.rectangle(
        (origin_x, origin_y, right, origin_y + name_h),
        fill=(18, 18, 22, 220),
    )

    cursor_x = origin_x
    badge_bg = (145, 70, 255, 64)
    badge_fg = (217, 195, 255, 255)

    for badge in badges:
        url = base._normalise_url(badge.get("imageUrl") or "")
        asset = assets.get(url) if url else None
        if asset and asset.frames:
            frame = asset.frames[0]
            target_h = max(12, badge_h)
            target_w = max(1, round(frame.width * (target_h / max(1, frame.height))))
            if frame.width != target_w or frame.height != target_h:
                frame = frame.resize((target_w, target_h), pil.Image.Resampling.LANCZOS)
            top = origin_y + max(0, (name_h - target_h) // 2)
            image.alpha_composite(frame, (round(cursor_x), round(top)))
            cursor_x += target_w + badge_gap
            continue

        label = _fallback_label(base, badge)
        if not label:
            continue
        bw = base._text_width(draw, label, badge_font) + max(8, round(style.badge_size * 0.7))
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

    user_name = str((message.get("user") or {}).get("displayName") or "viewer")
    user_color = base._safe_color((message.get("user") or {}).get("color") or "")
    draw.text((cursor_x, origin_y), user_name, font=name_font, fill=user_color)
    return prepared
