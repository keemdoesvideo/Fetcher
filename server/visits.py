"""Persistent visitor counter for the welcome card + About stats.

A tiny JSON file holds a monotonic count plus a token -> number map, so a repeat
visitor (same browser, same token) keeps their number and never double-counts.
A process lock serialises the read-modify-write. A local run counts one machine's
visits; a single hosted instance turns this into a real global counter.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path


class VisitCounter:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._data: dict = {"count": 0, "tokens": {}}
        self._load()

    def _load(self) -> None:
        try:
            raw = json.loads(self._path.read_text("utf-8"))
            if isinstance(raw, dict):
                self._data = {
                    "count": int(raw.get("count", 0)),
                    "tokens": dict(raw.get("tokens", {})),
                }
        except (FileNotFoundError, ValueError, OSError):
            pass  # no file yet / corrupt -> start fresh

    def _save(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_name(self._path.name + ".tmp")
            tmp.write_text(json.dumps(self._data), "utf-8")
            tmp.replace(self._path)  # atomic on same filesystem
        except OSError:
            pass  # best-effort; the count is not mission-critical

    def total(self) -> int:
        with self._lock:
            return int(self._data["count"])

    def claim(self, token: str) -> tuple[int, int]:
        """Assign (or return) this visitor's number. Idempotent per token so a
        reload doesn't double-count. Returns (number, total)."""
        token = (token or "").strip()[:64]
        with self._lock:
            tokens = self._data["tokens"]
            if token and token in tokens:
                return int(tokens[token]), int(self._data["count"])
            self._data["count"] = int(self._data["count"]) + 1
            number = self._data["count"]
            if token:
                tokens[token] = number
            self._save()
            return number, number
