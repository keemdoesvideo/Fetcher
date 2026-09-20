"""On-demand full-VOD Twitch chat indexing for clip search.

The normal chat preview deliberately reads only a short selected window. This
module builds a compact, temporary index for the whole finished VOD so editors
can search messages, usernames and emote codes without re-reading Twitch on
every keystroke.

Indexes are in-memory only, expire automatically, and are built one at a time to
avoid hammering Twitch or the hosted Mac. The index stores only the fields needed
for search/results; emote image data and badges stay in the normal section loader.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
import re
import threading
import time

from . import chat_capture, errors

log = logging.getLogger("fetcher.chat.index")

_MAX_DURATION = 12 * 60 * 60
_MAX_MESSAGES = 150_000
_MAX_PAGES = 6_000
_TTL_SECONDS = 60 * 60
_MAX_CACHED = 4


@dataclass
class IndexEntry:
    vod_id: str
    duration: float
    status: str = "queued"  # queued | building | ready | error
    progress: float = 0.0
    message_count: int = 0
    last_offset: float = 0.0
    truncated: bool = False
    error: str = ""
    messages: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.monotonic)
    updated_at: float = field(default_factory=time.monotonic)


_entries: dict[str, IndexEntry] = {}
_lock = threading.RLock()
_build_gate = threading.BoundedSemaphore(1)


def _cleanup() -> None:
    now = time.monotonic()
    with _lock:
        stale = [
            key for key, entry in _entries.items()
            if entry.status != "building" and entry.status != "queued"
            and now - entry.updated_at > _TTL_SECONDS
        ]
        for key in stale:
            _entries.pop(key, None)

        ready = sorted(
            (entry for entry in _entries.values() if entry.status == "ready"),
            key=lambda entry: entry.updated_at,
            reverse=True,
        )
        for entry in ready[_MAX_CACHED:]:
            _entries.pop(entry.vod_id, None)


def _public(entry: IndexEntry) -> dict:
    return {
        "vodId": entry.vod_id,
        "status": entry.status,
        "progress": round(max(0.0, min(100.0, entry.progress)), 1),
        "indexedMessages": entry.message_count,
        "lastOffset": round(entry.last_offset, 3),
        "duration": round(entry.duration, 3),
        "truncated": entry.truncated,
        "error": entry.error or None,
        "expiresIn": _TTL_SECONDS if entry.status == "ready" else None,
    }


def _touch(entry: IndexEntry) -> None:
    entry.updated_at = time.monotonic()


def _compact(node: dict) -> dict | None:
    item = chat_capture._normalize_comment(node, 0.0)
    if not item:
        return None
    user = item.get("user") if isinstance(item.get("user"), dict) else {}
    return {
        "id": str(item.get("id") or ""),
        "offset": float(item.get("offset") or 0.0),
        "text": str(item.get("text") or ""),
        "user": {
            "login": str(user.get("login") or ""),
            "displayName": str(user.get("displayName") or "viewer"),
        },
    }


def _worker(entry: IndexEntry) -> None:
    with _build_gate:
        with _lock:
            # Entry may have been replaced while this thread was queued.
            if _entries.get(entry.vod_id) is not entry:
                return
            entry.status = "building"
            entry.progress = 0.0
            _touch(entry)

        cursor: str | None = None
        seen_cursors: set[str] = set()
        seen_ids: set[str] = set()
        messages: list[dict] = []
        last_offset = 0.0
        truncated = False

        try:
            for page_num in range(1, _MAX_PAGES + 1):
                envelope = chat_capture._request_page(
                    entry.vod_id,
                    offset=0.0,
                    cursor=cursor,
                )
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
                    if absolute > entry.duration + 5:
                        break
                    compact = _compact(node)
                    if not compact:
                        continue
                    message_id = compact["id"]
                    if message_id and message_id in seen_ids:
                        continue
                    if message_id:
                        seen_ids.add(message_id)
                    messages.append(compact)
                    if len(messages) >= _MAX_MESSAGES:
                        truncated = True
                        break

                with _lock:
                    if _entries.get(entry.vod_id) is not entry:
                        return
                    entry.last_offset = last_offset
                    entry.message_count = len(messages)
                    entry.progress = min(
                        99.0,
                        (last_offset / max(1.0, entry.duration)) * 100.0,
                    )
                    _touch(entry)

                if truncated or last_offset >= entry.duration:
                    break
                page_info = comments.get("pageInfo") if isinstance(comments.get("pageInfo"), dict) else {}
                if not page_info.get("hasNextPage"):
                    break
                if not page_last_cursor or page_last_cursor in seen_cursors:
                    log.warning(
                        "chat index pagination stalled vod=%s page=%s offset=%.1f",
                        entry.vod_id,
                        page_num,
                        last_offset,
                    )
                    break
                seen_cursors.add(page_last_cursor)
                cursor = page_last_cursor
            else:
                truncated = True

            messages.sort(key=lambda item: (item["offset"], item["id"]))
            with _lock:
                if _entries.get(entry.vod_id) is not entry:
                    return
                entry.messages = messages
                entry.message_count = len(messages)
                entry.last_offset = last_offset
                entry.progress = 100.0
                entry.truncated = truncated
                entry.status = "ready"
                _touch(entry)
            log.info(
                "chat index ready vod=%s messages=%s last=%.1f truncated=%s",
                entry.vod_id,
                len(messages),
                last_offset,
                truncated,
            )
        except errors.FetcherError as err:
            with _lock:
                if _entries.get(entry.vod_id) is entry:
                    entry.status = "error"
                    entry.error = err.message
                    _touch(entry)
            log.info("chat index failed vod=%s: %s", entry.vod_id, err.detail or err.message)
        except Exception as exc:
            with _lock:
                if _entries.get(entry.vod_id) is entry:
                    entry.status = "error"
                    entry.error = "fetcher couldn't finish indexing that Twitch chat"
                    _touch(entry)
            log.exception("chat index failed vod=%s: %s", entry.vod_id, exc)


def start(url: str, duration: float) -> dict:
    _cleanup()
    video_id = chat_capture._vod_id(url)
    try:
        duration = float(duration)
    except (TypeError, ValueError) as exc:
        raise errors.FetcherError(errors.INVALID_SECTION, detail=str(exc)) from exc
    if duration <= 1 or duration > _MAX_DURATION:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="fetcher couldn't read that VOD duration for full-chat search",
        )

    with _lock:
        existing = _entries.get(video_id)
        if existing and existing.status in {"queued", "building", "ready"}:
            _touch(existing)
            return _public(existing)
        entry = IndexEntry(vod_id=video_id, duration=duration)
        _entries[video_id] = entry

    thread = threading.Thread(
        target=_worker,
        args=(entry,),
        name=f"fetcher-chat-index-{video_id[-8:]}",
        daemon=True,
    )
    thread.start()
    return _public(entry)


def status(video_id: str) -> dict | None:
    _cleanup()
    video_id = re.sub(r"\D", "", str(video_id or ""))
    if not video_id:
        return None
    with _lock:
        entry = _entries.get(video_id)
        if not entry:
            return None
        _touch(entry)
        return _public(entry)


def search(url: str, query: str, limit: int = 40) -> dict:
    _cleanup()
    video_id = chat_capture._vod_id(url)
    query = str(query or "").strip()
    if len(query) < 2:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="type at least 2 characters to search the whole VOD",
        )
    needle = query.casefold()
    limit = max(1, min(50, int(limit or 40)))

    with _lock:
        entry = _entries.get(video_id)
        if not entry:
            return {"ready": False, "index": None}
        _touch(entry)
        if entry.status != "ready":
            return {"ready": False, "index": _public(entry)}
        # Copy the list reference while locked; ready indexes are immutable.
        messages = entry.messages
        truncated = entry.truncated
        indexed_messages = entry.message_count

    matches = []
    total = 0
    for item in messages:
        user = item.get("user") if isinstance(item.get("user"), dict) else {}
        haystack = " ".join((
            str(item.get("text") or ""),
            str(user.get("displayName") or ""),
            str(user.get("login") or ""),
        )).casefold()
        if needle not in haystack:
            continue
        total += 1
        if len(matches) < limit:
            matches.append({
                "id": item.get("id"),
                "offset": item.get("offset"),
                "text": item.get("text"),
                "user": item.get("user"),
            })

    return {
        "ready": True,
        "vodId": video_id,
        "query": query,
        "matches": matches,
        "totalMatches": total,
        "indexedMessages": indexed_messages,
        "truncated": truncated,
    }
