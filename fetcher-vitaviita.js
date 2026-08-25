/* Vitaviita-only ambience: icy-blue ripple rings that persist across Fetcher's routed pages. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;

  var layer = null;
  var renderTimer = null;
  var MAX_RIPPLES = 3;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function active() {
    return root.getAttribute('data-easter-palette') === 'vitaviita' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function masterActive() {
    try {
      var masterRoot = topWindow.document.documentElement;
      return masterRoot.getAttribute('data-easter-palette') === 'vitaviita' &&
        masterRoot.getAttribute('data-motion') !== 'reduced';
    } catch (e) {
      return active();
    }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherVitaviitaShared) {
        topWindow.FetcherVitaviitaShared = {
          ripples: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherVitaviitaShared;
    } catch (e) {
      if (!window.FetcherVitaviitaShared) {
        window.FetcherVitaviitaShared = {
          ripples: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return window.FetcherVitaviitaShared;
    }
  }

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.ripples = shared.ripples.filter(function (ripple) {
      return now < ripple.bornAt + ripple.duration + 700;
    });
  }

  function makeRippleModel(delay) {
    var shared = sharedState();
    return {
      id: shared.nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(4300, 5900),
      left: rand(10, 90),
      top: rand(11, 86),
      size: rand(120, 220),
      opacity: rand(.58, .76),
      tilt: rand(-4, 4)
    };
  }

  function addSharedRipple(delay) {
    if (!isMaster || !masterActive()) return;
    var shared = sharedState();
    pruneShared();
    if (shared.ripples.length >= MAX_RIPPLES) return;
    shared.ripples.push(makeRippleModel(delay || 0));
  }

  function scheduleSharedSpawn() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive()) return;
    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive()) return;
      addSharedRipple(0);
      scheduleSharedSpawn();
    }, rand(2300, 3700));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.ripples = [];
    addSharedRipple(0);
    addSharedRipple(1150);
    scheduleSharedSpawn();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.ripples = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive()) startShared();
    else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-vitaviita-ripple-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-vitaviita-ripple-styles';
    style.textContent = [
      'html[data-easter-palette="vitaviita"] .fetcher-ambient-ripple{display:none!important;}',
      '.fetcher-vitaviita-ripples{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="vitaviita"] .main>.stage,html[data-easter-palette="vitaviita"] .main>.foot,html[data-easter-palette="vitaviita"] .main>.settings-nav,html[data-easter-palette="vitaviita"] .main>.settings-content,html[data-easter-palette="vitaviita"] .main>.about,html[data-easter-palette="vitaviita"] .main>.donate,html[data-easter-palette="vitaviita"] .main>.updates,html[data-easter-palette="vitaviita"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-vitaviita-ripple{position:absolute;left:var(--ripple-left);top:var(--ripple-top);width:var(--ripple-size);height:var(--ripple-size);transform:translate(-50%,-50%) rotate(var(--ripple-tilt));pointer-events:none;}',
      '.fetcher-vitaviita-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(202,226,255,.88);opacity:0;box-shadow:0 0 22px rgba(132,171,255,.24),inset 0 0 18px rgba(236,247,255,.18);animation:fetcher-vitaviita-ring var(--ripple-duration) cubic-bezier(.18,.7,.28,1) var(--ripple-delay) both;}',
      '.fetcher-vitaviita-ring.second{inset:16%;border-width:1.5px;border-color:rgba(225,240,255,.78);box-shadow:0 0 18px rgba(177,206,255,.18),inset 0 0 14px rgba(245,251,255,.16);animation-delay:calc(var(--ripple-delay) + 260ms);}',
      '@keyframes fetcher-vitaviita-ring{0%{opacity:0;transform:scale(.08);}9%{opacity:var(--ripple-opacity);}48%{opacity:.46;}82%{opacity:.20;}100%{opacity:0;transform:scale(1);}}',
      'html[data-motion="reduced"] .fetcher-vitaviita-ripples{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function rippleHost() {
    return document.querySelector('.main') || document.body;
  }

  function ensureLayer() {
    var host = rippleHost();
    if (!host) return null;
    if (layer && layer.isConnected && layer.parentNode === host) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-vitaviita-ripples';
    layer.setAttribute('aria-hidden', 'true');
    host.insertBefore(layer, host.firstChild);
    return layer;
  }

  function createRippleNode(model) {
    var node = document.createElement('span');
    node.className = 'fetcher-vitaviita-ripple';
    node.setAttribute('data-ripple-id', String(model.id));
    node.style.setProperty('--ripple-left', model.left + '%');
    node.style.setProperty('--ripple-top', model.top + '%');
    node.style.setProperty('--ripple-size', model.size + 'px');
    node.style.setProperty('--ripple-opacity', model.opacity.toFixed(2));
    node.style.setProperty('--ripple-tilt', model.tilt + 'deg');
    node.style.setProperty('--ripple-duration', model.duration + 'ms');
    node.style.setProperty('--ripple-delay', (-(Date.now() - model.bornAt)) + 'ms');

    var ring = document.createElement('span');
    ring.className = 'fetcher-vitaviita-ring';
    node.appendChild(ring);

    var second = document.createElement('span');
    second.className = 'fetcher-vitaviita-ring second';
    node.appendChild(second);

    return node;
  }

  function syncRenderedRipples() {
    window.clearTimeout(renderTimer);
    renderTimer = null;

    if (!active()) {
      if (layer) layer.replaceChildren();
      return;
    }

    ensureStyles();
    var host = ensureLayer();
    if (!host) return;
    pruneShared();

    var shared = sharedState();
    var liveIds = {};
    var now = Date.now();

    shared.ripples.forEach(function (model) {
      if (now >= model.bornAt + model.duration + 600) return;
      liveIds[String(model.id)] = true;
      if (!host.querySelector('[data-ripple-id="' + model.id + '"]')) {
        host.appendChild(createRippleNode(model));
      }
    });

    Array.prototype.forEach.call(host.querySelectorAll('.fetcher-vitaviita-ripple'), function (node) {
      if (!liveIds[node.getAttribute('data-ripple-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRenderedRipples, 180);
  }

  function stopRenderer() {
    window.clearTimeout(renderTimer);
    renderTimer = null;
    if (layer) layer.replaceChildren();
  }

  function startRenderer() {
    stopRenderer();
    if (!active()) return;
    ensureStyles();
    ensureLayer();
    syncRenderedRipples();
  }

  document.addEventListener('fetcher:easter-change', function () {
    syncMasterActivity();
    if (active()) startRenderer();
    else stopRenderer();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    syncMasterActivity();
    if (active()) startRenderer();
    else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncMasterActivity();
      if (active()) {
        if (!renderTimer) startRenderer();
      } else {
        stopRenderer();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-motion'] });
  }

  function init() {
    ensureStyles();
    syncMasterActivity();
    if (active()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
