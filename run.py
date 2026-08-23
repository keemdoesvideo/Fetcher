"""Convenience launcher: `python run.py` starts the Fetcher dev server.

Equivalent to `python -m uvicorn server.app:app --host 127.0.0.1 --port 8765`.
Set FETCHER_HOST / FETCHER_PORT to override. --reload is intentionally off here
(it interferes with the background sweeper); use the uvicorn command with
--reload while iterating on backend code.
"""

from __future__ import annotations

import uvicorn

from server import config

if __name__ == "__main__":
    uvicorn.run(
        "server.app:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        # Keep idle connections open far longer than uvicorn's 5s default. That
        # 5s close was disrupting the cross-document view transition: after ~5s
        # idle the browser's connection was dropped, so the next navigation had
        # to reconnect and the page swap snapped instead of animating.
        timeout_keep_alive=3600,
    )
