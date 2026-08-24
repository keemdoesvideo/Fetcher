/* Stonakah-only ambience: sparse brown woodgrain waves beneath the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var layer = null;
  var renderTimer = null;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function active() {
    return root.getAttribute('data-easter-palette') === 'stonakah';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherStonakahShared) {
        topWindow.FetcherStonakahShared = {
          waves: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherStonakahShared;
    } catch (e) {
      if (!window.FetcherStonakahShared) {
        window.FetcherStonakahShared = { waves: [], nextId: 1, spawnTimer: null, running: false };
      }
      return window.FetcherStonakahShared;
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
      '.fetcher-stonakah-wave{position:absolute;left:var(--stone-x);top:var(--stone-y);width:var(--stone-w);height:var(--stone-h);opacity:0;transform:translate(-50%,-50%) rotate(var(--stone-rotate));animation:fetcher-stonakah-wave-life var(--stone-duration) ease-in-out var(--stone-delay) forwards;will-change:transform,opacity,filter;}',
      '.fetcher-stonakah-svg{width:100%;height:100%;overflow:visible;}',
      '.fetcher-stonakah-path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke:rgba(91,58,38,.14);stroke-width:2.1;}',
      '.fetcher-stonakah-path.path-2{stroke:rgba(81,50,33,.10);stroke-width:1.55;}',
      '.fetcher-stonakah-path.path-3{stroke:rgba(106,70,46,.08);stroke-width:1.15;}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-path{stroke:rgba(201,162,126,.08);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-path.path-2{stroke:rgba(184,145,112,.06);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-path.path-3{stroke:rgba(220,186,150,.045);}',
      '@keyframes fetcher-stonakah-wave-life{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--stone-rotate)) translate3d(0,0,0) scale(.985);filter:blur(6px);}16%{opacity:var(--stone-opacity);filter:blur(1.2px);}58%{opacity:var(--stone-opacity);transform:translate(-50%,-50%) rotate(calc(var(--stone-rotate) + .8deg)) translate3d(var(--stone-drift-x),var(--stone-drift-y),0) scale(1);}82%{opacity:calc(var(--stone-opacity) * .76);filter:blur(1.8px);}100%{opacity:0;transform:translate(-50%,-50%) rotate(calc(var(--stone-rotate) + 1.3deg)) translate3d(calc(var(--stone-drift-x) * 1.2),calc(var(--stone-drift-y) * 1.12),0) scale(1.01);filter:blur(7px);}}',
      'html[data-motion="reduced"] .fetcher-stonakah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-stonakah-wave{width:calc(var(--stone-w) * 1.18);height:calc(var(--stone-h) * 1.12);}}'
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
    shared.waves = shared.waves.filter(function (item) {
      return now < item.bornAt + item.duration + 240;
    });
  }

  function makeWave(delay) {
    var shared = sharedState();
    return {
      id: shared.nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(8200, 11200),
      x: rand(10, 90),
      y: rand(12, 88),
      w: rand(30, 50) + 'vw',
      h: rand(14, 24) + 'vh',
      rotate: rand(-20, 20),
      opacity: rand(.52, .82),
      driftX: rand(-18, 18) + 'px',
      driftY: rand(-8, 8) + 'px',
      paths: buildPaths()
    };
  }

  function buildPaths() {
    var baseY = rand(38, 62);
    var points = [];
    for (var i = 0; i < 7; i += 1) {
      points.push({
        x: 4 + i * 15 + rand(-2.5, 2.5),
        y: baseY + Math.sin(i * .78 + rand(-.2, .2)) * rand(10, 18) + rand(-4, 4)
      });
    }
    function pathFrom(offsetY, jiggle, tighten) {
      var d = 'M ' + points[0].x.toFixed(1) + ' ' + (points[0].y + offsetY).toFixed(1);
      for (var i = 1; i < points.length; i += 1) {
        var prev = points[i - 1];
        var curr = points[i];
        var cx1 = prev.x + 6 + rand(-jiggle, jiggle);
        var cy1 = prev.y + offsetY + rand(-tighten, tighten);
        var cx2 = curr.x - 6 + rand(-jiggle, jiggle);
        var cy2 = curr.y + offsetY + rand(-tighten, tighten);
        d += ' C ' + cx1.toFixed(1) + ' ' + cy1.toFixed(1) + ', ' + cx2.toFixed(1) + ' ' + cy2.toFixed(1) + ', ' + curr.x.toFixed(1) + ' ' + (curr.y + offsetY).toFixed(1);
      }
      return d;
    }
    return [
      pathFrom(0, 2.8, 3.2),
      pathFrom(rand(6, 10), 2.4, 2.8),
      pathFrom(rand(-10, -6), 2.0, 2.6)
    ];
  }

  function addWave(delay) {
    var shared = sharedState();
    prune(shared);
    if (shared.waves.length >= 2) return null;
    var model = makeWave(delay || 0);
    shared.waves.push(model);
    return model;
  }

  function scheduleNext() {
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !active() || reducedMotion()) return;
    var wait = rand(3800, 6200);
    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !active() || reducedMotion()) return;
      addWave(0);
      scheduleNext();
    }, wait);
  }

  function startShared() {
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    if (!shared.waves.length) addWave(300);
    scheduleNext();
  }

  function stopShared() {
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.waves = [];
  }

  function renderWave(model) {
    var node = document.createElement('div');
    node.className = 'fetcher-stonakah-wave';
    node.setAttribute('data-stonakah-wave-id', String(model.id));
    node.style.setProperty('--stone-x', model.x + '%');
    node.style.setProperty('--stone-y', model.y + '%');
    node.style.setProperty('--stone-w', model.w);
    node.style.setProperty('--stone-h', model.h);
    node.style.setProperty('--stone-rotate', model.rotate + 'deg');
    node.style.setProperty('--stone-opacity', model.opacity);
    node.style.setProperty('--stone-duration', model.duration + 'ms');
    node.style.setProperty('--stone-drift-x', model.driftX);
    node.style.setProperty('--stone-drift-y', model.driftY);
    node.style.setProperty('--stone-delay', (-(Date.now() - model.bornAt)) + 'ms');

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'fetcher-stonakah-svg');

    model.paths.forEach(function (d, index) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', 'fetcher-stonakah-path path-' + (index + 1));
      svg.appendChild(p);
    });

    node.appendChild(svg);
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

    shared.waves.forEach(function (model) {
      live[String(model.id)] = true;
      if (!target.querySelector('[data-stonakah-wave-id="' + model.id + '"]')) {
        target.appendChild(renderWave(model));
      }
    });

    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-stonakah-wave'), function (node) {
      if (!live[node.getAttribute('data-stonakah-wave-id')]) node.remove();
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
    startShared();
    syncRendered();
  }

  document.addEventListener('fetcher:easter-change', function () {
    if (active() && !reducedMotion()) startRenderer();
    else { stopShared(); stopRenderer(); }
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    if (active() && !reducedMotion()) startRenderer();
    else { stopShared(); stopRenderer(); }
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (active() && !reducedMotion()) {
        if (!renderTimer) startRenderer();
      } else {
        stopShared();
        stopRenderer();
      }
    }).observe(root, { attributes:true, attributeFilter:['data-easter-palette','data-motion','data-theme'] });
  }

  function init() {
    ensureStyles();
    if (active() && !reducedMotion()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
