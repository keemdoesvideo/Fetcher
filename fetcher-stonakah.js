/* Stonakah-only ambience: slow carved contour grooves beneath the UI. */
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
          epoch: Date.now(),
          grooves: []
        };
      }
      return topWindow.FetcherStonakahShared;
    } catch (e) {
      if (!window.FetcherStonakahShared) {
        window.FetcherStonakahShared = { epoch: Date.now(), grooves: [] };
      }
      return window.FetcherStonakahShared;
    }
  }

  function buildGrooves(shared) {
    if (shared.grooves.length) return;

    var anchors = [
      { x: 14, y: 18, w: 36, h: 28 },
      { x: 82, y: 24, w: 42, h: 31 },
      { x: 24, y: 78, w: 48, h: 34 },
      { x: 76, y: 76, w: 39, h: 29 },
      { x: 50, y: 50, w: 32, h: 24 }
    ];

    anchors.forEach(function (anchor, index) {
      shared.grooves.push({
        id: index + 1,
        x: anchor.x + rand(-5, 5),
        y: anchor.y + rand(-5, 5),
        w: anchor.w + rand(-4, 5),
        h: anchor.h + rand(-3, 4),
        rotate: rand(-20, 20),
        driftX: rand(-28, 28),
        driftY: rand(-18, 18),
        duration: rand(28000, 42000),
        phase: rand(0, 18000),
        opacity: rand(.62, .92),
        radiusA: rand(42, 58),
        radiusB: rand(42, 58),
        radiusC: rand(42, 58),
        radiusD: rand(42, 58),
        rings: index === 4 ? 3 : 4
      });
    });
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-stonakah-styles')) return;

    var style = document.createElement('style');
    style.id = 'fetcher-stonakah-styles';
    style.textContent = [
      'html[data-easter-palette="stonakah"] .fetcher-ember-trail,html[data-easter-palette="stonakah"] .fetcher-ember-dot{display:none!important;}',
      '.fetcher-stonakah-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="stonakah"] .main>.stage,html[data-easter-palette="stonakah"] .main>.foot,html[data-easter-palette="stonakah"] .main>.settings-nav,html[data-easter-palette="stonakah"] .main>.settings-content,html[data-easter-palette="stonakah"] .main>.about,html[data-easter-palette="stonakah"] .main>.donate,html[data-easter-palette="stonakah"] .main>.updates,html[data-easter-palette="stonakah"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-stonakah-groove{position:absolute;left:var(--stone-x);top:var(--stone-y);width:var(--stone-w);height:var(--stone-h);opacity:var(--stone-opacity);transform:translate(-50%,-50%) rotate(var(--stone-rotate));animation:fetcher-stonakah-drift var(--stone-duration) ease-in-out var(--stone-delay) infinite alternate;will-change:transform,opacity;}',
      '.fetcher-stonakah-ring{position:absolute;inset:var(--stone-inset);border-radius:var(--stone-radius);border:1px solid rgba(84,52,34,.20);box-shadow:0 1px 0 rgba(255,239,222,.13),inset 0 1px 0 rgba(255,245,230,.035),0 -1px 0 rgba(74,43,28,.06);opacity:calc(1 - var(--stone-ring-index) * .12);}',
      'html[data-theme="dark"][data-easter-palette="stonakah"] .fetcher-stonakah-ring{border-color:rgba(221,184,146,.16);box-shadow:0 1px 0 rgba(255,236,214,.055),0 -1px 0 rgba(0,0,0,.28);}',
      '@keyframes fetcher-stonakah-drift{0%{transform:translate(-50%,-50%) translate3d(0,0,0) rotate(var(--stone-rotate)) scale(.985);opacity:calc(var(--stone-opacity) * .78);}48%{opacity:var(--stone-opacity);}100%{transform:translate(-50%,-50%) translate3d(var(--stone-drift-x),var(--stone-drift-y),0) rotate(calc(var(--stone-rotate) + 3deg)) scale(1.018);opacity:calc(var(--stone-opacity) * .86);}}',
      'html[data-motion="reduced"] .fetcher-stonakah-layer{display:none!important;}',
      '@media(max-width:760px){.fetcher-stonakah-groove{width:calc(var(--stone-w) * 1.24);height:calc(var(--stone-h) * 1.24);}}'
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

  function renderGroove(model, shared) {
    var node = document.createElement('div');
    node.className = 'fetcher-stonakah-groove';
    node.setAttribute('data-stonakah-groove-id', String(model.id));
    node.style.setProperty('--stone-x', model.x + '%');
    node.style.setProperty('--stone-y', model.y + '%');
    node.style.setProperty('--stone-w', model.w + 'vw');
    node.style.setProperty('--stone-h', model.h + 'vh');
    node.style.setProperty('--stone-rotate', model.rotate + 'deg');
    node.style.setProperty('--stone-drift-x', model.driftX + 'px');
    node.style.setProperty('--stone-drift-y', model.driftY + 'px');
    node.style.setProperty('--stone-duration', model.duration + 'ms');
    node.style.setProperty('--stone-opacity', model.opacity);

    var elapsed = Date.now() - shared.epoch + model.phase;
    node.style.setProperty('--stone-delay', -(elapsed % model.duration) + 'ms');

    for (var i = 0; i < model.rings; i += 1) {
      var ring = document.createElement('span');
      ring.className = 'fetcher-stonakah-ring';
      ring.style.setProperty('--stone-ring-index', String(i));
      ring.style.setProperty('--stone-inset', (i * 18) + 'px');
      ring.style.setProperty(
        '--stone-radius',
        (model.radiusA + i * 1.4) + '% ' +
        (model.radiusB - i * .8) + '% ' +
        (model.radiusC + i * .7) + '% ' +
        (model.radiusD - i * .9) + '% / ' +
        (model.radiusD + i * .7) + '% ' +
        (model.radiusA - i * .6) + '% ' +
        (model.radiusB + i * .8) + '% ' +
        (model.radiusC - i * .5) + '%'
      );
      node.appendChild(ring);
    }

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
    buildGrooves(shared);

    shared.grooves.forEach(function (model) {
      if (!target.querySelector('[data-stonakah-groove-id="' + model.id + '"]')) {
        target.appendChild(renderGroove(model, shared));
      }
    });

    renderTimer = window.setTimeout(syncRendered, 900);
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
    if (active()) startRenderer();
    else stopRenderer();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    if (active()) startRenderer();
    else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
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
    if (active()) startRenderer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
