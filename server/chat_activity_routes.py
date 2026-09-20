"""HTTP endpoint for the sampled Twitch VOD chat-activity heatmap."""

from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import chat_activity, errors, limits

log = logging.getLogger("fetcher.chat.activity")
_activity_window = limits.RequestWindow(max_requests=4, window_seconds=10 * 60)


class ChatActivityRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    duration: float = Field(..., gt=1, le=12 * 60 * 60)
    samples: int = Field(default=48, ge=18, le=64)


def _client_key(request: Request) -> str:
    direct = request.client.host if request.client else "unknown"
    if direct in {"127.0.0.1", "::1"}:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded[:96]
    return (direct or "unknown")[:96]


def register(app) -> None:
    if getattr(app.state, "fetcher_chat_activity_registered", False):
        return
    app.state.fetcher_chat_activity_registered = True

    @app.post("/api/chat/activity")
    def twitch_chat_activity(req: ChatActivityRequest, request: Request):
        key = _client_key(request)
        if not _activity_window.allow(key):
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": "60"},
                content={
                    "error": {
                        "code": "busy",
                        "message": "give the VOD chat scanner a minute before scanning again.",
                    }
                },
            )
        try:
            return chat_activity.scan(req.url, req.duration, req.samples)
        except errors.FetcherError as err:
            log.info("chat activity error %s: %s", err.code, err.detail or err.message)
            return JSONResponse(status_code=err.http_status, content=err.to_public())
