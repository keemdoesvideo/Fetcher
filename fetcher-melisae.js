/* Melisae-only ambience: softly forming honeycomb clusters behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;

  var PATTERNS = [
    [[0,0],[34,0],[17,29],[-17,29],[51,29],[0,58],[34,58]],
    [[0,0],[34,0],[68,0],[17,29],[51,29],[34,58],[68,58],[51,87]],
    [[17,0],[51,0],[0,29],[34,29],[68,29],[17,58],[51,58],[34,87]]
  ];
  var STROKES = ['#F0CBFF', '#DCDCFF', '#E6DE68'];
  var ZONES = [[14,20],[50,13],[84,22],[12,70],[50,84],[86,70]];

  function rand(min, max) { return min + Math.random() * (max - min); }

  function active() {
    return root.getAttribute('data-easter-palette') === 'melisae';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function masterActive() {
    try { return topWindow.document.documentElement.getAttribute('data-easter-palette') === 'melisae'; }
    catch (e) { return active(); }
  }

  function masterReducedMotion() {
    try { return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced'; }
    catch (e) { return reducedMotion(); }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherMelisaeHoneyShared || topWindow.FetcherMelisaeHoneyShared.version !== 1) {
        topWindow.FetcherMelisaeHoneyShared = {
          version: 1,
          clusters: [],
          nextId: 1,
          timer: null,
          running: false,
          lastZone: -1
        };
      }
      return topWindow.FetcherMelisaeHoneyShared;
    } catch (e) {
      if (!window.FetcherMelisaeHoneyShared || window.FetcherMelisaeHoneyShared.version !== 1) {
        window.FetcherMelisaeHoneyShared = {
          version: 1,
          clusters: [],
          nextId: 1,
          timer: null,
          running: false,
          lastZone: -1
        };
      }
      return window.FetcherMelisaeHoneyShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-melisae-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-melisae-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="melisae"]{--bg:#F8F1FC;--surface:#FFFFFF;--rail:#DCDCFF;--ink:#352A40;--ink-strong:#211829;--ink-soft:#64536E;--ink-faint:#8C7D95;--border:#E5D5EC;--border-strong:#C69ED8;--accent:#C58BDD;--accent-ink:#8854A0;--accent-tint:#F0CBFF;--on-accent:#FFFFFF;--audio:#D2C84F;--audio-tint:#FEFFA2;--mute:#AAAADB;--mute-tint:#DCDCFF;--danger:#B66E99;--danger-tint:#F0CBFF;--success:#B4B45C;--success-tint:#FEFFA2;--shiba:#F0CBFF;--shiba-deep:#C58BDD;--shiba-cream:#FEFFA2;}',
      'html[data-theme="dark"][data-easter-palette="melisae"]{--bg:#211A29;--surface:#2B2335;--rail:#332A42;--ink:#FFF9FF;--ink-strong:#FFFFFF;--ink-soft:#E7D9EC;--ink-faint:#BBAAC4;--border:#493A57;--border-strong:#8E6BA0;--accent:#F0CBFF;--accent-ink:#FEFFA2;--accent-tint:rgba(240,203,255,.18);--on-accent:#211A29;--audio:#FEFFA2;--audio-tint:rgba(254,255,162,.16);--mute:#DCDCFF;--mute-tint:rgba(220,220,255,.14);--danger:#F0CBFF;--danger-tint:rgba(240,203,255,.14);--success:#FEFFA2;--success-tint:rgba(254,255,162,.13);--shiba:#F0CBFF;--shiba-deep:#DCDCFF;--shiba-cream:#FEFFA2;}',
      '.fetcher-melisae-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="melisae"] .main>.stage,html[data-easter-palette="melisae"] .main>.foot,html[data-easter-palette="melisae"] .main>.settings-nav,html[data-easter-palette="melisae"] .main>.settings-content,html[data-easter-palette="melisae"] .main>.about,html[data-easter-palette="melisae"] .main>.donate,html[data-easter-palette="melisae"] .main>.updates,html[data-easter-palette="melisae"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-melisae-cluster{position:absolute;left:var(--mel-x);top:var(--mel-y);width:120px;height:118px;transform:translate(-50%,-50%) rotate(var(--mel-rotate)) scale(var(--mel-scale));transform-origin:center;}',
      '.fetcher-melisae-cell{position:absolute;left:var(--mel-cx);top:var(--mel-cy);width:38px;height:34px;opacity:0;transform:scale(.62);animation:fetcher-melisae-cell-life var(--mel-life) cubic-bezier(.2,.72,.25,1) var(--mel-delay) both;will-change:transform,opacity;}',
      '.fetcher-melisae-cell svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 4px 8px rgba(85,62,103,.035));}',
      '.fetcher-melisae-honey{position:absolute;left:4px;right:4px;top:3px;bottom:3px;clip-path:polygon(25% 2%,75% 2%,100% 50%,75% 98%,25% 98%,0 50%);background:linear-gradient(180deg,#FFFDBD 0%,#FEFFA2 52%,#E8D960 100%);transform:scaleY(0);transform-origin:50% 100%;opacity:0;animation:fetcher-melisae-honey-fill var(--mel-life) cubic-bezier(.2,.7,.3,1) var(--mel-delay) both;}',
      'html[data-theme="dark"][data-easter-palette="melisae"] .fetcher-melisae-cell svg{filter:drop-shadow(0 5px 10px rgba(0,0,0,.12));}',
      '@keyframes fetcher-melisae-cell-life{0%{opacity:0;transform:scale(.62);}8%{opacity:var(--mel-opacity);transform:scale(1.045);}14%{opacity:var(--mel-opacity);transform:scale(1);}72%{opacity:var(--mel-opacity);transform:scale(1);}88%{opacity:0;transform:scale(.9);}100%{opacity:0;transform:scale(.82);}}',
      '@keyframes fetcher-melisae-honey-fill{0%,18%{opacity:0;transform:scaleY(0);}24%{opacity:.58;}46%{opacity:.68;transform:scaleY(1);}72%{opacity:.68;transform:scaleY(1);}88%,100%{opacity:0;transform:scaleY(1);}}',
      'html[data-motion="reserved"] .fetcher-melisae-cell{animation-timing-function:var(--ease);}',
      'html[data-motion="reserved"] .fetcher-melisae-honey{animation-timing-function:var(--ease);}',
      'html[data-motion="reduced"] .fetcher-melisae-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#211A29' : '#F8F1FC');
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-melisae-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function makeCluster(offsetMs) {
    var shared = sharedState();
    var zoneIndex = Math.floor(rand(0, ZONES.length));
    if (ZONES.length > 1 && zoneIndex === shared.lastZone) zoneIndex = (zoneIndex + 1) % ZONES.length;
    shared.lastZone = zoneIndex;
    var zone = ZONES[zoneIndex];
    var pattern = Math.floor(rand(0, PATTERNS.length));
    var cellCount = PATTERNS[pattern].length;
    var gap = rand(210, 300);
    var duration = rand(9000, 11600);
    return {
      id: shared.nextId++,
      bornAt: Date.now() + (offsetMs || 0),
      duration: duration,
      gap: gap,
      x: Math.max(7, Math.min(93, zone[0] + rand(-5, 5))),
      y: Math.max(8, Math.min(92, zone[1] + rand(-6, 6))),
      rotate: rand(-9, 9),
      scale: rand(.82, 1.12),
      opacity: rand(.34, .52),
      pattern: pattern,
      toneOffset: Math.floor(rand(0, 3)),
      honeyIndex: Math.random() < .38 ? Math.floor(rand(0, cellCount)) : -1
    };
  }

  function addCluster(shared, offsetMs) {
    shared.clusters.push(makeCluster(offsetMs || 0));
  }

  function prune(shared) {
    var now = Date.now();
    shared.clusters = shared.clusters.filter(function (cluster) {
      return now < cluster.bornAt + cluster.duration + 700;
    });
  }

  function schedule() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.timer);
    shared.timer = null;
    if (!shared.running || !masterActive() || masterReducedMotion()) return;
    shared.timer = window.setTimeout(function () {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      prune(shared);
      if (shared.clusters.length < 3) addCluster(shared, 0);
      schedule();
    }, rand(5000, 7600));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (!shared.running) {
      shared.running = true;
      shared.clusters = [];
      addCluster(shared, 250);
      addCluster(shared, 2500);
    }
    if (!masterReducedMotion() && !shared.timer) schedule();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.timer);
    shared.timer = null;
    shared.running = false;
    shared.clusters = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function cellSvg(stroke) {
    return [
      '<svg viewBox="0 0 100 88" aria-hidden="true" focusable="false">',
      '<polygon points="25,3 75,3 98,44 75,85 25,85 2,44" fill="none" stroke="', stroke, '" stroke-width="5" stroke-linejoin="round"/>',
      '</svg>'
    ].join('');
  }

  function renderCluster(cluster) {
    var target = ensureLayer();
    if (!target) return;
    var pattern = PATTERNS[cluster.pattern] || PATTERNS[0];
    var age = Date.now() - cluster.bornAt;
    var maxOffset = cluster.gap * Math.max(0, pattern.length - 1);
    var life = Math.max(6200, cluster.duration - maxOffset);

    var node = document.createElement('div');
    node.className = 'fetcher-melisae-cluster';
    node.setAttribute('data-melisae-cluster-id', String(cluster.id));
    node.style.setProperty('--mel-x', cluster.x + '%');
    node.style.setProperty('--mel-y', cluster.y + '%');
    node.style.setProperty('--mel-rotate', cluster.rotate + 'deg');
    node.style.setProperty('--mel-scale', String(cluster.scale));

    pattern.forEach(function (point, index) {
      var cell = document.createElement('span');
      cell.className = 'fetcher-melisae-cell';
      cell.style.setProperty('--mel-cx', (point[0] + 24) + 'px');
      cell.style.setProperty('--mel-cy', (point[1] + 8) + 'px');
      cell.style.setProperty('--mel-opacity', String(cluster.opacity));
      cell.style.setProperty('--mel-life', life + 'ms');
      cell.style.setProperty('--mel-delay', (-age + (index * cluster.gap)) + 'ms');

      if (index === cluster.honeyIndex) {
        var honey = document.createElement('span');
        honey.className = 'fetcher-melisae-honey';
        cell.appendChild(honey);
      }

      var art = document.createElement('span');
      art.innerHTML = cellSvg(STROKES[(index + cluster.toneOffset) % STROKES.length]);
      while (art.firstChild) cell.appendChild(art.firstChild);
      node.appendChild(cell);
    });

    target.appendChild(node);
  }

  function syncRendered() {
    if (!active() || reducedMotion()) {
      if (layer) layer.replaceChildren();
      return;
    }
    var target = ensureLayer();
    if (!target) return;
    var shared = sharedState();
    var now = Date.now();
    var live = {};

    shared.clusters.forEach(function (cluster) {
      if (now >= cluster.bornAt + cluster.duration + 700) return;
      live[String(cluster.id)] = true;
      if (!target.querySelector('[data-melisae-cluster-id="' + cluster.id + '"]')) {
        renderCluster(cluster);
      }
    });

    Array.prototype.forEach.call(target.querySelectorAll('[data-melisae-cluster-id]'), function (node) {
      if (!live[node.getAttribute('data-melisae-cluster-id')]) node.remove();
    });
  }

  function startRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (!active() || reducedMotion()) return;
    ensureLayer();
    syncRendered();
    renderTimer = window.setInterval(syncRendered, 180);
  }

  function stopRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (layer) layer.replaceChildren();
  }

  function syncAll() {
    syncBrowserColor();
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
    else stopRenderer();
  }

  document.addEventListener('fetcher:easter-change', syncAll);
  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
    if (event.detail.key === 'fetcher.motion') syncAll();
  });

  if (window.MutationObserver) {
    new MutationObserver(syncAll).observe(root, {
      attributes: true,
      attributeFilter: ['data-easter-palette', 'data-motion', 'data-theme']
    });
  }

  function init() {
    ensureStyles();
    syncAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
