"""Small animated GIF previews for the Style Lab look cards.

The card thumbnails intentionally use the same visual vocabulary as the live
Stage-2 overlay preview: checkerboard transparency canvas, Twitch-style name row,
badge/emote hints, and the selected bubble skin. They are generated once per
process and cached in memory, so the UI gets literal looping GIFs without adding
binary artwork to the repository.
"""

from __future__ import annotations

from functools import lru_cache
from io import BytesIO


LOOKS = {
    "classic",
    "y2k",
    "editorial",
    "glass",
    "messenger",
    "terminal",
    "cyber",
    "scrapbook",
    "win95",
    "manga",
}

_W = 320
_H = 180
_MESSAGES = (
    ("MOMO", "that timing was clean", (174, 101, 255)),
    ("PIXELCAT", "LMAO", (43, 204, 255)),
    ("NOVA", "no way", (255, 104, 154)),
    ("KITSUNE", "GG!", (255, 186, 75)),
)


def _font(pil, size: int, *, bold: bool = False, mono: bool = False):
    candidates = []
    if mono:
        candidates.extend([
            "/System/Library/Fonts/Supplemental/Courier New Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Courier New.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        ])
    else:
        candidates.extend([
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ])
    from pathlib import Path
    for candidate in candidates:
        try:
            if Path(candidate).is_file():
                return pil.ImageFont.truetype(candidate, size=size)
        except Exception:
            continue
    try:
        return pil.ImageFont.load_default(size=size)
    except TypeError:
        return pil.ImageFont.load_default()


def _checker(pil):
    image = pil.Image.new("RGBA", (_W, _H), (0, 0, 0, 255))
    draw = pil.ImageDraw.Draw(image)
    cell = 16
    for y in range(0, _H, cell):
        for x in range(0, _W, cell):
            colour = (46, 46, 51, 255) if ((x // cell + y // cell) % 2 == 0) else (38, 38, 43, 255)
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=colour)
    return image


def _ease(value: float) -> float:
    value = max(0.0, min(1.0, float(value)))
    return 1.0 - (1.0 - value) ** 3


def _bubble(pil, look: str, index: int, opacity: int, scale: float):
    name, body, name_colour = _MESSAGES[index % len(_MESSAGES)]
    width, height = 205, 46
    image = pil.Image.new("RGBA", (width + 30, height + 24), (0, 0, 0, 0))
    draw = pil.ImageDraw.Draw(image)
    x, y = 12, 8

    if look == "classic":
        draw.rounded_rectangle((x, y, x + width, y + height), radius=10, fill=(28, 28, 33, 245), outline=(255, 255, 255, 20), width=1)
    elif look == "y2k":
        draw.rounded_rectangle((x + 5, y + 5, x + width + 5, y + height + 5), radius=11, fill=(20, 20, 20, 255))
        draw.rounded_rectangle((x, y, x + width, y + height), radius=11, fill=(255, 255, 255, 255), outline=(22, 22, 22, 255), width=2)
    elif look == "editorial":
        draw.rectangle((x, y, x + width, y + height), fill=(255, 253, 248, 250))
        draw.rectangle((x, y, x + 4, y + height), fill=(28, 28, 28, 255))
    elif look == "glass":
        draw.rounded_rectangle((x + 2, y + 3, x + width + 2, y + height + 3), radius=13, fill=(0, 0, 0, 45))
        draw.rounded_rectangle((x, y, x + width, y + height), radius=13, fill=(27, 34, 46, 210), outline=(255, 255, 255, 85), width=1)
        draw.line((x + 10, y + 2, x + width - 10, y + 2), fill=(255, 255, 255, 75), width=1)
    elif look == "messenger":
        fill = (236, 240, 244, 255) if index % 2 == 0 else (125, 83, 232, 255)
        draw.rounded_rectangle((x, y, x + width, y + height), radius=15, fill=fill)
    elif look == "terminal":
        draw.rectangle((x, y, x + width, y + height), fill=(2, 13, 7, 248), outline=(72, 255, 122, 210), width=1)
    elif look == "cyber":
        points = [(x, y), (x + width - 18, y), (x + width, y + 12), (x + width, y + height), (x + 12, y + height), (x, y + height - 10)]
        draw.polygon(points, fill=(8, 15, 29, 248))
        draw.line((x, y + 2, x, y + height - 2), fill=(77, 234, 255, 255), width=3)
        draw.line((x + width - 1, y + 12, x + width - 1, y + height - 2), fill=(255, 73, 211, 200), width=1)
    elif look == "scrapbook":
        draw.rectangle((x + 4, y + 5, x + width + 4, y + height + 5), fill=(65, 48, 31, 80))
        draw.rectangle((x, y, x + width, y + height), fill=(255, 248, 224, 255))
        draw.rectangle((x + 22, y - 2, x + 58, y + 7), fill=(225, 194, 137, 220))
    elif look == "win95":
        draw.rectangle((x + 2, y + 2, x + width + 2, y + height + 2), fill=(0, 0, 0, 255))
        draw.rectangle((x, y, x + width, y + height), fill=(192, 192, 192, 255), outline=(255, 255, 255, 255), width=2)
        draw.rectangle((x + 3, y + 3, x + width - 3, y + 16), fill=(0, 0, 128, 255))
    elif look == "manga":
        draw.rounded_rectangle((x + 4, y + 4, x + width + 4, y + height + 4), radius=12, fill=(15, 15, 15, 255))
        draw.rounded_rectangle((x, y, x + width, y + height), radius=12, fill=(255, 255, 255, 255), outline=(15, 15, 15, 255), width=3)
        for dot_y in range(y + 6, y + height - 4, 6):
            for dot_x in range(x + width - 42, x + width - 5, 6):
                draw.ellipse((dot_x, dot_y, dot_x + 1, dot_y + 1), fill=(130, 130, 130, 100))

    regular = _font(pil, 10)
    bold = _font(pil, 11, bold=True)
    mono = _font(pil, 9, mono=True)
    mono_bold = _font(pil, 10, bold=True, mono=True)

    if look == "win95":
        draw.ellipse((x + 7, y + 6, x + 13, y + 12), fill=(255, 220, 80, 255))
        draw.text((x + 18, y + 4), name, font=mono_bold, fill=(255, 255, 255, 255))
        draw.text((x + 8, y + 22), body, font=mono, fill=(20, 20, 20, 255))
    else:
        if look == "terminal":
            username = (104, 255, 148, 255)
            message = (202, 255, 215, 255)
            badge = (42, 169, 79, 255)
            prefix = ">"
            name_font, body_font = mono_bold, mono
        elif look == "messenger" and index % 2 == 1:
            username = message = (255, 255, 255, 255)
            badge = (255, 255, 255, 220)
            prefix = ""
            name_font, body_font = bold, regular
        else:
            username = (*name_colour, 255)
            message = (20, 20, 20, 255) if look in {"y2k", "editorial", "scrapbook", "manga", "messenger"} else (245, 245, 248, 255)
            badge = (180, 130, 255, 255)
            prefix = ""
            name_font, body_font = bold, regular

        draw.ellipse((x + 8, y + 8, x + 15, y + 15), fill=badge)
        draw.text((x + 20, y + 5), prefix + name, font=name_font, fill=username)
        draw.text((x + 8, y + 22), body, font=body_font, fill=message)
        if index == 1:
            # Tiny emote hint so the preview reads as chat, not a generic card UI.
            draw.ellipse((x + width - 24, y + 21, x + width - 10, y + 35), fill=(79, 196, 95, 255), outline=(26, 90, 35, 255), width=1)

    if look == "scrapbook":
        image = image.rotate(-2 if index % 2 == 0 else 2, resample=pil.Image.Resampling.BICUBIC, expand=True)
    if abs(scale - 1.0) > 0.001:
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), pil.Image.Resampling.LANCZOS)
    if opacity < 255:
        alpha = image.getchannel("A").point(lambda value: round(value * opacity / 255.0))
        image.putalpha(alpha)
    return image


@lru_cache(maxsize=len(LOOKS))
def render_gif(look: str) -> bytes:
    look = str(look or "classic").strip().lower()
    if look not in LOOKS:
        look = "classic"

    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:  # pragma: no cover - same dependency as chat export
        raise RuntimeError("Pillow is required for chat style previews") from exc

    class _Pil:
        pass

    pil = _Pil()
    pil.Image = Image
    pil.ImageDraw = ImageDraw
    pil.ImageFont = ImageFont

    frames = []
    starts = (0, 8, 16, 24)
    total_frames = 34
    for frame_index in range(total_frames):
        canvas = _checker(pil)
        active = [
            (index, frame_index - start)
            for index, start in enumerate(starts)
            if 0 <= frame_index - start < 27
        ][-3:]

        rendered = []
        for index, age in active:
            progress = _ease(min(1.0, age / 4.0))
            rendered.append((index, progress, _bubble(pil, look, index, round(255 * progress), 0.96 + 0.04 * progress)))

        gap = 4
        total_height = sum(image.height for _index, _progress, image in rendered) + gap * max(0, len(rendered) - 1)
        y = _H - 8 - total_height
        for index, progress, image in rendered:
            x = 8
            if look == "messenger" and index % 2 == 1:
                x = _W - image.width - 8
            elif look == "scrapbook":
                x += (index % 3) * 3
            canvas.alpha_composite(image, (round(x), round(y + (1.0 - progress) * 10)))
            y += image.height + gap

        frames.append(canvas.convert("RGB"))

    output = BytesIO()
    frames[0].save(
        output,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=100,
        loop=0,
        optimize=False,
        disposal=1,
    )
    return output.getvalue()
