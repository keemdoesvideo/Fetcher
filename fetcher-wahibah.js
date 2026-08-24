/* Wahibah-only ambience: stars establish the constellation, then one continuous tracer moves star-to-star. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;
  var VIEW_W = 600;
  var VIEW_H = 360;
  var STAR_START = 420;
  var STAR_STAGGER = 170;
  var STAR_ANIM = 660;
  var DRAW_GAP = 320;
  var DRAW_DURATION = 3000;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function distance(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function active() {
    return root.getAttribute('data-easter-palette') === 'wahibah' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function masterActive() {
    try {
      var masterRoot = topWindow.document.documentElement;
      return masterRoot.getAttribute('data-easter-palette') === 'wahibah' &&
        masterRoot.getAttribute('data-motion') !== 'reduced';
    } catch (e) { return active(); }
  }

  /* Simplified real-constellation silhouettes. Every route visits each star once.
     That is deliberate: no backtracking, retracing, or hidden branch jumps. */
  var REAL_TEMPLATES = [
    { name:'big dipper', points:[[70,210],[145,188],[220,196],[292,164],[365,126],[452,142],[526,105]] },
    { name:'cassiopeia', points:[[72,235],[170,118],[278,224],[386,105],[520,208]] },
    { name:'orion', points:[[170,78],[230,165],[300,182],[370,165],[430,88],[392,292]] },
    { name:'aries', points:[[108,214],[218,166],[346,183],[486,126]] },
    { name:'taurus', points:[[86,106],[196,154],[292,214],[390,151],[522,88],[472,278]] },
    { name:'gemini', points:[[150,82],[228,128],[246,252],[360,258],[382,132],[452,86]] },
    { name:'cancer', points:[[298,82],[292,160],[292,226],[180,292],[424,286]] },
    { name:'leo', points:[[120,230],[156,150],[226,105],[286,154],[370,244],[514,286]] },
    { name:'virgo', points:[[90,120],[182,154],[272,126],[332,205],[424,176],[520,238]] },
    { name:'libra', points:[[176,116],[410,104],[472,246],[286,292],[126,238]] },
    { name:'scorpius', points:[[92,104],[150,154],[210,130],[260,188],[330,228],[420,238],[520,286]] },
    { name:'sagittarius', points:[[130,220],[208,142],[310,158],[392,110],[468,184],[396,254],[286,270]] },
    { name:'capricorn', points:[[92,154],[210,110],[338,150],[500,126],[430,264],[270,286]] },
    { name:'aquarius', points:[[80,126],[160,164],[242,118],[318,164],[402,128],[478,184],[522,260]] },
    { name:'pisces', points:[[92,98],[150,126],[174,188],[130,232],[286,216],[392,240],[510,286]] }
  ];

  function sharedState() {
    try {
      if (!topWindow.FetcherWahibahShared) {
        topWindow.FetcherWahibahShared = { constellations:[], nextId:1, spawnTimer:null, running:false };
      }
      return topWindow.FetcherWahibahShared;
    } catch (e) {
      if (!window.FetcherWahibahShared) {
        window.FetcherWahibahShared = { constellations:[], nextId:1, spawnTimer:null, running:false };
      }
      return window.FetcherWahibahShared;
    }
  }

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.constellations = shared.constellations.filter(function (item) {
      return now < item.bornAt + item.duration + 250;
    });
  }

  function cloneTemplate(template, procedural) {
    var scaleX = rand(.92, 1.05);
    var scaleY = rand(.92, 1.06);
    var jitter = procedural ? 22 : 7;
    return {
      name: procedural ? template.name + ' variation' : template.name,
      points: template.points.map(function (p, index) {
        return {
          x: 300 + (p[0] - 300) * scaleX + rand(-jitter, jitter),
          y: 180 + (p[1] - 180) * scaleY + rand(-jitter, jitter),
          r: index === 0 ? rand(4.8, 5.8) : rand(3.5, 5.2)
        };
      })
    };
  }

  function randomPlacement() {
    var edge = Math.random() < .22;
    if (edge) {
      if (Math.random() < .5) {
        return { left:Math.random() < .5 ? rand(-2, 10) : rand(90, 102), top:rand(14, 86) };
      }
      return { left:rand(14, 86), top:Math.random() < .5 ? rand(-1, 10) : rand(90, 101) };
    }
    return { left:rand(12, 88), top:rand(12, 88) };
  }

  function placementAwayFrom(existing) {
    if (!existing.length) return randomPlacement();
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < 14; i += 1) {
      var candidate = randomPlacement();
      var score = Infinity;
      existing.forEach(function (model) {
        var dx = candidate.left - model.left;
        var dy = candidate.top - model.top;
        score = Math.min(score, Math.sqrt(dx * dx + dy * dy));
      });
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
      if (score >= 58) break;
    }
    return best || randomPlacement();
  }

  function makeModel(delay) {
    var shared = sharedState();
    pruneShared();
    var shape = cloneTemplate(pick(REAL_TEMPLATES), Math.random() < .28);
    var pos = placementAwayFrom(shared.constellations);
    var lastStarStart = STAR_START + Math.max(0, shape.points.length - 1) * STAR_STAGGER;
    var drawStart = lastStarStart + STAR_ANIM + DRAW_GAP;
    var glowStart = drawStart + DRAW_DURATION + 220;
    var duration = glowStart + 1800;

    return {
      id:shared.nextId++,
      bornAt:Date.now() + (delay || 0),
      duration:duration,
      glowStart:glowStart,
      left:pos.left,
      top:pos.top,
      width:rand(38, 52),
      rotate:rand(-9, 9),
      name:shape.name,
      points:shape.points,
      drawStart:drawStart
    };
  }

  function addShared(delay) {
    if (!isMaster || !masterActive()) return null;
    var shared = sharedState();
    pruneShared();
    if (shared.constellations.length >= 2) return null;
    var model = makeModel(delay || 0);
    shared.constellations.push(model);
    return model;
  }

  function scheduleNextFrom(model) {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive() || !model) return;

    var wait = Math.max(0, model.bornAt + model.glowStart + 260 - Date.now());
    shared.spawnTimer = window.setTimeout(function spawnNext() {
      if (!shared.running || !masterActive()) return;
      pruneShared();
      if (shared.constellations.length >= 2) {
        shared.spawnTimer = window.setTimeout(spawnNext, 220);
        return;
      }
      var next = addShared(0);
      if (next) scheduleNextFrom(next);
    }, wait);
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.constellations = [];
    scheduleNextFrom(addShared(0));
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
      'html[data-theme="light"][data-easter-palette="wahibah"]{--ink-soft:#FFF7FB;--ink-faint:#F8EAF3;}',
      'html[data-theme="light"][data-easter-palette="wahibah"] .rail-btn:not(.active),html[data-theme="light"][data-easter-palette="wahibah"] .rail-toggle{color:#fff;}',
      '.fetcher-wahibah-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="wahibah"] .main>.stage,html[data-easter-palette="wahibah"] .main>.foot,html[data-easter-palette="wahibah"] .main>.settings-nav,html[data-easter-palette="wahibah"] .main>.settings-content,html[data-easter-palette="wahibah"] .main>.about,html[data-easter-palette="wahibah"] .main>.donate,html[data-easter-palette="wahibah"] .main>.updates,html[data-easter-palette="wahibah"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-wahibah-constellation{position:absolute;left:var(--wah-left);top:var(--wah-top);width:var(--wah-width);max-width:720px;min-width:300px;height:auto;aspect-ratio:5/3;overflow:visible;opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);filter:drop-shadow(0 0 10px rgba(254,194,168,.10));animation:fetcher-wahibah-life var(--wah-duration) cubic-bezier(.45,0,.55,1) var(--wah-delay) both;}',
      '.fetcher-wahibah-nebula{opacity:0;animation:fetcher-wahibah-nebula var(--wah-duration) ease-in-out var(--wah-delay) both;}',
      '.fetcher-wahibah-segment{fill:none;stroke:rgba(255,220,205,.90);stroke-width:1.5;stroke-linecap:round;vector-effect:non-scaling-stroke;stroke-dasharray:var(--wah-seg-length) var(--wah-seg-length);stroke-dashoffset:var(--wah-seg-length);opacity:0;filter:drop-shadow(0 0 5px rgba(254,194,168,.31));animation:fetcher-wahibah-segment var(--wah-seg-duration) linear calc(var(--wah-delay) + var(--wah-seg-start)) both;}',
      '.fetcher-wahibah-star{fill:rgba(255,235,221,.98);stroke:rgba(255,250,246,.88);stroke-width:.75;vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center;filter:drop-shadow(0 0 6px rgba(254,194,168,.54));animation:fetcher-wahibah-star-arrive 660ms cubic-bezier(.18,.78,.26,1) calc(var(--wah-delay) + var(--wah-star-arrival)) both;}',
      '.fetcher-wahibah-star.alt{fill:rgba(229,207,248,.98);filter:drop-shadow(0 0 6px rgba(205,165,239,.54));}',
      '@keyframes fetcher-wahibah-life{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);}4%{opacity:1;}73%{opacity:1;filter:drop-shadow(0 0 12px rgba(254,194,168,.13));}80%{opacity:1;filter:drop-shadow(0 0 34px rgba(254,194,168,.46)) drop-shadow(0 0 48px rgba(193,100,153,.24));}88%{opacity:.86;filter:drop-shadow(0 0 14px rgba(254,194,168,.15));}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(1.012);filter:drop-shadow(0 0 8px rgba(254,194,168,.06));}}',
      '@keyframes fetcher-wahibah-segment{0%{opacity:.12;stroke-dashoffset:var(--wah-seg-length);}4%{opacity:.90;}100%{opacity:.90;stroke-dashoffset:0;}}',
      '@keyframes fetcher-wahibah-star-arrive{0%{opacity:0;transform:scale(.16);}34%{opacity:1;transform:scale(1.48);}58%{opacity:.9;transform:scale(.92);}78%,100%{opacity:.98;transform:scale(1);}}',
      '@keyframes fetcher-wahibah-nebula{0%,70%{opacity:0;}78%{opacity:.10;}82%{opacity:.25;}90%,100%{opacity:0;}}',
      'html[data-motion="reduced"] .fetcher-wahibah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-wahibah-constellation{width:74vw;min-width:250px;}}'
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
    layer.className = 'fetcher-wahibah-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function segmentMetrics(model) {
    var lengths = [];
    var total = 0;
    for (var i = 1; i < model.points.length; i += 1) {
      var len = Math.max(1, distance(model.points[i - 1], model.points[i]));
      lengths.push(len);
      total += len;
    }
    return { lengths:lengths, total:Math.max(1, total) };
  }

  function createSvg(model) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VIEW_W + ' ' + VIEW_H);
    svg.classList.add('fetcher-wahibah-constellation');
    svg.setAttribute('data-wahibah-id', String(model.id));
    svg.setAttribute('data-constellation-name', model.name);
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
    [['0%','#FEC2A8','.30'],['52%','#C16499','.13'],['100%','#C16499','0']].forEach(function (s) {
      var stop = document.createElementNS(ns, 'stop');
      stop.setAttribute('offset', s[0]);
      stop.setAttribute('stop-color', s[1]);
      stop.setAttribute('stop-opacity', s[2]);
      radial.appendChild(stop);
    });
    defs.appendChild(radial);
    svg.appendChild(defs);

    var nebula = document.createElementNS(ns, 'ellipse');
    nebula.setAttribute('cx', '300');
    nebula.setAttribute('cy', '180');
    nebula.setAttribute('rx', '250');
    nebula.setAttribute('ry', '134');
    nebula.setAttribute('fill', 'url(#wahibahGlow-' + model.id + ')');
    nebula.setAttribute('class', 'fetcher-wahibah-nebula');
    svg.appendChild(nebula);

    var metrics = segmentMetrics(model);
    var cumulative = 0;
    metrics.lengths.forEach(function (len, index) {
      var a = model.points[index];
      var b = model.points[index + 1];
      var segment = document.createElementNS(ns, 'line');
      segment.setAttribute('x1', a.x);
      segment.setAttribute('y1', a.y);
      segment.setAttribute('x2', b.x);
      segment.setAttribute('y2', b.y);
      segment.setAttribute('class', 'fetcher-wahibah-segment');
      segment.style.setProperty('--wah-seg-length', len.toFixed(2));
      segment.style.setProperty('--wah-seg-start', (model.drawStart + (cumulative / metrics.total) * DRAW_DURATION) + 'ms');
      segment.style.setProperty('--wah-seg-duration', Math.max(140, (len / metrics.total) * DRAW_DURATION) + 'ms');
      svg.appendChild(segment);
      cumulative += len;
    });

    model.points.forEach(function (point, index) {
      var star = document.createElementNS(ns, 'circle');
      star.setAttribute('cx', point.x);
      star.setAttribute('cy', point.y);
      star.setAttribute('r', point.r);
      star.setAttribute('class', 'fetcher-wahibah-star' + (index % 3 === 1 ? ' alt' : ''));
      star.style.setProperty('--wah-star-arrival', (STAR_START + index * STAR_STAGGER) + 'ms');
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
      if (now >= model.bornAt + model.duration + 180) return;
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
    }).observe(root, { attributes:true, attributeFilter:['data-easter-palette','data-motion','data-theme'] });
  }

  function init() {
    ensureStyles();
    syncMasterActivity();
    if (active()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
