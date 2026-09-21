"""Branch-only routes for animated Style Lab look-card previews."""

from __future__ import annotations

from fastapi.responses import Response

from . import chat_style_preview


def register(app) -> None:
    if getattr(app.state, "fetcher_chat_style_preview_registered", False):
        return
    app.state.fetcher_chat_style_preview_registered = True

    @app.get("/api/chat/style-preview/{look}.gif")
    def chat_style_preview_gif(look: str):
        value = str(look or "").strip().lower()
        if value not in chat_style_preview.LOOKS:
            value = "classic"
        return Response(
            content=chat_style_preview.render_gif(value),
            media_type="image/gif",
            headers={
                "Cache-Control": "public, max-age=86400",
                "X-Content-Type-Options": "nosniff",
            },
        )
