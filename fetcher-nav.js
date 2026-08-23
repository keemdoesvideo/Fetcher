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
