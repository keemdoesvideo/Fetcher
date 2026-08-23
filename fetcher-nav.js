/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared shell helpers: the paw cursor plus distance-aware timing for the
 * sidebar highlight pill.
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Paw cursor

     Uses the supplied paw silhouette at the approved cursor scale. Light mode
     uses a solid black paw; dark mode uses the same shape in solid white.
     The View Transition pseudo-tree is removed from pointer hit-testing so
     Chrome keeps resolving the cursor against the live page underneath instead
     of caching the browser arrow until the pointer moves again.
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

  var cursorStyle = document.createElement('style');
  cursorStyle.id = 'fetcher-paw-cursor-fix';
  cursorStyle.textContent =
    'html[data-theme="light"]{--cursor-paw-fixed:url("' + PAW_LIGHT + '") 15 3;}' +
    'html[data-theme="dark"]{--cursor-paw-fixed:url("' + PAW_DARK + '") 15 3;}' +
    'html[data-theme]{cursor:var(--cursor-paw-fixed),auto!important;}' +
    'html[data-theme]:active-view-transition{cursor:var(--cursor-paw-fixed),auto!important;}' +
    '::view-transition,' +
    '::view-transition-group(*),' +
    '::view-transition-image-pair(*),' +
    '::view-transition-old(*),' +
    '::view-transition-new(*){' +
      'pointer-events:none!important;' +
      'cursor:var(--cursor-paw-fixed),auto!important;' +
    '}' +
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
  var MIN = 240, MAX = 380, BASE = 230, PER_PX = 0.42;

  try {
    var pending = sessionStorage.getItem('nav.dur');
    if (pending) {
      document.documentElement.style.setProperty('--nav-dur', pending);
      sessionStorage.removeItem('nav.dur');
    }
  } catch (e) {}

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
