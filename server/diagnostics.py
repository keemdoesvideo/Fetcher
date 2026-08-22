"""Environment diagnostics.

Verifies the three things a YouTube fetch actually needs: a new-enough Python,
yt-dlp importable, and FFmpeg reachable. Used both at startup (to print a clear
banner) and by the /api/health endpoint. Nothing here raises — it reports — so
the server can start and still explain what's wrong instead of dying cryptically.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from . import config

MIN_PYTHON = (3, 10)


def _python_report() -> dict:
    ok = sys.version_info >= MIN_PYTHON
    return {
        "ok": ok,
        "version": ".".join(str(p) for p in sys.version_info[:3]),
        "required": ".".join(str(p) for p in MIN_PYTHON) + "+",
        "hint": None if ok else "Fetcher needs Python 3.10 or newer.",
    }


def _ytdlp_report() -> dict:
    try:
        import yt_dlp  # noqa: F401

        return {"ok": True, "version": getattr(yt_dlp.version, "__version__", "unknown"), "hint": None}
    except Exception as exc:  # pragma: no cover - import failure path
        return {
            "ok": False,
            "version": None,
            "hint": "yt-dlp is not installed. Run: pip install -r requirements.txt",
            "detail": str(exc),
        }


def find_ffmpeg() -> str | None:
    """Resolve an ffmpeg executable path, honouring the configured override."""
    loc = config.FFMPEG_LOCATION
    if loc:
        p = Path(loc)
        if p.is_file():
            return str(p)
        # Treat a directory as a folder containing ffmpeg(.exe).
        candidate = p / ("ffmpeg.exe" if sys.platform.startswith("win") else "ffmpeg")
        if candidate.is_file():
            return str(candidate)
    return shutil.which("ffmpeg")


def _ffmpeg_report() -> dict:
    path = find_ffmpeg()
    if path:
        return {"ok": True, "path": path, "hint": None}
    return {
        "ok": False,
        "path": None,
        "hint": (
            "FFmpeg not found. Install it (Windows: `winget install Gyan.FFmpeg`) "
            "and reopen your terminal, or set FETCHER_FFMPEG_LOCATION to its folder."
        ),
    }


def _js_runtime_report() -> dict:
    """Modern YouTube extraction needs a JavaScript runtime (yt-dlp's EJS). We
    look for any of the configured runtimes on PATH. Reported as a soft check —
    some videos work without it, but most need one."""
    found = {}
    for name in config.JS_RUNTIMES:
        exe = shutil.which(name)
        if exe:
            found[name] = exe
    ok = bool(found)
    return {
        "ok": ok,
        "found": found,
        "candidates": config.JS_RUNTIMES,
        "hint": None if ok else (
            "No JavaScript runtime found. YouTube now needs one for most videos. "
            "Install Node (`winget install OpenJS.NodeJS`) or Deno "
            "(`winget install DenoLand.Deno`), then reopen your terminal."
        ),
    }


def run_diagnostics() -> dict:
    python = _python_report()
    ytdlp = _ytdlp_report()
    ffmpeg = _ffmpeg_report()
    js = _js_runtime_report()
    return {
        "ok": bool(python["ok"] and ytdlp["ok"] and ffmpeg["ok"] and js["ok"]),
        "python": python,
        "ytdlp": ytdlp,
        "ffmpeg": ffmpeg,
        "jsRuntime": js,
    }


def format_banner(report: dict) -> str:
    """A short, human-readable startup summary."""
    def mark(section: dict) -> str:
        return "OK " if section.get("ok") else "!! "

    lines = ["Fetcher backend diagnostics:"]
    lines.append(f"  [{mark(report['python'])}] Python {report['python']['version']} "
                 f"(need {report['python']['required']})")
    yt = report["ytdlp"]
    lines.append(f"  [{mark(yt)}] yt-dlp {yt.get('version') or 'MISSING'}")
    ff = report["ffmpeg"]
    lines.append(f"  [{mark(ff)}] FFmpeg {ff.get('path') or 'MISSING'}")
    js = report["jsRuntime"]
    js_summary = ", ".join(js.get("found", {}).keys()) or "MISSING"
    lines.append(f"  [{mark(js)}] JS runtime {js_summary}")
    for section in (report["python"], report["ytdlp"], report["ffmpeg"], report["jsRuntime"]):
        if not section.get("ok") and section.get("hint"):
            lines.append(f"       -> {section['hint']}")
    return "\n".join(lines)
