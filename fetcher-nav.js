/*
 * fetcher-nav.js
 * Persistent Fetcher shell: rail state, page-content routing/fades and history.
 * Preference resolution lives in fetcher-prefs.js; presentation/motion lives in
 * fetcher-shell.css; page-specific controllers own their own UI.
 * Secret-name palettes use a deliberate top-right -> bottom-left paint spill,
 * with a readable confirmation beat and a matching colour-drain reset.
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

  var EASTER_WASH_COLORS = {
    light: {
      ailincia: '#FFB6C1',
      vitaviita: '#8993FF',
      stonakah: '#DDB892'
    },
    dark: {
      ailincia: '#4A2733',
      vitaviita: '#26346A',
      stonakah: '#111114'
    }
  };

  var easterStyle = document.createElement('style');
  easterStyle.id = 'fetcher-easter-styles';
  easterStyle.textContent = [
    'html[data-theme="light"][data-easter-palette="ailincia"]{--bg:#FFB6C1;--surface:#FFF0F5;--rail:#FFDAB9;--ink:#2B2024;--ink-strong:#140D10;--ink-soft:#5F414C;--ink-faint:#75515E;--border:#EFA6B3;--border-strong:#D9879B;--accent:#D96F8C;--accent-ink:#733047;--accent-tint:#FFE4E1;--on-accent:#FFFFFF;--audio:#C98A55;--audio-tint:#FFDAB9;--mute:#C96F84;--mute-tint:#FFE4E1;--danger:#B95873;--danger-tint:#FFE4E1;--success:#A66A55;--success-tint:#FFDAB9;--shiba:#D96F8C;--shiba-deep:#B95873;--shiba-cream:#FFDAB9;}',
    'html[data-theme="dark"][data-easter-palette="ailincia"]{--bg:#4A2733;--surface:#2A1920;--rail:#351F28;--ink:#FFF0F5;--ink-strong:#FFFFFF;--ink-soft:#E8C7D0;--ink-faint:#B68B96;--border:#6A3B49;--border-strong:#8D4E60;--accent:#FFB6C1;--accent-ink:#FFDCE3;--accent-tint:rgba(255,182,193,.20);--on-accent:#2B2024;--audio:#FFDAB9;--audio-tint:rgba(255,218,185,.20);}',
    'html[data-theme="light"][data-easter-palette="vitaviita"]{--bg:#8993FF;--surface:#F4FAFF;--rail:#ACCBFF;--ink:#18213E;--ink-strong:#0B1024;--ink-soft:#394566;--ink-faint:#4E5A7E;--border:#93ACFF;--border-strong:#7186E8;--accent:#5368DF;--accent-ink:#273694;--accent-tint:#DBEDFF;--on-accent:#FFFFFF;--audio:#6E89E8;--audio-tint:#DBEDFF;--mute:#7186E8;--mute-tint:#DBEDFF;--danger:#5368DF;--danger-tint:#DBEDFF;--success:#6E89E8;--success-tint:#DBEDFF;--shiba:#8993FF;--shiba-deep:#5368DF;--shiba-cream:#DBEDFF;}',
    'html[data-theme="dark"][data-easter-palette="vitaviita"]{--bg:#26346A;--surface:#151D3B;--rail:#1C274F;--ink:#F4FAFF;--ink-strong:#FFFFFF;--ink-soft:#CFDCF6;--ink-faint:#91A3CC;--border:#405487;--border-strong:#586FA8;--accent:#8993FF;--accent-ink:#D5DEFF;--accent-tint:rgba(137,147,255,.22);--on-accent:#101634;--audio:#ACCBFF;--audio-tint:rgba(172,203,255,.20);}',
    'html[data-theme="light"][data-easter-palette="stonakah"]{--bg:#DDB892;--surface:#EDE0D4;--rail:#B08968;--ink:#3B261A;--ink-strong:#24140D;--ink-soft:#5B3A28;--ink-faint:#704B35;--border:#9C6644;--border-strong:#7F5539;--accent:#9C6644;--accent-ink:#6B402A;--accent-tint:#E6CCB2;--on-accent:#FFF9F3;--audio:#7F5539;--audio-tint:#DDB892;--mute:#B08968;--mute-tint:#E6CCB2;--danger:#9C6644;--danger-tint:#E6CCB2;--success:#7F5539;--success-tint:#E6CCB2;--shiba:#B08968;--shiba-deep:#7F5539;--shiba-cream:#E6CCB2;}',
    'html[data-theme="dark"][data-easter-palette="stonakah"]{--bg:#111114;--surface:#1C171A;--rail:#18243B;--ink:#F4EEE9;--ink-strong:#FFFFFF;--ink-soft:#C6B7B0;--ink-faint:#877771;--border:#3A2B31;--border-strong:#563942;--accent:#8D2947;--accent-ink:#F0A6B9;--accent-tint:rgba(141,41,71,.24);--on-accent:#FFFFFF;--audio:#35527F;--audio-tint:rgba(53,82,127,.30);--mute:#8A604A;--mute-tint:rgba(138,96,74,.24);}',
    '#url-input.fetcher-easter-confirmation{color:var(--ink)!important;opacity:1!important;-webkit-text-fill-color:var(--ink)!important;font-weight:500;}',
    '.fetcher-easter-wash{position:fixed;left:50%;top:50%;width:230vmax;height:170vmax;z-index:10000;pointer-events:none;opacity:1;transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);transform-origin:center;transition:opacity 560ms cubic-bezier(.16,1,.3,1);will-change:transform,opacity;}',
    '.fetcher-easter-wash.is-color{background:var(--easter-wash-bg,#fff);}',
    '.fetcher-easter-lobe{position:absolute;bottom:-22vmax;width:94vmax;height:44vmax;border-radius:50%;background:var(--easter-wash-bg,#fff);}',
    '.fetcher-easter-lobe:nth-child(1){left:-3vmax;bottom:-18vmax;width:92vmax;height:39vmax;}',
    '.fetcher-easter-lobe:nth-child(2){left:67vmax;bottom:-24vmax;width:100vmax;height:48vmax;}',
    '.fetcher-easter-lobe:nth-child(3){left:143vmax;bottom:-17vmax;width:92vmax;height:38vmax;}',
    '.fetcher-easter-wash.is-drain,.fetcher-easter-wash.is-drain .fetcher-easter-lobe{background:rgba(128,128,128,.012);-webkit-backdrop-filter:grayscale(1) saturate(0);backdrop-filter:grayscale(1) saturate(0);}',
    '.fetcher-easter-wash.in{animation:fetcher-easter-spill-full 1900ms cubic-bezier(.18,.82,.22,1) both;}',
    '@keyframes fetcher-easter-spill-full{0%{transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);}70%{transform:translate(-50%,-50%) rotate(45deg) translateY(-24vmax);}87%{transform:translate(-50%,-50%) rotate(45deg) translateY(2.5vmax);}95%{transform:translate(-50%,-50%) rotate(45deg) translateY(-.7vmax);}100%{transform:translate(-50%,-50%) rotate(45deg) translateY(0);}}',
    '.fetcher-easter-wash.out{opacity:0;}',
    'html[data-motion="reserved"] .fetcher-easter-wash{transition:opacity 360ms var(--ease);}',
    'html[data-motion="reserved"] .fetcher-easter-wash.in{animation:fetcher-easter-spill-reserved 1240ms var(--ease) both;}',
    '@keyframes fetcher-easter-spill-reserved{from{transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);}to{transform:translate(-50%,-50%) rotate(45deg) translateY(0);}}',
    'html[data-motion="reduced"] .fetcher-easter-wash{left:0;top:0;width:100%;height:100%;transform:none!important;opacity:0;transition:opacity 180ms linear;animation:none!important;}',
    'html[data-motion="reduced"] .fetcher-easter-lobe{display:none;}',
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
    if (motion === 'reduced') return { hold: 300, wash: 180, settle: 180 };
    if (motion === 'reserved') return { hold: 320, wash: 1240, settle: 360 };
    return { hold: 620, wash: 1900, settle: 560 };
  }

  function easterWashColor(name) {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return EASTER_WASH_COLORS[theme][name] || '';
  }

  function runEasterTransition(name) {
    name = EASTER_WASH_COLORS.light[name] ? name : '';
    var reset = !name;
    var timings = easterTimings();

    return new Promise(function (resolve) {
      if (!document.body || !window.FetcherPrefs || !FetcherPrefs.setEasterPalette) {
        if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(name);
        resolve();
        return;
      }

      var overlay = document.createElement('div');
      overlay.className = 'fetcher-easter-wash ' + (reset ? 'is-drain' : 'is-color');
      overlay.setAttribute('aria-hidden', 'true');
      if (!reset) overlay.style.setProperty('--easter-wash-bg', easterWashColor(name));
      for (var i = 0; i < 3; i += 1) {
        var lobe = document.createElement('span');
        lobe.className = 'fetcher-easter-lobe';
        overlay.appendChild(lobe);
      }
      document.body.appendChild(overlay);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { overlay.classList.add('in'); });
      });

      window.setTimeout(function () {
        FetcherPrefs.setEasterPalette(name);

        /* Keep the paint fully opaque while the completed palette paints behind it.
           Two frames later, dissolve the paint so the new page emerges through it. */
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            overlay.classList.add('out');
            window.setTimeout(function () {
              if (overlay.parentNode) overlay.remove();
              resolve();
            }, timings.settle + 60);
          });
        });
      }, timings.wash);
    });
  }

  window.FetcherEaster = { transitionTo: runEasterTransition };

  var easterBusy = false;

  function runSecret(secret) {
    if (!secret || easterBusy) return;
    var input = document.getElementById('url-input');
    var fetchBtn = document.getElementById('fetch-btn');
    var pasteBtn = document.getElementById('paste-btn');
    var fetchWrap = document.getElementById('fetch-wrap');
    if (!input || !fetchBtn) return;

    easterBusy = true;
    if (window.FetcherTrimmer && window.FetcherTrimmer.close) window.FetcherTrimmer.close();

    var wasReadOnly = input.readOnly;
    input.readOnly = true;
    input.classList.add('fetcher-easter-confirmation');
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
    var timings = easterTimings();
    var transition = new Promise(function (resolve) { window.setTimeout(resolve, timings.hold); }).then(function () {
      return controller && controller.transitionTo
        ? controller.transitionTo(secret.palette)
        : Promise.resolve().then(function () {
            if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(secret.palette);
          });
    });

    Promise.resolve(transition).catch(function () {
      if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(secret.palette);
    }).then(function () {
      if (window.FetcherPrefs && FetcherPrefs.applyEasterPalette) FetcherPrefs.applyEasterPalette();
      input.value = '';
      input.readOnly = wasReadOnly;
      input.classList.remove('fetcher-easter-confirmation');
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
