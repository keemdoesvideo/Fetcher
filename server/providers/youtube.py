"""YouTube provider.

YouTube gets a little more defensive than the other yt-dlp-backed providers.
The normal extraction path is always tried first. If YouTube responds with its
"sign in to confirm you're not a bot" challenge, Fetcher transparently retries
with official yt-dlp player clients that currently do not require a PO Token.

An authenticated browser/cookie retry is also available as an explicit server
configuration for private/local installs. It is never enabled implicitly: a
public Fetcher instance must not silently borrow the host owner's YouTube login.
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

    # Current yt-dlp guidance lists these clients as not requiring a PO Token.
    # android_vr covers the broad case; web_embedded is a useful second route
    # for videos that permit embedding. The normal/default client still gets
    # first choice so this does not change successful downloads.
    BOT_CHECK_CLIENTS = ("android_vr", "web_embedded")
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

    def prepare(
        self,
        url: str,
        mode: str,
        preferences: Preferences,
        job: Job,
    ) -> ProviderResult:
        """Try normal YouTube extraction, then recover from bot verification.

        The fallback chain is deliberately narrow: it only runs after a real
        BOT_CHECK classification, so ordinary successful downloads keep their
        existing format/client behaviour. Authenticated cookies are tried last
        and only when the host owner explicitly configured them.
        """
        self._clear_retry_state(job)
        try:
            return super().prepare(url, mode, preferences, job)
        except errors.FetcherError as exc:
            if exc.code != errors.BOT_CHECK:
                raise
            bot_error = exc

        self.log.warning(
            "YouTube requested bot verification; trying anonymous fallback clients"
        )
        last_error: errors.FetcherError = bot_error

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

        # Private/local operators can opt into a logged-in browser session for
        # stubborn videos. This is intentionally a separate YouTube setting so
        # Instagram cookies are never silently reused here.
        if config.YOUTUBE_COOKIES_FROM_BROWSER or config.YOUTUBE_COOKIES_FILE:
            if job.cancel_event.is_set():
                raise JobCancelled()
            self._reset_for_retry(job, stage="verifying:browser-session")
            job._youtube_cookie_browser = config.YOUTUBE_COOKIES_FROM_BROWSER
            job._youtube_cookie_file = config.YOUTUBE_COOKIES_FILE
            try:
                return super().prepare(url, mode, preferences, job)
            except errors.FetcherError as exc:
                last_error = exc
                self.log.info(
                    "YouTube configured browser-session fallback failed with %s: %s",
                    exc.code,
                    exc.detail or exc.message,
                )
                if exc.code not in self._RETRYABLE_FALLBACK_CODES:
                    raise
            finally:
                self._clear_retry_state(job)

        # Keep the stable BOT_CHECK contract for the UI, but preserve the final
        # technical failure in server logs to make future YouTube changes easier
        # to diagnose.
        raise errors.FetcherError(
            errors.BOT_CHECK,
            detail=(
                "YouTube bot verification remained after normal + fallback attempts; "
                f"last retry: {last_error.detail or last_error.message}"
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
