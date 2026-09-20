"""Per-message edit rules for Twitch replay chat.

The browser keeps edit state by Twitch message id. This module applies those
choices to a freshly fetched payload so preview reloads and final exports use the
same message set and highlight markers.
"""

from __future__ import annotations

_MAX_EDIT_IDS = 500


def _clean(values) -> set[str]:
    result: set[str] = set()
    for value in values or []:
        item = str(value or "").strip()
        if not item:
            continue
        result.add(item[:256])
        if len(result) >= _MAX_EDIT_IDS:
            break
    return result


def apply(
    payload: dict,
    *,
    hidden_ids=None,
    highlighted_ids=None,
    only_message_id: str | None = None,
) -> dict:
    """Filter/mark messages in-place and refresh public payload counts."""
    messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
    hidden = _clean(hidden_ids)
    highlighted = _clean(highlighted_ids)
    only_id = str(only_message_id or "").strip()[:256]

    edited: list[dict] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        message_id = str(message.get("id") or "")
        if only_id:
            if message_id != only_id:
                continue
        elif message_id and message_id in hidden:
            continue

        if message_id and message_id in highlighted:
            message["_fetcherHighlight"] = True
        else:
            message.pop("_fetcherHighlight", None)
        edited.append(message)

    payload["messages"] = edited
    payload["messageCount"] = len(edited)
    payload["messageEdits"] = {
        "hidden": len(hidden),
        "highlighted": len(highlighted),
        "only": bool(only_id),
    }
    return payload
