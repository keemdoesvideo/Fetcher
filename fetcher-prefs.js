/*
 * fetcher-prefs.js
 * Shared preference storage + theme/motion resolution for all Fetcher pages.
 * Load this as the very first thing in <head>, before any stylesheet, so
 * data-theme/data-motion are set on <html> before the page paints (no flash
 * of the wrong theme). Every page that needs prefs just reads
 * window.FetcherPrefs — no per-page duplication of this logic.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    'fetcher.theme': 'auto',
    'fetcher.videoQuality': 'best',
    'fetcher.videoFormat': 'mp4',
    'fetcher.audioFormat': 'mp3',
    'fetcher.audioQuality': 'best',
    'fetcher.filenameStyle': 'clean',
    'fetcher.motion': 'system',
    'fetcher.showShortcuts': 'on',
    'fetcher.showDownloads': 'on'
  };

  var EASTER_KEY = 'fetcher.easterPalette';
  var EASTER_PALETTES = { ailincia: true, vitaviita: true, stonakah: true };

  function get(key) {
    try {
      var v = global.localStorage.getItem(key);
      return v === null ? DEFAULTS[key] : v;
    } catch (e) {
      return DEFAULTS[key];
    }
  }

  function set(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch (e) {
      /* storage unavailable (private mode, etc) — setting still applies for this session */
    }
    try {
      document.dispatchEvent(
        new CustomEvent('fetcher:pref-change', { detail: { key: key, value: value } })
      );
    } catch (e) {}
  }

  function getEasterPalette() {
    try {
      var value = global.sessionStorage.getItem(EASTER_KEY) || '';
      return EASTER_PALETTES[value] ? value : '';
    } catch (e) {
      return '';
    }
  }

  function applyEasterPalette() {
    var value = getEasterPalette();
    if (value) document.documentElement.setAttribute('data-easter-palette', value);
    else document.documentElement.removeAttribute('data-easter-palette');
  }

  function setEasterPalette(value) {
    value = EASTER_PALETTES[value] ? value : '';
    try {
      if (value) global.sessionStorage.setItem(EASTER_KEY, value);
      else global.sessionStorage.removeItem(EASTER_KEY);
    } catch (e) {}
    applyEasterPalette();
    try {
      document.dispatchEvent(new CustomEvent('fetcher:easter-change', { detail: { palette: value } }));
    } catch (e) {}
  }

  function systemPrefersDark() {
    return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function systemPrefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function resolveTheme() {
    var pref = get('fetcher.theme');
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return systemPrefersDark() ? 'dark' : 'light';
  }

  /*
   * Motion has four user-facing choices:
   *   system   -> follow the OS reduced-motion preference
   *   reduced  -> accessibility-first minimal movement
   *   reserved -> Fetcher motion without playful overshoot
   *   full     -> Fetcher's expressive bounce/overshoot language
   */
  function resolveMotion() {
    var pref = get('fetcher.motion');
    if (pref === 'reduced') return 'reduced';
    if (pref === 'reserved') return 'reserved';
    if (pref === 'full') return 'full';
    return systemPrefersReducedMotion() ? 'reduced' : 'full';
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', resolveTheme());
  }

  function applyMotion() {
    document.documentElement.setAttribute('data-motion', resolveMotion());
  }

  // Floating-chrome visibility (shortcuts + downloads bubbles). Set as html
  // attributes pre-paint so CSS can hide them with no flash. 'off' hides.
  function applyChrome() {
    document.documentElement.setAttribute(
      'data-shortcuts', get('fetcher.showShortcuts') === 'off' ? 'off' : 'on');
    document.documentElement.setAttribute(
      'data-downloads', get('fetcher.showDownloads') === 'off' ? 'off' : 'on');
  }

  // Apply immediately — this script must be loaded synchronously and early
  // in <head>, before the stylesheet, so these attributes exist before the
  // browser paints anything.
  applyTheme();
  applyMotion();
  applyChrome();
  applyEasterPalette();

  // Live-respond to system changes, but only when the user hasn't pinned an
  // explicit override (auto/system).
  if (global.matchMedia) {
    var mqDark = global.matchMedia('(prefers-color-scheme: dark)');
    var onDarkChange = function () {
      if (get('fetcher.theme') === 'auto') applyTheme();
    };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onDarkChange);
    else if (mqDark.addListener) mqDark.addListener('change', onDarkChange);

    var mqMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
    var onMotionChange = function () {
      if (get('fetcher.motion') === 'system') applyMotion();
    };
    if (mqMotion.addEventListener) mqMotion.addEventListener('change', onMotionChange);
    else if (mqMotion.addListener) mqMotion.addListener('change', onMotionChange);
  }

  document.addEventListener('fetcher:pref-change', function (e) {
    if (!e.detail) return;
    if (e.detail.key === 'fetcher.theme') applyTheme();
    if (e.detail.key === 'fetcher.motion') applyMotion();
    if (e.detail.key === 'fetcher.showShortcuts' || e.detail.key === 'fetcher.showDownloads') applyChrome();
  });

  // The persistent shell and page content live in separate same-origin browsing
  // contexts. localStorage/sessionStorage are shared, so storage events keep the
  // parent rail and currently embedded page visually in sync.
  global.addEventListener('storage', function (e) {
    if (!e || !e.key) return;
    if (e.key === 'fetcher.theme') applyTheme();
    if (e.key === 'fetcher.motion') applyMotion();
    if (e.key === 'fetcher.showShortcuts' || e.key === 'fetcher.showDownloads') applyChrome();
    if (e.key === EASTER_KEY) applyEasterPalette();
  });

  global.FetcherPrefs = {
    get: get,
    set: set,
    defaults: DEFAULTS,
    resolveTheme: resolveTheme,
    resolveMotion: resolveMotion,
    applyTheme: applyTheme,
    applyMotion: applyMotion,
    applyChrome: applyChrome,
    getEasterPalette: getEasterPalette,
    setEasterPalette: setEasterPalette,
    applyEasterPalette: applyEasterPalette
  };
})(window);
