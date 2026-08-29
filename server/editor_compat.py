"""Post-process video downloads into an editor-safe MP4 when necessary.

Browsers and media players happily decode codecs such as VP9, AV1 and HEVC in
an MP4 container, but NLE support is much less consistent. DaVinci Resolve in
particular may import the audio while showing no video stream for those files.

Fetcher keeps already-compatible H.264/AAC MP4s untouched. Only incompatible
video/audio streams are converted, preserving the requested resolution. On
macOS we prefer VideoToolbox for H.264 hardware encoding and fall back to
libx264; other platforms use libx264.
"""

from __future__ import annotations

from collections import deque
from functools import lru_cache
import json
import logging
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time

from . import errors
from . import jobs as jobstate
from .diagnostics import find_ffmpeg
from .jobs import Job, JobCancelled

log = logging.getLogger("fetcher.editor_compat")

_SAFE_VIDEO_CODEC = "h264"
_SAFE_PIXEL_FORMATS = {"yuv420p", "yuvj420p"}
_SAFE_AUDIO_CODEC = "aac"


def _ffprobe_path(ffmpeg: str) -> str | None:
    ffmpeg_path = Path(ffmpeg)
    sibling = ffmpeg_path.with_name("ffprobe.exe" if sys.platform.startswith("win") else "ffprobe")
    if sibling.is_file():
        return str(sibling)
    return shutil.which("ffprobe")


def _probe(path: Path, ffmpeg: str) -> tuple[str | None, str | None, str | None]:
    """Return (video codec, pixel format, audio codec), or unknowns if probing fails."""
    ffprobe = _ffprobe_path(ffmpeg)
    if not ffprobe:
        log.warning("ffprobe not found; compatibility pass will conservatively transcode")
        return None, None, None

    try:
        completed = subprocess.run(
            [
                ffprobe,
                "-v", "error",
                "-show_entries", "stream=codec_type,codec_name,pix_fmt",
                "-of", "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if completed.returncode != 0:
            log.warning("ffprobe failed for %s: %s", path.name, completed.stderr.strip())
            return None, None, None
        streams = json.loads(completed.stdout or "{}").get("streams", [])
    except Exception as exc:
        log.warning("could not inspect %s: %s", path.name, exc)
        return None, None, None

    video_codec = pixel_format = audio_codec = None
    for stream in streams:
        kind = stream.get("codec_type")
        if kind == "video" and video_codec is None:
            video_codec = (stream.get("codec_name") or "").lower() or None
            pixel_format = (stream.get("pix_fmt") or "").lower() or None
        elif kind == "audio" and audio_codec is None:
            audio_codec = (stream.get("codec_name") or "").lower() or None
    return video_codec, pixel_format, audio_codec


@lru_cache(maxsize=4)
def _encoder_listing(ffmpeg: str) -> str:
    try:
        completed = subprocess.run(
            [ffmpeg, "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        return (completed.stdout or "") + "\n" + (completed.stderr or "")
    except Exception:
        return ""


def _video_encoders(ffmpeg: str) -> list[str]:
    listing = _encoder_listing(ffmpeg)
    encoders: list[str] = []
    if sys.platform == "darwin" and "h264_videotoolbox" in listing:
        encoders.append("h264_videotoolbox")
    if "libx264" in listing:
        encoders.append("libx264")
    return encoders


def _stop_process(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def _drain_stderr(pipe, lines: deque[str]) -> None:
    """Continuously drain FFmpeg stderr so its OS pipe can never fill and stall.

    A damaged or awkward source can make FFmpeg emit enough repeated decoder
    errors to fill a PIPE. The old implementation waited until FFmpeg exited
    before reading stderr; once the pipe filled, FFmpeg could block forever
    while Fetcher sat on "almost there…".
    """
    if pipe is None:
        return
    try:
        for line in iter(pipe.readline, ""):
            lines.append(line)
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def _run_ffmpeg(command: list[str], job: Job) -> tuple[int, str]:
    # Keep only the tail of stderr for diagnostics. Most importantly, drain it
    # concurrently while FFmpeg runs so verbose decoder failures cannot deadlock
    # the child process.
    stderr_lines: deque[str] = deque(maxlen=240)
    proc = subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    drainer = threading.Thread(
        target=_drain_stderr,
        args=(proc.stderr, stderr_lines),
        name=f"fetcher-ffmpeg-stderr-{job.id[:8]}",
        daemon=True,
    )
    drainer.start()

    try:
        while proc.poll() is None:
            if job.cancel_event.is_set():
                _stop_process(proc)
                raise JobCancelled()
            time.sleep(0.2)

        drainer.join(timeout=2)
        return int(proc.returncode or 0), "".join(stderr_lines)
    except BaseException:
        _stop_process(proc)
        drainer.join(timeout=2)
        raise


def _video_args(encoder: str) -> list[str]:
    if encoder == "h264_videotoolbox":
        # q:v keeps hardware encoding fast while retaining high visual quality.
        return [
            "-c:v", "h264_videotoolbox",
            "-q:v", "65",
            "-pix_fmt", "yuv420p",
            "-tag:v", "avc1",
        ]
    return [
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-tag:v", "avc1",
    ]


def ensure_editor_compatible(path: Path, job: Job) -> Path:
    """Guarantee an H.264 8-bit/AAC MP4 suitable for mainstream NLEs.

    H.264 + yuv420p video and AAC audio are stream-copied with zero quality
    loss. VP9/AV1/HEVC/10-bit H.264 is converted to 8-bit H.264 at the same
    dimensions. Non-AAC audio is converted to AAC. The replacement is atomic so
    a failed conversion never destroys the original download.
    """
    path = Path(path)
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise errors.FetcherError(errors.FFMPEG_MISSING)

    video_codec, pixel_format, audio_codec = _probe(path, ffmpeg)
    video_safe = video_codec == _SAFE_VIDEO_CODEC and pixel_format in _SAFE_PIXEL_FORMATS
    audio_safe = audio_codec in (None, _SAFE_AUDIO_CODEC)

    if video_safe and audio_safe:
        log.info(
            "editor compatibility: %s already safe (%s/%s, %s)",
            path.name, video_codec, pixel_format, audio_codec or "no-audio",
        )
        return path

    if video_codec is None:
        log.info("editor compatibility: codec unknown; converting %s conservatively", path.name)
    else:
        log.info(
            "editor compatibility: converting %s video=%s/%s audio=%s",
            path.name, video_codec, pixel_format, audio_codec or "no-audio",
        )

    job.status = jobstate.PROCESSING
    job.stage = "converting"

    temp = path.with_name(path.stem + ".editor-safe.mp4")
    temp.unlink(missing_ok=True)

    base = [
        ffmpeg,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel", "error",
        # Regenerate presentation timestamps when a web source has missing or
        # malformed ones. This is harmless for clean sources and helps NLEs avoid
        # intermittent "Media Offline" flashes on otherwise decodable frames.
        "-fflags", "+genpts",
        "-i", str(path),
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-map_metadata", "0",
        "-map_chapters", "0",
    ]

    audio_args = ["-c:a", "copy"] if audio_safe else ["-c:a", "aac", "-b:a", "192k"]
    tail = [
        "-sn", "-dn",
        "-avoid_negative_ts", "make_zero",
        "-max_muxing_queue_size", "4096",
        "-movflags", "+faststart",
        str(temp),
    ]

    if video_safe:
        attempts: list[tuple[str, list[str]]] = [("stream-copy", ["-c:v", "copy"])]
    else:
        encoders = _video_encoders(ffmpeg)
        if not encoders:
            raise errors.FetcherError(
                errors.BACKEND_ERROR,
                detail="FFmpeg has no H.264 encoder (need h264_videotoolbox or libx264)",
            )
        attempts = [(encoder, _video_args(encoder)) for encoder in encoders]

    last_error = ""
    try:
        for encoder_name, video_args in attempts:
            temp.unlink(missing_ok=True)
            code, stderr = _run_ffmpeg(base + video_args + audio_args + tail, job)
            if code == 0 and temp.is_file() and temp.stat().st_size > 0:
                temp.replace(path)
                log.info("editor compatibility: %s ready via %s", path.name, encoder_name)
                return path
            last_error = stderr.strip()
            log.warning(
                "editor compatibility encoder %s failed for %s: %s",
                encoder_name, path.name, last_error,
            )
    finally:
        temp.unlink(missing_ok=True)

    raise errors.FetcherError(
        errors.BACKEND_ERROR,
        detail=f"Could not create editor-compatible MP4: {last_error}",
    )
