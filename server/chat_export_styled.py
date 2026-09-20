"""Render chat overlays with selectable layout and entry-animation styles.

This is intentionally a thin wrapper around ``chat_export_edits``. The existing
export path still owns bubbles, badges, emotes, paints, edits, sound and canvas
modes; this module only swaps the prepared-message transform and frame arranger
for the duration of one serialized chat render.
"""

from __future__ import annotations

import threading

from . import chat_export_edits, chat_export_plus, chat_style_render

_lock = threading.Lock()


def render(*args, **kwargs):
    chat_look = chat_style_render.normalise_look(kwargs.pop("chat_look", "bubble"))
    entry_animation = chat_style_render.normalise_animation(
        kwargs.pop("entry_animation", "slide")
    )

    with _lock:
        original_prepare_messages = chat_export_plus._prepare_messages
        original_frame = chat_export_plus._frame

        def prepare_messages(pil, payload, assets, style, job, bubble_width):
            prepared = original_prepare_messages(
                pil, payload, assets, style, job, bubble_width
            )
            return chat_style_render.transform_prepared(
                pil, payload, prepared, style, chat_look
            )

        chat_export_plus._prepare_messages = prepare_messages
        chat_export_plus._frame = chat_style_render.frame_renderer(
            chat_look, entry_animation
        )
        try:
            result = chat_export_edits.render(*args, **kwargs)
            if isinstance(result, tuple) and len(result) == 3 and chat_look != "bubble":
                output, filename, media_type = result
                dot = filename.rfind(".")
                suffix = "-" + chat_look
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
