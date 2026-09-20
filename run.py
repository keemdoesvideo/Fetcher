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
    "fetcher-chat.js": "application/javascript; charset=utf-8",
    "fetcher-chat-enhance.js": "application/javascript; charset=utf-8",
    "fetcher-chat-parity.js": "application/javascript; charset=utf-8",
    "fetcher-chat-insights.js": "application/javascript; charset=utf-8",
    "fetcher-chat-scrubheat.js": "application/javascript; charset=utf-8",
    "fetcher-chat-editor.js": "application/javascript; charset=utf-8",
    "fetcher-chat-fullsearch.js": "application/javascript; charset=utf-8",
    "fetcher-chat-fullsearch-bridge.js": "application/javascript; charset=utf-8",
})
# These helpers are harmless on non-chat pages (they exit immediately), which
# lets us ship the extra controls without duplicating the shared HTML injector.
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
if "fetcher-chat-fullsearch.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-fullsearch.js"></script>'
if "fetcher-chat-fullsearch-bridge.js" not in app_module._LAUNCH_HEAD:
    app_module._LAUNCH_HEAD += '\n<script defer src="/fetcher-chat-fullsearch-bridge.js"></script>'
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
