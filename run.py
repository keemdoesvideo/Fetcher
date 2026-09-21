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
# Stages runs last because it gathers the cards created by the helpers above and
# rearranges those same live controls into the centered page stages.
if "fetcher-chat-stages.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-stages.js"></script>'
register_chat_routes(app_module.app)
register_chat_activity_routes(app_module.app)
register_chat_search_routes(app_module.app)

if __name__ == "__main__":
    uvicorn.run(
        app_module.app,
        host=config.HOST,
        port=config.PORT,
        reload=False,
    )
