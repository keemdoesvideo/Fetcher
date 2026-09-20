"""On-demand full-VOD Twitch chat indexing for clip search.

The normal chat preview deliberately reads only a short selected window. This
module builds a compact index for the whole finished VOD so editors can search
messages, usernames and emote codes without re-reading Twitch on every
keystroke.

Active indexes are kept in memory for fast search. Completed indexes are also
saved as compressed JSON outside the repo so a Fetcher restart, process crash,
or one-hour memory-cache expiry does not make the same VOD get indexed again.
The index stores only fields needed for search/results; emote image data and
badges stay in the normal section loader.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import gzip
import json
import logging
import os
from pathlib import Path
import re
import threading
import time

from . import chat_capture, config, errors

log = logging.getLogger("fetcher.chat.index")

_MAX_DURATION = 12 * 60 * 60
_MAX_MESSAGES = 150_000
_MAX_PAGES = 6_000
_TTL_SECONDS = 60 * 60
_MAX_CACHED = 4

# Completed indexes live longer on disk than in RAM. Twitch VOD replay chat is
# immutable enough for clip-search purposes, while a modest age/cap prevents the
# hosted Mac from accumulating indexes forever.
_DISK_SCHEMA = 1
_DISK_TTL_SECONDS = 7 * 24 * 60 * 60
_MAX_DISK_INDEXES = 8

# Twitch's replay-chat GraphQL endpoint can briefly rate-limit or drop a page
# during long indexes. A full VOD should not make the user keep pressing the
# index button just because one request hiccupped, so page reads retry in-place
# and the worker keeps its current cursor/messages while waiting.
_PAGE_RETRIES = 8
_PAGE_PACE_SECONDS = 0.20


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
    retrying: bool = False
    retry_attempt: int = 0
    persisted_at: float = 0.0
    created_at: float = field(default_factory=time.monotonic)
    updated_at: float = field(default_factory=time.monotonic)


_entries: dict[str, IndexEntry] = {}
_lock = threading.RLock()
_build_gate = threading.BoundedSemaphore(1)


def _disk_path(video_id: str) -> Path:
    clean = re.sub(r"\D", "", str(video_id or ""))
    return config.CHAT_INDEX_ROOT / f"{clean}.json.gz"


def _cleanup_disk() -> None:
    root = config.CHAT_INDEX_ROOT
    try:
        if not root.exists():
            return
        now = time.time()
        files: list[tuple[float, Path]] = []
        for path in root.glob("*.json.gz"):
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            if now - mtime > _DISK_TTL_SECONDS:
                try:
                    path.unlink()
                except OSError:
                    pass
                continue
            files.append((mtime, path))
        files.sort(key=lambda item: item[0], reverse=True)
        for _mtime, path in files[_MAX_DISK_INDEXES:]:
            try:
                path.unlink()
            except OSError:
                pass
    except OSError as exc:
        log.info("chat index disk cleanup skipped: %s", exc)


def _persist_ready(entry: IndexEntry) -> None:
    if entry.status != "ready" or not entry.messages:
        return
    path = _disk_path(entry.vod_id)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = {
        "schema": _DISK_SCHEMA,
        "savedAt": time.time(),
        "vodId": entry.vod_id,
        "duration": entry.duration,
        "lastOffset": entry.last_offset,
        "truncated": entry.truncated,
        "messages": entry.messages,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=5) as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, path)
        saved_at = float(payload["savedAt"])
        with _lock:
            if _entries.get(entry.vod_id) is entry:
                entry.persisted_at = saved_at
                _touch(entry)
        log.info(
            "chat index persisted vod=%s messages=%s path=%s",
            entry.vod_id,
            entry.message_count,
            path,
        )
        _cleanup_disk()
    except OSError as exc:
        log.warning("chat index persistence failed vod=%s: %s", entry.vod_id, exc)
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def _load_persisted(video_id: str, expected_duration: float | None = None) -> IndexEntry | None:
    path = _disk_path(video_id)
    try:
        stat = path.stat()
    except OSError:
        return None
    if time.time() - stat.st_mtime > _DISK_TTL_SECONDS:
        try:
            path.unlink()
        except OSError:
            pass
        return None

    try:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, dict) or int(payload.get("schema") or 0) != _DISK_SCHEMA:
            raise ValueError("unsupported schema")
        if str(payload.get("vodId") or "") != str(video_id):
            raise ValueError("VOD id mismatch")
        duration = float(payload.get("duration") or 0.0)
        if duration <= 1 or duration > _MAX_DURATION:
            raise ValueError("invalid duration")
        if expected_duration is not None:
            tolerance = max(8.0, duration * 0.01)
            if abs(duration - float(expected_duration)) > tolerance:
                return None
        raw_messages = payload.get("messages")
        if not isinstance(raw_messages, list):
            raise ValueError("messages missing")
        messages = [item for item in raw_messages[:_MAX_MESSAGES] if isinstance(item, dict)]
        if not messages:
            return None
        saved_at = float(payload.get("savedAt") or stat.st_mtime)
        entry = IndexEntry(
            vod_id=str(video_id),
            duration=duration,
            status="ready",
            progress=100.0,
            message_count=len(messages),
            last_offset=float(payload.get("lastOffset") or messages[-1].get("offset") or 0.0),
            truncated=bool(payload.get("truncated")),
            messages=messages,
            persisted_at=saved_at,
        )
        log.info(
            "chat index restored vod=%s messages=%s age=%.0fs",
            video_id,
            len(messages),
            max(0.0, time.time() - saved_at),
        )
        return entry
    except (OSError, ValueError, TypeError, json.JSONDecodeError, EOFError) as exc:
        log.info("chat index cache unreadable vod=%s: %s", video_id, exc)
        try:
            path.unlink()
        except OSError:
            pass
        return None


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
    _cleanup_disk()


def _public(entry: IndexEntry) -> dict:
    persistent = entry.status == "ready" and entry.persisted_at > 0
    disk_expires = None
    if persistent:
        disk_expires = max(0, int(_DISK_TTL_SECONDS - (time.time() - entry.persisted_at)))
    return {
        "vodId": entry.vod_id,
        "status": entry.status,
        "progress": round(max(0.0, min(100.0, entry.progress)), 1),
        "indexedMessages": entry.message_count,
        "lastOffset": round(entry.last_offset, 3),
        "duration": round(entry.duration, 3),
        "truncated": entry.truncated,
        "retrying": entry.retrying,
        "retryAttempt": entry.retry_attempt,
        "persistent": persistent,
        "expiresIn": disk_expires if persistent else (_TTL_SECONDS if entry.status == "ready" else None),
        "error": entry.error or None,
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


def _retry_delay(err: errors.FetcherError, attempt: int) -> float:
    """Back off harder for Twitch rate limits, gently for ordinary network blips."""
    detail = str(err.detail or "").lower()
    if "http 429" in detail or "rate" in detail or "too many" in detail:
        return min(45.0, 8.0 * attempt)
    return min(20.0, 0.75 * (2 ** max(0, attempt - 1)))


def _request_page_resilient(
    entry: IndexEntry,
    *,
    offset: float,
    cursor: str | None,
    page_num: int,
) -> dict:
    """Read one Twitch page, transparently surviving temporary endpoint failures."""
    last_error: errors.FetcherError | None = None
    for attempt in range(1, _PAGE_RETRIES + 1):
        try:
            envelope = chat_capture._request_page(
                entry.vod_id,
                offset=offset,
                cursor=cursor,
            )
            with _lock:
                if _entries.get(entry.vod_id) is entry:
                    entry.retrying = False
                    entry.retry_attempt = 0
                    entry.error = ""
                    _touch(entry)
            return envelope
        except errors.FetcherError as err:
            last_error = err
            if err.code == errors.VIDEO_UNAVAILABLE or attempt >= _PAGE_RETRIES:
                raise

            delay = _retry_delay(err, attempt)
            with _lock:
                if _entries.get(entry.vod_id) is not entry:
                    raise
                entry.retrying = True
                entry.retry_attempt = attempt
                _touch(entry)
            log.info(
                "chat index page retry vod=%s page=%s attempt=%s/%s delay=%.1fs detail=%s",
                entry.vod_id,
                page_num,
                attempt,
                _PAGE_RETRIES,
                delay,
                err.detail or err.message,
            )
            time.sleep(delay)

    if last_error is not None:
        raise last_error
    raise errors.FetcherError(errors.EXTRACTION_FAILED)


def _worker(entry: IndexEntry) -> None:
    with _build_gate:
        with _lock:
            if _entries.get(entry.vod_id) is not entry:
                return
            entry.status = "building"
            entry.progress = 0.0
            entry.retrying = False
            entry.retry_attempt = 0
            entry.error = ""
            _touch(entry)

        cursor: str | None = None
        seen_cursors: set[str] = set()
        seen_ids: set[str] = set()
        messages: list[dict] = []
        last_offset = 0.0
        truncated = False

        try:
            for page_num in range(1, _MAX_PAGES + 1):
                envelope = _request_page_resilient(
                    entry,
                    offset=0.0,
                    cursor=cursor,
                    page_num=page_num,
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
                time.sleep(_PAGE_PACE_SECONDS)
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
                entry.retrying = False
                entry.retry_attempt = 0
                entry.status = "ready"
                _touch(entry)
            _persist_ready(entry)
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
                    entry.retrying = False
                    entry.retry_attempt = 0
                    entry.error = err.message
                    _touch(entry)
            log.info("chat index failed vod=%s: %s", entry.vod_id, err.detail or err.message)
        except Exception as exc:
            with _lock:
                if _entries.get(entry.vod_id) is entry:
                    entry.status = "error"
                    entry.retrying = False
                    entry.retry_attempt = 0
                    entry.error = "fetcher couldn't finish indexing that Twitch chat"
                    _touch(entry)
            log.exception("chat index failed vod=%s: %s", entry.vod_id, exc)


def _install_restored(entry: IndexEntry) -> IndexEntry:
    with _lock:
        existing = _entries.get(entry.vod_id)
        if existing and existing.status in {"queued", "building", "ready"}:
            _touch(existing)
            return existing
        _entries[entry.vod_id] = entry
        _touch(entry)
        return entry


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

    restored = _load_persisted(video_id, expected_duration=duration)
    if restored is not None:
        return _public(_install_restored(restored))

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
        if entry:
            _touch(entry)
            return _public(entry)

    restored = _load_persisted(video_id)
    if restored is None:
        return None
    return _public(_install_restored(restored))


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

    if entry is None:
        restored = _load_persisted(video_id)
        if restored is not None:
            entry = _install_restored(restored)

    if entry is None:
        return {"ready": False, "index": None}

    with _lock:
        _touch(entry)
        if entry.status != "ready":
            return {"ready": False, "index": _public(entry)}
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
        "persistent": entry.persisted_at > 0,
    }
