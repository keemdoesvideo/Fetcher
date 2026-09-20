"""Third-party Twitch emotes for chat capture.

Fetcher keeps native Twitch emotes from the replay payload, then uses this module
for plain-text tokens supplied by 7TV, BetterTTV and FrankerFaceZ. All APIs used
here are public/no-auth endpoints. Failures are deliberately soft: replay chat
must still load even if one emote service is down.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from typing import Callable

log = logging.getLogger("fetcher.chat.emotes")

_TWITCH_GQL = "https://gql.twitch.tv/gql"
_TWITCH_METADATA_HASH = os.environ.get(
    "FETCHER_TWITCH_METADATA_HASH",
    "45111672eea2e507f8ba44d101a61862f9c56b11dee09a15634cb75cb9b9084d",
)
_SEVENTV = "https://7tv.io/v3"
_BTTV = "https://api.betterttv.net/3"
_FFZ = "https://api.frankerfacez.com/v1"
_CACHE_TTL = 30 * 60
_PUNCT = "\"'`.,!?;:()[]{}<>"

_cache: dict[str, tuple[float, object]] = {}


def _cache_get(key: str):
    item = _cache.get(key)
    if not item:
        return None
    created, value = item
    if time.monotonic() - created > _CACHE_TTL:
        _cache.pop(key, None)
        return None
    return value


def _cache_put(key: str, value):
    _cache[key] = (time.monotonic(), value)
    return value


def _json_request(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None):
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "Fetcher/0.2 (+https://fetcher.hahkeemi.com)",
    }
    request_headers.update(headers or {})
    req = urllib.request.Request(
        url,
        data=data,
        method="POST" if data is not None else "GET",
        headers=request_headers,
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def twitch_channel_for_vod(video_id: str, client_id: str) -> dict:
    """Return the VOD owner's Twitch id/login/display name, best-effort."""
    key = f"twitch-owner:{video_id}"
    cached = _cache_get(key)
    if isinstance(cached, dict):
        return cached

    payload = [{
        "operationName": "VideoMetadata",
        "variables": {"channelLogin": "", "videoID": str(video_id)},
        "extensions": {
            "persistedQuery": {"version": 1, "sha256Hash": _TWITCH_METADATA_HASH}
        },
    }]
    try:
        parsed = _json_request(
            _TWITCH_GQL,
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={
                "Client-ID": client_id,
                "Content-Type": "application/json",
                "Origin": "https://www.twitch.tv",
                "Referer": "https://www.twitch.tv/",
            },
        )
        envelope = parsed[0] if isinstance(parsed, list) and parsed else parsed
        video = ((envelope or {}).get("data") or {}).get("video") or {}
        owner = video.get("owner") or {}
        result = {
            "id": str(owner.get("id") or ""),
            "login": str(owner.get("login") or "").lower(),
            "displayName": str(owner.get("displayName") or owner.get("login") or ""),
        }
        if result["id"]:
            return _cache_put(key, result)
    except Exception as exc:
        log.info("could not resolve Twitch VOD owner %s: %s", video_id, exc)
    return {}


def _https(url: str) -> str:
    if url.startswith("//"):
        return "https:" + url
    return url


def _seven_url(entry: dict) -> tuple[str, bool]:
    data = entry.get("data") if isinstance(entry.get("data"), dict) else {}
    host = data.get("host") if isinstance(data.get("host"), dict) else {}
    animated = bool(data.get("animated"))
    base = _https(str(host.get("url") or ""))
    files = host.get("files") if isinstance(host.get("files"), list) else []
    preferred = (
        "3x.webp", "2x.webp", "3x.avif", "2x.avif",
        "3x.gif", "2x.gif", "1x.webp", "1x.gif",
    )
    by_name = {
        str(item.get("name")): item
        for item in files
        if isinstance(item, dict) and item.get("name")
    }
    for name in preferred:
        if name in by_name and base:
            return f"{base}/{name}", animated
    emote_id = str(entry.get("id") or data.get("id") or "")
    if emote_id:
        return f"https://cdn.7tv.app/emote/{emote_id}/3x.webp", animated
    return "", animated


def _seven_set(payload) -> dict[str, dict]:
    if not isinstance(payload, dict):
        return {}
    result: dict[str, dict] = {}
    for entry in payload.get("emotes") or []:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "")
        url, animated = _seven_url(entry)
        if name and url:
            result[name] = {
                "url": url,
                "source": "7tv",
                "animated": animated,
                "zeroWidth": bool(int(entry.get("flags") or 0) & 256),
            }
    return result


def _load_7tv(channel_id: str) -> tuple[dict[str, dict], bool]:
    key = f"7tv:{channel_id}"
    cached = _cache_get(key)
    if isinstance(cached, dict):
        return cached, True
    merged: dict[str, dict] = {}
    succeeded = False
    try:
        merged.update(_seven_set(_json_request(f"{_SEVENTV}/emote-sets/global")))
        succeeded = True
    except Exception as exc:
        log.info("7TV global emotes unavailable: %s", exc)
    try:
        user = _json_request(f"{_SEVENTV}/users/twitch/{channel_id}")
        emote_set = user.get("emote_set") if isinstance(user, dict) else None
        if isinstance(emote_set, dict):
            channel_map = _seven_set(emote_set)
            set_id = str(emote_set.get("id") or "")
            if not channel_map and set_id:
                channel_map = _seven_set(_json_request(f"{_SEVENTV}/emote-sets/{set_id}"))
            merged.update(channel_map)
        succeeded = True
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            log.info("7TV channel emotes unavailable for %s: %s", channel_id, exc)
    except Exception as exc:
        log.info("7TV channel emotes unavailable for %s: %s", channel_id, exc)
    if succeeded:
        _cache_put(key, merged)
    return merged, succeeded


def _bttv_items(items) -> dict[str, dict]:
    result: dict[str, dict] = {}
    if not isinstance(items, list):
        return result
    for entry in items:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("code") or "")
        emote_id = str(entry.get("id") or "")
        if name and emote_id:
            result[name] = {
                "url": f"https://cdn.betterttv.net/emote/{emote_id}/3x",
                "source": "bttv",
                "animated": str(entry.get("imageType") or "").lower() == "gif",
            }
    return result


def _load_bttv(channel_id: str) -> tuple[dict[str, dict], bool]:
    key = f"bttv:{channel_id}"
    cached = _cache_get(key)
    if isinstance(cached, dict):
        return cached, True
    merged: dict[str, dict] = {}
    succeeded = False
    try:
        merged.update(_bttv_items(_json_request(f"{_BTTV}/cached/emotes/global")))
        succeeded = True
    except Exception as exc:
        log.info("BetterTTV global emotes unavailable: %s", exc)
    try:
        channel = _json_request(f"{_BTTV}/cached/users/twitch/{channel_id}")
        if isinstance(channel, dict):
            merged.update(_bttv_items(channel.get("channelEmotes")))
            merged.update(_bttv_items(channel.get("sharedEmotes")))
        succeeded = True
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            log.info("BetterTTV channel emotes unavailable for %s: %s", channel_id, exc)
    except Exception as exc:
        log.info("BetterTTV channel emotes unavailable for %s: %s", channel_id, exc)
    if succeeded:
        _cache_put(key, merged)
    return merged, succeeded


def _ffz_url(entry: dict) -> tuple[str, bool]:
    animated = entry.get("animated") if isinstance(entry.get("animated"), dict) else {}
    urls = entry.get("urls") if isinstance(entry.get("urls"), dict) else {}
    for mapping, is_animated in ((animated, True), (urls, False)):
        for scale in ("4", "2", "1"):
            url = mapping.get(scale)
            if url:
                return _https(str(url)), is_animated
    return "", False


def _ffz_sets(payload, set_ids: set[str] | None = None) -> dict[str, dict]:
    result: dict[str, dict] = {}
    if not isinstance(payload, dict):
        return result
    sets = payload.get("sets") if isinstance(payload.get("sets"), dict) else {}
    for set_id, emote_set in sets.items():
        if set_ids is not None and str(set_id) not in set_ids:
            continue
        if not isinstance(emote_set, dict):
            continue
        for entry in emote_set.get("emoticons") or []:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("name") or "")
            url, animated = _ffz_url(entry)
            if name and url:
                result[name] = {"url": url, "source": "ffz", "animated": animated}
    return result


def _load_ffz(channel_id: str) -> tuple[dict[str, dict], bool]:
    key = f"ffz:{channel_id}"
    cached = _cache_get(key)
    if isinstance(cached, dict):
        return cached, True
    merged: dict[str, dict] = {}
    succeeded = False
    try:
        global_payload = _json_request(f"{_FFZ}/set/global")
        default_sets = {
            str(value) for value in (global_payload.get("default_sets") or [])
        } if isinstance(global_payload, dict) else set()
        merged.update(_ffz_sets(global_payload, default_sets or None))
        succeeded = True
    except Exception as exc:
        log.info("FrankerFaceZ global emotes unavailable: %s", exc)
    try:
        channel = _json_request(f"{_FFZ}/room/id/{channel_id}")
        merged.update(_ffz_sets(channel))
        succeeded = True
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            log.info("FrankerFaceZ channel emotes unavailable for %s: %s", channel_id, exc)
    except Exception as exc:
        log.info("FrankerFaceZ channel emotes unavailable for %s: %s", channel_id, exc)
    if succeeded:
        _cache_put(key, merged)
    return merged, succeeded


def catalog_for_channel(channel_id: str) -> tuple[dict[str, dict], list[str]]:
    """Build a name -> image catalog. Channel-specific 7TV wins collisions."""
    key = f"catalog:{channel_id}"
    cached = _cache_get(key)
    if isinstance(cached, tuple) and len(cached) == 2:
        return cached

    seven, seven_ok = _load_7tv(channel_id)
    bttv, bttv_ok = _load_bttv(channel_id)
    ffz, ffz_ok = _load_ffz(channel_id)

    # Each loader already combines global + channel sets. Service precedence is
    # FFZ < BTTV < 7TV, matching what users most commonly expect in Twitch chat.
    merged: dict[str, dict] = {}
    merged.update(ffz)
    merged.update(bttv)
    merged.update(seven)
    providers = [
        name for name, ok in (("7tv", seven_ok), ("bttv", bttv_ok), ("ffz", ffz_ok)) if ok
    ]
    result = (merged, providers)
    _cache_put(key, result)
    return result


def _token_parts(piece: str, catalog: dict[str, dict]):
    if piece in catalog:
        return "", piece, ""
    if not piece or piece.isspace():
        return None
    left = len(piece) - len(piece.lstrip(_PUNCT))
    right = len(piece.rstrip(_PUNCT))
    core = piece[left:right]
    if core and core in catalog:
        return piece[:left], core, piece[right:]
    return None


def split_text(text: str, catalog: dict[str, dict]) -> list[dict]:
    """Replace whitespace-delimited third-party emote codes while preserving text."""
    if not text or not catalog:
        return [{"text": text}] if text else []
    output: list[dict] = []
    for piece in re.split(r"(\s+)", text):
        if not piece:
            continue
        match = _token_parts(piece, catalog)
        if not match:
            output.append({"text": piece})
            continue
        prefix, code, suffix = match
        if prefix:
            output.append({"text": prefix})
        info = catalog[code]
        output.append({
            "text": code,
            "emoteUrl": info["url"],
            "emoteSource": info.get("source", ""),
            "animated": bool(info.get("animated")),
            "zeroWidth": bool(info.get("zeroWidth")),
        })
        if suffix:
            output.append({"text": suffix})
    return output


def enrich_messages(messages: list[dict], catalog: dict[str, dict]) -> int:
    """Mutate normalized replay messages, enriching only non-Twitch fragments."""
    if not catalog:
        return 0
    resolved = 0
    for message in messages:
        fragments = message.get("fragments") if isinstance(message.get("fragments"), list) else []
        enriched: list[dict] = []
        for fragment in fragments:
            if not isinstance(fragment, dict):
                continue
            if fragment.get("emoteUrl") or fragment.get("emoteId"):
                enriched.append(fragment)
                continue
            pieces = split_text(str(fragment.get("text") or ""), catalog)
            resolved += sum(1 for piece in pieces if piece.get("emoteUrl"))
            enriched.extend(pieces)
        if enriched:
            message["fragments"] = enriched
    return resolved
