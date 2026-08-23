/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared shell helpers: the paw cursor fix plus distance-aware timing for the
 * sidebar highlight pill.
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Paw cursor

     The first cursor pass rasterised the supplied paw artwork at about 40x34,
     which made it feel oversized, and it preserved faint source-alpha pixels
     that made the paw look washed out on some backgrounds. These replacements
     are rebuilt from the supplied SVG at 30x26 / 31x26, with opaque artwork and
     a one-pixel contrast edge baked into each theme variant.

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
    'html[data-theme="light"]{--cursor-paw-fixed:url("' + PAW_LIGHT + '") 15 2;}' +
    'html[data-theme="dark"]{--cursor-paw-fixed:url("' + PAW_DARK + '") 15 2;}' +
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
