"""Small in-memory launch guards for a public Fetcher instance.

Fetcher has no accounts and deliberately keeps the public UI lightweight, so the
production guardrail is intentionally simple: cap expensive concurrent prepare
jobs and cap how often one client can start them. Nothing here is persisted and
no IP addresses are written to disk by this module.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class FetchGate:
    def __init__(
        self,
        *,
        max_global: int = 4,
        max_per_client: int = 2,
        max_starts: int = 20,
        window_seconds: int = 600,
    ) -> None:
        self.max_global = max(1, int(max_global))
        self.max_per_client = max(1, int(max_per_client))
        self.max_starts = max(1, int(max_starts))
        self.window_seconds = max(1, int(window_seconds))
        self._lock = threading.Lock()
        self._global_active = 0
        self._active: dict[str, int] = {}
        self._starts: dict[str, deque[float]] = {}

    def _trim(self, client: str, now: float) -> deque[float]:
        starts = self._starts.setdefault(client, deque())
        cutoff = now - self.window_seconds
        while starts and starts[0] < cutoff:
            starts.popleft()
        if not starts and not self._active.get(client):
            self._starts.pop(client, None)
            starts = self._starts.setdefault(client, deque())
        return starts

    def acquire(self, client: str) -> tuple[bool, str | None]:
        """Reserve one expensive prepare slot.

        Returns ``(True, None)`` when accepted. Rejections use a short reason so
        the API can choose a friendly public message without exposing internals.
        """
        client = client or "unknown"
        now = time.monotonic()
        with self._lock:
            starts = self._trim(client, now)
            if len(starts) >= self.max_starts:
                return False, "rate"
            if self._global_active >= self.max_global:
                return False, "global"
            if self._active.get(client, 0) >= self.max_per_client:
                return False, "client"

            starts.append(now)
            self._global_active += 1
            self._active[client] = self._active.get(client, 0) + 1
            return True, None

    def release(self, client: str) -> None:
        client = client or "unknown"
        with self._lock:
            if self._global_active > 0:
                self._global_active -= 1
            active = self._active.get(client, 0)
            if active <= 1:
                self._active.pop(client, None)
            else:
                self._active[client] = active - 1


class RequestWindow:
    """Cheap sliding-window limiter for actions that should not be spammed."""

    def __init__(self, *, max_requests: int = 24, window_seconds: int = 300) -> None:
        self.max_requests = max(1, int(max_requests))
        self.window_seconds = max(1, int(window_seconds))
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}

    def allow(self, client: str) -> bool:
        client = client or "unknown"
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits.setdefault(client, deque())
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            if len(self._hits) > 4096:
                # Opportunistic cleanup for a long-running public process.
                dead = [key for key, values in self._hits.items() if not values or values[-1] < cutoff]
                for key in dead[:512]:
                    self._hits.pop(key, None)
            return True
