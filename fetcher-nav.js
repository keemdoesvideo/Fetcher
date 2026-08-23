/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Distance-aware timing for the sidebar highlight pill.
 *
 * Cross-document view transitions run one fixed CSS duration for the pill, so a
 * short hop (settings -> donate) feels as slow as a long one (save -> settings).
 * Fix: when you click a rail link, measure how far the pill will travel — from
 * the currently-active item to the one you clicked (both laid out on this page)
 * — and stash a distance-scaled duration. The destination page reads it in this
 * same script, synchronously in <head>, and sets --nav-dur before its first
 * paint, so the view transition slides at the right speed. Same curve, adapted
 * speed: every hop feels consistent. Falls back to the CSS default duration.
 */
(function () {
  'use strict';

  // Tuned so save<->bottom-icons lands near the 500ms that already feels good,
  // while adjacent icons come in noticeably snappier (~290ms).
  var MIN = 260, MAX = 520, BASE = 250, PER_PX = 0.55;

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
