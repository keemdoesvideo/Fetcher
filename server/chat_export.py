"""Render Twitch replay chat into editor-ready overlay video files.

The browser preview is intentionally lightweight. Export is a background server
job so the result is deterministic and can target formats browsers cannot encode
reliably themselves: ProRes 4444 with alpha, VP9 WebM with alpha, or a green
screen H.264 MP4 fallback.

Frames are composed with Pillow and streamed directly into FFmpeg as raw RGBA;
no giant PNG sequence is written to disk. Animated Twitch/7TV/BTTV/FFZ emotes
are decoded once and sampled at their own frame timing during the render.
"""

from __future__ import annotations

from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from io import BytesIO
import logging
import math
from pathlib import Path
import re
import subprocess
import sys
import threading
from typing import Any
import urllib.error
import urllib.request

from . import errors
from .diagnostics import find_ffmpeg
from .jobs import Job, JobCancelled

log = logging.getLogger("fetcher.chat.export")

_MAX_ASSET_BYTES = 8 * 1024 * 1024
_MAX_UNIQUE_EMOTES = 220
_MAX_ANIMATION_FRAMES = 180
_MESSAGE_TTL = 12.0
_MAX_VISIBLE = 7
_ENTER_SECONDS = 0.24
_LEAVE_SECONDS = 0.18

_FORMATS = {
    "prores": ("mov", "video/quicktime"),
    "webm": ("webm", "video/webm"),
    "greenscreen": ("mp4", "video/mp4"),
}
_RESOLUTIONS = {
    "1080p": (1920, 1080),
    "720p": (1280, 720),
}
_BADGES = {
    "broadcaster": "LIVE",
    "moderator": "MOD",
    "vip": "VIP",
    "subscriber": "SUB",
    "founder": "OG",
    "staff": "STAFF",
}


@dataclass
class EmoteAsset:
    frames: list[Any]
    durations_ms: list[int]
    total_ms: int

    def frame_at(self, elapsed_ms: float):
        if len(self.frames) <= 1 or self.total_ms <= 0:
            return self.frames[0]
        pos = int(max(0.0, elapsed_ms)) % self.total_ms
        cursor = 0
        for frame, duration in zip(self.frames, self.durations_ms):
            cursor += duration
            if pos < cursor:
                return frame
        return self.frames[-1]


@dataclass
class EmotePlacement:
    asset: EmoteAsset
    x: int
    y: int


@dataclass
class PreparedMessage:
    at: float
    base: Any
    emotes: list[EmotePlacement]


@dataclass
class RenderStyle:
    width: int
    height: int
    fps: int
    font_size: int
    name_size: int
    badge_size: int
    emote_height: int
    stack_width: int
    stack_left: int
    stack_bottom: int
    gap: int
    pad_x: int
    pad_y: int
    radius: int
    shadow_pad: int


class _Pillow:
    def __init__(self):
        try:
            from PIL import Image, ImageDraw, ImageFont, ImageSequence
        except ImportError as exc:
            raise errors.FetcherError(
                errors.BACKEND_ERROR,
                message="chat export isn't set up on this server yet",
                detail="Pillow is missing; install requirements.txt",
            ) from exc
        self.Image = Image
        self.ImageDraw = ImageDraw
        self.ImageFont = ImageFont
        self.ImageSequence = ImageSequence


def validate_request(fmt: str, resolution: str, fps: int, duration: float) -> None:
    if fmt not in _FORMATS or resolution not in _RESOLUTIONS or fps not in {30, 60}:
        raise errors.FetcherError(errors.INVALID_SECTION, message="check those export settings and try again")
    if duration <= 0:
        raise errors.FetcherError(errors.INVALID_SECTION)

    # ProRes 4444 is intentionally bounded more tightly: it is a superb editing
    # intermediate but enormous (often multiple GB per minute at 1080p).
    limit = 60.0 if fmt == "prores" else 120.0
    if fps == 60:
        limit *= 0.5
    if duration > limit:
        label = "30 seconds" if fmt == "prores" and fps == 60 else (
            "1 minute" if fmt == "prores" else ("1 minute" if fps == 60 else "2 minutes")
        )
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message=f"that export is too long for now — {label} max with these settings",
        )


def _style(resolution: str, fps: int) -> RenderStyle:
    width, height = _RESOLUTIONS[resolution]
    scale = width / 1920.0
    return RenderStyle(
        width=width,
        height=height,
        fps=fps,
        font_size=max(17, round(28 * scale)),
        name_size=max(17, round(28 * scale)),
        badge_size=max(10, round(15 * scale)),
        emote_height=max(27, round(46 * scale)),
        stack_width=round(width * 0.62),
        stack_left=round(width * 0.045),
        stack_bottom=round(height * 0.05),
        gap=max(5, round(12 * scale)),
        pad_x=max(10, round(18 * scale)),
        pad_y=max(8, round(13 * scale)),
        radius=max(9, round(18 * scale)),
        shadow_pad=max(4, round(10 * scale)),
    )


def _font_candidates(bold: bool) -> list[str]:
    if sys.platform == "darwin":
        if bold:
            return [
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "/System/Library/Fonts/Supplemental/Verdana Bold.ttf",
            ]
        return [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Supplemental/Verdana.ttf",
        ]
    if bold:
        return [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        ]
    return [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]


def _font(pil: _Pillow, size: int, bold: bool = False):
    for path in _font_candidates(bold):
        try:
            if Path(path).is_file():
                return pil.ImageFont.truetype(path, size=size)
        except Exception:
            continue
    try:
        return pil.ImageFont.load_default(size=size)
    except TypeError:
        return pil.ImageFont.load_default()


def _normalise_url(url: str) -> str:
    url = str(url or "").strip()
    if url.startswith("//"):
        return "https:" + url
    return url


def _download_asset(url: str) -> bytes:
    url = _normalise_url(url)
    if not url.startswith("https://"):
        raise ValueError("emote URL is not HTTPS")
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 Fetcher/0.2",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        data = response.read(_MAX_ASSET_BYTES + 1)
    if len(data) > _MAX_ASSET_BYTES:
        raise ValueError("emote asset too large")
    return data


def _load_emote(pil: _Pillow, url: str, target_height: int) -> EmoteAsset | None:
    try:
        raw = _download_asset(url)
        image = pil.Image.open(BytesIO(raw))
        frames = []
        durations = []
        count = min(getattr(image, "n_frames", 1) or 1, _MAX_ANIMATION_FRAMES)
        for index in range(count):
            try:
                image.seek(index)
            except EOFError:
                break
            frame = image.convert("RGBA").copy()
            if not frame.width or not frame.height:
                continue
            new_w = max(1, round(frame.width * (target_height / frame.height)))
            frame = frame.resize((new_w, target_height), pil.Image.Resampling.LANCZOS)
            frames.append(frame)
            duration = int(image.info.get("duration") or 100)
            durations.append(max(20, min(2000, duration)))
        if not frames:
            return None
        return EmoteAsset(frames=frames, durations_ms=durations, total_ms=sum(durations))
    except Exception as exc:
        log.debug("could not load emote %s: %s", url, exc)
        return None


def _collect_emote_urls(payload: dict) -> list[str]:
    urls: list[str] = []
    seen = set()
    for message in payload.get("messages") or []:
        if not isinstance(message, dict):
            continue
        for fragment in message.get("fragments") or []:
            if not isinstance(fragment, dict):
                continue
            url = _normalise_url(fragment.get("emoteUrl") or "")
            if url and url not in seen:
                seen.add(url)
                urls.append(url)
                if len(urls) >= _MAX_UNIQUE_EMOTES:
                    return urls
    return urls


def _load_assets(pil: _Pillow, payload: dict, style: RenderStyle, job: Job) -> dict[str, EmoteAsset]:
    urls = _collect_emote_urls(payload)
    if not urls:
        return {}
    assets: dict[str, EmoteAsset] = {}
    workers = min(8, max(1, len(urls)))
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="fetcher-emote") as pool:
        futures = {pool.submit(_load_emote, pil, url, style.emote_height): url for url in urls}
        finished = 0
        for future in as_completed(futures):
            if job.cancel_event.is_set():
                raise JobCancelled()
            url = futures[future]
            try:
                asset = future.result()
            except Exception:
                asset = None
            if asset:
                assets[url] = asset
            finished += 1
            job.progress = 5.0 + 8.0 * (finished / len(urls))
    return assets


def _text_width(draw, text: str, font) -> int:
    if not text:
        return 0
    try:
        return max(0, round(draw.textlength(text, font=font)))
    except Exception:
        box = draw.textbbox((0, 0), text, font=font)
        return max(0, box[2] - box[0])


def _split_text(text: str) -> list[str]:
    return re.findall(r"\S+|\s+", text or "")


def _safe_color(value: str, fallback=(255, 255, 255, 255)):
    if re.fullmatch(r"#[0-9a-fA-F]{6}", str(value or "")):
        raw = str(value)[1:]
        return tuple(int(raw[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    return fallback


def _prepare_message(
    pil: _Pillow,
    message: dict,
    assets: dict[str, EmoteAsset],
    style: RenderStyle,
    body_font,
    name_font,
    badge_font,
) -> PreparedMessage:
    dummy = pil.Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    measure = pil.ImageDraw.Draw(dummy)
    inner_max = max(180, style.stack_width - 2 * style.pad_x - 2 * style.shadow_pad)
    line_h = max(style.emote_height, round(style.font_size * 1.35))
    name_h = round(style.name_size * 1.25)
    badge_h = max(round(style.badge_size * 1.55), round(name_h * 0.72))
    gap_after_name = max(3, round(style.font_size * 0.18))

    # Name row widths.
    badges: list[tuple[str, int]] = []
    badge_gap = max(3, round(style.font_size * 0.18))
    name_x = 0
    for badge in message.get("badges") or []:
        if not isinstance(badge, dict):
            continue
        label = _BADGES.get(str(badge.get("setId") or ""))
        if not label:
            continue
        bw = _text_width(measure, label, badge_font) + max(8, round(style.badge_size * 0.7))
        badges.append((label, bw))
        name_x += bw + badge_gap
    user_name = str((message.get("user") or {}).get("displayName") or "viewer")
    user_w = _text_width(measure, user_name, name_font)
    name_row_w = name_x + user_w

    # Body token layout. Every tuple is (kind, payload, x, line-index, width).
    tokens: list[tuple[str, Any, int, int, int]] = []
    x = 0
    line = 0
    line_widths = [0]
    emote_margin = max(2, round(style.font_size * 0.08))

    for fragment in message.get("fragments") or []:
        if not isinstance(fragment, dict):
            continue
        emote_url = _normalise_url(fragment.get("emoteUrl") or "")
        asset = assets.get(emote_url) if emote_url else None
        if asset:
            token_w = asset.frames[0].width + emote_margin * 2
            if x and x + token_w > inner_max:
                line += 1
                x = 0
                line_widths.append(0)
            tokens.append(("emote", asset, x + emote_margin, line, token_w))
            x += token_w
            line_widths[line] = max(line_widths[line], x)
            continue

        text = str(fragment.get("text") or "")
        for piece in _split_text(text):
            if not piece:
                continue
            is_space = piece.isspace()
            token_w = _text_width(measure, piece, body_font)
            if is_space and x == 0:
                continue
            if x and not is_space and x + token_w > inner_max:
                line += 1
                x = 0
                line_widths.append(0)
            if is_space and x + token_w > inner_max:
                line += 1
                x = 0
                line_widths.append(0)
                continue
            tokens.append(("text", piece, x, line, token_w))
            x += token_w
            line_widths[line] = max(line_widths[line], x)

    if not tokens:
        fallback = str(message.get("text") or "")
        if fallback:
            tokens.append(("text", fallback, 0, 0, min(inner_max, _text_width(measure, fallback, body_font))))
            line_widths = [tokens[0][4]]

    body_w = max(line_widths or [0])
    lines = max(1, len(line_widths))
    content_w = max(name_row_w, body_w, round(style.font_size * 3.0))
    box_w = min(style.stack_width, content_w + 2 * style.pad_x)
    box_h = style.pad_y * 2 + name_h + gap_after_name + lines * line_h
    canvas_w = box_w + style.shadow_pad * 2
    canvas_h = box_h + style.shadow_pad * 2
    image = pil.Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = pil.ImageDraw.Draw(image)

    rect = (
        style.shadow_pad,
        style.shadow_pad,
        style.shadow_pad + box_w,
        style.shadow_pad + box_h,
    )
    shadow_offset = max(2, round(style.shadow_pad * 0.45))
    shadow_rect = (
        rect[0] + shadow_offset,
        rect[1] + shadow_offset,
        rect[2] + shadow_offset,
        rect[3] + shadow_offset,
    )
    draw.rounded_rectangle(shadow_rect, radius=style.radius, fill=(0, 0, 0, 42))
    draw.rounded_rectangle(
        rect,
        radius=style.radius,
        fill=(18, 18, 22, 220),
        outline=(255, 255, 255, 22),
        width=max(1, round(style.width / 1920)),
    )

    origin_x = style.shadow_pad + style.pad_x
    origin_y = style.shadow_pad + style.pad_y
    cursor_x = origin_x
    badge_bg = (145, 70, 255, 64)
    badge_fg = (217, 195, 255, 255)
    for label, bw in badges:
        top = origin_y + max(0, (name_h - badge_h) // 2)
        draw.rounded_rectangle(
            (cursor_x, top, cursor_x + bw, top + badge_h),
            radius=max(3, round(style.badge_size * 0.3)),
            fill=badge_bg,
        )
        tw = _text_width(draw, label, badge_font)
        draw.text(
            (cursor_x + (bw - tw) / 2, top + max(0, (badge_h - style.badge_size) / 2 - 1)),
            label,
            font=badge_font,
            fill=badge_fg,
        )
        cursor_x += bw + badge_gap

    user_color = _safe_color((message.get("user") or {}).get("color") or "")
    draw.text((cursor_x, origin_y), user_name, font=name_font, fill=user_color)

    body_y = origin_y + name_h + gap_after_name
    placements: list[EmotePlacement] = []
    for kind, payload, tx, line_index, _token_w in tokens:
        y = body_y + line_index * line_h
        if kind == "text":
            draw.text((origin_x + tx, y), str(payload), font=body_font, fill=(255, 255, 255, 255))
        else:
            asset = payload
            ey = y + max(0, (line_h - asset.frames[0].height) // 2)
            placements.append(EmotePlacement(asset=asset, x=origin_x + tx, y=ey))

    try:
        at = float(message.get("at") or 0.0)
    except (TypeError, ValueError):
        at = 0.0
    return PreparedMessage(at=max(0.0, at), base=image, emotes=placements)


def _prepare_messages(pil: _Pillow, payload: dict, assets: dict[str, EmoteAsset], style: RenderStyle, job: Job):
    body_font = _font(pil, style.font_size, bold=False)
    name_font = _font(pil, style.name_size, bold=True)
    badge_font = _font(pil, style.badge_size, bold=True)
    messages = payload.get("messages") or []
    prepared = []
    total = max(1, len(messages))
    for idx, message in enumerate(messages):
        if job.cancel_event.is_set():
            raise JobCancelled()
        if isinstance(message, dict):
            prepared.append(_prepare_message(
                pil, message, assets, style, body_font, name_font, badge_font
            ))
        job.progress = 13.0 + 5.0 * ((idx + 1) / total)
    prepared.sort(key=lambda item: item.at)
    return prepared


def _ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1.0 - (1.0 - t) ** 3


def _with_opacity(pil: _Pillow, image, opacity: float):
    if opacity >= 0.999:
        return image
    result = image.copy()
    alpha = result.getchannel("A").point(lambda value: round(value * max(0.0, opacity)))
    result.putalpha(alpha)
    return result


def _message_image(pil: _Pillow, item: PreparedMessage, t: float):
    image = item.base.copy()
    elapsed_ms = max(0.0, t - item.at) * 1000.0
    for placement in item.emotes:
        frame = placement.asset.frame_at(elapsed_ms)
        image.alpha_composite(frame, (placement.x, placement.y))

    age = max(0.0, t - item.at)
    enter = _ease_out(age / _ENTER_SECONDS) if age < _ENTER_SECONDS else 1.0
    opacity = enter
    if age > _MESSAGE_TTL - _LEAVE_SECONDS:
        opacity *= max(0.0, (_MESSAGE_TTL - age) / _LEAVE_SECONDS)

    scale = 0.975 + 0.025 * enter
    if scale < 0.999:
        nw = max(1, round(image.width * scale))
        nh = max(1, round(image.height * scale))
        image = image.resize((nw, nh), pil.Image.Resampling.LANCZOS)
    return _with_opacity(pil, image, opacity), round((1.0 - enter) * 8)


def _frame(pil: _Pillow, prepared: list[PreparedMessage], t: float, style: RenderStyle, green: bool):
    bg = (0, 255, 0, 255) if green else (0, 0, 0, 0)
    canvas = pil.Image.new("RGBA", (style.width, style.height), bg)

    active = [item for item in prepared if item.at <= t < item.at + _MESSAGE_TTL]
    if len(active) > _MAX_VISIBLE:
        active = active[-_MAX_VISIBLE:]
    rendered = [_message_image(pil, item, t) for item in active]
    total_h = sum(image.height for image, _ in rendered)
    if rendered:
        total_h += style.gap * (len(rendered) - 1)
    y = style.height - style.stack_bottom - total_h
    for image, enter_offset in rendered:
        draw_y = y + enter_offset
        canvas.alpha_composite(image, (style.stack_left, draw_y))
        y += image.height + style.gap
    return canvas


def _encoder_listing(ffmpeg: str) -> str:
    try:
        result = subprocess.run(
            [ffmpeg, "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        return (result.stdout or "") + "\n" + (result.stderr or "")
    except Exception:
        return ""


def _ffmpeg_command(ffmpeg: str, output: Path, fmt: str, style: RenderStyle) -> list[str]:
    base = [
        ffmpeg,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel", "error",
        "-f", "rawvideo",
        "-pix_fmt", "rgba",
        "-s", f"{style.width}x{style.height}",
        "-r", str(style.fps),
        "-i", "pipe:0",
        "-an",
    ]
    listing = _encoder_listing(ffmpeg)
    if fmt == "prores":
        if "prores_ks" not in listing:
            raise errors.FetcherError(
                errors.BACKEND_ERROR,
                message="this server's FFmpeg build can't make ProRes 4444 yet",
            )
        return base + [
            "-c:v", "prores_ks",
            "-profile:v", "4",
            "-pix_fmt", "yuva444p10le",
            "-vendor", "apl0",
            "-movflags", "+faststart",
            str(output),
        ]
    if fmt == "webm":
        if "libvpx-vp9" not in listing:
            raise errors.FetcherError(
                errors.BACKEND_ERROR,
                message="this server's FFmpeg build can't make transparent WebM yet",
            )
        return base + [
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-b:v", "0",
            "-crf", "28",
            "-deadline", "good",
            "-cpu-used", "4",
            "-auto-alt-ref", "0",
            str(output),
        ]

    encoder = "h264_videotoolbox" if sys.platform == "darwin" and "h264_videotoolbox" in listing else "libx264"
    if encoder not in listing:
        raise errors.FetcherError(
            errors.BACKEND_ERROR,
            message="this server's FFmpeg build can't make the green-screen MP4 yet",
        )
    video_args = (
        ["-c:v", encoder, "-q:v", "65", "-pix_fmt", "yuv420p", "-tag:v", "avc1"]
        if encoder == "h264_videotoolbox"
        else ["-c:v", encoder, "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-tag:v", "avc1"]
    )
    return base + video_args + ["-movflags", "+faststart", str(output)]


def _drain(pipe, tail: deque[str]):
    if pipe is None:
        return
    try:
        for line in iter(pipe.readline, ""):
            tail.append(line)
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def _stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=4)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=4)


def render(payload: dict, job: Job, fmt: str, resolution: str, fps: int) -> tuple[Path, str, str]:
    """Render a normalized/enriched chat payload into the selected format."""
    duration = float(payload.get("duration") or 0.0)
    validate_request(fmt, resolution, fps, duration)
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise errors.FetcherError(errors.FFMPEG_MISSING)

    pil = _Pillow()
    style = _style(resolution, fps)
    ext, media_type = _FORMATS[fmt]
    output = job.dir / f"chat-overlay.{ext}"
    output.unlink(missing_ok=True)

    job.status = "processing"
    job.stage = "loading emotes"
    job.progress = 4.0
    assets = _load_assets(pil, payload, style, job)

    job.stage = "laying out chat"
    prepared = _prepare_messages(pil, payload, assets, style, job)

    job.stage = "rendering overlay"
    command = _ffmpeg_command(ffmpeg, output, fmt, style)
    stderr_tail: deque[str] = deque(maxlen=120)
    proc = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        bufsize=0,
        text=False,
    )
    # stderr is binary because stdin must be binary; decode it in a tiny adapter.
    def drain_binary():
        if proc.stderr is None:
            return
        try:
            while True:
                line = proc.stderr.readline()
                if not line:
                    break
                stderr_tail.append(line.decode("utf-8", "replace"))
        except Exception:
            pass
    drainer = threading.Thread(target=drain_binary, name=f"chat-ffmpeg-{job.id[:8]}", daemon=True)
    drainer.start()

    total_frames = max(1, math.ceil(duration * style.fps))
    green = fmt == "greenscreen"
    try:
        if proc.stdin is None:
            raise RuntimeError("FFmpeg stdin unavailable")
        for index in range(total_frames):
            if job.cancel_event.is_set():
                _stop(proc)
                raise JobCancelled()
            t = min(duration, index / style.fps)
            frame = _frame(pil, prepared, t, style, green)
            try:
                proc.stdin.write(frame.tobytes("raw", "RGBA"))
            except BrokenPipeError as exc:
                _stop(proc)
                raise errors.FetcherError(
                    errors.BACKEND_ERROR,
                    message="chat export stopped unexpectedly — try again",
                    detail="".join(stderr_tail)[-2000:],
                ) from exc
            job.progress = 18.0 + 79.0 * ((index + 1) / total_frames)
        proc.stdin.close()
        proc.wait()
        drainer.join(timeout=2)
        if proc.returncode != 0 or not output.is_file() or output.stat().st_size <= 0:
            raise errors.FetcherError(
                errors.BACKEND_ERROR,
                message="chat export couldn't finish — try another format",
                detail="".join(stderr_tail)[-2400:],
            )
    except BaseException:
        _stop(proc)
        drainer.join(timeout=2)
        output.unlink(missing_ok=True)
        raise

    job.progress = 99.0
    job.stage = "finishing"
    vod_id = re.sub(r"[^0-9]", "", str(payload.get("vodId") or "")) or "vod"
    start = max(0, round(float(payload.get("start") or 0)))
    end = max(start, round(float(payload.get("end") or 0)))
    label = "alpha-prores" if fmt == "prores" else ("alpha-webm" if fmt == "webm" else "green-screen")
    filename = f"twitch-chat-{vod_id}-{start}-{end}-{label}.{ext}"
    return output, filename, media_type
