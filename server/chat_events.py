"""Recognise Twitch replay-chat events from finished VOD comments.

Twitch's VOD replay comment query exposes the visible replay message reliably,
but does not provide the full live EventSub payload for every historical event.
Fetcher therefore reconstructs the common editor-useful events from Twitch's
own replay text, with defensive support for legacy notice/bits fields when they
are present.
"""

from __future__ import annotations

from collections import Counter
import re

# Same family of Cheermote prefixes TwitchDownloader recognises in downloaded
# replay chat. Matching the token + integer is much safer than treating any
# number in a message as Bits.
_CHEER_PREFIXES = (
    "4Head|Anon|BibleThumb|BitBoss|bday|Cheer|Charity|Corgo|cheerwal|"
    "DansGame|DoodleCheer|EleGiggle|FrankerZ|FailFish|Goal|HeyGuys|"
    "HolidayCheer|Kappa|Kreygasm|MrDestructoid|Muxy|NotLikeThis|Party|"
    "Pride|PJSalt|RIPCheer|Scoops|ShowLove|Shamrock|SeemsGood|SwiftRage|"
    "Streamlabs|TriHard|uni|VoHiYo"
)
_BITS_RE = re.compile(
    rf"(?<!\S)(?:{_CHEER_PREFIXES})([1-9]\d{{0,6}})(?=\s|$)",
    re.IGNORECASE,
)
_MONTHS_RE = re.compile(r"They(?:'|’)ve subscribed for\s+(\d{1,3})\s+months?", re.IGNORECASE)
_GIFT_MANY_RE = re.compile(r"\bis gifting\s+(\d{1,4})\s+", re.IGNORECASE)
_ANON_GIFT_MANY_RE = re.compile(r"^An anonymous user is gifting\s+(\d{1,4})\s+", re.IGNORECASE)
_RAID_RE = re.compile(r"^(\d{1,8})\s+raiders?\s+from\s+.+?\s+have joined!", re.IGNORECASE)

_BADGE_BY_TYPE = {
    "sub": "event-sub",
    "resub": "event-resub",
    "gift": "event-gift",
    "gift-bomb": "event-gift-bomb",
    "bits": "event-bits",
    "raid": "event-raid",
    "highlight": "event-highlight",
    "watch-streak": "event-watch-streak",
    "charity": "event-charity",
    "combo": "event-combo",
}


def _notice_id(message: dict) -> str:
    notice = message.get("_twitchNotice")
    if isinstance(notice, dict):
        for key in ("msg_id", "msgId", "id"):
            value = notice.get(key)
            if value:
                return str(value).strip().lower()
    if isinstance(notice, str):
        return notice.strip().lower()
    return ""


def _bits_amount(message: dict, text: str) -> int:
    raw = message.get("_twitchBits")
    try:
        direct = int(raw or 0)
    except (TypeError, ValueError):
        direct = 0
    if direct > 0:
        return direct
    return sum(int(match.group(1)) for match in _BITS_RE.finditer(text))


def _event(event_type: str, label: str, *, amount: int | None = None, source: str = "replay-text") -> dict:
    result = {"type": event_type, "label": label, "source": source}
    if amount is not None:
        result["amount"] = int(amount)
    return result


def classify(message: dict) -> dict | None:
    """Return a compact event description for one normalized replay message."""
    text = str(message.get("text") or "").strip()
    user = message.get("user") if isinstance(message.get("user"), dict) else {}
    display = str(user.get("displayName") or user.get("login") or "").strip()
    notice = _notice_id(message)

    # Legacy/alternate replay payloads sometimes preserve a Twitch notice id.
    # Prefer it when available, but still use visible text for useful labels.
    if notice == "highlighted-message":
        return _event("highlight", "HIGHLIGHT", source="notice")
    if notice in {"sub", "resub"}:
        months_match = _MONTHS_RE.search(text)
        months = int(months_match.group(1)) if months_match else None
        event_type = "resub" if notice == "resub" or (months or 0) > 1 else "sub"
        label = "RESUB" if event_type == "resub" else "SUB"
        return _event(event_type, label, amount=months, source="notice")
    if notice in {"subgift", "submysterygift", "anonsubgift"}:
        many = _GIFT_MANY_RE.search(text) or _ANON_GIFT_MANY_RE.search(text)
        amount = int(many.group(1)) if many else 1
        return _event(
            "gift-bomb" if amount > 1 else "gift",
            f"{amount}× GIFT" if amount > 1 else "GIFT",
            amount=amount,
            source="notice",
        )

    # Bits are ordinary replay comments with cheermote tokens in current VOD
    # data, so detect them before the broader system-message text patterns.
    bits = _bits_amount(message, text)
    if bits > 0:
        return _event("bits", f"{bits:,} BITS", amount=bits)

    lowered = text.casefold()
    display_lower = display.casefold()
    body_after_name = lowered
    if display_lower and lowered.startswith(display_lower):
        body_after_name = lowered[len(display_lower):]

    if body_after_name.startswith(" subscribed at tier") or body_after_name.startswith(" subscribed with prime"):
        months_match = _MONTHS_RE.search(text)
        months = int(months_match.group(1)) if months_match else None
        event_type = "resub" if (months or 0) > 1 else "sub"
        return _event(event_type, "RESUB" if event_type == "resub" else "SUB", amount=months)

    many = _GIFT_MANY_RE.search(text) or _ANON_GIFT_MANY_RE.search(text)
    if many:
        amount = int(many.group(1))
        return _event("gift-bomb", f"{amount}× GIFT", amount=amount)

    if (
        body_after_name.startswith(" gifted a tier")
        or lowered.startswith("an anonymous user gifted a tier")
        or body_after_name.startswith(" is continuing the gift sub they got from")
        or body_after_name.startswith(" is paying forward the gift they got from")
    ):
        return _event("gift", "GIFT", amount=1)

    raid = _RAID_RE.search(text)
    if raid:
        viewers = int(raid.group(1))
        return _event("raid", f"RAID · {viewers:,}", amount=viewers)

    if " consecutive streams " in lowered and " and sparked a watch streak!" in lowered:
        return _event("watch-streak", "STREAK")

    if body_after_name.startswith(": donated ") and " to support " in body_after_name:
        return _event("charity", "CHARITY")

    if body_after_name.startswith("'s community sent") and body_after_name.rstrip().endswith("!"):
        return _event("combo", "COMBO")

    return None


def _ensure_badge(message: dict, event: dict) -> None:
    set_id = _BADGE_BY_TYPE.get(str(event.get("type") or ""))
    if not set_id:
        return
    badges = message.get("badges")
    if not isinstance(badges, list):
        badges = []
        message["badges"] = badges
    if any(isinstance(item, dict) and item.get("setId") == set_id for item in badges):
        return
    badges.insert(0, {"setId": set_id, "version": str(event.get("label") or "")})


def apply(payload: dict) -> dict:
    """Annotate all messages and add aggregate event metadata to the payload."""
    messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
    counts: Counter[str] = Counter()
    event_count = 0
    for message in messages:
        if not isinstance(message, dict):
            continue
        event = classify(message)
        if not event:
            message.pop("event", None)
            continue
        message["event"] = event
        _ensure_badge(message, event)
        event_count += 1
        counts[str(event.get("type") or "event")] += 1

    payload["eventCount"] = event_count
    payload["eventTypes"] = dict(sorted(counts.items()))
    return payload
