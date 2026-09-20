"""Resolve real Twitch chat-badge artwork for replay-chat messages.

Twitch's documented Helix badge endpoints require OAuth. Fetcher already reads
finished-VOD chat through Twitch's public web GraphQL API, so badge resolution
uses the same public/no-user-auth surface Twitch's web client uses. Failures are
soft: callers keep the normalized badge set/version and the renderer falls back
to its existing text labels.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request

log = logging.getLogger("fetcher.chat.badges")

_TWITCH_GQL = "https://gql.twitch.tv/gql"
_CACHE_TTL = 60 * 60
_CHAT_LIST_BADGES_HASH = "dd0997370fb7ca288bc52a96a9a7e3222c75c4a9a9b03df17d779666f07f7529"

_cache: dict[str, tuple[float, dict[tuple[str, str], dict]]] = {}


def _cache_get(key: str):
    item = _cache.get(key)
    if not item:
        return None
    created, value = item
    if time.monotonic() - created > _CACHE_TTL:
        _cache.pop(key, None)
        return None
    return value


def _cache_put(key: str, value: dict[tuple[str, str], dict]):
    _cache[key] = (time.monotonic(), value)
    return value


def _gql(payload: dict, client_id: str) -> dict:
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        _TWITCH_GQL,
        data=data,
        method="POST",
        headers={
            "Client-ID": client_id,
            "Content-Type": "application/json",
            "Origin": "https://www.twitch.tv",
            "Referer": "https://www.twitch.tv/",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
        },
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        body = response.read().decode("utf-8", "replace")
    parsed = json.loads(body)
    envelope = parsed[0] if isinstance(parsed, list) and parsed else parsed
    if not isinstance(envelope, dict):
        raise ValueError("unexpected Twitch badge GraphQL response")
    if envelope.get("errors"):
        raise ValueError(json.dumps(envelope.get("errors"), ensure_ascii=False)[:800])
    return envelope


def _catalog(rows) -> dict[tuple[str, str], dict]:
    out: dict[tuple[str, str], dict] = {}
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        set_id = str(row.get("setID") or row.get("setId") or "").strip()
        version = str(row.get("version") or row.get("id") or "").strip()
        image = str(
            row.get("imageURL")
            or row.get("imageUrl")
            or row.get("image_url_4x")
            or row.get("image_url_2x")
            or row.get("image_url_1x")
            or ""
        ).strip()
        if not set_id or not version or not image.startswith("https://"):
            continue
        out[(set_id, version)] = {
            "imageUrl": image,
            "title": str(row.get("title") or set_id).strip(),
        }
    return out


def _persisted_catalog(channel_login: str, client_id: str) -> dict[tuple[str, str], dict]:
    envelope = _gql(
        {
            "operationName": "ChatList_Badges",
            "variables": {"channelLogin": channel_login},
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": _CHAT_LIST_BADGES_HASH,
                }
            },
        },
        client_id,
    )
    data = envelope.get("data") if isinstance(envelope.get("data"), dict) else {}
    return _catalog(data.get("badges"))


def _query_catalog(channel_id: str, channel_login: str, client_id: str) -> dict[tuple[str, str], dict]:
    """Fallback to ordinary GraphQL query text if Twitch rotates the hash."""
    merged: dict[tuple[str, str], dict] = {}

    global_envelope = _gql(
        {
            "operationName": "Badges",
            "variables": {"quality": "QUADRUPLE"},
            "query": (
                "query Badges($quality: BadgeImageSize) { "
                "badges { imageURL(size: $quality) setID title version } }"
            ),
        },
        client_id,
    )
    global_data = global_envelope.get("data") if isinstance(global_envelope.get("data"), dict) else {}
    merged.update(_catalog(global_data.get("badges")))

    channel_envelope = _gql(
        {
            "operationName": "UserBadges",
            "variables": {
                "id": channel_id,
                "login": channel_login,
                "quality": "QUADRUPLE",
            },
            "query": (
                "query UserBadges($id: ID, $login: String, $quality: BadgeImageSize) { "
                "user(id: $id, login: $login, lookupType: ALL) { "
                "broadcastBadges { imageURL(size: $quality) setID title version } } }"
            ),
        },
        client_id,
    )
    channel_data = channel_envelope.get("data") if isinstance(channel_envelope.get("data"), dict) else {}
    user = channel_data.get("user") if isinstance(channel_data.get("user"), dict) else {}
    merged.update(_catalog(user.get("broadcastBadges")))
    return merged


def catalog_for_channel(channel_id: str, channel_login: str, client_id: str) -> dict[tuple[str, str], dict]:
    channel_id = str(channel_id or "").strip()
    channel_login = str(channel_login or "").strip().lower()
    if not channel_id and not channel_login:
        return {}
    key = f"{channel_id}:{channel_login}"
    cached = _cache_get(key)
    if isinstance(cached, dict):
        return cached

    try:
        catalog = _persisted_catalog(channel_login, client_id)
        if catalog:
            return _cache_put(key, catalog)
    except Exception as exc:
        log.info("Twitch persisted badge query unavailable for %s: %s", channel_login or channel_id, exc)

    try:
        catalog = _query_catalog(channel_id, channel_login, client_id)
        if catalog:
            return _cache_put(key, catalog)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
        log.info("Twitch badge artwork unavailable for %s: %s", channel_login or channel_id, exc)
    except Exception as exc:
        log.info("Twitch badge artwork failed for %s: %s", channel_login or channel_id, exc)
    return {}


def enrich_messages(messages: list[dict], catalog: dict[tuple[str, str], dict]) -> int:
    """Attach image/title metadata to replay badges in-place."""
    if not catalog:
        return 0
    resolved = 0
    for message in messages:
        if not isinstance(message, dict):
            continue
        for badge in message.get("badges") or []:
            if not isinstance(badge, dict):
                continue
            key = (str(badge.get("setId") or ""), str(badge.get("version") or ""))
            info = catalog.get(key)
            if not info:
                continue
            badge["imageUrl"] = info["imageUrl"]
            badge["title"] = info.get("title") or key[0]
            badge["source"] = "twitch"
            resolved += 1
    return resolved
