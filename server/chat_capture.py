"""Twitch VOD chat extraction for Fetcher's chat-capture workspace.

This deliberately starts with one provider and one job: replay chat from a
finished Twitch VOD. Twitch's public Helix API does not expose VOD chat replay,
so this module mirrors the GraphQL request used by Twitch's web player. The
operation hash and client ID are both server-side constants with environment
escape hatches because Twitch can change them independently of Fetcher.

Only the requested time window is paged. Results are normalized into a small,
provider-agnostic-ish shape the browser can animate without knowing Twitch's
GraphQL schema.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from . import errors

log = logging.getLogger("fetcher.chat")

_TWITCH_GQL = "https://gql.twitch.tv/gql"
# yt-dlp's current Twitch default client ID. This is a public web client ID, not
# a secret. Operators can override it if Twitch rotates the web client.
_TWITCH_CLIENT_ID = os.environ.get(
    "FETCHER_TWITCH_CLIENT_ID", "ue6666qo983tsx6so1t0vnawi233wa"
)
# VideoCommentsByOffsetOrCursor. Keep overrideable because persisted-query hashes
# are an implementation detail of Twitch's web app and may change.
_TWITCH_CHAT_HASH = os.environ.get(
    "FETCHER_TWITCH_CHAT_HASH",
    "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a",
)
_VOD_RE = re.compile(r"^/videos/(?P<id>\d+)(?:/|$)", re.IGNORECASE)
_MAX_RANGE_SECONDS = 30 * 60
_MAX_MESSAGES = 4000
_MAX_PAGES = 100


def _vod_id(url: str) -> str:
    try:
        parts = urlsplit(url if "://" in url else "https://" + url)
    except ValueError as exc:
        raise errors.FetcherError(errors.INVALID_URL, detail=str(exc)) from exc
    host = (parts.hostname or "").lower()
    if host not in {"twitch.tv", "www.twitch.tv", "m.twitch.tv"}:
        raise errors.FetcherError(
            errors.UNSUPPORTED_PROVIDER,
            message="chat capture currently supports Twitch VOD links",
        )
    match = _VOD_RE.match(parts.path or "")
    if not match:
        raise errors.FetcherError(
            errors.MEDIA_UNAVAILABLE,
            message="paste a finished Twitch VOD link for chat capture",
        )
    return match.group("id")


def _request_page(video_id: str, *, offset: float | None = None, cursor: str | None = None) -> dict:
    variables: dict[str, object] = {"videoID": video_id}
    if cursor:
        variables["cursor"] = cursor
    else:
        variables["contentOffsetSeconds"] = max(0, int(offset or 0))

    payload = [{
        "operationName": "VideoCommentsByOffsetOrCursor",
        "variables": variables,
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": _TWITCH_CHAT_HASH,
            }
        },
    }]
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        _TWITCH_GQL,
        data=data,
        method="POST",
        headers={
            "Client-ID": _TWITCH_CLIENT_ID,
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
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", "replace")[-1200:]
        except Exception:
            pass
        raise errors.FetcherError(
            errors.EXTRACTION_FAILED,
            message="fetcher couldn't read that Twitch VOD's replay chat",
            detail=f"Twitch GQL HTTP {exc.code}: {detail}",
        ) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise errors.FetcherError(
            errors.EXTRACTION_FAILED,
            message="fetcher couldn't reach Twitch chat right now — try again",
            detail=str(exc),
        ) from exc

    try:
        parsed = json.loads(body)
        envelope = parsed[0] if isinstance(parsed, list) and parsed else parsed
    except (json.JSONDecodeError, TypeError, IndexError) as exc:
        raise errors.FetcherError(
            errors.EXTRACTION_FAILED,
            message="fetcher couldn't read that Twitch VOD's replay chat",
            detail=f"invalid Twitch GQL response: {body[:600]}",
        ) from exc

    if not isinstance(envelope, dict):
        raise errors.FetcherError(
            errors.EXTRACTION_FAILED,
            message="fetcher couldn't read that Twitch VOD's replay chat",
            detail=f"unexpected Twitch GQL envelope: {type(envelope).__name__}",
        )
    if envelope.get("errors"):
        raise errors.FetcherError(
            errors.EXTRACTION_FAILED,
            message="fetcher couldn't read that Twitch VOD's replay chat",
            detail=json.dumps(envelope.get("errors"), ensure_ascii=False)[:1200],
        )
    return envelope


def _emote_id(fragment: dict) -> str | None:
    emote = fragment.get("emote")
    if not isinstance(emote, dict):
        return None
    for key in ("emoteID", "id", "token"):
        value = emote.get(key)
        if value:
            return str(value)
    return None


def _normalize_fragment(fragment: dict) -> dict:
    text = str(fragment.get("text") or "")
    emote_id = _emote_id(fragment)
    item = {"text": text}
    if emote_id:
        item["emoteId"] = emote_id
        # `default` asks Twitch's CDN for animated when one exists, otherwise
        # static. No OAuth is required to serve the actual emote image.
        item["emoteUrl"] = (
            "https://static-cdn.jtvnw.net/emoticons/v2/"
            f"{emote_id}/default/dark/2.0"
        )
    return item


def _normalize_badges(message: dict) -> list[dict]:
    badges = []
    for badge in message.get("userBadges") or []:
        if not isinstance(badge, dict):
            continue
        set_id = str(badge.get("setID") or badge.get("setId") or "").strip()
        if not set_id:
            continue
        badges.append({
            "setId": set_id,
            "version": str(badge.get("version") or badge.get("id") or ""),
        })
    return badges


def _normalize_comment(node: dict, start: float) -> dict | None:
    try:
        absolute = float(node.get("contentOffsetSeconds"))
    except (TypeError, ValueError):
        return None
    message = node.get("message") if isinstance(node.get("message"), dict) else {}
    commenter = node.get("commenter") if isinstance(node.get("commenter"), dict) else {}
    fragments = [
        _normalize_fragment(fragment)
        for fragment in (message.get("fragments") or [])
        if isinstance(fragment, dict)
    ]
    if not fragments:
        text = str(message.get("body") or "")
        if text:
            fragments = [{"text": text}]
    text = "".join(fragment.get("text", "") for fragment in fragments).strip()
    if not text and not any(fragment.get("emoteId") for fragment in fragments):
        return None

    display_name = str(commenter.get("displayName") or commenter.get("login") or "viewer")
    login = str(commenter.get("login") or display_name).lower()
    color = str(message.get("userColor") or "").strip()
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        color = ""

    return {
        "id": str(node.get("id") or f"{absolute:.3f}:{login}:{text[:24]}"),
        "offset": round(absolute, 3),
        "at": round(max(0.0, absolute - start), 3),
        "user": {
            "id": str(commenter.get("id") or ""),
            "login": login,
            "displayName": display_name,
            "color": color,
        },
        "badges": _normalize_badges(message),
        "fragments": fragments,
        "text": text,
    }


def fetch_twitch_chat(url: str, start: float, end: float) -> dict:
    """Fetch and normalize replay chat for ``start <= t <= end``.

    The caller validates the timecode syntax. We enforce a bounded preview
    window here because this endpoint is interactive and the hosted instance is
    shared; export can later use a separate queued render path with its own limits.
    """
    video_id = _vod_id(url)
    start = max(0.0, float(start))
    end = float(end)
    if end <= start:
        raise errors.FetcherError(errors.INVALID_SECTION)
    if end - start > _MAX_RANGE_SECONDS:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="chat preview can cover up to 30 minutes at a time for now",
        )

    messages: list[dict] = []
    cursor: str | None = None
    seen_cursors: set[str] = set()
    last_offset = start
    truncated = False

    for page_num in range(1, _MAX_PAGES + 1):
        envelope = _request_page(video_id, offset=start, cursor=cursor)
        data = envelope.get("data") if isinstance(envelope.get("data"), dict) else {}
        video = data.get("video") if isinstance(data.get("video"), dict) else None
        if video is None:
            raise errors.FetcherError(
                errors.VIDEO_UNAVAILABLE,
                message="that Twitch VOD isn't available anymore",
            )
        comments = video.get("comments") if isinstance(video.get("comments"), dict) else None
        if not comments:
            break
        edges = comments.get("edges") if isinstance(comments.get("edges"), list) else []
        if not edges:
            break

        page_last_cursor = None
        reached_end = False
        for edge in edges:
            if not isinstance(edge, dict):
                continue
            edge_cursor = edge.get("cursor")
            if edge_cursor:
                page_last_cursor = str(edge_cursor)
            node = edge.get("node") if isinstance(edge.get("node"), dict) else None
            if not node:
                continue
            try:
                absolute = float(node.get("contentOffsetSeconds"))
            except (TypeError, ValueError):
                continue
            last_offset = max(last_offset, absolute)
            if absolute < start:
                continue
            if absolute > end:
                reached_end = True
                break
            item = _normalize_comment(node, start)
            if item:
                messages.append(item)
                if len(messages) >= _MAX_MESSAGES:
                    truncated = True
                    reached_end = True
                    break

        if reached_end:
            break
        page_info = comments.get("pageInfo") if isinstance(comments.get("pageInfo"), dict) else {}
        if not page_info.get("hasNextPage"):
            break
        if not page_last_cursor or page_last_cursor in seen_cursors:
            log.warning(
                "Twitch chat pagination stalled vod=%s page=%s offset=%s",
                video_id,
                page_num,
                last_offset,
            )
            break
        seen_cursors.add(page_last_cursor)
        cursor = page_last_cursor
    else:
        truncated = True

    messages.sort(key=lambda item: (item["offset"], item["id"]))
    log.info(
        "chat capture vod=%s %.1f-%.1f messages=%s truncated=%s",
        video_id,
        start,
        end,
        len(messages),
        truncated,
    )
    return {
        "provider": "twitch",
        "vodId": video_id,
        "start": round(start, 3),
        "end": round(end, 3),
        "duration": round(end - start, 3),
        "messages": messages,
        "messageCount": len(messages),
        "truncated": truncated,
    }
