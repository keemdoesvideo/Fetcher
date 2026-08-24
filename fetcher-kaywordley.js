/* KayWordley-only palette + ambience: supplied pastel sunset colours with soft dust and shimmer. */
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
    return root.getAttribute('data-easter-palette') === 'kaywordley';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function masterActive() {
    try { return topWindow.document.documentElement.getAttribute('data-easter-palette') === 'kaywordley'; }
    catch (e) { return active(); }
  }

  function masterReducedMotion() {
    try { return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced'; }
    catch (e) { return reducedMotion(); }
  }

  function syncBrowserColor() {
    if (!active() || root.getAttribute('data-theme') !== 'light') return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#FFD497');
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherKayWordleySunsetShared) {
        topWindow.FetcherKayWordleySunsetShared = {
          epoch: Date.now(),
          motes: [],
          glints: [],
          nextGlintId: 1,
          glintTimer: null,
          running: false
        };
      }
      return topWindow.FetcherKayWordleySunsetShared;
    } catch (e) {
      if (!window.FetcherKayWordleySunsetShared) {
        window.FetcherKayWordleySunsetShared = {
          epoch: Date.now(), motes: [], glints: [], nextGlintId: 1, glintTimer: null, running: false
        };
      }
      return window.FetcherKayWordleySunsetShared;
    }
  }

  function buildMotes(shared) {
    if (shared.motes.length) return;
    var colours = [
      'rgba(255,249,201,.78)',
      'rgba(253,242,154,.72)',
      'rgba(255,212,151,.68)',
      'rgba(251,165,139,.60)',
      'rgba(251,145,143,.54)'
    ];
    var count = 18 + Math.floor(Math.random() * 5);
    for (var i = 0; i < count; i += 1) {
      shared.motes.push({
        id: i + 1,
        x: rand(3, 97),
        y: rand(4, 96),
        size: rand(1.6, 4.2),
        colour: pick(colours),
        opacity: rand(.20, .48),
        dx: rand(-34, 34),
        dy: rand(-28, 20),
        duration: rand(16000, 28000),
        phase: rand(0, 22000),
        blur: rand(.1, 1.1)
      });
    }
  }

  function pruneGlints(shared) {
    var now = Date.now();
    shared.glints = shared.glints.filter(function (glint) {
      return now < glint.bornAt + glint.duration + 180;
    });
  }

  function makeGlint(shared) {
    return {
      id: shared.nextGlintId++,
      bornAt: Date.now(),
      duration: rand(3000, 4400),
      x: rand(8, 92),
      y: rand(10, 90),
      size: rand(8, 14),
      rotate: rand(-18, 18),
      opacity: rand(.48, .76)
    };
  }

  function scheduleGlint() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.glintTimer);
    shared.glintTimer = null;
    if (!shared.running || !masterActive() || masterReducedMotion()) return;

    shared.glintTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      pruneGlints(shared);
      if (shared.glints.length < 2) shared.glints.push(makeGlint(shared));
      scheduleGlint();
    }, rand(3800, 6800));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    buildMotes(shared);
    if (!shared.running) {
      shared.running = true;
      shared.epoch = Date.now();
      shared.glints = [];
    }
    if (!masterReducedMotion() && !shared.glintTimer) scheduleGlint();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.glintTimer);
    shared.glintTimer = null;
    shared.running = false;
    shared.glints = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-kaywordley-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-kaywordley-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="kaywordley"]{--bg:#FFD497;--surface:#FFF9C9;--rail:#FBA58B;--ink:#3B2B29;--ink-strong:#241817;--ink-soft:#6B4A47;--ink-faint:#835E58;--border:#FB918F;--border-strong:#FB918F;--accent:#FB918F;--accent-ink:#7B3435;--accent-tint:#FDF29A;--on-accent:#3B2B29;--audio:#FBA58B;--audio-tint:#FFF9C9;--mute:#FB918F;--mute-tint:#FDF29A;--danger:#FB918F;--danger-tint:#FDF29A;--success:#FBA58B;--success-tint:#FFF9C9;--shiba:#FB918F;--shiba-deep:#FBA58B;--shiba-cream:#FFF9C9;}',
      'html[data-theme="light"][data-easter-palette="kaywordley"] .rail-btn:not(.active),html[data-theme="light"][data-easter-palette="kaywordley"] .rail-toggle{color:var(--ink-soft);}',
      'html[data-easter-palette="kaywordley"] .fetcher-ambient-spark{display:none!important;}',
      '.fetcher-kaywordley-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="kaywordley"] .main>.stage,html[data-easter-palette="kaywordley"] .main>.foot,html[data-easter-palette="kaywordley"] .main>.settings-nav,html[data-easter-palette="kaywordley"] .main>.settings-content,html[data-easter-palette="kaywordley"] .main>.about,html[data-easter-palette="kaywordley"] .main>.donate,html[data-easter-palette="kaywordley"] .main>.updates,html[data-easter-palette="kaywordley"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-kaywordley-mote{position:absolute;left:var(--kay-x);top:var(--kay-y);width:var(--kay-size);height:var(--kay-size);border-radius:50%;background:var(--kay-colour);opacity:0;box-shadow:0 0 10px color-mix(in srgb,var(--kay-colour) 34%,transparent);filter:blur(var(--kay-blur));animation:fetcher-kaywordley-drift var(--kay-duration) ease-in-out var(--kay-delay) infinite alternate;will-change:transform,opacity;}',
      '@keyframes fetcher-kaywordley-drift{0%{opacity:calc(var(--kay-opacity) * .42);transform:translate3d(0,0,0) scale(.82);}34%{opacity:var(--kay-opacity);}68%{opacity:calc(var(--kay-opacity) * .78);}100%{opacity:calc(var(--kay-opacity) * .35);transform:translate3d(var(--kay-dx),var(--kay-dy),0) scale(1.08);}}',
      '.fetcher-kaywordley-glint{position:absolute;left:var(--kay-glint-x);top:var(--kay-glint-y);width:var(--kay-glint-size);height:var(--kay-glint-size);opacity:0;transform:translate(-50%,-50%) rotate(var(--kay-glint-rotate)) scale(.35);animation:fetcher-kaywordley-glint var(--kay-glint-duration) ease-in-out var(--kay-glint-delay) both;will-change:transform,opacity;}',
      '.fetcher-kaywordley-glint::before,.fetcher-kaywordley-glint::after{content:"";position:absolute;left:50%;top:50%;border-radius:999px;background:rgba(253,242,154,.94);box-shadow:0 0 12px rgba(251,165,139,.34);transform:translate(-50%,-50%);}',
      '.fetcher-kaywordley-glint::before{width:1.5px;height:100%;}',
      '.fetcher-kaywordley-glint::after{width:100%;height:1.5px;}',
      '@keyframes fetcher-kaywordley-glint{0%,12%{opacity:0;transform:translate(-50%,-50%) rotate(var(--kay-glint-rotate)) scale(.3);}38%{opacity:var(--kay-glint-opacity);transform:translate(-50%,-50%) rotate(calc(var(--kay-glint-rotate) + 5deg)) scale(1);}62%{opacity:calc(var(--kay-glint-opacity) * .72);transform:translate(-50%,-50%) rotate(calc(var(--kay-glint-rotate) + 9deg)) scale(.86);}100%{opacity:0;transform:translate(-50%,-50%) rotate(calc(var(--kay-glint-rotate) + 13deg)) scale(.42);}}',
      'html[data-theme="dark"][data-easter-palette="kaywordley"] .fetcher-kaywordley-mote{filter:blur(var(--kay-blur)) brightness(.86);}',
      'html[data-motion="reduced"] .fetcher-kaywordley-layer{display:none!important;}'
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
    layer.className = 'fetcher-kaywordley-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function renderMote(mote, shared) {
    var node = document.createElement('span');
    node.className = 'fetcher-kaywordley-mote';
    node.setAttribute('data-kaywordley-mote-id', String(mote.id));
    node.style.setProperty('--kay-x', mote.x + '%');
    node.style.setProperty('--kay-y', mote.y + '%');
    node.style.setProperty('--kay-size', mote.size + 'px');
    node.style.setProperty('--kay-colour', mote.colour);
    node.style.setProperty('--kay-opacity', mote.opacity);
    node.style.setProperty('--kay-dx', mote.dx + 'px');
    node.style.setProperty('--kay-dy', mote.dy + 'px');
    node.style.setProperty('--kay-duration', mote.duration + 'ms');
    node.style.setProperty('--kay-blur', mote.blur + 'px');
    var elapsed = Date.now() - shared.epoch + mote.phase;
    node.style.setProperty('--kay-delay', -(elapsed % mote.duration) + 'ms');
    return node;
  }

  function renderGlint(glint) {
    var node = document.createElement('span');
    node.className = 'fetcher-kaywordley-glint';
    node.setAttribute('data-kaywordley-glint-id', String(glint.id));
    node.style.setProperty('--kay-glint-x', glint.x + '%');
    node.style.setProperty('--kay-glint-y', glint.y + '%');
    node.style.setProperty('--kay-glint-size', glint.size + 'px');
    node.style.setProperty('--kay-glint-rotate', glint.rotate + 'deg');
    node.style.setProperty('--kay-glint-duration', glint.duration + 'ms');
    node.style.setProperty('--kay-glint-opacity', glint.opacity);
    node.style.setProperty('--kay-glint-delay', -(Date.now() - glint.bornAt) + 'ms');
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
    syncBrowserColor();
    var target = ensureLayer();
    if (!target) return;

    var shared = sharedState();
    buildMotes(shared);
    pruneGlints(shared);

    shared.motes.forEach(function (mote) {
      if (!target.querySelector('[data-kaywordley-mote-id="' + mote.id + '"]')) {
        target.appendChild(renderMote(mote, shared));
      }
    });

    var liveGlints = {};
    shared.glints.forEach(function (glint) {
      liveGlints[String(glint.id)] = true;
      if (!target.querySelector('[data-kaywordley-glint-id="' + glint.id + '"]')) {
        target.appendChild(renderGlint(glint));
      }
    });

    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-kaywordley-glint'), function (node) {
      if (!liveGlints[node.getAttribute('data-kaywordley-glint-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRendered, 260);
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
    syncBrowserColor();
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
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.motion') {
      syncMasterActivity();
      if (active() && !reducedMotion()) startRenderer();
      else stopRenderer();
    }
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncMasterActivity();
      syncBrowserColor();
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
    syncBrowserColor();
    if (active() && !reducedMotion()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();