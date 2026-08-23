/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared shell helpers: the paw cursor fix plus distance-aware timing for the
 * sidebar highlight pill.
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Paw cursor

     Rebuilt from the supplied paw artwork at a compact desktop-cursor scale.
     The visible paw stays fully opaque, while the contrast treatment is now a
     soft one-pixel halo with extra transparent breathing room so the silhouette
     doesn't look boxed or clipped against the cursor canvas.

     This script is shared by every Fetcher page. The selectors deliberately use
     enough specificity + !important to beat older page-level cursor:pointer
     declarations (including the Twitch trimmer), while keeping specialist
     cursors where they communicate useful behaviour.
  ----------------------------------------------------------------------- */
  var PAW_LIGHT = 'data:image/png;base64,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';
  var PAW_DARK = 'data:image/png;base64,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';

  var cursorStyle = document.createElement('style');
  cursorStyle.id = 'fetcher-paw-cursor-fix';
  cursorStyle.textContent =
    'html[data-theme="light"]{--cursor-paw-fixed:url("' + PAW_LIGHT + '") 16 3;}' +
    'html[data-theme="dark"]{--cursor-paw-fixed:url("' + PAW_DARK + '") 16 3;}' +
    'html[data-theme]{cursor:var(--cursor-paw-fixed),auto!important;}' +
    'html[data-theme] body,html[data-theme] .app{cursor:inherit!important;}' +
    'html[data-theme] a,html[data-theme] button:not(:disabled),' +
    'html[data-theme] [role="button"]:not([aria-disabled="true"]),' +
    'html[data-theme] summary,html[data-theme] label[for],' +
    'html[data-theme] .trim-play,html[data-theme] .trim-track{' +
      'cursor:var(--cursor-paw-fixed),pointer!important;' +
    '}' +
    'html[data-theme] input:not([type="button"]):not([type="submit"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]),' +
    'html[data-theme] textarea,html[data-theme] [contenteditable="true"]{cursor:text!important;}' +
    'html[data-theme] button:disabled,html[data-theme] .seg-btn:disabled,' +
    'html[data-theme] .settings-seg-btn:disabled,html[data-theme] [aria-disabled="true"]{cursor:not-allowed!important;}' +
    'html[data-theme] .trim-handle{cursor:ew-resize!important;}';
  (document.head || document.documentElement).appendChild(cursorStyle);

  /* -----------------------------------------------------------------------
     Distance-aware sidebar highlight timing
  ----------------------------------------------------------------------- */

  // Tuned to keep adjacent hops feeling the same (~255ms) while capping the long
  // save<->bottom-icon hops lower (~380ms, was ~520ms). The shorter ceiling
  // narrows the window in which a rapid second click can supersede — and skip —
  // an in-flight cross-document transition (the "blink" under fast back-and-forth).
  var MIN = 240, MAX = 380, BASE = 230, PER_PX = 0.42;

  // 1) Apply the duration the previous page's click computed — before first paint.
  try {
    var pending = sessionStorage.getItem('nav.dur');
    if (pending) {
      document.documentElement.style.setProperty('--nav-dur', pending);
      sessionStorage.removeItem('nav.dur');   // one-shot: consume it for this hop
    }
  } catch (e) {}

  // 2) On a rail nav click, size the upcoming slide by the pill's travel distance.
  document.addEventListener('click', function (ev) {
    var link = ev.target.closest ? ev.target.closest('a.rail-btn[href]') : null;
    if (!link) return;
    var active = document.querySelector('.rail-btn.active');
    if (!active || link === active) return;
    var travel = Math.abs(
      link.getBoundingClientRect().top - active.getBoundingClientRect().top
    );
    var dur = Math.round(Math.min(MAX, Math.max(MIN, BASE + PER_PX * travel)));
    try { sessionStorage.setItem('nav.dur', dur + 'ms'); } catch (e) {}
  }, true);
})();
