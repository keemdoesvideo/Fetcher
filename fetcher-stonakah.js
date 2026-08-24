/* Stonakah-only ambience: soft latte swirls blooming through the coffee-brown background. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }

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
      if (!topWindow.FetcherStonakahLatteShared) {
        topWindow.FetcherStonakahLatteShared = {
          swirls: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherStonakahLatteShared;
    } catch (e) {
      if (!window.FetcherStonakahLatteShared) {
        window.FetcherStonakahLatteShared = {
          swirls: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return window.FetcherStonakahLatteShared;
    }
  }

  var PATHS = [
    {
      outer: 'M34 128 C48 63 130 26 220 48 C302 68 318 132 278 178 C235 226 137 221 77 180 C35 151 48 107 92 84 C142 58 219 70 246 111 C270 148 227 178 174 176 C126 174 101 151 116 124 C132 96 180 92 201 113 C221 133 194 149 167 145',
      inner: 'M84 151 C109 193 192 205 247 169 C289 142 277 101 237 83 C194 64 133 72 108 102 C86 127 104 153 139 160 C174 168 211 155 218 132 C225 111 197 99 171 104'
    },
    {
      outer: 'M46 104 C78 45 167 28 245 59 C313 86 314 146 264 185 C210 227 116 212 67 166 C31 132 55 92 106 77 C163 60 228 78 250 116 C269 149 228 171 181 165 C137 159 117 136 132 113 C149 88 192 89 209 111 C223 130 202 143 178 140',
      inner: 'M70 158 C101 205 184 219 249 179 C299 149 294 105 253 82 C211 59 145 63 114 91 C86 117 99 149 136 161 C174 174 220 161 229 134 C237 110 207 95 178 101'
    },
    {
      outer: 'M33 141 C52 78 126 40 207 46 C291 52 326 111 295 164 C264 217 172 233 101 201 C45 176 37 133 77 100 C118 66 192 62 232 91 C270 119 249 157 205 170 C163 183 119 168 112 139 C106 113 134 94 166 96 C197 97 218 113 211 132',
      inner: 'M84 178 C122 212 193 214 245 179 C287 150 285 111 251 88 C215 63 155 61 119 84 C84 107 82 141 112 160 C143 181 193 181 219 157 C241 137 230 113 202 104'
    }
  ];

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.swirls = shared.swirls.filter(function (item) {
      return now < item.bornAt + item.duration + 240;
    });
  }

  function makeModel(delay) {
    var shared = sharedState();
    var pos = {
      x: rand(12, 88),
      y: rand(14, 86)
    };

    return {
      id: shared.nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(7600, 10400),
      x: pos.x,
      y: pos.y,
      width: rand(28, 44),
      rotate: rand(-24, 24),
      driftX: rand(-18, 18),
      driftY: rand(-12, 12),
      flip: Math.random() < .5 ? -1 : 1,
      opacity: rand(.74, .94),
      variant: Math.floor(rand(0, PATHS.length))
    };
  }

  function addShared(delay) {
    if (!isMaster || !masterActive() || masterReducedMotion()) return null;
    var shared = sharedState();
    pruneShared();
    if (shared.swirls.length >= 2) return null;
    var model = makeModel(delay || 0);
    shared.swirls.push(model);
    return model;
  }

  function scheduleNext() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;

    if (!shared.running || !masterActive() || masterReducedMotion()) return;

    shared.spawnTimer = window.setTimeout(function spawn() {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      pruneShared();
      if (shared.swirls.length < 2) addShared(0);
      scheduleNext();
    }, rand(5200, 8200));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.swirls = [];
    addShared(650);
    scheduleNext();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.swirls = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-stonakah-styles')) return;

    var style = document.createElement('style');
    style.id = 'fetcher-stonakah-styles';
    style.textContent = [
      'html[data-easter-palette="stonakah"] .fetcher-ember-trail,html[data-easter-palette="stonakah"] .fetcher-ember-dot{display:none!important;}',
      '.fetcher-stonakah-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="stonakah"] .main>.stage,html[data-easter-palette="stonakah"] .main>.foot,html[data-easter-palette="stonakah"] .main>.settings-nav,html[data-easter-palette="stonakah"] .main>.settings-content,html[data-easter-palette="stonakah"] .main>.about,html[data-easter-palette="stonakah"] .main>.donate,html[data-easter-palette="stonakah"] .main>.updates,html[data-easter-palette="stonakah"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-stonakah-swirl{position:absolute;left:var(--stone-x);top:var(--stone-y);width:var(--stone-width);max-width:620px;min-width:250px;aspect-ratio:1.45/1;opacity:0;transform:translate(-50%,-50%) rotate(var(--stone-rotate)) scale(.82);animation:fetcher-stonakah-latte-life var(--stone-duration) cubic-bezier(.45,0,.55,1) var(--stone-delay) both;will-change:transform,opacity,filter;}',
      '.fetcher-stonakah-pool{position:absolute;inset:10% 7%;border-radius:48% 52% 56% 44% / 54% 42% 58% 46%;background:radial-gradient(ellipse at 52% 49%,rgba(255,238,215,.28) 0%,rgba(247,222,190,.16) 34%,rgba(240,208,170,.06) 57%,rgba(240,208,170,0) 76%);filter:blur(16px);opacity:.72;animation:fetcher-stonakah-pool var(--stone-duration) ease-in-out var(--stone-delay) both;}',
      '.fetcher-stonakah-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform:scaleX(var(--stone-flip));transform-origin:center;}',
      '.fetcher-stonakah-stream{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;}',
      '.fetcher-stonakah-stream.outer-soft{stroke:rgba(255,237,213,.16);stroke-width:18;filter:blur(8px);}',
      '.fetcher-stonakah-stream.outer{stroke:rgba(255,240,219,.25);stroke-width:7.5;filter:blur(2.2px);}',
      '.fetcher-stonakah-stream.inner-soft{stroke:rgba(248,222,191,.13);stroke-width:13;filter:blur(6px);}',
      '.fetcher-stonakah-stream.inner{stroke:rgba(255,235,209,.22);stroke-width:5;filter:blur(1.6px);}',
      '.fetcher-stonakah-stream.fine{stroke:rgba(255,247,232,.19);stroke-width:1.35;filter:blur(.15px);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-pool{opacity:.48;background:radial-gradient(ellipse at 52% 49%,rgba(221,184,146,.19) 0%,rgba(176,137,104,.10) 38%,rgba(176,137,104,0) 76%);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-stream.outer-soft{stroke:rgba(221,184,146,.10);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-stream.outer{stroke:rgba(230,201,171,.17);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-stream.inner-soft{stroke:rgba(196,157,122,.09);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-stream.inner{stroke:rgba(226,193,158,.15);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-stream.fine{stroke:rgba(239,213,187,.14);}',
      '@keyframes fetcher-stonakah-latte-life{0%{opacity:0;transform:translate(-50%,-50%) translate3d(0,0,0) rotate(var(--stone-rotate)) scale(.78);filter:blur(4px);}16%{opacity:calc(var(--stone-opacity) * .56);filter:blur(1.8px);}38%{opacity:var(--stone-opacity);filter:blur(0);}64%{opacity:calc(var(--stone-opacity) * .82);}100%{opacity:0;transform:translate(-50%,-50%) translate3d(var(--stone-drift-x),var(--stone-drift-y),0) rotate(calc(var(--stone-rotate) + 7deg)) scale(1.09);filter:blur(5px);}}',
      '@keyframes fetcher-stonakah-pool{0%{opacity:0;transform:scale(.72) rotate(-4deg);}22%{opacity:.72;}52%{opacity:.58;transform:scale(1) rotate(1deg);}100%{opacity:0;transform:scale(1.13) rotate(6deg);}}',
      'html[data-motion="reduced"] .fetcher-stonakah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-stonakah-swirl{width:62vw;min-width:220px;}}'
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
    layer.className = 'fetcher-stonakah-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function makePath(svg, className, d) {
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'fetcher-stonakah-stream ' + className);
    path.setAttribute('d', d);
    return path;
  }

  function renderSwirl(model) {
    var age = Date.now() - model.bornAt;
    var shape = PATHS[model.variant] || PATHS[0];
    var node = document.createElement('div');
    node.className = 'fetcher-stonakah-swirl';
    node.setAttribute('data-stonakah-swirl-id', String(model.id));
    node.style.setProperty('--stone-x', model.x + '%');
    node.style.setProperty('--stone-y', model.y + '%');
    node.style.setProperty('--stone-width', model.width + 'vw');
    node.style.setProperty('--stone-rotate', model.rotate + 'deg');
    node.style.setProperty('--stone-drift-x', model.driftX + 'px');
    node.style.setProperty('--stone-drift-y', model.driftY + 'px');
    node.style.setProperty('--stone-duration', model.duration + 'ms');
    node.style.setProperty('--stone-opacity', model.opacity);
    node.style.setProperty('--stone-flip', model.flip);
    node.style.setProperty('--stone-delay', (-age) + 'ms');

    var pool = document.createElement('span');
    pool.className = 'fetcher-stonakah-pool';
    node.appendChild(pool);

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fetcher-stonakah-svg');
    svg.setAttribute('viewBox', '0 0 340 240');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    svg.appendChild(makePath(svg, 'outer-soft', shape.outer));
    svg.appendChild(makePath(svg, 'outer', shape.outer));
    svg.appendChild(makePath(svg, 'inner-soft', shape.inner));
    svg.appendChild(makePath(svg, 'inner', shape.inner));
    svg.appendChild(makePath(svg, 'fine', shape.outer));
    svg.appendChild(makePath(svg, 'fine', shape.inner));
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
    pruneShared();

    var live = {};
    shared.swirls.forEach(function (model) {
      live[String(model.id)] = true;
      if (!target.querySelector('[data-stonakah-swirl-id="' + model.id + '"]')) {
        target.appendChild(renderSwirl(model));
      }
    });

    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-stonakah-swirl'), function (node) {
      if (!live[node.getAttribute('data-stonakah-swirl-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRendered, 240);
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
    }).observe(root, {
      attributes: true,
      attributeFilter: ['data-easter-palette', 'data-motion', 'data-theme']
    });
  }

  function init() {
    ensureStyles();
    syncMasterActivity();
    if (active()) startRenderer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
