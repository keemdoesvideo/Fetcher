/* Suki-only ambience: lavender crescent moons that gently drift near the page edges. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;

  var layer = null;
  var renderTimer = null;
  var MAX_MOONS = 4;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function active() {
    return root.getAttribute('data-easter-palette') === 'suki' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function masterActive() {
    try {
      var masterRoot = topWindow.document.documentElement;
      return masterRoot.getAttribute('data-easter-palette') === 'suki' &&
        masterRoot.getAttribute('data-motion') !== 'reduced';
    } catch (e) {
      return active();
    }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherSukiShared) {
        topWindow.FetcherSukiShared = {
          moons: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherSukiShared;
    } catch (e) {
      if (!window.FetcherSukiShared) {
        window.FetcherSukiShared = {
          moons: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return window.FetcherSukiShared;
    }
  }

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.moons = shared.moons.filter(function (moon) {
      return now < moon.bornAt + moon.duration + 700;
    });
  }

  function makeMoonModel(delay) {
    var edge = Math.floor(Math.random() * 4);
    var left;
    var top;

    if (edge === 0) {
      left = rand(2.5, 9.5);
      top = rand(12, 86);
    } else if (edge === 1) {
      left = rand(90.5, 97.5);
      top = rand(12, 86);
    } else if (edge === 2) {
      left = rand(12, 88);
      top = rand(2.5, 10);
    } else {
      left = rand(12, 88);
      top = rand(88, 96);
    }

    var shared = sharedState();
    var rotate = rand(-8, 8);
    var starSide = Math.random() < .5 ? -1 : 1;
    return {
      id: shared.nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(5400, 7600),
      left: left,
      top: top,
      size: rand(27, 42),
      opacity: rand(.58, .78),
      driftX: rand(-15, 15),
      driftY: rand(-11, 11),
      rotate: rotate,
      endRotate: -rotate,
      hasStar: Math.random() < .52,
      starX: starSide * rand(10, 17)
    };
  }

  function addSharedMoon(delay) {
    if (!isMaster || !masterActive()) return;
    var shared = sharedState();
    pruneShared();
    if (shared.moons.length >= MAX_MOONS) return;
    shared.moons.push(makeMoonModel(delay || 0));
  }

  function scheduleSharedSpawn() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive()) return;
    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive()) return;
      addSharedMoon(0);
      scheduleSharedSpawn();
    }, rand(1900, 3200));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.moons = [];
    addSharedMoon(0);
    addSharedMoon(900);
    scheduleSharedSpawn();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.moons = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive()) startShared();
    else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-suki-moon-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-suki-moon-styles';
    style.textContent = [
      'html[data-easter-palette="suki"] .fetcher-ambient-crescent{display:none!important;}',
      '.fetcher-suki-moons{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="suki"] .main>.stage,html[data-easter-palette="suki"] .main>.foot,html[data-easter-palette="suki"] .main>.settings-nav,html[data-easter-palette="suki"] .main>.settings-content,html[data-easter-palette="suki"] .main>.about,html[data-easter-palette="suki"] .main>.donate,html[data-easter-palette="suki"] .main>.updates,html[data-easter-palette="suki"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-suki-moon{position:absolute;left:var(--moon-left);top:var(--moon-top);font-family:Georgia,"Times New Roman",serif;font-size:var(--moon-size);line-height:1;color:rgba(231,218,246,.94);opacity:0;text-shadow:0 0 12px rgba(224,204,248,.28),0 0 24px rgba(178,144,211,.16);transform-origin:center;animation:fetcher-suki-moon var(--moon-duration) cubic-bezier(.45,0,.55,1) var(--moon-delay) both;}',
      '.fetcher-suki-star{position:absolute;left:calc(50% + var(--star-x));top:-5px;font-family:Georgia,"Times New Roman",serif;font-size:9px;line-height:1;color:rgba(243,234,255,.92);text-shadow:0 0 9px rgba(230,212,255,.42);opacity:0;animation:fetcher-suki-star var(--moon-duration) ease-in-out var(--moon-delay) both;}',
      '@keyframes fetcher-suki-moon{0%{opacity:0;transform:translate(0,0) rotate(var(--moon-rotate)) scale(.9);}15%{opacity:var(--moon-opacity);}48%{opacity:var(--moon-opacity);transform:translate(var(--moon-drift-x),var(--moon-drift-y)) rotate(0deg) scale(1.02);}82%{opacity:.48;}100%{opacity:0;transform:translate(0,0) rotate(var(--moon-end-rotate)) scale(.96);}}',
      '@keyframes fetcher-suki-star{0%,18%{opacity:0;transform:scale(.5) rotate(0deg);}30%{opacity:.9;transform:scale(1.08) rotate(12deg);}56%{opacity:.55;transform:scale(.92) rotate(24deg);}76%,100%{opacity:0;transform:scale(.6) rotate(36deg);}}',
      'html[data-motion="reduced"] .fetcher-suki-moons{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function moonHost() {
    return document.querySelector('.main') || document.body;
  }

  function ensureLayer() {
    var host = moonHost();
    if (!host) return null;
    if (layer && layer.isConnected && layer.parentNode === host) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-suki-moons';
    layer.setAttribute('aria-hidden', 'true');
    host.insertBefore(layer, host.firstChild);
    return layer;
  }

  function createMoonNode(model) {
    var node = document.createElement('span');
    node.className = 'fetcher-suki-moon';
    node.setAttribute('data-moon-id', String(model.id));
    node.textContent = '☾';
    node.style.setProperty('--moon-left', model.left + '%');
    node.style.setProperty('--moon-top', model.top + '%');
    node.style.setProperty('--moon-size', model.size + 'px');
    node.style.setProperty('--moon-opacity', model.opacity.toFixed(2));
    node.style.setProperty('--moon-drift-x', model.driftX + 'px');
    node.style.setProperty('--moon-drift-y', model.driftY + 'px');
    node.style.setProperty('--moon-rotate', model.rotate + 'deg');
    node.style.setProperty('--moon-end-rotate', model.endRotate + 'deg');
    node.style.setProperty('--moon-duration', model.duration + 'ms');
    node.style.setProperty('--moon-delay', (-(Date.now() - model.bornAt)) + 'ms');

    if (model.hasStar) {
      var star = document.createElement('span');
      star.className = 'fetcher-suki-star';
      star.textContent = '✦';
      star.style.setProperty('--star-x', model.starX + 'px');
      node.appendChild(star);
    }

    return node;
  }

  function syncRenderedMoons() {
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

    shared.moons.forEach(function (model) {
      if (now >= model.bornAt + model.duration + 600) return;
      liveIds[String(model.id)] = true;
      if (!host.querySelector('[data-moon-id="' + model.id + '"]')) {
        host.appendChild(createMoonNode(model));
      }
    });

    Array.prototype.forEach.call(host.querySelectorAll('.fetcher-suki-moon'), function (node) {
      if (!liveIds[node.getAttribute('data-moon-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRenderedMoons, 180);
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
    syncRenderedMoons();
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
