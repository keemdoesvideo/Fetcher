# Fetcher

Fetcher is a small, self-hostable media utility: paste a link, choose **Video** or **Audio**, hit **Fetch**, and the file lands in your browser downloads.

The current build supports:

- **YouTube**
- **TikTok**
- **SoundCloud**
- **Twitch**
- **Instagram**
- **X / Twitter**

It includes live progress, cancellation, persistent download settings, recent-download history, Light/Dark appearance, Full/Reserved/Reduced motion modes, and a preview/trimmer flow for supported long-form media.

**Image** and **Chat** are visible in the app as coming-soon tools. They are intentionally not part of the current launch feature set.

---

## Local setup — Windows

### Requirements

- Windows 10/11
- Python 3.10+
- FFmpeg

From the Fetcher project folder in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

If you do not already have FFmpeg:

```powershell
winget install Gyan.FFmpeg
```

Then close/reopen PowerShell and confirm:

```powershell
ffmpeg -version
```

Fetcher starts at:

```text
http://127.0.0.1:8765/
```

Stop it with `Ctrl+C`.

---

## Using Fetcher

1. Paste a supported link.
2. Pick **Video** or **Audio**.
3. Click **Fetch** or press **Enter**.
4. Fetcher prepares the file in the background and shows live progress.
5. The browser download starts automatically when the file is ready.

For supported long-form sources, Fetcher can open a preview/trimmer so only a chosen section is prepared.

Temporary media lives in per-job folders under `.fetcher-tmp/` and is cleaned up after the download, cancellation, timeout, or stale-job sweep. Fetcher does not keep a permanent media library.

---

## Settings

Browser-persisted settings include:

- **Video quality** — Best / 4K / 1440p / 1080p / 720p / 480p
- **Video format**
- **Audio quality** — Best / 320 / 256 / 192 / 128 kbps
- **Audio format**
- **Filename style** — Clean / Original
- **Appearance** — System / Light / Dark
- **Motion** — System / Reduced / Reserved / Full
- visibility preferences for the Downloads and Shortcuts utilities

Provider capabilities vary. For example, SoundCloud is audio-only, while TikTok does not have the same useful resolution ladder as YouTube.

---

## Provider notes

### YouTube

Fetcher uses yt-dlp's normal extraction path. If YouTube asks for extra anti-bot verification, the supported route is yt-dlp's PO Token Provider plugin system rather than hardcoded tokens or bespoke bypasses.

### TikTok

Fetcher accepts normal TikTok URLs plus `vm.tiktok.com` / `vt.tiktok.com` share links. The provider prefers clean playback streams rather than TikTok's watermarked `download` format.

### Twitch

Clips and supported long-form/VOD links are handled through the shared yt-dlp provider flow. Long-form media can use Fetcher's preview/trimmer.

### Instagram

Instagram may require a logged-in session. Fetcher supports either browser cookies or a local `cookies.txt` file.

Browser-cookie example:

```powershell
$env:FETCHER_COOKIES_FROM_BROWSER = "firefox"
python run.py
```

Cookie-file example:

```powershell
$env:FETCHER_COOKIES_FILE = "C:\path\to\instagram-cookies.txt"
python run.py
```

These credentials stay on the machine running Fetcher and are applied only where configured.

---

## Architecture

```text
Fetcher frontend
      ↓
FastAPI
      ↓
provider resolver
      ↓
yt-dlp
      ↓
FFmpeg when needed
      ↓
temporary prepared file
      ↓
browser download
```

Main backend pieces:

```text
server/
  app.py               FastAPI routes + frontend serving
  downloader.py        provider resolution / prepare entry point
  providers/
    youtube.py
    tiktok.py
    soundcloud.py
    twitch.py
    instagram.py
    x.py
    ytdlp_base.py       shared yt-dlp implementation
  jobs.py              background job state + temp cleanup
  preview.py           long-form preview proxy
  timecode.py          trim-section handling
  visits.py            persistent visitor counter
  naming.py            safe filenames
  diagnostics.py       startup / health checks
```

The frontend is intentionally lightweight HTML/CSS/JS served by the same FastAPI process.

---

## API flow

- `GET /api/detect?url=...` — provider + supported modes
- `POST /api/prepare` — create a background prepare job
- `GET /api/progress/{jobId}` — poll state/progress
- `POST /api/cancel/{jobId}` — cancel an active job
- `GET /api/download/{jobId}` — stream the prepared file and clean it up
- `POST /api/preview` — open supported long-form preview sessions
- `GET /api/visits` — public visitor-count total used by the About page

---

## Optional configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FETCHER_PORT` | `8765` | Local listen port |
| `FETCHER_HOST` | `127.0.0.1` | Bind address |
| `FETCHER_FFMPEG_LOCATION` | PATH | FFmpeg location |
| `FETCHER_JOB_TTL` | `1800` | Stale-job lifetime in seconds |
| `FETCHER_PREPARE_TIMEOUT` | `360` | Normal prepare timeout |
| `FETCHER_COOKIES_FROM_BROWSER` | none | Browser cookie source for Instagram |
| `FETCHER_COOKIES_FILE` | none | Cookie file for Instagram |

---

## Coming soon

The launch build deliberately leaves two visible areas unfinished:

- **Image** — crop, circle crop, background removal, format conversion
- **Chat** — animated transparent chat capture/export

Other future ideas include additional providers, batch workflows, QR/direct-link tools and other small media utilities.

---

## Public deployment

Fetcher is currently being prepared for a self-hosted public deployment. The production Mac/Caddy/launchd setup will be documented when that launch configuration is finalized rather than keeping speculative instructions in the repo.

---

## Open source

Fetcher is built by Hahkeemi / Keem and the source is available here for people to read, learn from, report issues on, or improve.
