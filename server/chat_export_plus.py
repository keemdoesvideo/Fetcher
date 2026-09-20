"""Style parity + optional message sounds for Fetcher's chat overlay renderer.

This builds on ``chat_export`` rather than replacing its media/emote plumbing.
The browser preview and rendered file share a simple 1080p reference gap so the
spacing seen in Fetcher survives into Resolve/Premiere. Optional message sounds
are mixed after the video render so alpha video remains untouched.
"""

from __future__ import annotations

from array import array
import base64
import binascii
from collections import deque
from dataclasses import dataclass
from io import BytesIO
import math
from pathlib import Path
import re
import subprocess
import threading
import wave

from . import chat_export as base, errors
from .diagnostics import find_ffmpeg
from .jobs import Job, JobCancelled

_SAMPLE_RATE = 48_000
_MAX_CUSTOM_BYTES = 2 * 1024 * 1024
_MAX_SOUND_SECONDS = 2.0
_SOUND_MIMES = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
}


@dataclass
class _Prepared:
    at: float
    base: object
    emotes: list


def _prepare_message(pil, message: dict, assets: dict, style, body_font, name_font, badge_font, bubble_width: str):
    """Equivalent to the base layout, with an optional uniform bubble width."""
    dummy = pil.Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    measure = pil.ImageDraw.Draw(dummy)
    inner_max = max(180, style.stack_width - 2 * style.pad_x - 2 * style.shadow_pad)
    line_h = max(style.emote_height, round(style.font_size * 1.35))
    name_h = round(style.name_size * 1.25)
    badge_h = max(round(style.badge_size * 1.55), round(name_h * 0.72))
    gap_after_name = max(3, round(style.font_size * 0.18))

    badges = []
    badge_gap = max(3, round(style.font_size * 0.18))
    name_x = 0
    for badge in message.get("badges") or []:
        if not isinstance(badge, dict):
            continue
        label = base._BADGES.get(str(badge.get("setId") or ""))
        if not label:
            continue
        bw = base._text_width(measure, label, badge_font) + max(8, round(style.badge_size * 0.7))
        badges.append((label, bw))
        name_x += bw + badge_gap
    user_name = str((message.get("user") or {}).get("displayName") or "viewer")
    user_w = base._text_width(measure, user_name, name_font)
    name_row_w = name_x + user_w

    tokens = []
    x = 0
    line = 0
    line_widths = [0]
    emote_margin = max(2, round(style.font_size * 0.08))
    for fragment in message.get("fragments") or []:
        if not isinstance(fragment, dict):
            continue
        emote_url = base._normalise_url(fragment.get("emoteUrl") or "")
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
        for piece in base._split_text(text):
            if not piece:
                continue
            is_space = piece.isspace()
            token_w = base._text_width(measure, piece, body_font)
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
            tw = min(inner_max, base._text_width(measure, fallback, body_font))
            tokens.append(("text", fallback, 0, 0, tw))
            line_widths = [tw]

    body_w = max(line_widths or [0])
    lines = max(1, len(line_widths))
    content_w = max(name_row_w, body_w, round(style.font_size * 3.0))
    if bubble_width == "uniform":
        box_w = style.stack_width
    else:
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
        tw = base._text_width(draw, label, badge_font)
        draw.text(
            (cursor_x + (bw - tw) / 2, top + max(0, (badge_h - style.badge_size) / 2 - 1)),
            label,
            font=badge_font,
            fill=badge_fg,
        )
        cursor_x += bw + badge_gap

    user_color = base._safe_color((message.get("user") or {}).get("color") or "")
    draw.text((cursor_x, origin_y), user_name, font=name_font, fill=user_color)

    body_y = origin_y + name_h + gap_after_name
    placements = []
    for kind, payload, tx, line_index, _token_w in tokens:
        y = body_y + line_index * line_h
        if kind == "text":
            draw.text((origin_x + tx, y), str(payload), font=body_font, fill=(255, 255, 255, 255))
        else:
            asset = payload
            ey = y + max(0, (line_h - asset.frames[0].height) // 2)
            placements.append(base.EmotePlacement(asset=asset, x=origin_x + tx, y=ey))

    try:
        at = float(message.get("at") or 0.0)
    except (TypeError, ValueError):
        at = 0.0
    return _Prepared(at=max(0.0, at), base=image, emotes=placements)


def _prepare_messages(pil, payload: dict, assets: dict, style, job: Job, bubble_width: str):
    body_font = base._font(pil, style.font_size, bold=False)
    name_font = base._font(pil, style.name_size, bold=True)
    badge_font = base._font(pil, style.badge_size, bold=True)
    messages = payload.get("messages") or []
    prepared = []
    total = max(1, len(messages))
    for idx, message in enumerate(messages):
        if job.cancel_event.is_set():
            raise JobCancelled()
        if isinstance(message, dict):
            prepared.append(_prepare_message(
                pil, message, assets, style, body_font, name_font, badge_font, bubble_width
            ))
        job.progress = 13.0 + 5.0 * ((idx + 1) / total)
    prepared.sort(key=lambda item: item.at)
    return prepared


def _message_image(pil, item: _Prepared, t: float, message_ttl: float):
    image = item.base.copy()
    elapsed_ms = max(0.0, t - item.at) * 1000.0
    for placement in item.emotes:
        frame = placement.asset.frame_at(elapsed_ms)
        image.alpha_composite(frame, (placement.x, placement.y))

    age = max(0.0, t - item.at)
    enter = base._ease_out(age / base._ENTER_SECONDS) if age < base._ENTER_SECONDS else 1.0
    opacity = enter
    if age > message_ttl - base._LEAVE_SECONDS:
        opacity *= max(0.0, (message_ttl - age) / base._LEAVE_SECONDS)
    scale = 0.975 + 0.025 * enter
    if scale < 0.999:
        nw = max(1, round(image.width * scale))
        nh = max(1, round(image.height * scale))
        image = image.resize((nw, nh), pil.Image.Resampling.LANCZOS)
    return base._with_opacity(pil, image, opacity), round((1.0 - enter) * 8)


def _frame(pil, prepared, t: float, style, green: bool, message_ttl: float, max_visible: int, visible_gap: int):
    bg = (0, 255, 0, 255) if green else (0, 0, 0, 0)
    canvas = pil.Image.new("RGBA", (style.width, style.height), bg)
    active = [item for item in prepared if item.at <= t < item.at + message_ttl]
    if len(active) > max_visible:
        active = active[-max_visible:]
    rendered = [_message_image(pil, item, t, message_ttl) for item in active]

    # Each prepared bubble has transparent shadow padding above and below it.
    # Subtract that padding from the stack step so ``visible_gap`` describes the
    # actual space between the visible rounded rectangles. Default 20px @1080p
    # scales to ~8 CSS px in Fetcher's desktop preview — exactly the old preview.
    effective_gap = visible_gap - style.shadow_pad * 2
    total_h = sum(image.height for image, _ in rendered)
    if rendered:
        total_h += effective_gap * (len(rendered) - 1)
    y = style.height - style.stack_bottom - total_h
    for image, enter_offset in rendered:
        canvas.alpha_composite(image, (style.stack_left, round(y + enter_offset)))
        y += image.height + effective_gap
    return canvas


def _preset_samples(name: str) -> array:
    if name == "tick":
        duration = 0.065
    elif name == "bubble":
        duration = 0.18
    else:
        duration = 0.12
    count = max(1, round(duration * _SAMPLE_RATE))
    out = array("h")
    phase = 0.0
    for i in range(count):
        t = i / _SAMPLE_RATE
        x = i / count
        if name == "tick":
            freq = 1450.0
            env = math.exp(-28.0 * x)
            value = math.sin(2 * math.pi * freq * t) * env
        elif name == "bubble":
            freq = 820.0 - 470.0 * x
            phase += 2 * math.pi * freq / _SAMPLE_RATE
            env = math.sin(min(1.0, x * 12.0) * math.pi / 2) * math.exp(-5.2 * x)
            value = math.sin(phase) * env
        else:
            freq = 650.0 + 160.0 * math.exp(-10.0 * x)
            phase += 2 * math.pi * freq / _SAMPLE_RATE
            env = math.sin(min(1.0, x * 18.0) * math.pi / 2) * math.exp(-7.5 * x)
            value = (math.sin(phase) * 0.76 + math.sin(phase * 0.52) * 0.24) * env
        out.append(max(-32768, min(32767, round(value * 12500))))
    return out


def _custom_samples(ffmpeg: str, job: Job, data_url: str) -> array:
    match = re.fullmatch(r"data:([^;,]+);base64,(.+)", str(data_url or ""), flags=re.DOTALL)
    if not match:
        raise errors.FetcherError(errors.INVALID_SECTION, message="that custom chat sound couldn't be read")
    mime = match.group(1).lower().strip()
    suffix = _SOUND_MIMES.get(mime)
    if not suffix:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="use a WAV, MP3, OGG, WebM or M4A file for the custom chat sound",
        )
    encoded = match.group(2)
    if len(encoded) > (_MAX_CUSTOM_BYTES * 4 // 3) + 16:
        raise errors.FetcherError(errors.INVALID_SECTION, message="keep the custom chat sound under 2 MB")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise errors.FetcherError(errors.INVALID_SECTION, message="that custom chat sound couldn't be read") from exc
    if not raw or len(raw) > _MAX_CUSTOM_BYTES:
        raise errors.FetcherError(errors.INVALID_SECTION, message="keep the custom chat sound under 2 MB")

    source = job.dir / f"message-sound{suffix}"
    source.write_bytes(raw)
    command = [
        ffmpeg, "-v", "error", "-nostdin", "-i", str(source),
        "-t", str(_MAX_SOUND_SECONDS), "-ac", "1", "-ar", str(_SAMPLE_RATE),
        "-f", "s16le", "pipe:1",
    ]
    try:
        result = subprocess.run(command, capture_output=True, timeout=20, check=False)
    except Exception as exc:
        raise errors.FetcherError(errors.BACKEND_ERROR, message="that custom chat sound couldn't be decoded") from exc
    if result.returncode != 0 or not result.stdout:
        raise errors.FetcherError(
            errors.INVALID_SECTION,
            message="that custom chat sound couldn't be decoded — try WAV, MP3, OGG or M4A",
            detail=result.stderr.decode("utf-8", "replace")[-1200:],
        )
    samples = array("h")
    samples.frombytes(result.stdout[: int(_MAX_SOUND_SECONDS * _SAMPLE_RATE * 2)])
    return samples


def _sound_events(payload: dict, min_gap_ms: int):
    gap = max(0.0, min_gap_ms / 1000.0)
    last = -10_000.0
    events = []
    for message in payload.get("messages") or []:
        if not isinstance(message, dict):
            continue
        try:
            at = max(0.0, float(message.get("at") or 0.0))
        except (TypeError, ValueError):
            continue
        if at - last + 1e-9 < gap:
            continue
        events.append(at)
        last = at
    return events


def _build_soundtrack(ffmpeg: str, job: Job, payload: dict, preset: str, volume: int, min_gap_ms: int, data_url: str | None) -> Path:
    duration = max(0.01, float(payload.get("duration") or 0.0))
    if preset == "custom":
        samples = _custom_samples(ffmpeg, job, data_url or "")
    else:
        samples = _preset_samples(preset)
    total = max(1, math.ceil(duration * _SAMPLE_RATE))
    mixed = array("h", [0]) * total
    gain = max(0.0, min(1.0, volume / 100.0))
    for at in _sound_events(payload, min_gap_ms):
        start = round(at * _SAMPLE_RATE)
        if start >= total:
            continue
        upto = min(len(samples), total - start)
        for i in range(upto):
            value = mixed[start + i] + round(samples[i] * gain)
            mixed[start + i] = max(-32768, min(32767, value))
    path = job.dir / "chat-message-sounds.wav"
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(_SAMPLE_RATE)
        wav.writeframes(mixed.tobytes())
    return path


def _mux_sound(ffmpeg: str, video: Path, output: Path, sound: Path, fmt: str) -> None:
    if fmt == "prores":
        audio_args = ["-c:a", "pcm_s16le"]
    elif fmt == "webm":
        audio_args = ["-c:a", "libopus", "-b:a", "128k"]
    else:
        audio_args = ["-c:a", "aac", "-b:a", "192k"]
    command = [
        ffmpeg, "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
        "-i", str(video), "-i", str(sound), "-c:v", "copy",
    ] + audio_args + ["-shortest"]
    if fmt in {"prores", "greenscreen"}:
        command += ["-movflags", "+faststart"]
    command.append(str(output))
    result = subprocess.run(command, capture_output=True, text=True, timeout=90, check=False)
    if result.returncode != 0 or not output.is_file() or output.stat().st_size <= 0:
        raise errors.FetcherError(
            errors.BACKEND_ERROR,
            message="the overlay rendered, but its message sound couldn't be attached",
            detail=(result.stderr or "")[-1800:],
        )


def render(
    payload: dict,
    job: Job,
    fmt: str,
    resolution: str,
    fps: int,
    *,
    bubble_width: str = "uniform",
    bubble_gap: int = 20,
    message_ttl: float = 12.0,
    max_visible: int = 7,
    sound_preset: str = "off",
    sound_volume: int = 65,
    sound_min_gap_ms: int = 120,
    sound_data: str | None = None,
):
    duration = float(payload.get("duration") or 0.0)
    base.validate_request(fmt, resolution, fps, duration)
    if bubble_width not in {"uniform", "auto"}:
        bubble_width = "uniform"
    bubble_gap = max(8, min(40, int(bubble_gap)))
    message_ttl = max(4.0, min(30.0, float(message_ttl)))
    max_visible = max(3, min(12, int(max_visible)))
    if sound_preset not in {"off", "pop", "tick", "bubble", "custom"}:
        sound_preset = "off"

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise errors.FetcherError(errors.FFMPEG_MISSING)
    pil = base._Pillow()
    style = base._style(resolution, fps)
    visible_gap = round(bubble_gap * (style.height / 1080.0))
    ext, media_type = base._FORMATS[fmt]
    output = job.dir / f"chat-overlay.{ext}"
    video_only = job.dir / f"chat-video-only.{ext}" if sound_preset != "off" else output
    output.unlink(missing_ok=True)
    video_only.unlink(missing_ok=True)

    job.status = "processing"
    job.stage = "loading emotes"
    job.progress = 4.0
    assets = base._load_assets(pil, payload, style, job)
    job.stage = "laying out chat"
    prepared = _prepare_messages(pil, payload, assets, style, job, bubble_width)

    job.stage = "rendering overlay"
    command = base._ffmpeg_command(ffmpeg, video_only, fmt, style)
    stderr_tail = deque(maxlen=120)
    proc = subprocess.Popen(
        command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE, bufsize=0, text=False,
    )

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
                base._stop(proc)
                raise JobCancelled()
            t = min(duration, index / style.fps)
            frame = _frame(
                pil, prepared, t, style, green,
                message_ttl, max_visible, visible_gap,
            )
            try:
                proc.stdin.write(frame.tobytes("raw", "RGBA"))
            except BrokenPipeError as exc:
                base._stop(proc)
                raise errors.FetcherError(
                    errors.BACKEND_ERROR,
                    message="chat export stopped unexpectedly — try again",
                    detail="".join(stderr_tail)[-2000:],
                ) from exc
            job.progress = 18.0 + 72.0 * ((index + 1) / total_frames)
        proc.stdin.close()
        proc.wait()
        drainer.join(timeout=2)
        if proc.returncode != 0 or not video_only.is_file() or video_only.stat().st_size <= 0:
            raise errors.FetcherError(
                errors.BACKEND_ERROR,
                message="chat export couldn't finish — try another format",
                detail="".join(stderr_tail)[-2400:],
            )
    except BaseException:
        base._stop(proc)
        drainer.join(timeout=2)
        video_only.unlink(missing_ok=True)
        output.unlink(missing_ok=True)
        raise

    if job.cancel_event.is_set():
        raise JobCancelled()
    if sound_preset != "off":
        job.stage = "mixing message sounds"
        job.progress = 92.0
        soundtrack = _build_soundtrack(
            ffmpeg, job, payload, sound_preset, sound_volume,
            sound_min_gap_ms, sound_data,
        )
        if job.cancel_event.is_set():
            raise JobCancelled()
        job.stage = "attaching audio"
        job.progress = 96.0
        _mux_sound(ffmpeg, video_only, output, soundtrack, fmt)
        video_only.unlink(missing_ok=True)

    job.progress = 99.0
    job.stage = "finishing"
    vod_id = re.sub(r"[^0-9]", "", str(payload.get("vodId") or "")) or "vod"
    start = max(0, round(float(payload.get("start") or 0)))
    end = max(start, round(float(payload.get("end") or 0)))
    label = "alpha-prores" if fmt == "prores" else ("alpha-webm" if fmt == "webm" else "green-screen")
    suffix = "-sound" if sound_preset != "off" else ""
    filename = f"twitch-chat-{vod_id}-{start}-{end}-{label}{suffix}.{ext}"
    return output, filename, media_type
