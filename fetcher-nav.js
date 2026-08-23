/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared shell helpers: custom paw cursor, rail-page transition choreography,
 * and small cross-page interaction fixes that belong to the persistent shell.
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Paw cursor

     One runtime cursor definition is used across the shell: black in light
     mode, white in dark mode. Text fields and disabled controls keep their
     native semantic cursors; trimmer handles keep the resize cursor.
  ----------------------------------------------------------------------- */
  var PAW_PATHS =
    "<path d='M 226 12 L 225 13 L 216 14 L 206 19 L 198 26 L 192 34 L 188 42 L 184 57 L 184 78 L 188 93 L 194 105 L 199 112 L 207 120 L 221 128 L 229 130 L 242 130 L 254 126 L 260 122 L 271 110 L 277 98 L 279 91 L 279 87 L 280 86 L 280 65 L 275 47 L 271 39 L 261 26 L 252 19 L 244 15 L 237 13 Z'/>" +
    "<path d='M 93 46 L 85 49 L 79 53 L 69 64 L 65 72 L 62 83 L 62 103 L 66 118 L 76 136 L 83 144 L 95 153 L 107 158 L 117 159 L 118 160 L 129 159 L 135 157 L 144 152 L 152 144 L 156 138 L 160 128 L 161 120 L 162 119 L 162 104 L 157 85 L 152 75 L 144 64 L 131 53 L 121 48 L 110 45 Z'/>" +
    "<path d='M 347 82 L 332 82 L 323 85 L 316 89 L 308 96 L 301 105 L 294 121 L 292 129 L 292 148 L 295 159 L 301 170 L 309 178 L 321 184 L 335 185 L 343 183 L 353 178 L 368 163 L 376 146 L 377 138 L 378 137 L 378 119 L 374 105 L 368 95 L 362 89 L 356 85 Z'/>" +
    "<path d='M 334 230 L 325 218 L 286 179 L 267 165 L 255 159 L 242 155 L 238 155 L 232 153 L 223 153 L 222 152 L 201 153 L 185 157 L 170 164 L 156 174 L 141 191 L 128 214 L 120 238 L 119 248 L 118 249 L 118 256 L 117 257 L 116 275 L 115 276 L 114 299 L 118 316 L 127 330 L 137 338 L 152 344 L 163 345 L 164 346 L 165 345 L 179 345 L 195 339 L 219 321 L 229 310 L 239 305 L 246 305 L 267 313 L 281 314 L 282 315 L 283 314 L 297 313 L 306 310 L 316 305 L 326 298 L 335 288 L 340 278 L 342 270 L 342 253 L 338 238 Z'/>" +
    "<path d='M 28 166 L 18 176 L 12 192 L 13 211 L 16 220 L 24 234 L 30 241 L 40 249 L 50 254 L 60 257 L 76 257 L 87 253 L 94 248 L 102 237 L 105 227 L 105 210 L 102 199 L 93 183 L 78 169 L 63 162 L 53 161 L 52 160 L 45 160 L 44 161 L 36 162 Z'/>";

  function makePaw(fill) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 391 359' width='32' height='32'>" +
        "<g fill='" + fill + "'>" + PAW_PATHS + "</g>" +
      "</svg>"
    );
  }

  var PAW_LIGHT = makePaw('#000000');
  var PAW_DARK = makePaw('#ffffff');

  /* -----------------------------------------------------------------------
     Rail-page transition

     Cross-document View Transitions are intentionally disabled. The old named
     pill morph required distance measurement, sessionStorage timing hand-off,
     View Transition pseudo-element cursor workarounds, and server tuning just
     to preserve a simple navigation effect.

     The replacement is deliberately simpler:
       - outgoing page fades briefly
       - destination page fades in
       - the destination pill appears in place and pops once

     Full motion keeps a restrained overshoot. Reserved uses a clean scale/fade.
     Reduced uses opacity only. The rail collapse and hover motion are untouched.
  ----------------------------------------------------------------------- */
  var root = document.documentElement;
  var arrivedFromRail = false;
  try {
    arrivedFromRail = sessionStorage.getItem('fetcher.navArrival') === '1';
    if (arrivedFromRail) sessionStorage.removeItem('fetcher.navArrival');
  } catch (e) {}
  if (arrivedFromRail) root.setAttribute('data-nav-arrival', 'true');

  var shellStyle = document.createElement('style');
  shellStyle.id = 'fetcher-shell-runtime';
  shellStyle.textContent =
    '@view-transition{navigation:none;}' +

    'html[data-theme="light"]{--cursor-paw-fixed:url("' + PAW_LIGHT + '") 15 3;}' +
    'html[data-theme="dark"]{--cursor-paw-fixed:url("' + PAW_DARK + '") 15 3;}' +
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
    'html[data-theme] .trim-handle{cursor:ew-resize!important;}' +

    'html .rail-btn.active::before{view-transition-name:none!important;}' +

    'html{--fetcher-page-in:170ms;--fetcher-page-out:115ms;}' +
    'html[data-motion="reserved"]{--fetcher-page-in:145ms;--fetcher-page-out:95ms;}' +
    'html[data-motion="reduced"]{--fetcher-page-in:100ms;--fetcher-page-out:80ms;}' +
    'html[data-nav-arrival="true"] body{' +
      'animation:fetcher-page-in var(--fetcher-page-in) var(--ease) both;' +
    '}' +
    'html[data-page-leaving="true"] body{' +
      'opacity:0!important;transition:opacity var(--fetcher-page-out) var(--ease)!important;' +
    '}' +
    '@keyframes fetcher-page-in{from{opacity:0;}to{opacity:1;}}' +

    'html[data-nav-arrival="true"][data-motion="full"] .rail-btn.active::before{' +
      'animation:fetcher-nav-pop-full 230ms cubic-bezier(.34,1.3,.64,1) both;' +
      'transform-origin:center;' +
    '}' +
    '@keyframes fetcher-nav-pop-full{' +
      '0%{opacity:.35;transform:scale(.88);}' +
      '68%{opacity:1;transform:scale(1.045);}' +
      '100%{opacity:1;transform:scale(1);}' +
    '}' +
    'html[data-nav-arrival="true"][data-motion="reserved"] .rail-btn.active::before{' +
      'animation:fetcher-nav-pop-reserved 170ms var(--ease) both;transform-origin:center;' +
    '}' +
    '@keyframes fetcher-nav-pop-reserved{' +
      'from{opacity:.45;transform:scale(.96);}' +
      'to{opacity:1;transform:scale(1);}' +
    '}' +
    'html[data-nav-arrival="true"][data-motion="reduced"] .rail-btn.active::before{' +
      'animation:fetcher-nav-pop-reduced 100ms var(--ease) both;' +
    '}' +
    '@keyframes fetcher-nav-pop-reduced{from{opacity:.45;}to{opacity:1;}}' +

    'html .trim-handle::before{' +
      'content:"";position:absolute;inset:-8px;background:transparent;' +
    '}' +

    'html[data-motion="reserved"] .rail-btn,' +
    'html[data-motion="reserved"] .rail-btn svg,' +
    'html[data-motion="reserved"] .fetch-btn,' +
    'html[data-motion="reserved"] .paste-btn,' +
    'html[data-motion="reserved"] .paste-btn svg,' +
    'html[data-motion="reserved"] .chip,' +
    'html[data-motion="reserved"] .seg-btn svg,' +
    'html[data-motion="reserved"] .services-toggle svg.chev,' +
    'html[data-motion="reserved"] .settings-nav-thumb,' +
    'html[data-motion="reserved"] .settings-seg .thumb,' +
    'html[data-motion="reserved"] .segmented .thumb{' +
      'transition-duration:150ms!important;transition-timing-function:var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .services-panel{' +
      'transition:grid-template-rows 180ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .chips{' +
      'transition:transform 180ms var(--ease),opacity 130ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .settings-panel.active,' +
    'html[data-motion="reserved"] .settings-panel.active.back{' +
      'animation-duration:180ms!important;animation-timing-function:var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .fetch-wrap-inner{' +
      'transition:transform 180ms var(--ease),opacity 130ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .fetch-wrap.show .fetch-wrap-inner{' +
      'animation:none!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-bubble,' +
    'html[data-motion="reserved"] .kbd-bubble{' +
      'transition-duration:220ms!important;transition-timing-function:var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-bubble-list,' +
    'html[data-motion="reserved"] .kbd-bubble-list{' +
      'transition:grid-template-rows 220ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-bubble-body,' +
    'html[data-motion="reserved"] .kbd-bubble-body{' +
      'transition:opacity 130ms var(--ease),transform 180ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-count.bump{animation:none!important;}' +
    'html[data-motion="reserved"] .dl-bubble.popping-in{' +
      'animation:fetcher-reserved-pop-in 180ms var(--ease) both!important;' +
    '}' +
    '@keyframes fetcher-reserved-pop-in{' +
      'from{transform:scale(.96);opacity:0;}to{transform:scale(1);opacity:1;}' +
    '}';

  (document.head || root).appendChild(shellStyle);

  function motionMode() {
    return root.getAttribute('data-motion') || 'full';
  }

  function pageExitDelay() {
    var mode = motionMode();
    if (mode === 'reduced') return 80;
    if (mode === 'reserved') return 95;
    return 115;
  }

  function isPlainPrimaryNavigation(ev, link) {
    if (ev.defaultPrevented) return false;
    if (ev.button != null && ev.button !== 0) return false;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
    if (link.target && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;
    return true;
  }

  document.addEventListener('click', function (ev) {
    var link = ev.target.closest ? ev.target.closest('a.rail-btn[href]') : null;
    if (!link || !isPlainPrimaryNavigation(ev, link)) return;

    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;

    var destination;
    try { destination = new URL(link.href, window.location.href); }
    catch (e) { return; }
    if (destination.origin !== window.location.origin) return;

    var current = new URL(window.location.href);
    if (destination.pathname === current.pathname && destination.search === current.search) return;

    ev.preventDefault();
    if (root.getAttribute('data-page-leaving') === 'true') return;

    try { sessionStorage.setItem('fetcher.navArrival', '1'); } catch (e) {}
    root.setAttribute('data-page-leaving', 'true');

    window.setTimeout(function () {
      window.location.href = destination.href;
    }, pageExitDelay());
  }, true);

  function installReservedMotionOption() {
    var group = document.querySelector('[data-pref="fetcher.motion"]');
    if (!group) return;

    var reserved = group.querySelector('[data-value="reserved"]');
    if (!reserved) {
      reserved = document.createElement('button');
      reserved.type = 'button';
      reserved.className = 'settings-seg-btn';
      reserved.setAttribute('data-value', 'reserved');
      reserved.setAttribute('aria-pressed', 'false');
      reserved.textContent = 'reserved';
      var full = group.querySelector('[data-value="full"]');
      group.insertBefore(reserved, full || null);
    }

    function syncMotionGroup(value) {
      var buttons = Array.prototype.slice.call(group.querySelectorAll('.settings-seg-btn'));
      var active = null;
      buttons.forEach(function (button) {
        var selected = button.getAttribute('data-value') === value;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        if (selected) active = button;
      });

      var thumb = group.querySelector('.thumb');
      if (!thumb || !active || !group.offsetWidth) return;
      thumb.style.transition = 'none';
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + (active.offsetLeft - 4) + 'px)';
      requestAnimationFrame(function () { thumb.style.transition = ''; });
    }

    group.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('.settings-seg-btn[data-value]') : null;
      if (!button || !group.contains(button)) return;
      var value = button.getAttribute('data-value');
      if (window.FetcherPrefs && window.FetcherPrefs.get('fetcher.motion') !== value) {
        window.FetcherPrefs.set('fetcher.motion', value);
      }
      requestAnimationFrame(function () { syncMotionGroup(value); });
    });

    document.addEventListener('fetcher:pref-change', function (event) {
      if (event.detail && event.detail.key === 'fetcher.motion') {
        requestAnimationFrame(function () { syncMotionGroup(event.detail.value); });
      }
    });

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(function () {
        if (group.offsetWidth && window.FetcherPrefs) {
          syncMotionGroup(window.FetcherPrefs.get('fetcher.motion'));
        }
      });
      observer.observe(group);
    }

    if (window.FetcherPrefs) syncMotionGroup(window.FetcherPrefs.get('fetcher.motion'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (shellStyle.parentNode) document.head.appendChild(shellStyle);
    installReservedMotionOption();
  });
})();
