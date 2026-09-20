"""Small, deterministic cleanup filters for chat preview/export."""

from __future__ import annotations

# Common automated accounts that are useful in live chat but usually add noise to
# social clips. Keep this deliberately conservative; users can still leave the
# filter off and nothing is removed.
_COMMON_BOTS = {
    "nightbot",
    "streamelements",
    "streamlabs",
    "moobot",
    "fossabot",
    "sery_bot",
    "serybot",
    "wizebot",
    "coebot",
    "phantombot",
    "soundalerts",
}


def apply(payload: dict, *, hide_bots: bool = False) -> dict:
    messages = payload.get("messages")
    if not isinstance(messages, list) or not hide_bots:
        payload["filteredBots"] = 0
        return payload

    kept = []
    removed = 0
    for message in messages:
        user = message.get("user") if isinstance(message, dict) else {}
        login = str((user or {}).get("login") or "").lower().strip()
        if login and login in _COMMON_BOTS:
            removed += 1
            continue
        kept.append(message)
    payload["messages"] = kept
    payload["messageCount"] = len(kept)
    payload["filteredBots"] = removed
    return payload
