/* Stonakah-only ambience: occasional kraft-paper planes gliding behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function active() {
    return root.getAttribute('data-easter-palette') === 'stonakah';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function masterActive() {
    try {
      return topWindow.document.documentElement.getAttribute('data-easter-palette') === 'stonakah';
    } catch (e) { return active(); }
  }

  function masterReducedMotion() {
    try {
      return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced';
    } catch (e) { return reducedMotion(); }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherStonakahPlanesShared) {
        topWindow.FetcherStonakahPlanesShared = {
          planes: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherStonakahPlanesShared;
    } catch (e) {
      if (!window.FetcherStonakahPlanesShared) {
        window.FetcherStonakahPlanesShared = {
          planes: [], nextId: 1, spawnTimer: null, running: false
        };
      }
      return window.FetcherStonakahPlanesShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-stonakah-styles')) return;

    var style = document.createElement('style');
    style.id = 'fetcher-stonakah-styles';
    style.textContent = [
      'html[data-easter-palette="stonakah"] .fetcher-ember-trail,html[data-easter-palette="stonakah"] .fetcher-ember-dot{display:none!important;}',
      '.fetcher-stonakah-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="stonakah"] .main>.stage,html[data-easter-palette="stonakah"] .main>.foot,html[data-easter-palette="stonakah"] .main>.settings-nav,html[data-easter-palette="stonakah"] .main>.settings-content,html[data-easter-palette="stonakah"] .main>.about,html[data-easter-palette="stonakah"] .main>.donate,html[data-easter-palette="stonakah"] .main>.updates,html[data-easter-palette="stonakah"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-stonakah-plane{position:absolute;left:var(--stone-start-x);top:var(--stone-start-y);width:var(--stone-plane-w);height:auto;opacity:0;transform-origin:52% 48%;animation:fetcher-stonakah-plane-flight var(--stone-duration) linear var(--stone-delay) both;will-change:transform,opacity;}',
      '.fetcher-stonakah-plane svg{display:block;width:100%;height:auto;overflow:visible;filter:drop-shadow(0 3px 5px rgba(79,48,30,.10));}',
      '.fetcher-stonakah-plane-body{fill:#C89F78;stroke:rgba(96,60,38,.28);stroke-width:.8;stroke-linejoin:round;}',
      '.fetcher-stonakah-plane-wing{fill:#D7B28D;stroke:rgba(96,60,38,.19);stroke-width:.65;stroke-linejoin:round;}',
      '.fetcher-stonakah-plane-fold{fill:none;stroke:rgba(103,67,43,.28);stroke-width:.7;stroke-linecap:round;}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-plane{opacity:0;}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-plane-body{fill:#9A7558;stroke:rgba(226,194,163,.17);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-plane-wing{fill:#B08968;stroke:rgba(226,194,163,.12);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-plane-fold{stroke:rgba(235,209,183,.17);}',
      '@keyframes fetcher-stonakah-plane-flight{',
      '0%{opacity:0;transform:translate3d(0,0,0) rotate(var(--stone-r0)) scale(.96);}',
      '7%{opacity:var(--stone-opacity);}',
      '24%{opacity:var(--stone-opacity);transform:translate3d(var(--stone-x1),var(--stone-y1),0) rotate(var(--stone-r1)) scale(1);}',
      '51%{opacity:var(--stone-opacity);transform:translate3d(var(--stone-x2),var(--stone-y2),0) rotate(var(--stone-r2)) scale(1);}',
      '77%{opacity:var(--stone-opacity);transform:translate3d(var(--stone-x3),var(--stone-y3),0) rotate(var(--stone-r3)) scale(1);}',
      '92%{opacity:calc(var(--stone-opacity) * .54);}',
      '100%{opacity:0;transform:translate3d(var(--stone-x4),var(--stone-y4),0) rotate(var(--stone-r4)) scale(.985);}',
      '}',
      'html[data-motion="reduced"] .fetcher-stonakah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-stonakah-plane{width:calc(var(--stone-plane-w) * .9);}}'
    ].join('\n');

    (document.head || document.documentElement).appendChild(style);
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();

    layer = document.createElement('div');
    layer.className = 'fetcher-stonakah-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function prune(shared) {
    var now = Date.now();
    shared.planes = shared.planes.filter(function (item) {
      return now < item.bornAt + item.duration + 220;
    });
  }

  function makePlane(delay) {
    var shared = sharedState();
    var leftToRight = Math.random() < .5;
    return {
      id: shared.nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(8400, 11200),
      leftToRight: leftToRight,
      y: rand(16, 80),
      width: rand(34, 48),
      curveA: rand(-34, 34),
      curveB: rand(-58, 58),
      curveC: rand(-34, 34),
      endY: rand(-20, 20),
      tilt: rand(-4.5, 4.5),
      opacity: rand(.42, .62)
    };
  }

  function addPlane(delay) {
    if (!isMaster || !masterActive() || masterReducedMotion()) return null;
    var shared = sharedState();
    prune(shared);
    if (shared.planes.length) return null;
    var model = makePlane(delay || 0);
    shared.planes.push(model);
    return model;
  }

  function scheduleNext() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    if (!shared.running || !masterActive() || masterReducedMotion()) return;

    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      prune(shared);
      if (!shared.planes.length) addPlane(0);
      scheduleNext();
    }, rand(10500, 17500));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.planes = [];
    addPlane(2600);
    scheduleNext();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.planes = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function makeSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 64 40');
    svg.setAttribute('aria-hidden', 'true');

    var body = document.createElementNS(ns, 'polygon');
    body.setAttribute('class', 'fetcher-stonakah-plane-body');
    body.setAttribute('points', '3,20 59,4 38,35 27,24');
    svg.appendChild(body);

    var wing = document.createElementNS(ns, 'polygon');
    wing.setAttribute('class', 'fetcher-stonakah-plane-wing');
    wing.setAttribute('points', '3,20 59,4 27,24 17,35');
    svg.appendChild(wing);

    var fold = document.createElementNS(ns, 'path');
    fold.setAttribute('class', 'fetcher-stonakah-plane-fold');
    fold.setAttribute('d', 'M3 20 L27 24 L59 4 M27 24 L38 35');
    svg.appendChild(fold);

    return svg;
  }

  function renderPlane(model, target) {
    var node = document.createElement('div');
    node.className = 'fetcher-stonakah-plane';
    node.setAttribute('data-stonakah-plane-id', String(model.id));

    var distance = Math.max(420, (target.clientWidth || window.innerWidth || 900) + 150);
    var dir = model.leftToRight ? 1 : -1;
    var startX = model.leftToRight ? '-72px' : 'calc(100% + 72px)';
    var baseRot = model.leftToRight ? model.tilt : 180 - model.tilt;

    node.style.setProperty('--stone-start-x', startX);
    node.style.setProperty('--stone-start-y', model.y + '%');
    node.style.setProperty('--stone-plane-w', model.width + 'px');
    node.style.setProperty('--stone-duration', model.duration + 'ms');
    node.style.setProperty('--stone-opacity', model.opacity);
    node.style.setProperty('--stone-delay', (-(Date.now() - model.bornAt)) + 'ms');

    node.style.setProperty('--stone-x1', (distance * .24 * dir) + 'px');
    node.style.setProperty('--stone-x2', (distance * .51 * dir) + 'px');
    node.style.setProperty('--stone-x3', (distance * .77 * dir) + 'px');
    node.style.setProperty('--stone-x4', (distance * dir) + 'px');
    node.style.setProperty('--stone-y1', model.curveA + 'px');
    node.style.setProperty('--stone-y2', model.curveB + 'px');
    node.style.setProperty('--stone-y3', model.curveC + 'px');
    node.style.setProperty('--stone-y4', model.endY + 'px');

    node.style.setProperty('--stone-r0', (baseRot - 2.5) + 'deg');
    node.style.setProperty('--stone-r1', (baseRot + 1.5) + 'deg');
    node.style.setProperty('--stone-r2', (baseRot - 1.2) + 'deg');
    node.style.setProperty('--stone-r3', (baseRot + 1.8) + 'deg');
    node.style.setProperty('--stone-r4', (baseRot - .5) + 'deg');

    node.appendChild(makeSvg());
    return node;
  }

  function syncRendered() {
    window.clearTimeout(renderTimer);
    renderTimer = null;

    if (!active() || reducedMotion()) {
      if (layer) layer.replaceChildren();
      return;
    }

    ensureStyles();
    var target = ensureLayer();
    if (!target) return;

    var shared = sharedState();
    prune(shared);
    var live = {};

    shared.planes.forEach(function (model) {
      live[String(model.id)] = true;
      if (!target.querySelector('[data-stonakah-plane-id="' + model.id + '"]')) {
        target.appendChild(renderPlane(model, target));
      }
    });

    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-stonakah-plane'), function (node) {
      if (!live[node.getAttribute('data-stonakah-plane-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRendered, 220);
  }

  function stopRenderer() {
    window.clearTimeout(renderTimer);
    renderTimer = null;
    if (layer) layer.replaceChildren();
  }

  function startRenderer() {
    stopRenderer();
    if (!active() || reducedMotion()) return;
    ensureStyles();
    ensureLayer();
    syncMasterActivity();
    syncRendered();
  }

  document.addEventListener('fetcher:easter-change', function () {
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
    else stopRenderer();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
    else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncMasterActivity();
      if (active() && !reducedMotion()) {
        if (!renderTimer) startRenderer();
      } else {
        stopRenderer();
      }
    }).observe(root, { attributes:true, attributeFilter:['data-easter-palette','data-motion','data-theme'] });
  }

  function init() {
    ensureStyles();
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
