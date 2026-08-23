/*
 * fetcher-nav.js
 * Persistent Fetcher shell: rail state, page-content routing/fades and history.
 * Preference resolution lives in fetcher-prefs.js; presentation/motion lives in
 * fetcher-shell.css; page-specific controllers own their own UI.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

  function cssDuration(name, fallback) {
    var raw = '';
    try { raw = getComputedStyle(root).getPropertyValue(name).trim(); } catch (e) {}
    if (!raw) return fallback;
    if (/ms$/i.test(raw)) return Math.max(0, parseFloat(raw) || fallback);
    if (/s$/i.test(raw)) return Math.max(0, (parseFloat(raw) || 0) * 1000);
    return Math.max(0, parseFloat(raw) || fallback);
  }

  /* -----------------------------------------------------------------------
     Secret name palettes
  ----------------------------------------------------------------------- */
  var EASTER_NAMES = {
    ailincia: 'ailincia',
    vitaviita: 'vitaviita',
    stonakah: 'stonakah',
    fetcher: ''
  };

  var EASTER_WASHES = {
    ailincia: 'linear-gradient(135deg,#FFB6C1 0%,#FFDAB9 28%,#FFE4E1 52%,#FFF0F5 76%,#FAEBD7 100%)',
    vitaviita: 'linear-gradient(135deg,#F4FAFF 0%,#DBEDFF 24%,#ACCBFF 50%,#93ACFF 74%,#8993FF 100%)',
    stonakah: 'linear-gradient(135deg,#111114 0%,#6E1F34 34%,#6B4A3A 66%,#18243B 100%)'
  };

  var easterStyle = document.createElement('style');
  easterStyle.id = 'fetcher-easter-styles';
  easterStyle.textContent = [
    'html[data-theme="light"][data-easter-palette="ailincia"]{--bg:#FFF0F5;--surface:#FFF8FA;--rail:#FAEBD7;--ink:#2B2024;--ink-strong:#140D10;--ink-soft:#725A62;--ink-faint:#A27F8A;--border:#FFDAB9;--border-strong:#FFB6C1;--accent:#FFB6C1;--accent-ink:#87384F;--accent-tint:#FFE4E1;--on-accent:#2B2024;--audio:#E5A873;--audio-tint:#FFDAB9;}',
    'html[data-theme="dark"][data-easter-palette="ailincia"]{--bg:#1A1216;--surface:#261A20;--rail:#21151A;--ink:#FFF0F5;--ink-strong:#FFFFFF;--ink-soft:#E8C7D0;--ink-faint:#A77C88;--border:#4D3039;--border-strong:#70424F;--accent:#FFB6C1;--accent-ink:#FFDCE3;--accent-tint:rgba(255,182,193,.18);--on-accent:#2B2024;--audio:#FFDAB9;--audio-tint:rgba(255,218,185,.18);}',
    'html[data-theme="light"][data-easter-palette="vitaviita"]{--bg:#F4FAFF;--surface:#FBFDFF;--rail:#DBEDFF;--ink:#18213E;--ink-strong:#0B1024;--ink-soft:#566384;--ink-faint:#8390B1;--border:#C7DDFF;--border-strong:#ACCBFF;--accent:#8993FF;--accent-ink:#3949B7;--accent-tint:#DBEDFF;--on-accent:#101634;--audio:#93ACFF;--audio-tint:#DCE7FF;}',
    'html[data-theme="dark"][data-easter-palette="vitaviita"]{--bg:#0F1425;--surface:#161D35;--rail:#121A30;--ink:#F4FAFF;--ink-strong:#FFFFFF;--ink-soft:#C6D5F4;--ink-faint:#7C8DB5;--border:#293858;--border-strong:#3D527D;--accent:#8993FF;--accent-ink:#C7D4FF;--accent-tint:rgba(137,147,255,.20);--on-accent:#101634;--audio:#ACCBFF;--audio-tint:rgba(172,203,255,.18);}',
    'html[data-theme="light"][data-easter-palette="stonakah"]{--bg:#F4EFEA;--surface:#FBF8F5;--rail:#E8DED4;--ink:#171316;--ink-strong:#050506;--ink-soft:#625451;--ink-faint:#8B7771;--border:#D7C5B9;--border-strong:#B9A08F;--accent:#7A2138;--accent-ink:#5B162A;--accent-tint:#EAD6DC;--on-accent:#FFFFFF;--audio:#223654;--audio-tint:#DCE3EC;--mute:#7A503D;--mute-tint:#E8DAD2;}',
    'html[data-theme="dark"][data-easter-palette="stonakah"]{--bg:#0D0D10;--surface:#17151A;--rail:#11131A;--ink:#F4EEE9;--ink-strong:#FFFFFF;--ink-soft:#BDAFA9;--ink-faint:#776B67;--border:#30272A;--border-strong:#49373A;--accent:#8D2947;--accent-ink:#F0A6B9;--accent-tint:rgba(141,41,71,.22);--on-accent:#FFFFFF;--audio:#2E466E;--audio-tint:rgba(46,70,110,.28);--mute:#8A604A;--mute-tint:rgba(138,96,74,.22);}',
    '.fetcher-easter-wash{position:fixed;inset:0;z-index:10000;pointer-events:none;opacity:1;clip-path:circle(0 at var(--easter-x,50%) var(--easter-y,50%));transition:clip-path 560ms cubic-bezier(.16,.84,.44,1),opacity 180ms var(--ease);will-change:clip-path,opacity;}',
    '.fetcher-easter-wash.is-color{background:var(--easter-wash-bg,#fff);}',
    '.fetcher-easter-wash.is-drain{background:rgba(128,128,128,.025);-webkit-backdrop-filter:grayscale(1) saturate(0);backdrop-filter:grayscale(1) saturate(0);}',
    '.fetcher-easter-wash.in{clip-path:circle(150vmax at var(--easter-x,50%) var(--easter-y,50%));}',
    '.fetcher-easter-wash.out{opacity:0;}',
    'html[data-motion="reserved"] .fetcher-easter-wash{transition:clip-path 360ms var(--ease),opacity 150ms var(--ease);}',
    'html[data-motion="reduced"] .fetcher-easter-wash{clip-path:none!important;opacity:0;transition:opacity 120ms linear;}',
    'html[data-motion="reduced"] .fetcher-easter-wash.in{opacity:1;}',
    'html[data-motion="reduced"] .fetcher-easter-wash.out{opacity:0;}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(easterStyle);

  function easterSecret(value) {
    var key = String(value || '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(EASTER_NAMES, key)) return null;
    return { key: key, palette: EASTER_NAMES[key], reset: key === 'fetcher' };
  }

  function easterTimings() {
    var motion = root.getAttribute('data-motion') || 'full';
    if (motion === 'reduced') return { wash: 120, settle: 100 };
    if (motion === 'reserved') return { wash: 360, settle: 150 };
    return { wash: 560, settle: 180 };
  }

  function runEasterTransition(name, origin) {
    name = EASTER_WASHES[name] ? name : '';
    var reset = !name;
    var timings = easterTimings();
    var x = origin && Number.isFinite(origin.x) ? origin.x : window.innerWidth / 2;
    var y = origin && Number.isFinite(origin.y) ? origin.y : window.innerHeight / 2;

    return new Promise(function (resolve) {
      if (!document.body || !window.FetcherPrefs || !FetcherPrefs.setEasterPalette) {
        if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(name);
        resolve();
        return;
      }

      var overlay = document.createElement('div');
      overlay.className = 'fetcher-easter-wash ' + (reset ? 'is-drain' : 'is-color');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.setProperty('--easter-x', Math.round(x) + 'px');
      overlay.style.setProperty('--easter-y', Math.round(y) + 'px');
      if (!reset) overlay.style.setProperty('--easter-wash-bg', EASTER_WASHES[name]);
      document.body.appendChild(overlay);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { overlay.classList.add('in'); });
      });

      window.setTimeout(function () {
        FetcherPrefs.setEasterPalette(name);
        overlay.classList.add('out');
        window.setTimeout(function () {
          if (overlay.parentNode) overlay.remove();
          resolve();
        }, timings.settle + 40);
      }, timings.wash);
    });
  }

  window.FetcherEaster = { transitionTo: runEasterTransition };

  var easterBusy = false;

  function secretOrigin(input) {
    var rect = input.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    try {
      if (window.frameElement) {
        var frameRect = window.frameElement.getBoundingClientRect();
        x += frameRect.left;
        y += frameRect.top;
      }
    } catch (e) {}
    return { x: x, y: y };
  }

  function runSecret(secret) {
    if (!secret || easterBusy) return;
    var input = document.getElementById('url-input');
    var fetchBtn = document.getElementById('fetch-btn');
    var pasteBtn = document.getElementById('paste-btn');
    var fetchWrap = document.getElementById('fetch-wrap');
    if (!input || !fetchBtn) return;

    easterBusy = true;
    if (window.FetcherTrimmer && window.FetcherTrimmer.close) window.FetcherTrimmer.close();

    input.disabled = true;
    fetchBtn.disabled = true;
    if (pasteBtn) pasteBtn.disabled = true;
    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function (btn) { btn.disabled = true; });

    input.value = secret.reset ? 'back to fetcher.' : 'found you.';
    if (fetchWrap) fetchWrap.classList.add('show');

    var host = window;
    try {
      if (window.parent && window.parent !== window && window.parent.FetcherEaster) host = window.parent;
    } catch (e) {}
    var controller = host.FetcherEaster || window.FetcherEaster;
    var transition = controller && controller.transitionTo
      ? controller.transitionTo(secret.palette, secretOrigin(input))
      : Promise.resolve().then(function () {
          if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(secret.palette);
        });

    Promise.resolve(transition).catch(function () {
      if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(secret.palette);
    }).then(function () {
      if (window.FetcherPrefs && FetcherPrefs.applyEasterPalette) FetcherPrefs.applyEasterPalette();
      input.value = '';
      input.disabled = false;
      fetchBtn.disabled = false;
      if (pasteBtn) pasteBtn.disabled = false;
      Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function (btn) { btn.disabled = false; });
      if (fetchWrap) fetchWrap.classList.remove('show');
      easterBusy = false;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || easterBusy) return;
    var input = document.getElementById('url-input');
    if (!input || document.activeElement !== input) return;
    var secret = easterSecret(input.value);
    if (!secret) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runSecret(secret);
  }, true);

  document.addEventListener('click', function (event) {
    if (easterBusy) return;
    var target = event.target && event.target.closest ? event.target.closest('#fetch-btn') : null;
    if (!target) return;
    var input = document.getElementById('url-input');
    if (!input) return;
    var secret = easterSecret(input.value);
    if (!secret) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runSecret(secret);
  }, true);

  /* -----------------------------------------------------------------------
     Persistent rail state
  ----------------------------------------------------------------------- */
  var RAIL_KEY = 'fetcher.railCollapsed';
  var savedRailCollapsed = false;
  try { savedRailCollapsed = localStorage.getItem(RAIL_KEY) === '1'; } catch (e) {}
  if (savedRailCollapsed) root.setAttribute('data-rail-collapsed', 'true');
  if (embedded) root.setAttribute('data-fetcher-embedded', 'true');

  /* -----------------------------------------------------------------------
     Route helpers
  ----------------------------------------------------------------------- */
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
    return path === '/project-fetcher.html' ? '/' : path;
  }

  function isFetcherPage(url) {
    return !!PAGE_PATHS[url.pathname || '/'];
  }

  function sameRoute(a, b) {
    return routePath(a) === routePath(b) && a.search === b.search && a.hash === b.hash;
  }

  function isPlainPrimaryNavigation(event, link) {
    if (event.defaultPrevented) return false;
    if (event.button != null && event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;
    return true;
  }

  /* Embedded pages hand same-origin Fetcher navigation back to the parent. */
  if (embedded) {
    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || !isPlainPrimaryNavigation(event, link)) return;

      var destination;
      try { destination = new URL(link.href, window.location.href); } catch (e) { return; }
      if (destination.origin !== window.location.origin || !isFetcherPage(destination)) return;

      event.preventDefault();
      try {
        window.parent.postMessage({ type: 'fetcher:navigate', href: destination.href }, window.location.origin);
      } catch (e) {}
    }, true);
    return;
  }

  /* -----------------------------------------------------------------------
     Parent shell
  ----------------------------------------------------------------------- */
  var rail = null;
  var railToggle = null;
  var contentHost = null;
  var currentLayer = null;
  var navToken = 0;
  var navPopTimer = null;

  function railIsCollapsed() {
    return !!(rail && rail.classList.contains('collapsed'));
  }

  function syncRailState() {
    if (!rail || !railToggle) return;
    var collapsed = railIsCollapsed();

    railToggle.setAttribute('aria-expanded', String(!collapsed));
    railToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    railToggle.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');

    if (collapsed) root.setAttribute('data-rail-collapsed', 'true');
    else root.removeAttribute('data-rail-collapsed');

    try { localStorage.setItem(RAIL_KEY, collapsed ? '1' : '0'); } catch (e) {}
  }

  function restoreRailState() {
    rail = document.getElementById('rail');
    railToggle = document.getElementById('rail-toggle');
    if (!rail || !railToggle) return;

    rail.classList.toggle('collapsed', savedRailCollapsed);
    syncRailState();

    railToggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rail.classList.toggle('collapsed');
      syncRailState();
    }, true);
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

    if (!active) return;
    if (navPopTimer) clearTimeout(navPopTimer);
    root.removeAttribute('data-nav-pop');

    requestAnimationFrame(function () {
      root.setAttribute('data-nav-pop', 'true');
      navPopTimer = window.setTimeout(function () {
        root.removeAttribute('data-nav-pop');
        navPopTimer = null;
      }, cssDuration('--shell-nav-pop', 230) + 40);
    });
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
      if (myToken === navToken) window.location.href = destination.href;
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
      }, cssDuration('--shell-page-fade', 170) + 35);
    });

    if (options.push !== false) {
      history.pushState(
        { fetcherRoute: destination.pathname + destination.search + destination.hash },
        '',
        destination.href
      );
    }
  }

  function handleRouteClick(event) {
    var link = event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || !isPlainPrimaryNavigation(event, link)) return;

    var destination;
    try { destination = new URL(link.href, window.location.href); } catch (e) { return; }
    if (destination.origin !== window.location.origin || !isFetcherPage(destination)) return;

    var currentUrl = new URL(window.location.href);
    if (sameRoute(destination, currentUrl)) return;

    event.preventDefault();
    routeTo(destination, { push: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    restoreRailState();
    installContentHost();
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
  });
})();
