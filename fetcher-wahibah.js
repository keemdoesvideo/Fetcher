/* Wahibah-only ambience: stars establish the constellation, then one continuous line traces it. */
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
  var STAR_STAGGER = 180;
  var STAR_ANIM = 720;
  var DRAW_GAP = 360;
  var DRAW_DURATION = 3600;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }

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

  /* Simplified recognisable layouts based on familiar real constellations.
     Traversal can revisit stars so branched shapes still draw as one unbroken stroke. */
  var REAL_TEMPLATES = [
    { name:'big dipper', points:[[70,210],[145,188],[220,196],[292,164],[365,126],[452,142],[526,105]], traversal:[0,1,2,3,4,5,6] },
    { name:'cassiopeia', points:[[72,235],[170,118],[278,224],[386,105],[520,208]], traversal:[0,1,2,3,4] },
    { name:'orion', points:[[178,78],[418,90],[235,170],[300,183],[365,170],[206,286],[402,292]], traversal:[0,2,3,4,1,4,6,4,3,2,5] },
    { name:'aries', points:[[108,214],[218,166],[346,183],[486,126]], traversal:[0,1,2,3] },
    { name:'taurus', points:[[86,106],[196,154],[292,214],[390,151],[522,88],[472,278]], traversal:[0,1,2,3,4,3,5] },
    { name:'gemini', points:[[150,82],[228,128],[246,212],[210,292],[418,86],[360,137],[344,218],[392,294]], traversal:[0,1,2,3,2,1,5,4,5,6,7] },
    { name:'cancer', points:[[298,82],[292,160],[292,226],[180,292],[424,286]], traversal:[0,1,2,3,2,4] },
    { name:'leo', points:[[120,230],[156,150],[226,105],[286,154],[260,218],[370,244],[488,190],[514,286]], traversal:[0,1,2,3,4,5,6,7,6] },
    { name:'virgo', points:[[90,120],[182,154],[272,126],[332,205],[424,176],[520,238],[332,205],[260,292]], traversal:[0,1,2,3,4,5,4,3,7] },
    { name:'libra', points:[[176,116],[410,104],[472,246],[286,292],[126,238]], traversal:[0,1,2,3,4,0,3] },
    { name:'scorpius', points:[[92,104],[150,154],[210,130],[260,188],[310,220],[370,242],[430,226],[482,270],[530,230]], traversal:[0,1,2,3,4,5,6,7,8] },
    { name:'sagittarius', points:[[130,220],[208,142],[310,158],[392,110],[468,184],[396,254],[286,270],[208,220]], traversal:[0,1,2,3,4,5,6,7,1,2,5] },
    { name:'capricorn', points:[[92,154],[210,110],[338,150],[500,126],[430,264],[270,286]], traversal:[0,1,2,3,4,5,0] },
    { name:'aquarius', points:[[80,126],[160,164],[242,118],[318,164],[402,128],[478,184],[522,260],[414,286]], traversal:[0,1,2,3,4,5,6,7] },
    { name:'pisces', points:[[92,98],[150,126],[174,188],[130,232],[80,196],[286,216],[392,240],[510,286]], traversal:[0,1,2,3,4,0,1,2,5,6,7] }
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
    var jitter = procedural ? 24 : 7;
    return {
      name: procedural ? template.name + ' variation' : template.name,
      points: template.points.map(function (p, index) {
        return {
          x: 300 + (p[0] - 300) * scaleX + rand(-jitter, jitter),
          y: 180 + (p[1] - 180) * scaleY + rand(-jitter, jitter),
          r: index === 0 ? rand(4.8, 5.8) : rand(3.5, 5.2)
        };
      }),
      traversal: template.traversal.slice()
    };
  }

  function placement() {
    var edgeRoll = Math.random();
    var left;
    if (edgeRoll < .24) left = rand(-4, 14);
    else if (edgeRoll < .48) left = rand(86, 104);
    else left = rand(15, 85);

    var topRoll = Math.random();
    var top;
    if (topRoll < .16) top = rand(-1, 13);
    else if (topRoll < .32) top = rand(87, 101);
    else top = rand(14, 86);

    return { left:left, top:top };
  }

  function uniqueTraversal(traversal) {
    var seen = {};
    var order = [];
    traversal.forEach(function (index) {
      if (seen[index]) return;
      seen[index] = true;
      order.push(index);
    });
    return order;
  }

  function makeModel(delay) {
    var shared = sharedState();
    var shape = cloneTemplate(pick(REAL_TEMPLATES), Math.random() < .28);
    var pos = placement();
    var unique = uniqueTraversal(shape.traversal);
    var lastStarStart = STAR_START + Math.max(0, unique.length - 1) * STAR_STAGGER;
    var drawStart = lastStarStart + STAR_ANIM + DRAW_GAP;
    return {
      id:shared.nextId++,
      bornAt:Date.now() + (delay || 0),
      duration:rand(9000, 9800),
      left:pos.left,
      top:pos.top,
      width:rand(38, 53),
      rotate:rand(-9, 9),
      name:shape.name,
      points:shape.points,
      traversal:shape.traversal,
      starOrder:unique,
      drawStart:drawStart
    };
  }

  function addShared(delay) {
    if (!isMaster || !masterActive()) return null;
    var shared = sharedState();
    pruneShared();
    if (shared.constellations.length) return shared.constellations[0];
    var model = makeModel(delay || 0);
    shared.constellations.push(model);
    return model;
  }

  function scheduleNextFrom(model) {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive() || !model) return;
    var wait = Math.max(0, model.bornAt + model.duration - Date.now()) + rand(1000, 1800);
    shared.spawnTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive()) return;
      pruneShared();
      if (shared.constellations.length) {
        scheduleNextFrom(shared.constellations[0]);
        return;
      }
      scheduleNextFrom(addShared(0));
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
      '.fetcher-wahibah-path{fill:none;stroke:rgba(255,220,205,.88);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1;opacity:0;filter:drop-shadow(0 0 5px rgba(254,194,168,.31));animation:fetcher-wahibah-path var(--wah-draw-duration) cubic-bezier(.24,.68,.3,1) calc(var(--wah-delay) + var(--wah-draw-start)) forwards;}',
      '.fetcher-wahibah-star{fill:rgba(255,235,221,.98);stroke:rgba(255,250,246,.88);stroke-width:.75;vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center;filter:drop-shadow(0 0 6px rgba(254,194,168,.54));animation:fetcher-wahibah-star-arrive 720ms cubic-bezier(.18,.78,.26,1) calc(var(--wah-delay) + var(--wah-star-arrival)) both;}',
      '.fetcher-wahibah-star.alt{fill:rgba(229,207,248,.98);filter:drop-shadow(0 0 6px rgba(205,165,239,.54));}',
      '@keyframes fetcher-wahibah-life{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(.97);}4%{opacity:1;}67%{opacity:1;filter:drop-shadow(0 0 12px rgba(254,194,168,.13));}76%{opacity:1;filter:drop-shadow(0 0 34px rgba(254,194,168,.46)) drop-shadow(0 0 48px rgba(193,100,153,.24));}84%{opacity:1;filter:drop-shadow(0 0 14px rgba(254,194,168,.15));}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--wah-rotate)) scale(1.012);filter:drop-shadow(0 0 8px rgba(254,194,168,.06));}}',
      '@keyframes fetcher-wahibah-path{0%{opacity:.12;stroke-dashoffset:1;}7%{opacity:.88;}100%{opacity:.88;stroke-dashoffset:0;}}',
      '@keyframes fetcher-wahibah-star-arrive{0%{opacity:0;transform:scale(.18);}38%{opacity:1;transform:scale(1.36);}70%,100%{opacity:.98;transform:scale(1);}}',
      '@keyframes fetcher-wahibah-nebula{0%,61%{opacity:0;}69%{opacity:.08;}76%{opacity:.24;}84%,100%{opacity:0;}}',
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

  function pathData(model) {
    var first = model.points[model.traversal[0]];
    var d = 'M ' + first.x.toFixed(1) + ' ' + first.y.toFixed(1);
    for (var i = 1; i < model.traversal.length; i += 1) {
      var p = model.points[model.traversal[i]];
      d += ' L ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    }
    return d;
  }

  function starArrivalMap(model) {
    var map = {};
    model.starOrder.forEach(function (starIndex, orderIndex) {
      map[starIndex] = STAR_START + orderIndex * STAR_STAGGER;
    });
    return map;
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
    svg.style.setProperty('--wah-draw-start', model.drawStart + 'ms');
    svg.style.setProperty('--wah-draw-duration', DRAW_DURATION + 'ms');

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

    var arrivals = starArrivalMap(model);
    model.points.forEach(function (point, index) {
      var star = document.createElementNS(ns, 'circle');
      star.setAttribute('cx', point.x);
      star.setAttribute('cy', point.y);
      star.setAttribute('r', point.r);
      star.setAttribute('class', 'fetcher-wahibah-star' + (index % 3 === 1 ? ' alt' : ''));
      star.style.setProperty('--wah-star-arrival', (arrivals[index] || STAR_START) + 'ms');
      svg.appendChild(star);
    });

    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathData(model));
    path.setAttribute('pathLength', '1');
    path.setAttribute('class', 'fetcher-wahibah-path');
    svg.appendChild(path);

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
