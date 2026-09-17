"""YouTube provider.

YouTube gets a little more defensive than the other yt-dlp-backed providers.
When a dedicated YouTube service session is configured, Fetcher uses it first so
an already bot-gated server IP does not waste time repeating several anonymous
failures on every fetch. If that session is unavailable or stops working, Fetcher
still falls back through the normal anonymous route and alternate yt-dlp player
clients, including mweb + the installed PO Token provider.

The authenticated route is only enabled by explicit/private server configuration;
public/self-hosted copies without that configuration remain anonymous-first.
"""

from __future__ import annotations

import shutil

from .. import config, errors
from .. import jobs as jobstate
from ..jobs import Job, JobCancelled
from ..models import Preferences
from .base import ProviderResult
from .ytdlp_base import YtdlpProvider


class YouTubeProvider(YtdlpProvider):
    name = "youtube"
    # Exactly the hosts we allow — no arbitrary yt-dlp sites slip through.
    ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}

    # Anonymous recovery routes kept as a safety net if the configured dedicated
    # service session expires or is temporarily unusable.
    BOT_CHECK_CLIENTS = ("android_vr", "web_embedded", "mweb")
    _RETRYABLE_FALLBACK_CODES = {
        errors.BOT_CHECK,
        errors.EXTRACTION_FAILED,
        errors.LOGIN_REQUIRED,
        errors.MEDIA_UNAVAILABLE,
        errors.RESTRICTED,
        errors.VIDEO_UNAVAILABLE,
    }

    def long_form(self, url: str) -> bool:
        # Regular YouTube uploads can be multi-hour VODs. Grant full-video
        # downloads the long-form ceiling; Shorts keep the normal short timeout.
        return "/shorts/" not in url.lower()

    def _base_opts(self, job: Job):
        """Apply per-attempt YouTube overrides without mutating provider state.

        Providers are singletons and jobs run concurrently, so retry state lives
        on the Job object rather than on ``self``. This keeps one user's fallback
        from affecting another user's download.
        """
        opts, ydl_logger = super()._base_opts(job)

        player_client = getattr(job, "_youtube_player_client", None)
        if player_client:
            opts["extractor_args"] = {
                "youtube": {"player_client": [player_client]},
            }

        browser = getattr(job, "_youtube_cookie_browser", None)
        cookie_file = getattr(job, "_youtube_cookie_file", None)
        if browser:
            # yt-dlp accepts (browser,) or (browser, profile). Keep the profile
            # part intact so values such as "chrome:Profile 1" work correctly.
            browser_name, separator, profile = browser.partition(":")
            opts["cookiesfrombrowser"] = (
                (browser_name, profile) if separator else (browser_name,)
            )
        elif cookie_file:
            opts["cookiefile"] = cookie_file

        return opts, ydl_logger

    def _configured_session(self, job: Job) -> None:
        job._youtube_cookie_browser = config.YOUTUBE_COOKIES_FROM_BROWSER
        job._youtube_cookie_file = config.YOUTUBE_COOKIES_FILE

    def prepare(
        self,
        url: str,
        mode: str,
        preferences: Preferences,
        job: Job,
    ) -> ProviderResult:
        """Use a configured service session first, then retain anonymous recovery.

        Fetcher's hosted Mac currently has a dedicated YouTube-only session. On a
        static IP that YouTube already challenges, trying anonymous/default plus
        three alternate clients before that known-good session adds substantial
        latency to every fetch. Prefer the explicitly configured session; if it
        fails with a retryable YouTube error, fall back to the anonymous chain.
        """
        self._clear_retry_state(job)
        last_error: errors.FetcherError | None = None
        has_configured_session = bool(
            config.YOUTUBE_COOKIES_FROM_BROWSER or config.YOUTUBE_COOKIES_FILE
        )

        if has_configured_session:
            if job.cancel_event.is_set():
                raise JobCancelled()
            self._reset_for_retry(job, stage="verifying:service-session")
            self._configured_session(job)
            try:
                result = super().prepare(url, mode, preferences, job)
                self.log.info("YouTube configured service session succeeded")
                return result
            except errors.FetcherError as exc:
                last_error = exc
                self.log.info(
                    "YouTube configured service session failed with %s; trying anonymous routes: %s",
                    exc.code,
                    exc.detail or exc.message,
                )
                if exc.code not in self._RETRYABLE_FALLBACK_CODES:
                    raise
            finally:
                self._clear_retry_state(job)

        # Keep a plain/default anonymous attempt as a fallback. This is still the
        # only path on public installs with no dedicated YouTube session.
        self._reset_for_retry(job, stage="verifying:default")
        try:
            return super().prepare(url, mode, preferences, job)
        except errors.FetcherError as exc:
            last_error = exc
            if exc.code != errors.BOT_CHECK:
                # If a configured session already failed with a retryable error,
                # allow the alternate anonymous clients below to have a chance at
                # recovery for extraction/login/media failures too.
                if not has_configured_session or exc.code not in self._RETRYABLE_FALLBACK_CODES:
                    raise
        finally:
            self._clear_retry_state(job)

        self.log.warning(
            "YouTube verification failed; trying anonymous fallback clients"
        )

        for client in self.BOT_CHECK_CLIENTS:
            if job.cancel_event.is_set():
                raise JobCancelled()
            self._reset_for_retry(job, stage=f"verifying:{client}")
            job._youtube_player_client = client
            try:
                return super().prepare(url, mode, preferences, job)
            except errors.FetcherError as exc:
                last_error = exc
                self.log.info(
                    "YouTube fallback client %s failed with %s: %s",
                    client,
                    exc.code,
                    exc.detail or exc.message,
                )
                if exc.code not in self._RETRYABLE_FALLBACK_CODES:
                    raise
            finally:
                self._clear_retry_state(job)

        # Do not repeat the configured session at the end: when configured it was
        # already the first/fast path above. Preserve the stable BOT_CHECK contract
        # for the UI while keeping the final technical failure in server logs.
        raise errors.FetcherError(
            errors.BOT_CHECK,
            detail=(
                "YouTube verification remained after configured + anonymous attempts; "
                f"last retry: {(last_error.detail or last_error.message) if last_error else 'unknown'}"
            ),
        )

    @staticmethod
    def _clear_retry_state(job: Job) -> None:
        for name in (
            "_youtube_player_client",
            "_youtube_cookie_browser",
            "_youtube_cookie_file",
        ):
            if hasattr(job, name):
                delattr(job, name)

    @staticmethod
    def _reset_for_retry(job: Job, stage: str) -> None:
        """Remove partial attempt files and put the job back in preparing state."""
        try:
            for child in job.dir.iterdir():
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                else:
                    child.unlink(missing_ok=True)
        except OSError:
            # yt-dlp overwrites its controlled source path anyway; cleanup is
            # best-effort so a locked .part file does not hide the real retry.
            pass
        job.status = jobstate.PREPARING
        job.stage = stage
        job.progress = 0.0
