# Fetcher

Paste a link, pick **Video** or **Audio**, hit **Fetch**, and the file downloads
to your browser. This first backend release supports **YouTube only** (watch URLs
and Shorts) — video as **MP4**, audio as **MP3** — honouring the quality and
filename choices in Settings.

The frontend (the Fetch page, Settings, themes) is plain HTML/CSS/JS and is
served by the backend, so everything runs from one local address with no extra
tooling. A fetch shows a live progress bar and can be cancelled mid-way.

---

## What you need

- **Windows 10/11**
- **Python 3.10 or newer**
- **FFmpeg** (used to merge video+audio and to make MP3s)

---

## Setup (Windows, step by step)

These instructions assume no prior Python experience. Run the commands in
**PowerShell**, from the Fetcher project folder.

### 1. Open PowerShell in the project folder

Open the `Fetcher` folder in File Explorer, then in the address bar type
`powershell` and press Enter. You should see a prompt sitting in the Fetcher
folder.

### 2. Check Python

```powershell
python --version
```

You should see `Python 3.10.x` or higher. If instead the Microsoft Store opens
or you get an error, install Python from <https://www.python.org/downloads/>
and, in the installer, **tick "Add python.exe to PATH"**. Then close and reopen
PowerShell.

### 3. Install FFmpeg

The easiest way on Windows:

```powershell
winget install Gyan.FFmpeg
```

**Close and reopen PowerShell** afterwards (so the new PATH takes effect), then
confirm:

```powershell
ffmpeg -version
```

If you see version text, you're set. If `ffmpeg` still isn't found, either add
its `bin` folder to your PATH, or tell Fetcher where it is:

```powershell
$env:FETCHER_FFMPEG_LOCATION = "C:\path\to\ffmpeg\bin"
```

### 4. Create and activate a virtual environment

A "venv" keeps Fetcher's Python packages isolated from the rest of your system.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Your prompt should now start with `(.venv)`.

> If activation is blocked by an execution-policy error, run this once, then
> retry the activate command:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

### 5. Install Fetcher's Python packages

```powershell
pip install -r requirements.txt
```

### 6. Start Fetcher

```powershell
python run.py
```

You'll see a short diagnostics banner (Python / yt-dlp / FFmpeg all `OK`), then:

```
Fetcher listening on http://127.0.0.1:8765/
```

### 7. Open it

Go to **<http://127.0.0.1:8765/>** in your browser.

To stop the server, press **Ctrl+C** in PowerShell.

---

## Trying it out

1. Open <http://127.0.0.1:8765/>.
2. Paste a public YouTube link (a normal watch URL **or** a Shorts URL).
3. Choose **Video** or **Audio**.
4. Click **Fetch**. A progress bar tracks it — *sniffing it out… → bringing it
   back… (with a live %) → fetched!* — and your browser's download then starts
   automatically. You can **cancel** at any time before it finishes.
5. Video arrives as `.mp4`, audio as `.mp3`, named per your **Files → filename
   style** setting.

Settings you can change (they persist in your browser):

- **Video quality** — Best / 4K / 1440p / 1080p / 720p / 480p. If the exact
  resolution isn't offered, Fetcher takes the next best at or below it rather
  than failing.
- **Audio quality** — Best / 320 / 256 / 192 / 128 kbps. "Best" produces a
  high-quality VBR MP3 (LAME V0). Fetcher never invents quality a source
  doesn't have.
- **Filename style** — *Clean* → `Title - Creator.mp4`; *Original* → the
  source's own title. Both are sanitized for Windows/macOS/Linux.

A non-YouTube link, or a private/unavailable video, shows a friendly message
above the input (the real technical reason is logged in your PowerShell window).

---

## How it's put together

```
Fetcher UI  →  Fetcher API (FastAPI)  →  YouTube provider  →  yt-dlp  →  FFmpeg  →  file
```

```
Fetcher/
  project-fetcher.html, settings.html            # frontend
  fetcher-theme.css, fetcher-prefs.js            # theme tokens + shared prefs
  server/
    app.py           # FastAPI: serves the frontend + prepare/progress/cancel/download
    downloader.py    # validates the URL, picks a provider
    providers/
      base.py        # provider interface + result type
      youtube.py     # the only enabled provider (yt-dlp Python API, live progress)
    jobs.py          # per-fetch temp dirs, job state, stale-job cleanup
    naming.py        # safe cross-platform filenames
    models.py        # request/response schemas
    errors.py        # structured, friendly error codes
    diagnostics.py   # Python / yt-dlp / FFmpeg / JS-runtime checks (also GET /api/health)
    config.py        # env-overridable settings
  run.py             # `python run.py` launcher
  requirements.txt, .gitignore, README.md
```

The flow is a background job the frontend polls for progress:

- `POST /api/prepare` starts the download in a background worker and returns
  `{ jobId }` immediately (yt-dlp + FFmpeg run server-side).
- `GET /api/progress/{jobId}` is polled for live status: `preparing →
  downloading` (with a %) `→ processing → ready` (or `error` / `cancelled`).
- `POST /api/cancel/{jobId}` aborts an in-flight job and deletes its partial files.
- `GET /api/download/{jobId}` streams the prepared file (no giant JavaScript
  Blob) and then deletes the temp directory. Abandoned jobs are swept after
  30 minutes. A per-job timeout (default 6 min) bounds a stuck fetch.

Each fetch gets its own `jobId` directory under `.fetcher-tmp/` (gitignored),
so concurrent downloads never collide, and nothing is stored permanently.

### Configuration (optional env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `FETCHER_PORT` | `8765` | Port to listen on |
| `FETCHER_HOST` | `127.0.0.1` | Bind address |
| `FETCHER_FFMPEG_LOCATION` | (PATH) | Folder or path to `ffmpeg` |
| `FETCHER_JOB_TTL` | `1800` | Seconds before an abandoned job is swept |
| `FETCHER_PREPARE_TIMEOUT` | `360` | Max seconds for one prepare |
| `FETCHER_COOKIES_FROM_BROWSER` | (none) | Browser to read login cookies from (Instagram) |
| `FETCHER_COOKIES_FILE` | (none) | Path to a `cookies.txt` (Instagram) |

---

## Instagram (needs login)

Instagram blocks logged-out access, so Fetcher can't grab reels/posts unless it
uses **your** Instagram session. Without it you'll see *"instagram needs you to
be logged in."* Nothing is stored in the repo — cookies stay on your machine.

Pick **one** of these (set it before starting Fetcher), then log into Instagram
in that browser:

**A. Read cookies from a browser you're logged into (easiest):**
```powershell
$env:FETCHER_COOKIES_FROM_BROWSER = "firefox"
python run.py
```
`firefox` is the most reliable on Windows. `chrome`/`edge`/`brave` also work but
recent Chrome versions encrypt cookies in a way yt-dlp sometimes can't read — if
Chrome fails, use Firefox or option B. For a specific profile:
`"firefox:default-release"`.

**B. Export a `cookies.txt` and point Fetcher at it:**
Use a "Get cookies.txt" browser extension on instagram.com, save the file, then:
```powershell
$env:FETCHER_COOKIES_FILE = "C:\path\to\instagram-cookies.txt"
python run.py
```

Fetcher applies these cookies **only** to Instagram, never to YouTube/TikTok/etc.
Only public posts/reels/IGTV are supported (not stories or profiles). Treat
whichever cookie source you use as sensitive — it's your logged-in session.

---

## YouTube PO Tokens

Fetcher uses **yt-dlp's standard extraction path only** — no homemade anti-bot
tricks, no hardcoded tokens, no account cookies in the repo.

If YouTube ever responds with *"Sign in to confirm you're not a bot"* for the
formats you want, Fetcher surfaces a clear message and logs the real reason. The
supported fix is yt-dlp's **PO Token Provider plugin** (e.g.
`bgutil-ytdlp-pot-provider`) rather than anything bespoke — see yt-dlp's
[PO Token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide). That
plugin mechanism can be slotted into the YouTube provider later without changing
the API or the UI.

---

## Not in this release

TikTok/Instagram/X/Reddit/SoundCloud/Vimeo/Pinterest, playlists, batch
downloads, QR transfer, direct-link copy, accounts, cloud storage, and
deployment. This pass is the first real YouTube end-to-end slice only.
