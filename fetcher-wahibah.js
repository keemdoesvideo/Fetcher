/* Wahibah-only ambience: large peach/lilac constellations that persist across Fetcher's routed pages. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;

  var layer = null;
  var renderTimer = null;
  var MAX_CONSTELLATIONS = 2;
  var VIEW_W = 600;
  var VIEW_H = 360;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function active() {
    return root.getAttribute('data-easter-palette') === 'wahibah' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function masterActive() {
    try {
      var masterRoot = topWindow.document.documentElement;
      return masterRoot.getAttribute('data-easter-palette') === 'wahibah' &&
        masterRoot.getAttribute('data-motion') !== 'reduced';
    } catch (e) {
      return active();
    }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherWahibahShared) {
        topWindow.FetcherWahibahShared = {
          constellations: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherWahibahShared;
    } catch (e) {
      if (!window.FetcherWahibahShared) {
        window.FetcherWahibahShared = {
          constellations: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return window.FetcherWahibahShared;
    }
  }

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.constellations = shared.constellations.filter(function (item) {
      return now < item.bornAt + item.duration + 800;
    });
  }

  function makePoints(count) {
    var points = [];
    var step = (VIEW_W - 120) / Math.max(1, count - 1);
    for (var i = 0; i < count; i += 1) {
      var x = 60 + step * i + rand(-34, 34);
      var wave = i % 2 === 0 ? rand(72, 145) : rand(205, 292);
      points.push({
        x: Math.max(36, Math.min(VIEW_W - 36, x)),
        y: Math.max(40, Math.min(VIEW_H - 40, wave + rand(-28, 28))),
        r: i === 0 || i === count - 1 ? rand(4.4, 5.7) : rand(3.2, 4.8)
      });
    }
    if (count >= 6 && Math.random() < .78) {
      points[Math.floor(count / 2)].y = rand(82, 128);
    }
    return points;
  }

  function makeModel(delay) {
    var shared = sharedState();
    var count = 6 + Math.floor(Math.random() * 3);
    return {
      id: shared.nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(8800, 11200),
      left: rand(31, 70),
      top: rand(28, 70),
      width: rand(44, 55),
      rotate: rand(-8, 8),
      points: makePoints(count)
    };
  }

  function addShared(delay) {
    if (!isMaster || !masterActive()) return;
    var shared = sharedState();
    pruneShared();
    if (shared.constellations.length >= MAX_CONSTELLATIONS) return;
    shared.constellations.push(makeModel(delay || 0));
  }

  function scheduleSharedSpawn() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive()) return;
    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive()) return;
      addShared(0);
      scheduleSharedSpawn();
    }, rand(5000, 7200));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.constellations = [];
    addShared(0);
    scheduleSharedSpawn();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.constellations = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive()) startShared();
    else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-wahibah-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-wahibah-styles';
    style.textContent = [
      'html[data-easter-palette="wahibah"] .fetcher-ambient-constellation{display:none!important;}',
      '.fetcher-wahibah-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="wahibah"] .main>.stage,html[data-easter-palette="wahibah"] .main>.foot,html[data-easter-palette="wahibah"] .main>.settings-nav,html[data-easter-palette="wahibah"] .main>.settings-content,html[data-easter-palette="wahibah"] .main>.about,html[data-easter-palette="wahibah"] .main>.donate,html[data-easter-palette="wahibah"] .main>.updates,html[data-easter-palette="wahibah"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-wahibah-constellation{position:absolute;left:var(--wah-left);top:var(--wah-top);width:var(--wah-width);max-width:660px;min-width:320px;height:auto;aspect-ratio:5/3;overflow:visible;opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);filter:drop-shadow(0 0 12px rgba(254,194,168,.11));animation:fetcher-wahibah-life var(--wah-duration) cubic-bezier(.45,0,.55,1) var(--wah-delay) both;}',
      '.fetcher-wahibah-nebula{opacity:0;animation:fetcher-wahibah-nebula var(--wah-duration) ease-in-out var(--wah-delay) both;}',
      '.fetcher-wahibah-line{fill:none;stroke:rgba(254,194,168,.58);stroke-width:1.25;stroke-linecap:round;vector-effect:non-scaling-stroke;stroke-dasharray:var(--wah-line-length);stroke-dashoffset:var(--wah-line-length);opacity:0;filter:drop-shadow(0 0 3px rgba(254,194,168,.18));animation:fetcher-wahibah-line 2100ms cubic-bezier(.22,.72,.28,1) calc(var(--wah-delay) + var(--wah-line-delay)) forwards;}',
      '.fetcher-wahibah-star{fill:rgba(255,230,214,.98);stroke:rgba(255,247,240,.76);stroke-width:.7;vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center;filter:drop-shadow(0 0 5px rgba(254,194,168,.48));animation:fetcher-wahibah-star 1200ms cubic-bezier(.2,.76,.28,1) calc(var(--wah-delay) + var(--wah-star-delay)) both;}',
      '.fetcher-wahibah-star.alt{fill:rgba(222,196,245,.98);filter:drop-shadow(0 0 5px rgba(205,165,239,.46));}',
      '@keyframes fetcher-wahibah-life{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);}10%{opacity:1;}72%{opacity:1;filter:drop-shadow(0 0 13px rgba(254,194,168,.13));}82%{opacity:1;filter:drop-shadow(0 0 26px rgba(254,194,168,.34)) drop-shadow(0 0 38px rgba(193,100,153,.18));}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(1.015);filter:drop-shadow(0 0 10px rgba(254,194,168,.08));}}',
      '@keyframes fetcher-wahibah-star{0%{opacity:0;transform:scale(.2);}42%{opacity:1;transform:scale(1.28);}70%,100%{opacity:.96;transform:scale(1);}}',
      '@keyframes fetcher-wahibah-line{0%{opacity:0;stroke-dashoffset:var(--wah-line-length);}10%{opacity:.18;}30%{opacity:.72;}100%{opacity:.72;stroke-dashoffset:0;}}',
      '@keyframes fetcher-wahibah-nebula{0%,48%{opacity:0;}67%{opacity:.13;}82%{opacity:.23;}100%{opacity:0;}}',
      'html[data-motion="reduced"] .fetcher-wahibah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-wahibah-constellation{width:72vw;min-width:260px;}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function host() {
    return document.querySelector('.main') || document.body;
  }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-wahibah-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function lineLength(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function createSvg(model) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VIEW_W + ' ' + VIEW_H);
    svg.classList.add('fetcher-wahibah-constellation');
    svg.setAttribute('data-wahibah-id', String(model.id));
    svg.style.setProperty('--wah-left', model.left + '%');
    svg.style.setProperty('--wah-top', model.top + '%');
    svg.style.setProperty('--wah-width', model.width + 'vw');
    svg.style.setProperty('--wah-rotate', model.rotate + 'deg');
    svg.style.setProperty('--wah-duration', model.duration + 'ms');
    svg.style.setProperty('--wah-delay', (-(Date.now() - model.bornAt)) + 'ms');

    var defs = document.createElementNS(ns, 'defs');
    var radial = document.createElementNS(ns, 'radialGradient');
    radial.setAttribute('id', 'wahibahGlow-' + model.id);
    radial.setAttribute('cx', '50%');
    radial.setAttribute('cy', '50%');
    radial.setAttribute('r', '50%');
    var stopA = document.createElementNS(ns, 'stop');
    stopA.setAttribute('offset', '0%');
    stopA.setAttribute('stop-color', '#FEC2A8');
    stopA.setAttribute('stop-opacity', '.34');
    var stopB = document.createElementNS(ns, 'stop');
    stopB.setAttribute('offset', '52%');
    stopB.setAttribute('stop-color', '#C16499');
    stopB.setAttribute('stop-opacity', '.15');
    var stopC = document.createElementNS(ns, 'stop');
    stopC.setAttribute('offset', '100%');
    stopC.setAttribute('stop-color', '#C16499');
    stopC.setAttribute('stop-opacity', '0');
    radial.appendChild(stopA);
    radial.appendChild(stopB);
    radial.appendChild(stopC);
    defs.appendChild(radial);
    svg.appendChild(defs);

    var nebula = document.createElementNS(ns, 'ellipse');
    nebula.setAttribute('cx', '300');
    nebula.setAttribute('cy', '180');
    nebula.setAttribute('rx', '248');
    nebula.setAttribute('ry', '132');
    nebula.setAttribute('fill', 'url(#wahibahGlow-' + model.id + ')');
    nebula.setAttribute('class', 'fetcher-wahibah-nebula');
    svg.appendChild(nebula);

    for (var i = 0; i < model.points.length - 1; i += 1) {
      var a = model.points[i];
      var b = model.points[i + 1];
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('class', 'fetcher-wahibah-line');
      line.style.setProperty('--wah-line-length', lineLength(a, b).toFixed(1));
      line.style.setProperty('--wah-line-delay', (1050 + i * 360) + 'ms');
      svg.appendChild(line);
    }

    model.points.forEach(function (point, index) {
      var star = document.createElementNS(ns, 'circle');
      star.setAttribute('cx', point.x);
      star.setAttribute('cy', point.y);
      star.setAttribute('r', point.r);
      star.setAttribute('class', 'fetcher-wahibah-star' + (index % 3 === 1 ? ' alt' : ''));
      star.style.setProperty('--wah-star-delay', (180 + index * 330) + 'ms');
      svg.appendChild(star);
    });

    return svg;
  }

  function syncRendered() {
    window.clearTimeout(renderTimer);
    renderTimer = null;

    if (!active()) {
      if (layer) layer.replaceChildren();
      return;
    }

    ensureStyles();
    var target = ensureLayer();
    if (!target) return;
    pruneShared();

    var shared = sharedState();
    var live = {};
    var now = Date.now();

    shared.constellations.forEach(function (model) {
      if (now >= model.bornAt + model.duration + 650) return;
      live[String(model.id)] = true;
      if (!target.querySelector('[data-wahibah-id="' + model.id + '"]')) {
        target.appendChild(createSvg(model));
      }
    });

    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-wahibah-constellation'), function (node) {
      if (!live[node.getAttribute('data-wahibah-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRendered, 180);
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
    syncRendered();
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
