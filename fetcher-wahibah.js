/* Wahibah-only ambience: a calm galaxy field with sparse twinkling stars and occasional shooting stars. */
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

  function paletteActive() {
    return root.getAttribute('data-easter-palette') === 'wahibah';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function masterPaletteActive() {
    try {
      return topWindow.document.documentElement.getAttribute('data-easter-palette') === 'wahibah';
    } catch (e) { return paletteActive(); }
  }

  function masterReducedMotion() {
    try {
      return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced';
    } catch (e) { return reducedMotion(); }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherWahibahGalaxyShared) {
        topWindow.FetcherWahibahGalaxyShared = {
          stars: [],
          shots: [],
          nextShotId: 1,
          epoch: Date.now(),
          shotTimer: null,
          running: false
        };
      }
      return topWindow.FetcherWahibahGalaxyShared;
    } catch (e) {
      if (!window.FetcherWahibahGalaxyShared) {
        window.FetcherWahibahGalaxyShared = {
          stars: [],
          shots: [],
          nextShotId: 1,
          epoch: Date.now(),
          shotTimer: null,
          running: false
        };
      }
      return window.FetcherWahibahGalaxyShared;
    }
  }

  function buildStars(shared) {
    if (shared.stars.length) return;

    var count = 22 + Math.floor(Math.random() * 6);
    var colours = [
      'rgba(255,247,245,.94)',
      'rgba(239,222,255,.90)',
      'rgba(255,224,206,.88)'
    ];

    for (var i = 0; i < count; i += 1) {
      shared.stars.push({
        id: i + 1,
        x: rand(2.5, 97.5),
        y: rand(3, 97),
        size: rand(1.4, 3.4),
        duration: rand(3600, 7200),
        phase: rand(0, 7200),
        peak: rand(.62, .96),
        base: rand(.16, .36),
        colour: pick(colours),
        glow: rand(2.5, 6.5)
      });
    }
  }

  function pruneShots(shared) {
    var now = Date.now();
    shared.shots = shared.shots.filter(function (shot) {
      return now < shot.bornAt + shot.duration + 180;
    });
  }

  function makeShot(shared) {
    var leftToRight = Math.random() < .74;
    var startX = leftToRight ? rand(4, 67) : rand(33, 94);
    var startY = rand(6, 58);
    var dx = leftToRight ? rand(190, 310) : rand(-310, -190);
    var dy = rand(82, 155);
    var duration = rand(1850, 2650);

    return {
      id: shared.nextShotId++,
      bornAt: Date.now(),
      duration: duration,
      x: startX,
      y: startY,
      dx: dx,
      dy: dy,
      length: rand(135, 220),
      opacity: rand(.62, .86)
    };
  }

  function scheduleShot() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.shotTimer);
    shared.shotTimer = null;

    if (!shared.running || !masterPaletteActive() || masterReducedMotion()) return;

    shared.shotTimer = window.setTimeout(function () {
      if (!shared.running || !masterPaletteActive() || masterReducedMotion()) return;
      pruneShots(shared);
      if (!shared.shots.length) shared.shots.push(makeShot(shared));
      scheduleShot();
    }, rand(7800, 13500));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    buildStars(shared);

    if (!shared.running) {
      shared.running = true;
      shared.epoch = Date.now();
      shared.shots = [];
    }

    if (!masterReducedMotion() && !shared.shotTimer) scheduleShot();
    if (masterReducedMotion()) {
      window.clearTimeout(shared.shotTimer);
      shared.shotTimer = null;
      shared.shots = [];
    }
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.shotTimer);
    shared.shotTimer = null;
    shared.running = false;
    shared.shots = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterPaletteActive()) startShared();
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
      '.fetcher-wahibah-star{position:absolute;left:var(--wah-x);top:var(--wah-y);width:var(--wah-size);height:var(--wah-size);border-radius:50%;background:var(--wah-colour);opacity:var(--wah-base);box-shadow:0 0 var(--wah-glow) var(--wah-colour);transform:translate(-50%,-50%) scale(.82);animation:fetcher-wahibah-twinkle var(--wah-twinkle-duration) ease-in-out var(--wah-twinkle-delay) infinite;will-change:opacity,transform;}',
      '@keyframes fetcher-wahibah-twinkle{0%,100%{opacity:var(--wah-base);transform:translate(-50%,-50%) scale(.82);}45%{opacity:var(--wah-peak);transform:translate(-50%,-50%) scale(1.14);}58%{opacity:calc(var(--wah-peak) * .74);transform:translate(-50%,-50%) scale(1);}75%{opacity:calc(var(--wah-base) * 1.3);transform:translate(-50%,-50%) scale(.9);}}',
      '.fetcher-wahibah-shot{position:absolute;left:var(--wah-shot-x);top:var(--wah-shot-y);width:var(--wah-shot-length);height:10px;opacity:0;transform-origin:left center;transform:translate3d(0,0,0) rotate(var(--wah-shot-angle));animation:fetcher-wahibah-shot-flight var(--wah-shot-duration) linear var(--wah-shot-delay) both;will-change:transform,opacity;}',
      '.fetcher-wahibah-shot::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;border-radius:999px;transform:translateY(-50%);background:linear-gradient(90deg,rgba(255,244,241,0) 0%,rgba(255,232,224,.08) 14%,rgba(255,231,222,.28) 42%,rgba(255,242,236,.64) 74%,rgba(255,252,250,.98) 100%);filter:drop-shadow(0 0 5px rgba(255,225,216,.38));clip-path:inset(0 0 0 0 round 999px);animation:fetcher-wahibah-shot-tail var(--wah-shot-duration) linear var(--wah-shot-delay) both;will-change:clip-path,opacity;}',
      '.fetcher-wahibah-shot::after{content:"";position:absolute;right:-2px;top:50%;width:4px;height:4px;border-radius:50%;background:rgba(255,252,250,.99);box-shadow:0 0 8px rgba(255,230,222,.76);transform:translateY(-50%);animation:fetcher-wahibah-shot-head var(--wah-shot-duration) linear var(--wah-shot-delay) both;will-change:opacity;}',
      '@keyframes fetcher-wahibah-shot-flight{0%{opacity:0;transform:translate3d(0,0,0) rotate(var(--wah-shot-angle));}8%{opacity:var(--wah-shot-opacity);}70%{opacity:var(--wah-shot-opacity);}100%{opacity:0;transform:translate3d(var(--wah-shot-dx),var(--wah-shot-dy),0) rotate(var(--wah-shot-angle));}}',
      '@keyframes fetcher-wahibah-shot-tail{0%{opacity:0;clip-path:inset(0 0 0 100% round 999px);}8%{opacity:.92;clip-path:inset(0 0 0 0 round 999px);}70%{opacity:.92;clip-path:inset(0 0 0 0 round 999px);}100%{opacity:0;clip-path:inset(0 0 0 100% round 999px);}}',
      '@keyframes fetcher-wahibah-shot-head{0%,6%{opacity:0;}10%,70%{opacity:1;}100%{opacity:0;}}',
      'html[data-motion="reduced"] .fetcher-wahibah-star{animation:none!important;opacity:.42!important;transform:translate(-50%,-50%) scale(1)!important;}',
      'html[data-motion="reduced"] .fetcher-wahibah-shot{display:none!important;}'
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

  function renderStar(star, shared) {
    var node = document.createElement('span');
    node.className = 'fetcher-wahibah-star';
    node.setAttribute('data-wahibah-star-id', String(star.id));
    node.style.setProperty('--wah-x', star.x + '%');
    node.style.setProperty('--wah-y', star.y + '%');
    node.style.setProperty('--wah-size', star.size + 'px');
    node.style.setProperty('--wah-colour', star.colour);
    node.style.setProperty('--wah-glow', star.glow + 'px');
    node.style.setProperty('--wah-base', star.base);
    node.style.setProperty('--wah-peak', star.peak);
    node.style.setProperty('--wah-twinkle-duration', star.duration + 'ms');

    var elapsed = Date.now() - shared.epoch + star.phase;
    node.style.setProperty('--wah-twinkle-delay', -(elapsed % star.duration) + 'ms');
    return node;
  }

  function renderShot(shot) {
    var node = document.createElement('span');
    node.className = 'fetcher-wahibah-shot';
    node.setAttribute('data-wahibah-shot-id', String(shot.id));
    node.style.setProperty('--wah-shot-x', shot.x + '%');
    node.style.setProperty('--wah-shot-y', shot.y + '%');
    node.style.setProperty('--wah-shot-length', shot.length + 'px');
    node.style.setProperty('--wah-shot-dx', shot.dx + 'px');
    node.style.setProperty('--wah-shot-dy', shot.dy + 'px');
    node.style.setProperty('--wah-shot-angle', Math.atan2(shot.dy, shot.dx) * 180 / Math.PI + 'deg');
    node.style.setProperty('--wah-shot-duration', shot.duration + 'ms');
    node.style.setProperty('--wah-shot-opacity', shot.opacity);
    node.style.setProperty('--wah-shot-delay', -(Date.now() - shot.bornAt) + 'ms');
    return node;
  }

  function syncRendered() {
    window.clearTimeout(renderTimer);
    renderTimer = null;

    if (!paletteActive()) {
      if (layer) layer.replaceChildren();
      return;
    }

    ensureStyles();
    var target = ensureLayer();
    if (!target) return;

    var shared = sharedState();
    buildStars(shared);
    pruneShots(shared);

    shared.stars.forEach(function (star) {
      if (!target.querySelector('[data-wahibah-star-id="' + star.id + '"]')) {
        target.appendChild(renderStar(star, shared));
      }
    });

    var liveShots = {};
    if (!reducedMotion()) {
      shared.shots.forEach(function (shot) {
        liveShots[String(shot.id)] = true;
        if (!target.querySelector('[data-wahibah-shot-id="' + shot.id + '"]')) {
          target.appendChild(renderShot(shot));
        }
      });
    }

    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-wahibah-shot'), function (node) {
      if (!liveShots[node.getAttribute('data-wahibah-shot-id')]) node.remove();
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
    if (!paletteActive()) return;
    ensureStyles();
    ensureLayer();
    syncRendered();
  }

  document.addEventListener('fetcher:easter-change', function () {
    syncMasterActivity();
    if (paletteActive()) startRenderer();
    else stopRenderer();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    syncMasterActivity();
    if (paletteActive()) startRenderer();
    else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncMasterActivity();
      if (paletteActive()) {
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
    if (paletteActive()) startRenderer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();