"""Best-effort 7TV cosmetic-badge enrichment for Twitch replay chat.

Finished Twitch VOD messages already carry the chatter's numeric Twitch id.
7TV exposes an equipped cosmetic badge id for that Twitch connection through its
public GraphQL API. Fetcher resolves those ids in batches, resolves the badge
artwork, and appends a normal badge-shaped object to each matching message.

The rest of Fetcher's preview/export badge pipeline is intentionally reused: a
7TV badge therefore gets the same image loading, sizing, fallback, tight-canvas
and ProRes/WebM/green-screen behavior as native Twitch badge artwork.
"""

from __future__ import annotations

from collections import Counter
import json
import logging
import threading
import time
import urllib.request

log = logging.getLogger("fetcher.chat.7tv_badges")

_GQL = "https://7tv.io/v3/gql"
_USER_TTL = 30 * 60
_BADGE_TTL = 6 * 60 * 60
_MAX_USER_LOOKUPS = 200
_USER_BATCH = 40
_BADGE_BATCH = 80

_lock = threading.Lock()
# twitch id -> (created monotonic, badge id or None)
_user_cache: dict[str, tuple[float, str | None]] = {}
# badge id -> (created monotonic, normalized badge or None)
_badge_cache: dict[str, tuple[float, dict | None]] = {}


def _post(query: str, variables: dict | None = None, *, allow_partial: bool = False) -> dict:
    body = json.dumps(
        {"query": query, "variables": variables or {}},
        separators=(",", ":"),
    ).encode("utf-8")
    req = urllib.request.Request(
        _GQL,
        data=body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Fetcher/0.2 (+https://fetcher.hahkeemi.com)",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        parsed = json.loads(response.read().decode("utf-8", "replace"))
    if not isinstance(parsed, dict):
        raise ValueError("7TV returned an invalid response")
    data = parsed.get("data")
    if parsed.get("errors") and not allow_partial:
        raise ValueError("7TV GraphQL rejected the badge lookup")
    if not isinstance(data, dict):
        if parsed.get("errors"):
            raise ValueError("7TV GraphQL returned no usable badge data")
        return {}
    return data


def _chunks(values: list[str], size: int):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def _valid_twitch_id(value: object) -> str:
    raw = str(value or "").strip()
    return raw if raw.isdigit() and len(raw) <= 32 else ""


def _cached_user(user_id: str):
    with _lock:
        item = _user_cache.get(user_id)
        if not item:
            return False, None
        created, badge_id = item
        if time.monotonic() - created > _USER_TTL:
            _user_cache.pop(user_id, None)
            return False, None
        return True, badge_id


def _put_user(user_id: str, badge_id: str | None) -> None:
    with _lock:
        _user_cache[user_id] = (time.monotonic(), badge_id or None)


def _cached_badge(badge_id: str):
    with _lock:
        item = _badge_cache.get(badge_id)
        if not item:
            return False, None
        created, badge = item
        if time.monotonic() - created > _BADGE_TTL:
            _badge_cache.pop(badge_id, None)
            return False, None
        return True, badge


def _put_badge(badge_id: str, badge: dict | None) -> None:
    with _lock:
        _badge_cache[badge_id] = (time.monotonic(), badge)


def _https(url: object) -> str:
    value = str(url or "").strip()
    if value.startswith("//"):
        return "https:" + value
    return value


def _badge_url(raw: dict) -> str:
    host = raw.get("host") if isinstance(raw.get("host"), dict) else {}
    base = _https(host.get("url"))
    if not base:
        return ""
    base = base.rstrip("/")
    files = host.get("files") if isinstance(host.get("files"), list) else []

    candidates = []
    for item in files:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        fmt = str(item.get("format") or "").upper()
        # Pillow/browser support is reliable for WEBP and PNG. GIF is retained
        # as a last resort; AVIF is deliberately skipped for export portability.
        if fmt not in {"WEBP", "PNG", "GIF"} and not name.lower().endswith((".webp", ".png", ".gif")):
            continue
        try:
            area = max(0, int(item.get("width") or 0)) * max(0, int(item.get("height") or 0))
        except (TypeError, ValueError):
            area = 0
        rank = 3 if (fmt == "WEBP" or name.lower().endswith(".webp")) else (
            2 if (fmt == "PNG" or name.lower().endswith(".png")) else 1
        )
        candidates.append((rank, area, name))

    if not candidates:
        return ""
    _rank, _area, name = max(candidates, key=lambda item: (item[0], item[1]))
    return f"{base}/{name}"


def _normalise_badge(raw: dict) -> dict | None:
    badge_id = str(raw.get("id") or "").strip()
    image_url = _badge_url(raw)
    if not badge_id or not image_url.startswith("https://"):
        return None
    title = str(raw.get("tooltip") or raw.get("name") or "7TV badge").strip()[:160]
    return {
        "id": badge_id,
        "name": str(raw.get("name") or "7TV badge")[:96],
        "title": title or "7TV badge",
        "imageUrl": image_url,
    }


def _fetch_user_ids(user_ids: list[str]) -> None:
    for batch in _chunks(user_ids, _USER_BATCH):
        fields = []
        for index, user_id in enumerate(batch):
            # Twitch ids were validated as digits, so interpolation cannot alter
            # the GraphQL document structure.
            fields.append(
                f'u{index}:userByConnection(id:"{user_id}",platform:TWITCH)'
                "{style{badge_id}}"
            )
        query = "query FetcherBadgeUsers{" + " ".join(fields) + "}"
        try:
            # Ordinary Twitch users commonly have no 7TV account. 7TV may report
            # those aliases as errors while still returning valid sibling data.
            data = _post(query, allow_partial=True)
        except Exception as exc:
            log.info("7TV user-badge batch unavailable: %s", exc)
            continue
        for index, user_id in enumerate(batch):
            user = data.get(f"u{index}")
            style = user.get("style") if isinstance(user, dict) and isinstance(user.get("style"), dict) else {}
            badge_id = str(style.get("badge_id") or "").strip() or None
            _put_user(user_id, badge_id)


def _fetch_badge_ids(badge_ids: list[str]) -> None:
    query = """query FetcherBadges($list:[ObjectID!]) {
      cosmetics(list:$list) {
        badges {
          id name tooltip tag
          host { url files { name format width height } }
        }
      }
    }"""
    for batch in _chunks(badge_ids, _BADGE_BATCH):
        try:
            data = _post(query, {"list": batch})
        except Exception as exc:
            log.info("7TV badge batch unavailable: %s", exc)
            continue

        cosmetics = data.get("cosmetics") if isinstance(data.get("cosmetics"), dict) else {}
        badges = cosmetics.get("badges") if isinstance(cosmetics.get("badges"), list) else []
        found: set[str] = set()
        for raw in badges:
            if not isinstance(raw, dict):
                continue
            badge_id = str(raw.get("id") or "").strip()
            if not badge_id:
                continue
            found.add(badge_id)
            _put_badge(badge_id, _normalise_badge(raw))
        for badge_id in batch:
            if badge_id not in found:
                _put_badge(badge_id, None)


def apply(payload: dict) -> dict:
    """Append equipped 7TV cosmetic badges to replay messages, best-effort."""
    messages = [m for m in (payload.get("messages") or []) if isinstance(m, dict)]
    if not messages:
        payload["sevenTvBadges"] = 0
        payload["sevenTvBadgeUsers"] = 0
        return payload

    counts: Counter[str] = Counter()
    for message in messages:
        user = message.get("user") if isinstance(message.get("user"), dict) else {}
        user_id = _valid_twitch_id(user.get("id"))
        if user_id:
            counts[user_id] += 1
    if not counts:
        payload["sevenTvBadges"] = 0
        payload["sevenTvBadgeUsers"] = 0
        return payload

    user_to_badge: dict[str, str | None] = {}
    missing: list[str] = []
    for user_id, _count in counts.most_common():
        hit, badge_id = _cached_user(user_id)
        if hit:
            user_to_badge[user_id] = badge_id
        elif len(missing) < _MAX_USER_LOOKUPS:
            missing.append(user_id)

    if missing:
        _fetch_user_ids(missing)
        for user_id in missing:
            hit, badge_id = _cached_user(user_id)
            if hit:
                user_to_badge[user_id] = badge_id

    needed_badges = sorted({badge_id for badge_id in user_to_badge.values() if badge_id})
    unresolved = []
    badge_defs: dict[str, dict] = {}
    for badge_id in needed_badges:
        hit, badge = _cached_badge(badge_id)
        if hit:
            if isinstance(badge, dict):
                badge_defs[badge_id] = badge
        else:
            unresolved.append(badge_id)
    if unresolved:
        _fetch_badge_ids(unresolved)
        for badge_id in unresolved:
            hit, badge = _cached_badge(badge_id)
            if hit and isinstance(badge, dict):
                badge_defs[badge_id] = badge

    badged_messages = 0
    badged_users: set[str] = set()
    for message in messages:
        user = message.get("user") if isinstance(message.get("user"), dict) else {}
        user_id = _valid_twitch_id(user.get("id"))
        badge_id = user_to_badge.get(user_id) if user_id else None
        badge = badge_defs.get(badge_id or "")
        if not badge:
            continue

        existing = [
            item for item in (message.get("badges") or [])
            if isinstance(item, dict) and item.get("source") != "7tv"
        ]
        existing.append({
            "setId": "7tv-cosmetic",
            "version": badge["id"],
            "imageUrl": badge["imageUrl"],
            "title": badge["title"],
            "source": "7tv",
            "cosmeticId": badge["id"],
        })
        message["badges"] = existing
        badged_messages += 1
        badged_users.add(user_id)

    payload["sevenTvBadges"] = badged_messages
    payload["sevenTvBadgeUsers"] = len(badged_users)
    return payload
