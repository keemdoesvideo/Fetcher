/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared shell helpers: the paw cursor fix plus distance-aware timing for the
 * sidebar highlight pill.
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Paw cursor

     Uses a compact, high-contrast paw silhouette: black fill with a small white
     outline, based on the simplified paw-print direction requested in review.
     The cursor rule is injected from shared JS so it applies across every page,
     including page-local controls that previously overrode cursor:pointer.
  ----------------------------------------------------------------------- */
  var PAW_OUTLINED = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>" +
      "<g fill='#000000' stroke='#ffffff' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'>" +
        "<ellipse cx='8.6' cy='13.2' rx='2.8' ry='4.1' transform='rotate(-24 8.6 13.2)'/>" +
        "<ellipse cx='14.1' cy='8.8' rx='2.9' ry='4.2' transform='rotate(-8 14.1 8.8)'/>" +
        "<ellipse cx='20.6' cy='10.9' rx='2.8' ry='4.0' transform='rotate(14 20.6 10.9)'/>" +
        "<ellipse cx='24.1' cy='16.4' rx='2.7' ry='3.8' transform='rotate(28 24.1 16.4)'/>" +
        "<path d='M15.9 14.6c2.2 0 4.5.7 6.2 2.1 1.9 1.5 3 3.8 3 6.3 0 3.9-2.3 6.4-5.9 6.4-1.8 0-3-.5-4.1-1.4-.8-.7-1.5-1-2.4-1-.8 0-1.7.3-2.6.5-.8.2-1.7.4-2.6.4-3.3 0-5.5-2.2-5.5-5.7 0-2.3 1-4.4 2.7-5.9 1.7-1.3 3.9-2.1 6.1-2.1 1.3 0 2.2.2 3.1.5.8.2 1.4.4 2 .4.5 0 1-.2 1.6-.4.7-.1 1.4-.4 2.4-.4z'/>" +
      "</g>" +
    "</svg>"
  );

  var cursorStyle = document.createElement('style');
  cursorStyle.id = 'fetcher-paw-cursor-fix';
  cursorStyle.textContent =
    'html[data-theme]{--cursor-paw-fixed:url("' + PAW_OUTLINED + '") 15 3;}' +
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
