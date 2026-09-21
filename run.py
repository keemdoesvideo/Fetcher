"""Convenience launcher: `python run.py` starts the Fetcher service.

Equivalent to serving ``server.app:app`` on the configured host/port, with the
small beta feature registrars attached first. --reload is intentionally off here
(it interferes with the background sweeper); use a direct uvicorn command while
iterating on core backend code.
"""

from __future__ import annotations

import uvicorn

from server import config
import server.app as app_module
from server.chat_activity_routes import register as register_chat_activity_routes
from server.chat_routes import register as register_chat_routes
from server.chat_search_routes import register as register_chat_search_routes

# Chat is still a beta surface, so its routes/assets live outside the core app
# module for now. The production launcher attaches them before Uvicorn starts.
app_module.ALLOWED_ASSETS.update({
    "fetcher-chat.css": "text/css; charset=utf-8",
    "fetcher-chat-stages.css": "text/css; charset=utf-8",
    "fetcher-chat-source-lock.css": "text/css; charset=utf-8",
    "fetcher-chat-stage-polish.css": "text/css; charset=utf-8",
    "fetcher-chat-cleanup.css": "text/css; charset=utf-8",
    "fetcher-chat-repair.css": "text/css; charset=utf-8",
    "fetcher-chat-url-fresh.css": "text/css; charset=utf-8",
    "fetcher-chat-style-lab.css": "text/css; charset=utf-8",
    "fetcher-chat-style-lab-ui.css": "text/css; charset=utf-8",
    "fetcher-chat-intro.css": "text/css; charset=utf-8",
    "fetcher-chat.js": "application/javascript; charset=utf-8",
    "fetcher-chat-enhance.js": "application/javascript; charset=utf-8",
    "fetcher-chat-parity.js": "application/javascript; charset=utf-8",
    "fetcher-chat-insights.js": "application/javascript; charset=utf-8",
    "fetcher-chat-scrubheat.js": "application/javascript; charset=utf-8",
    "fetcher-chat-editor.js": "application/javascript; charset=utf-8",
    "fetcher-chat-index-resilience.js": "application/javascript; charset=utf-8",
    "fetcher-chat-fullsearch.js": "application/javascript; charset=utf-8",
    "fetcher-chat-fullsearch-bridge.js": "application/javascript; charset=utf-8",
    "fetcher-chat-events.js": "application/javascript; charset=utf-8",
    "fetcher-chat-canvas.js": "application/javascript; charset=utf-8",
    "fetcher-chat-presets.js": "application/javascript; charset=utf-8",
    "fetcher-chat-zerowidth.js": "application/javascript; charset=utf-8",
    "fetcher-chat-badges.js": "application/javascript; charset=utf-8",
    "fetcher-chat-paints.js": "application/javascript; charset=utf-8",
    "fetcher-chat-looks.js": "application/javascript; charset=utf-8",
    "fetcher-chat-fonts.js": "application/javascript; charset=utf-8",
    "fetcher-chat-stages.js": "application/javascript; charset=utf-8",
    "fetcher-chat-advanced.js": "application/javascript; charset=utf-8",
    "fetcher-chat-style-lab-ui.js": "application/javascript; charset=utf-8",
    "fetcher-chat-style-extras.js": "application/javascript; charset=utf-8",
    "fetcher-chat-look-gifs.js": "application/javascript; charset=utf-8",
    "fetcher-chat-intro.js": "application/javascript; charset=utf-8",
})
# These helpers are harmless on non-chat pages (they exit immediately), which
# lets us ship the extra controls without duplicating the shared HTML injector.
if "fetcher-chat-stages.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-stages.css">'
if "fetcher-chat-source-lock.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-source-lock.css">'
if "fetcher-chat-stage-polish.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-stage-polish.css">'
if "fetcher-chat-cleanup.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-cleanup.css">'
if "fetcher-chat-repair.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-repair.css">'
# This loads last on purpose: it completely rebuilds the source URL pill and
# neutralizes every earlier border/pseudo-element experiment.
if "fetcher-chat-url-fresh.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-url-fresh.css">'
# Branch-only visual research layers. They load after the stable sheets so the
# experiment can be removed cleanly without touching production styles.
if "fetcher-chat-style-lab.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-style-lab.css">'
if "fetcher-chat-style-lab-ui.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-style-lab-ui.css">'
# Chat intro deliberately mirrors the homepage first-visit glass without loading
# fetcher-main.css into the Chat page.
if "fetcher-chat-intro.css" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<link rel="stylesheet" href="/fetcher-chat-intro.css">'
if "fetcher-chat-enhance.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-enhance.js"></script>'
if "fetcher-chat-parity.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-parity.js"></script>'
if "fetcher-chat-insights.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-insights.js"></script>'
if "fetcher-chat-scrubheat.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-scrubheat.js"></script>'
if "fetcher-chat-editor.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-editor.js"></script>'
if "fetcher-chat-index-resilience.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-index-resilience.js"></script>'
if "fetcher-chat-fullsearch.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-fullsearch.js"></script>'
if "fetcher-chat-fullsearch-bridge.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-fullsearch-bridge.js"></script>'
if "fetcher-chat-events.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-events.js"></script>'
if "fetcher-chat-canvas.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-canvas.js"></script>'
if "fetcher-chat-presets.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-presets.js"></script>'
if "fetcher-chat-zerowidth.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-zerowidth.js"></script>'
if "fetcher-chat-badges.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-badges.js"></script>'
if "fetcher-chat-paints.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-paints.js"></script>'
if "fetcher-chat-looks.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-looks.js"></script>'
if "fetcher-chat-fonts.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-fonts.js"></script>'
# Stages runs after the feature helpers because it gathers those live controls
# into the centered three-page flow. Advanced runs immediately after stages and
# moves the already-wired timing/message controls into the Style page.
if "fetcher-chat-stages.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-stages.js"></script>'
if "fetcher-chat-advanced.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-advanced.js"></script>'
# Style Lab UI runs after the stable Stage 2 arranger, then extras apply the
# branch-only carousel gesture fix + bubble-size/Advanced behaviour.
if "fetcher-chat-style-lab-ui.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-style-lab-ui.js"></script>'
if "fetcher-chat-style-extras.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-style-extras.js"></script>'
# Literal animated GIF thumbnails go last so they sit above the old CSS mini
# previews while leaving those previews available as a failure fallback.
if "fetcher-chat-look-gifs.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-look-gifs.js"></script>'
# The first-visit explainer waits until the rest of Chat has assembled, then
# frosts that finished UI behind a single dismissible welcome card.
if "fetcher-chat-intro.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-intro.js"></script>'

register_chat_routes(app_module.app)
register_chat_activity_routes(app_module.app)
register_chat_search_routes(app_module.app)

# server.app declares the frontend /{asset:path} GET catch-all before these beta
# Chat registrars run. FastAPI matches routes in declaration order, so without
# this reorder every late-added Chat GET endpoint (notably
# /api/chat/download/{job_id}) is swallowed by the frontend catch-all and returns
# the generic API 404. POST endpoints still worked, which made an export appear
# to render successfully right up until the browser requested the finished file.
# Keep the frontend catch-all last after all runtime feature routes are attached.
for _route in list(app_module.app.router.routes):
    if getattr(_route, "path", None) == "/{asset:path}":
        app_module.app.router.routes.remove(_route)
        app_module.app.router.routes.append(_route)

if __name__ == "__main__":
    uvicorn.run(
        app_module.app,
        host=config.HOST,
        port=config.PORT,
        reload=False,
    )