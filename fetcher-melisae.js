/* Melisae-only ambience: a softly animated pastel drip ceiling behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;

  var DRIPS = [
    { x: 4,  w: 58, h: 58,  dur: 9800,  phase: 900,  variant: 'a' },
    { x: 14, w: 42, h: 84,  dur: 12400, phase: 3800, variant: 'b' },
    { x: 27, w: 66, h: 46,  dur: 11200, phase: 6100, variant: 'c' },
    { x: 39, w: 48, h: 104, dur: 13800, phase: 2400, variant: 'b' },
    { x: 53, w: 62, h: 68,  dur: 10400, phase: 7600, variant: 'a' },
    { x: 66, w: 40, h: 92,  dur: 12800, phase: 4700, variant: 'c' },
    { x: 78, w: 70, h: 52,  dur: 11800, phase: 1700, variant: 'a' },
    { x: 91, w: 46, h: 78,  dur: 13200, phase: 8200, variant: 'b' }
  ];

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
      if (!topWindow.FetcherMelisaeDripsShared || topWindow.FetcherMelisaeDripsShared.version !== 2) {
        topWindow.FetcherMelisaeDripsShared = {
          version: 2,
          startedAt: Date.now(),
          droplets: [],
          nextId: 1,
          timer: null,
          running: false
        };
      }
      return topWindow.FetcherMelisaeDripsShared;
    } catch (e) {
      if (!window.FetcherMelisaeDripsShared || window.FetcherMelisaeDripsShared.version !== 2) {
        window.FetcherMelisaeDripsShared = {
          version: 2,
          startedAt: Date.now(),
          droplets: [],
          nextId: 1,
          timer: null,
          running: false
        };
      }
      return window.FetcherMelisaeDripsShared;
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
      '.fetcher-melisae-ceiling{position:absolute;left:0;right:0;top:0;height:132px;overflow:visible;opacity:.94;}',
      '.fetcher-melisae-band{position:absolute;left:-2%;right:-2%;top:-9px;height:43px;background:linear-gradient(180deg,#FFFEC4 0%,#FEFFA2 58%,#F6EE91 100%);border-radius:0 0 42% 38%/0 0 38% 34%;box-shadow:inset 0 -8px 16px rgba(240,203,255,.24),0 6px 20px rgba(122,103,142,.035);overflow:hidden;}',
      '.fetcher-melisae-band::before{content:"";position:absolute;left:-8%;top:4px;width:52%;height:22px;border-radius:999px;background:linear-gradient(90deg,rgba(240,203,255,.14),rgba(240,203,255,.38),rgba(220,220,255,.14));filter:blur(5px);animation:fetcher-melisae-band-glow 15000ms ease-in-out var(--mel-band-a-delay,0ms) infinite alternate;}',
      '.fetcher-melisae-band::after{content:"";position:absolute;right:-10%;top:10px;width:44%;height:18px;border-radius:999px;background:linear-gradient(90deg,rgba(220,220,255,.08),rgba(220,220,255,.34),rgba(240,203,255,.10));filter:blur(5px);animation:fetcher-melisae-band-glow-b 18000ms ease-in-out var(--mel-band-b-delay,0ms) infinite alternate;}',
      '.fetcher-melisae-drip{position:absolute;top:22px;left:var(--mel-x);width:var(--mel-w);height:var(--mel-h);margin-left:calc(var(--mel-w) * -.5);transform-origin:50% 0%;border-radius:12px 12px 55% 55%/14px 14px 28px 28px;background:linear-gradient(108deg,#FEFFA2 0%,#FFFDB6 32%,#F8EFA0 66%,#F2E78F 100%);box-shadow:inset 7px 0 12px rgba(240,203,255,.15),inset -7px 0 13px rgba(220,220,255,.18),0 8px 18px rgba(112,91,128,.035);will-change:transform,border-radius;}',
      '.fetcher-melisae-drip::before{content:"";position:absolute;left:18%;top:9px;width:28%;height:56%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(240,203,255,.16),rgba(255,255,255,0));filter:blur(1px);opacity:.75;}',
      '.fetcher-melisae-drip::after{content:"";position:absolute;right:12%;bottom:12%;width:38%;height:34%;border-radius:50%;background:radial-gradient(circle at 38% 35%,rgba(220,220,255,.34),rgba(220,220,255,.10) 54%,transparent 68%);opacity:.72;}',
      '.fetcher-melisae-drip[data-variant="a"]{animation:fetcher-melisae-drip-a var(--mel-dur) cubic-bezier(.42,0,.58,1) infinite alternate;}',
      '.fetcher-melisae-drip[data-variant="b"]{animation:fetcher-melisae-drip-b var(--mel-dur) cubic-bezier(.45,0,.55,1) infinite alternate;}',
      '.fetcher-melisae-drip[data-variant="c"]{animation:fetcher-melisae-drip-c var(--mel-dur) cubic-bezier(.4,0,.6,1) infinite alternate;}',
      '@keyframes fetcher-melisae-drip-a{0%{transform:scale3d(1,.92,1) translateY(-1px);border-radius:12px 12px 52% 58%/14px 14px 24px 31px;}48%{transform:scale3d(.97,1.06,1) translateY(1px);border-radius:10px 14px 58% 50%/14px 15px 33px 25px;}100%{transform:scale3d(1.025,.97,1) translateY(0);border-radius:14px 10px 49% 61%/15px 13px 25px 34px;}}',
      '@keyframes fetcher-melisae-drip-b{0%{transform:scale3d(.98,1.04,1);border-radius:13px 10px 61% 48%/15px 13px 36px 24px;}52%{transform:scale3d(1.025,.94,1) translateY(-2px);border-radius:10px 14px 52% 60%/13px 15px 27px 35px;}100%{transform:scale3d(.965,1.08,1) translateY(2px);border-radius:14px 11px 58% 51%/16px 13px 34px 27px;}}',
      '@keyframes fetcher-melisae-drip-c{0%{transform:scale3d(1.02,.95,1) translateY(-1px);border-radius:11px 14px 50% 60%/13px 16px 25px 34px;}46%{transform:scale3d(.965,1.075,1) translateY(2px);border-radius:14px 10px 61% 48%/16px 12px 35px 24px;}100%{transform:scale3d(1,.99,1);border-radius:12px 12px 54% 56%/14px 14px 29px 31px;}}',
      '@keyframes fetcher-melisae-band-glow{from{transform:translate3d(-4%,0,0) scaleX(.92);opacity:.58;}to{transform:translate3d(58%,2px,0) scaleX(1.12);opacity:.82;}}',
      '@keyframes fetcher-melisae-band-glow-b{from{transform:translate3d(8%,0,0) scaleX(1.04);opacity:.52;}to{transform:translate3d(-52%,-1px,0) scaleX(.9);opacity:.76;}}',
      '.fetcher-melisae-drop{position:absolute;left:var(--mel-drop-x);top:var(--mel-drop-y);width:var(--mel-drop-size);height:calc(var(--mel-drop-size) * 1.18);margin-left:calc(var(--mel-drop-size) * -.5);border-radius:52% 48% 56% 44%/38% 40% 60% 62%;background:linear-gradient(145deg,#FFFDC2 0%,#FEFFA2 55%,#EFDFA1 100%);box-shadow:inset 2px 1px 4px rgba(240,203,255,.30),inset -2px -1px 4px rgba(220,220,255,.22),0 5px 10px rgba(91,70,107,.05);opacity:0;animation:fetcher-melisae-drop-fall var(--mel-drop-dur) cubic-bezier(.32,.02,.62,1) var(--mel-drop-delay) both;will-change:transform,opacity;}',
      '.fetcher-melisae-drop::before{content:"";position:absolute;left:26%;top:15%;width:24%;height:28%;border-radius:50%;background:rgba(255,255,255,.45);filter:blur(.4px);}',
      '@keyframes fetcher-melisae-drop-fall{0%{opacity:0;transform:translate3d(0,-4px,0) scale(.72,.86);}7%{opacity:.78;transform:translate3d(0,0,0) scale(1,1);}76%{opacity:.74;}100%{opacity:0;transform:translate3d(var(--mel-drop-drift),var(--mel-drop-fall),0) scale(.9,1.08);}}',
      'html[data-motion="reserved"] .fetcher-melisae-drip,html[data-motion="reserved"] .fetcher-melisae-band::before,html[data-motion="reserved"] .fetcher-melisae-band::after{animation-timing-function:var(--ease);}',
      'html[data-motion="reduced"] .fetcher-melisae-drip,html[data-motion="reduced"] .fetcher-melisae-band::before,html[data-motion="reduced"] .fetcher-melisae-band::after{animation:none!important;}',
      'html[data-motion="reduced"] .fetcher-melisae-drop{display:none!important;}'
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

  function applyCeilingPhase() {
    if (!layer) return;
    var shared = sharedState();
    var elapsed = Math.max(0, Date.now() - shared.startedAt);
    Array.prototype.forEach.call(layer.querySelectorAll('.fetcher-melisae-drip'), function (drip, index) {
      var spec = DRIPS[index % DRIPS.length];
      var phase = (elapsed + spec.phase) % (spec.dur * 2);
      drip.style.animationDelay = (-phase) + 'ms';
    });
    var band = layer.querySelector('.fetcher-melisae-band');
    if (band) {
      band.style.setProperty('--mel-band-a-delay', -((elapsed + 1700) % 30000) + 'ms');
      band.style.setProperty('--mel-band-b-delay', -((elapsed + 4300) % 36000) + 'ms');
    }
  }

  function ensureCeiling() {
    var target = ensureLayer();
    if (!target) return null;
    var existing = target.querySelector('.fetcher-melisae-ceiling');
    if (existing) return existing;

    var ceiling = document.createElement('div');
    ceiling.className = 'fetcher-melisae-ceiling';

    var band = document.createElement('div');
    band.className = 'fetcher-melisae-band';
    ceiling.appendChild(band);

    DRIPS.forEach(function (spec) {
      var drip = document.createElement('span');
      drip.className = 'fetcher-melisae-drip';
      drip.setAttribute('data-variant', spec.variant);
      drip.style.setProperty('--mel-x', spec.x + '%');
      drip.style.setProperty('--mel-w', spec.w + 'px');
      drip.style.setProperty('--mel-h', spec.h + 'px');
      drip.style.setProperty('--mel-dur', spec.dur + 'ms');
      ceiling.appendChild(drip);
    });

    target.appendChild(ceiling);
    applyCeilingPhase();
    return ceiling;
  }

  function makeDroplet() {
    var shared = sharedState();
    var sourceIndex = Math.floor(rand(0, DRIPS.length));
    var source = DRIPS[sourceIndex];
    var viewportH = Math.max(520, window.innerHeight || 720);
    return {
      id: shared.nextId++,
      bornAt: Date.now(),
      duration: rand(4200, 5600),
      x: Math.max(3, Math.min(97, source.x + rand(-1.4, 1.4))),
      startY: source.h + 17,
      fall: viewportH + rand(70, 150),
      drift: rand(-34, 34),
      size: rand(9, 14)
    };
  }

  function pruneDroplets(shared) {
    var now = Date.now();
    shared.droplets = shared.droplets.filter(function (drop) {
      return now < drop.bornAt + drop.duration + 250;
    });
  }

  function scheduleDroplet() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.timer);
    shared.timer = null;
    if (!shared.running || !masterActive() || masterReducedMotion()) return;
    shared.timer = window.setTimeout(function () {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      pruneDroplets(shared);
      if (shared.droplets.length < 2) shared.droplets.push(makeDroplet());
      scheduleDroplet();
    }, rand(7200, 11600));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (!shared.running) {
      shared.running = true;
      shared.droplets = [];
      window.clearTimeout(shared.timer);
      shared.timer = window.setTimeout(function () {
        if (!shared.running || !masterActive() || masterReducedMotion()) return;
        shared.droplets.push(makeDroplet());
        scheduleDroplet();
      }, 3600);
      return;
    }
    if (!masterReducedMotion() && !shared.timer) scheduleDroplet();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.timer);
    shared.timer = null;
    shared.running = false;
    shared.droplets = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function renderDroplet(drop) {
    var target = ensureLayer();
    if (!target) return;
    var age = Date.now() - drop.bornAt;
    var node = document.createElement('span');
    node.className = 'fetcher-melisae-drop';
    node.setAttribute('data-melisae-drop-id', String(drop.id));
    node.style.setProperty('--mel-drop-x', drop.x + '%');
    node.style.setProperty('--mel-drop-y', drop.startY + 'px');
    node.style.setProperty('--mel-drop-size', drop.size + 'px');
    node.style.setProperty('--mel-drop-dur', drop.duration + 'ms');
    node.style.setProperty('--mel-drop-delay', (-age) + 'ms');
    node.style.setProperty('--mel-drop-fall', drop.fall + 'px');
    node.style.setProperty('--mel-drop-drift', drop.drift + 'px');
    target.appendChild(node);
  }

  function syncRenderedDrops() {
    if (!active() || reducedMotion()) {
      if (layer) {
        Array.prototype.forEach.call(layer.querySelectorAll('[data-melisae-drop-id]'), function (node) { node.remove(); });
      }
      return;
    }

    var target = ensureLayer();
    if (!target) return;
    var shared = sharedState();
    pruneDroplets(shared);
    var live = {};

    shared.droplets.forEach(function (drop) {
      live[String(drop.id)] = true;
      if (!target.querySelector('[data-melisae-drop-id="' + drop.id + '"]')) renderDroplet(drop);
    });

    Array.prototype.forEach.call(target.querySelectorAll('[data-melisae-drop-id]'), function (node) {
      if (!live[node.getAttribute('data-melisae-drop-id')]) node.remove();
    });
  }

  function startRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (!active()) return;
    ensureCeiling();
    syncRenderedDrops();
    if (!reducedMotion()) renderTimer = window.setInterval(syncRenderedDrops, 220);
  }

  function stopRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (layer && layer.parentNode) layer.remove();
    layer = null;
  }

  function syncAll() {
    if (!active()) {
      stopRenderer();
      syncMasterActivity();
      return;
    }
    ensureStyles();
    syncBrowserColor();
    ensureCeiling();
    syncMasterActivity();
    startRenderer();
  }

  document.addEventListener('fetcher:easter-change', syncAll);
  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
    if (event.detail.key === 'fetcher.motion') syncAll();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncAll();
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-theme', 'data-motion'] });
  }

  if (isMaster && window.MutationObserver) {
    new MutationObserver(syncMasterActivity).observe(topWindow.document.documentElement, {
      attributes: true,
      attributeFilter: ['data-easter-palette', 'data-motion']
    });
  }

  function init() {
    ensureStyles();
    if (active()) syncAll();
    else syncMasterActivity();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
