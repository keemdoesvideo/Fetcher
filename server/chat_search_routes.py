"""HTTP endpoints for on-demand full-VOD Twitch chat indexing/search."""

from __future__ import annotations

import logging
import re

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import chat_index, errors, limits

log = logging.getLogger("fetcher.chat.search")
_index_window = limits.RequestWindow(max_requests=6, window_seconds=30 * 60)
_search_window = limits.RequestWindow(max_requests=90, window_seconds=5 * 60)


class ChatIndexRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    duration: float = Field(..., gt=1, le=12 * 60 * 60)


class ChatFullSearchRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    query: str = Field(..., min_length=2, max_length=120)
    limit: int = Field(default=40, ge=1, le=50)


def _client_key(request: Request) -> str:
    direct = request.client.host if request.client else "unknown"
    if direct in {"127.0.0.1", "::1"}:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded[:96]
    return (direct or "unknown")[:96]


def _error(err: errors.FetcherError) -> JSONResponse:
    log.info("full chat search error %s: %s", err.code, err.detail or err.message)
    return JSONResponse(status_code=err.http_status, content=err.to_public())


def register(app) -> None:
    if getattr(app.state, "fetcher_chat_search_registered", False):
        return
    app.state.fetcher_chat_search_registered = True

    @app.post("/api/chat/index")
    def twitch_chat_index(req: ChatIndexRequest, request: Request):
        key = _client_key(request)
        if not _index_window.allow(key):
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": "120"},
                content={
                    "error": {
                        "code": "busy",
                        "message": "give full-chat indexing a couple of minutes before starting another VOD.",
                    }
                },
            )
        try:
            return chat_index.start(req.url, req.duration)
        except errors.FetcherError as err:
            return _error(err)

    @app.get("/api/chat/index/status/{video_id}")
    def twitch_chat_index_status(video_id: str):
        clean = re.sub(r"\D", "", str(video_id or ""))
        if not clean:
            return JSONResponse(status_code=404, content={"error": {"code": "not_found", "message": "chat index not found"}})
        state = chat_index.status(clean)
        if not state:
            return JSONResponse(status_code=404, content={"error": {"code": "not_found", "message": "chat index not found"}})
        return state

    @app.post("/api/chat/search/full")
    def twitch_chat_full_search(req: ChatFullSearchRequest, request: Request):
        key = _client_key(request)
        if not _search_window.allow(key):
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": "30"},
                content={
                    "error": {
                        "code": "busy",
                        "message": "too many full-chat searches at once — give Fetcher a moment.",
                    }
                },
            )
        try:
            result = chat_index.search(req.url, req.query, req.limit)
        except errors.FetcherError as err:
            return _error(err)
        if not result.get("ready"):
            return JSONResponse(
                status_code=409,
                content={
                    "error": {
                        "code": "index_not_ready",
                        "message": "index this VOD's chat first, then search it instantly.",
                    },
                    "index": result.get("index"),
                },
            )
        return result
