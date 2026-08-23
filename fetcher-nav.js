/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared Fetcher shell: custom paw cursor, persistent primary rail, rail state,
 * page-content routing/fades, and the Reserved motion preference bridge.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

  /* -----------------------------------------------------------------------
     Persistent rail state
  ----------------------------------------------------------------------- */
  var RAIL_KEY = 'fetcher.railCollapsed';
  var savedRailCollapsed = false;
  try { savedRailCollapsed = localStorage.getItem(RAIL_KEY) === '1'; } catch (e) {}
  if (savedRailCollapsed) root.setAttribute('data-rail-collapsed', 'true');
  if (embedded) root.setAttribute('data-fetcher-embedded', 'true');

  /* -----------------------------------------------------------------------
     Paw cursor
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
     Shell styling
  ----------------------------------------------------------------------- */
  var shellStyle = document.createElement('style');
  shellStyle.id = 'fetcher-shell-runtime';
  shellStyle.textContent =
    '@view-transition{navigation:none;}' +

    'html[data-theme="light"]{--cursor-paw-fixed:url("' + PAW_LIGHT + '") 15 3;}' +
    'html[data-theme="dark"]{--cursor-paw-fixed:url("' + PAW_DARK + '") 15 3;}' +
    'html[data-theme]{cursor:var(--cursor-paw-fixed),auto!important;}' +
    'html[data-theme] body,html[data-theme] .app,html[data-theme] .fetcher-content-host,html[data-theme] .fetcher-page-frame{cursor:inherit!important;}' +
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

    'html .rail,html .rail-btn.active::before{view-transition-name:none!important;}' +

    'html[data-rail-collapsed="true"] .rail{width:64px;flex-basis:64px;}' +
    'html[data-rail-collapsed="true"] .rail .rail-toggle svg{transform:rotate(180deg);}' +
    'html[data-rail-collapsed="true"] .rail .rail-btn span{opacity:0;max-height:0;overflow:hidden;}' +
    'html[data-rail-collapsed="true"] .rail .rail-btn{height:44px;}' +

    'html[data-fetcher-embedded="true"] .rail{display:none!important;}' +
    'html[data-fetcher-embedded="true"] .app{width:100%!important;}' +

    '.fetcher-content-host{position:relative;flex:1 1 auto;min-width:0;height:100%;overflow:hidden;background:var(--bg);}' +
    '.fetcher-content-host>.main{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}' +
    '.fetcher-page-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--bg);opacity:0;transition:opacity 170ms var(--ease);}' +
    '.fetcher-content-host>.fetcher-page-layer{transition:opacity 170ms var(--ease);}' +
    'html[data-motion="reserved"] .fetcher-page-frame,html[data-motion="reserved"] .fetcher-content-host>.fetcher-page-layer{transition-duration:145ms;}' +
    'html[data-motion="reduced"] .fetcher-page-frame,html[data-motion="reduced"] .fetcher-content-host>.fetcher-page-layer{transition-duration:100ms;}' +

    'html[data-nav-pop="true"][data-motion="full"] .rail-btn.active::before{' +
      'animation:fetcher-nav-pop-full 230ms cubic-bezier(.34,1.3,.64,1) both;transform-origin:center;' +
    '}' +
    '@keyframes fetcher-nav-pop-full{0%{opacity:.35;transform:scale(.88);}68%{opacity:1;transform:scale(1.045);}100%{opacity:1;transform:scale(1);}}' +
    'html[data-nav-pop="true"][data-motion="reserved"] .rail-btn.active::before{' +
      'animation:fetcher-nav-pop-reserved 170ms var(--ease) both;transform-origin:center;' +
    '}' +
    '@keyframes fetcher-nav-pop-reserved{from{opacity:.45;transform:scale(.96);}to{opacity:1;transform:scale(1);}}' +
    'html[data-nav-pop="true"][data-motion="reduced"] .rail-btn.active::before{' +
      'animation:fetcher-nav-pop-reduced 100ms var(--ease) both;' +
    '}' +
    '@keyframes fetcher-nav-pop-reduced{from{opacity:.45;}to{opacity:1;}}' +

    'html .trim-handle::before{content:"";position:absolute;inset:-8px;background:transparent;}' +

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
    'html[data-motion="reserved"] .services-panel{transition:grid-template-rows 180ms var(--ease)!important;}' +
    'html[data-motion="reserved"] .chips{transition:transform 180ms var(--ease),opacity 130ms var(--ease)!important;}' +
    'html[data-motion="reserved"] .settings-panel.active,html[data-motion="reserved"] .settings-panel.active.back{' +
      'animation-duration:180ms!important;animation-timing-function:var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .fetch-wrap-inner{transition:transform 180ms var(--ease),opacity 130ms var(--ease)!important;}' +
    'html[data-motion="reserved"] .fetch-wrap.show .fetch-wrap-inner{animation:none!important;}' +
    'html[data-motion="reserved"] .dl-bubble,html[data-motion="reserved"] .kbd-bubble{' +
      'transition-duration:220ms!important;transition-timing-function:var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-bubble-list,html[data-motion="reserved"] .kbd-bubble-list{' +
      'transition:grid-template-rows 220ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-bubble-body,html[data-motion="reserved"] .kbd-bubble-body{' +
      'transition:opacity 130ms var(--ease),transform 180ms var(--ease)!important;' +
    '}' +
    'html[data-motion="reserved"] .dl-count.bump{animation:none!important;}' +
    'html[data-motion="reserved"] .dl-bubble.popping-in{animation:fetcher-reserved-pop-in 180ms var(--ease) both!important;}' +
    '@keyframes fetcher-reserved-pop-in{from{transform:scale(.96);opacity:0;}to{transform:scale(1);opacity:1;}}';

  (document.head || root).appendChild(shellStyle);

  var PAGE_PATHS = {
    '/': true,
    '/project-fetcher.html': true,
    '/image.html': true,
    '/chat.html': true,
    '/settings.html': true,
    '/donate.html': true,
    '/updates.html': true,
    '/about.html': true
  };

  function routePath(url) {
    var path = url.pathname || '/';
    if (path === '/project-fetcher.html') return '/';
    return path;
  }

  function isFetcherPage(url) {
    return !!PAGE_PATHS[url.pathname || '/'];
  }

  function sameRoute(a, b) {
    return routePath(a) === routePath(b) && a.search === b.search;
  }

  function isPlainPrimaryNavigation(ev, link) {
    if (ev.defaultPrevented) return false;
    if (ev.button != null && ev.button !== 0) return false;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
    if (link.target && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;
    return true;
  }

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

  if (embedded) {
    document.addEventListener('click', function (ev) {
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!link || !isPlainPrimaryNavigation(ev, link)) return;
      var destination;
      try { destination = new URL(link.href, window.location.href); } catch (e) { return; }
      if (destination.origin !== window.location.origin || !isFetcherPage(destination)) return;
      ev.preventDefault();
      try {
        window.parent.postMessage({ type: 'fetcher:navigate', href: destination.href }, window.location.origin);
      } catch (e) {}
    }, true);

    document.addEventListener('DOMContentLoaded', function () {
      if (shellStyle.parentNode) document.head.appendChild(shellStyle);
      installReservedMotionOption();
    });
    return;
  }

  var rail = null;
  var railToggle = null;
  var contentHost = null;
  var currentLayer = null;
  var navToken = 0;

  function syncRailToggle() {
    if (!rail || !railToggle) return;
    var collapsed = rail.classList.contains('collapsed');
    railToggle.setAttribute('aria-expanded', String(!collapsed));
    railToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    railToggle.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    if (collapsed) root.setAttribute('data-rail-collapsed', 'true');
    else root.removeAttribute('data-rail-collapsed');
  }

  function restoreRailState() {
    rail = document.getElementById('rail');
    railToggle = document.getElementById('rail-toggle');
    if (!rail || !railToggle) return;
    if (savedRailCollapsed) rail.classList.add('collapsed');
    syncRailToggle();

    railToggle.addEventListener('click', function () {
      window.setTimeout(function () {
        var collapsed = rail.classList.contains('collapsed');
        try { localStorage.setItem(RAIL_KEY, collapsed ? '1' : '0'); } catch (e) {}
        syncRailToggle();
      }, 0);
    });
  }

  function installContentHost() {
    var main = document.querySelector('.app > .main');
    if (!main || !main.parentNode) return;
    contentHost = document.createElement('div');
    contentHost.className = 'fetcher-content-host';
    main.parentNode.insertBefore(contentHost, main);
    contentHost.appendChild(main);
    main.classList.add('fetcher-page-layer');
    currentLayer = main;
  }

  function setRailActive(destination) {
    if (!rail) return;
    var wanted = routePath(destination);
    var links = rail.querySelectorAll('a.rail-btn[href]');
    var active = null;
    Array.prototype.forEach.call(links, function (link) {
      var linkUrl;
      try { linkUrl = new URL(link.href, window.location.href); } catch (e) { return; }
      var selected = routePath(linkUrl) === wanted;
      link.classList.toggle('active', selected);
      if (selected) {
        link.setAttribute('aria-current', 'page');
        active = link;
      } else {
        link.removeAttribute('aria-current');
      }
    });

    if (active) {
      root.removeAttribute('data-nav-pop');
      void active.offsetWidth;
      root.setAttribute('data-nav-pop', 'true');
      window.setTimeout(function () { root.removeAttribute('data-nav-pop'); }, 280);
    }
  }

  function applyParentPrefsFromStorage(event) {
    if (!window.FetcherPrefs || !event || !event.key) return;
    if (event.key === 'fetcher.theme') window.FetcherPrefs.applyTheme();
    else if (event.key === 'fetcher.motion') window.FetcherPrefs.applyMotion();
    else if (event.key === 'fetcher.showShortcuts' || event.key === 'fetcher.showDownloads') {
      window.FetcherPrefs.applyChrome();
    }
  }

  function transitionDuration() {
    var mode = root.getAttribute('data-motion');
    if (mode === 'reduced') return 100;
    if (mode === 'reserved') return 145;
    return 170;
  }

  function routeTo(destination, options) {
    options = options || {};
    if (!contentHost || !isFetcherPage(destination)) {
      window.location.href = destination.href;
      return;
    }

    var currentUrl = new URL(window.location.href);
    if (!options.force && sameRoute(destination, currentUrl)) return;

    var myToken = ++navToken;
    contentHost.setAttribute('aria-busy', 'true');
    setRailActive(destination);

    var frame = document.createElement('iframe');
    frame.className = 'fetcher-page-frame';
    frame.setAttribute('title', 'Fetcher page');
    frame.src = destination.href;
    frame.style.zIndex = String(10 + myToken);
    contentHost.appendChild(frame);

    var fallback = window.setTimeout(function () {
      if (myToken !== navToken) return;
      window.location.href = destination.href;
    }, 12000);

    frame.addEventListener('load', function () {
      if (myToken !== navToken) {
        frame.remove();
        return;
      }
      clearTimeout(fallback);

      try {
        if (frame.contentDocument && frame.contentDocument.title) {
          document.title = frame.contentDocument.title;
          frame.title = frame.contentDocument.title;
        }
      } catch (e) {}

      var old = currentLayer;
      frame.classList.add('fetcher-page-layer');
      requestAnimationFrame(function () {
        frame.style.opacity = '1';
        if (old) old.style.opacity = '0';
      });

      window.setTimeout(function () {
        if (myToken !== navToken) return;
        if (old && old !== frame && old.parentNode === contentHost) old.remove();
        currentLayer = frame;
        contentHost.removeAttribute('aria-busy');
      }, transitionDuration() + 35);
    });

    if (options.push !== false) {
      history.pushState({ fetcherRoute: destination.pathname + destination.search + destination.hash }, '', destination.href);
    }
  }

  function handleRouteClick(ev) {
    var link = ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!link || !isPlainPrimaryNavigation(ev, link)) return;

    var destination;
    try { destination = new URL(link.href, window.location.href); } catch (e) { return; }
    if (destination.origin !== window.location.origin || !isFetcherPage(destination)) return;

    var currentUrl = new URL(window.location.href);
    if (sameRoute(destination, currentUrl)) return;

    ev.preventDefault();
    routeTo(destination, { push: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (shellStyle.parentNode) document.head.appendChild(shellStyle);
    restoreRailState();
    installContentHost();
    installReservedMotionOption();

    document.addEventListener('click', handleRouteClick, true);

    window.addEventListener('message', function (event) {
      if (event.origin !== window.location.origin || !event.data || event.data.type !== 'fetcher:navigate') return;
      var destination;
      try { destination = new URL(event.data.href, window.location.href); } catch (e) { return; }
      if (!isFetcherPage(destination)) return;
      routeTo(destination, { push: true });
    });

    window.addEventListener('popstate', function () {
      routeTo(new URL(window.location.href), { push: false, force: true });
    });

    window.addEventListener('storage', applyParentPrefsFromStorage);
  });
})();