"""Render chat overlays with selectable layout, entry motion and font styles.

This is intentionally a thin wrapper around ``chat_export_edits``. The existing
export path still owns bubbles, badges, emotes, paints, edits, sound and canvas
modes; this module swaps presentation details for the duration of one serialized
chat render.
"""

from __future__ import annotations

from pathlib import Path
import threading

from . import chat_export_edits, chat_export_plus, chat_style_render

_lock = threading.Lock()

_FONT_CHOICES = {"system", "arial", "helvetica", "verdana", "georgia", "courier"}
_VISUAL_LOOKS = {"classic", "y2k", "editorial", "glass", "messenger", "terminal", "cyber", "scrapbook", "win95", "manga"}
_FONT_PATHS = {
    "arial": {
        False: [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ],
        True: [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ],
    },
    "helvetica": {
        False: [
            "/System/Library/Fonts/Helvetica.ttc",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ],
        True: [
            "/System/Library/Fonts/Helvetica.ttc",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ],
    },
    "verdana": {
        False: [
            "/System/Library/Fonts/Supplemental/Verdana.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ],
        True: [
            "/System/Library/Fonts/Supplemental/Verdana Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ],
    },
    "georgia": {
        False: [
            "/System/Library/Fonts/Supplemental/Georgia.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        ],
        True: [
            "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        ],
    },
    "courier": {
        False: [
            "/System/Library/Fonts/Supplemental/Courier New.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        ],
        True: [
            "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        ],
    },
}


def _font_loader(original, family: str):
    family = str(family or "system").strip().lower()
    if family not in _FONT_CHOICES:
        family = "system"

    def load(pil, size: int, bold: bool = False):
        if family == "system":
            return original(pil, size, bold=bold)
        for candidate in _FONT_PATHS.get(family, {}).get(bool(bold), []):
            try:
                if Path(candidate).is_file():
                    return pil.ImageFont.truetype(candidate, size=size)
            except Exception:
                continue
        return original(pil, size, bold=bold)

    return load


def render(*args, **kwargs):
    legacy_layout = kwargs.pop("chat_look", "bubble")
    chat_layout = chat_style_render.normalise_layout(
        kwargs.pop("chat_layout", legacy_layout)
    )
    entry_animation = chat_style_render.normalise_animation(
        kwargs.pop("entry_animation", "rise")
    )
    stack_motion = chat_style_render.normalise_stack_motion(
        kwargs.pop("stack_motion", "smooth")
    )
    visual_look = str(kwargs.pop("visual_look", "classic") or "classic").strip().lower()
    if visual_look not in _VISUAL_LOOKS:
        visual_look = "classic"

    chat_font = str(kwargs.pop("chat_font", "system") or "system").strip().lower()
    if chat_font not in _FONT_CHOICES:
        chat_font = "system"

    with _lock:
        original_prepare_messages = chat_export_plus._prepare_messages
        original_frame = chat_export_plus._frame
        original_font = chat_export_plus.base._font

        def prepare_messages(pil, payload, assets, style, job, bubble_width):
            prepared = original_prepare_messages(
                pil, payload, assets, style, job, bubble_width
            )
            return chat_style_render.transform_prepared(
                pil, payload, prepared, style, chat_layout
            )

        chat_export_plus._prepare_messages = prepare_messages
        chat_export_plus._frame = chat_style_render.frame_renderer(
            chat_layout, entry_animation, stack_motion
        )
        chat_export_plus.base._font = _font_loader(original_font, chat_font)
        try:
            result = chat_export_edits.render(*args, **kwargs)
            if isinstance(result, tuple) and len(result) == 3:
                output, filename, media_type = result
                suffixes = []
                if visual_look != "classic":
                    suffixes.append(visual_look)
                if chat_layout != "stack":
                    suffixes.append(chat_layout)
                if suffixes:
                    dot = filename.rfind(".")
                    suffix = "-" + "-".join(suffixes)
                    filename = (
                        filename[:dot] + suffix + filename[dot:]
                        if dot > 0
                        else filename + suffix
                    )
                return output, filename, media_type
            return result
        finally:
            chat_export_plus._prepare_messages = original_prepare_messages
            chat_export_plus._frame = original_frame
            chat_export_plus.base._font = original_font
