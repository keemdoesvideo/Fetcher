"""Approximate full-VOD Twitch chat activity for the clip-finding heatmap.

A complete multi-hour replay chat can contain hundreds of thousands of messages,
so the public Fetcher instance should not download every comment just to draw a
sparkline. Instead we sample evenly-spaced offsets across the VOD and use the
comment density of Twitch's returned page as a local messages/minute estimate.
The result is intentionally labelled approximate and cached per VOD.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import threading
import time

from . import chat_capture, errors

log = logging.getLogger("fetcher.chat.activity")

_CACHE_TTL = 30 * 60
_MAX_DURATION = 12 * 60 * 60
_DEFAULT_SAMPLES = 48
_MIN_SAMPLES = 18
_MAX_SAMPLES = 64
_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()


def _cached(key: str):
    now = time.monotonic()
    with _cache_lock:
        item = _cache.get(key)
        if not item:
            return None
        created, value = item
        if now - created > _CACHE_TTL:
            _cache.pop(key, None)
            return None
        # Return shallow copies so callers cannot mutate the cache entry.
        return {
            **value,
            "samples": [dict(sample) for sample in value.get("samples", [])],
            "cached": True,
        }


def _put(key: str, value: dict) -> dict:
    with _cache_lock:
        _cache[key] = (time.monotonic(), value)
    return value


def _sample(video_id: str, at: float) -> dict:
    envelope = chat_capture._request_page(video_id, offset=at)
    data = envelope.get("data") if isinstance(envelope.get("data"), dict) else {}
    video = data.get("video") if isinstance(data.get("video"), dict) else None
    if video is None:
        raise errors.FetcherError(
            errors.VIDEO_UNAVAILABLE,
            message="that Twitch VOD isn't available anymore",
        )
    comments = video.get("comments") if isinstance(video.get("comments"), dict) else {}
    edges = comments.get("edges") if isinstance(comments.get("edges"), list) else []
    offsets: list[float] = []
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        node = edge.get("node") if isinstance(edge.get("node"), dict) else None
        if not node:
            continue
        try:
            offsets.append(float(node.get("contentOffsetSeconds")))
        except (TypeError, ValueError):
            continue

    if not offsets:
        rate = 0.0
        span = 0.0
    elif len(offsets) == 1:
        rate = 1.0
        span = 0.0
    else:
        span = max(1.0, max(offsets) - min(offsets))
        # Twitch commonly returns roughly a page of nearby comments. Page count
        # divided by covered seconds is a useful local density estimate without
        # downloading the whole replay chat.
        rate = min(10_000.0, len(offsets) / span * 60.0)

    return {
        "time": round(at, 3),
        "rate": round(rate, 2),
        "pageMessages": len(offsets),
        "pageSpan": round(span, 2),
    }


def scan(url: str, duration: float, sample_count: int = _DEFAULT_SAMPLES) -> dict:
    video_id = chat_capture._vod_id(url)
    try:
        duration = float(duration)
    except (TypeError, ValueError) as exc:
        raise errors.FetcherError(errors.INVALID_SECTION, detail=str(exc)) from exc
    if duration <= 1 or duration > _MAX_DURATION:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="fetcher couldn't read that VOD duration for the chat heatmap",
        )

    sample_count = max(_MIN_SAMPLES, min(_MAX_SAMPLES, int(sample_count or _DEFAULT_SAMPLES)))
    cache_key = f"{video_id}:{round(duration)}:{sample_count}"
    cached = _cached(cache_key)
    if cached:
        return cached

    step = duration / sample_count
    points = [min(duration - 0.01, (index + 0.5) * step) for index in range(sample_count)]
    samples: list[dict] = []
    failures = 0
    workers = min(6, sample_count)
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="fetcher-chat-activity") as pool:
        futures = {pool.submit(_sample, video_id, point): point for point in points}
        for future in as_completed(futures):
            point = futures[future]
            try:
                samples.append(future.result())
            except errors.FetcherError:
                failures += 1
            except Exception as exc:
                failures += 1
                log.info("activity sample failed vod=%s at=%.1f: %s", video_id, point, exc)

    samples.sort(key=lambda item: item["time"])
    if not samples:
        raise errors.FetcherError(
            errors.EXTRACTION_FAILED,
            message="fetcher couldn't scan that VOD's chat activity right now",
        )

    peak = max((float(item.get("rate") or 0.0) for item in samples), default=0.0)
    result = {
        "provider": "twitch",
        "vodId": video_id,
        "duration": round(duration, 3),
        "samples": samples,
        "sampleCount": len(samples),
        "peakRate": round(peak, 2),
        "approximate": True,
        "failedSamples": failures,
        "cached": False,
    }
    log.info(
        "chat activity vod=%s duration=%.1f samples=%s failures=%s peak=%.1f/min",
        video_id,
        duration,
        len(samples),
        failures,
        peak,
    )
    return _put(cache_key, result)
