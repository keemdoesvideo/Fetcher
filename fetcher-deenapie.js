/* Deenapie-only palette + ambience: soft pink/purple theme with occasional stylised pie slices. */
(function () {
  'use strict';

  var SECRET = 'deenapie';
  var STORAGE_KEY = 'fetcher.easterPalette';
  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;
  var secretBusy = false;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function motionMode() { return root.getAttribute('data-motion') || 'full'; }

  function rawStoredPalette() {
    try { return window.sessionStorage.getItem(STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }

  function active() {
    return root.getAttribute('data-easter-palette') === SECRET;
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function masterActive() {
    try { return topWindow.document.documentElement.getAttribute('data-easter-palette') === SECRET; }
    catch (e) { return active(); }
  }

  function masterReducedMotion() {
    try { return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced'; }
    catch (e) { return reducedMotion(); }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-deenapie-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-deenapie-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="deenapie"]{--bg:#F6E9F8;--surface:#F5D2E6;--rail:#F4BBD3;--ink:#3C233B;--ink-strong:#281526;--ink-soft:#70425F;--ink-faint:#98627D;--border:#F4BBD3;--border-strong:#F98CB9;--accent:#FE5D9F;--accent-ink:#B52668;--accent-tint:#F5D2E6;--on-accent:#FFFFFF;--audio:#F98CB9;--audio-tint:#F5D2E6;--mute:#F4BBD3;--mute-tint:#F6E9F8;--danger:#FE5D9F;--danger-tint:#F5D2E6;--success:#F98CB9;--success-tint:#F6E9F8;--shiba:#F98CB9;--shiba-deep:#FE5D9F;--shiba-cream:#F6E9F8;}',
      'html[data-theme="dark"][data-easter-palette="deenapie"]{--bg:#261522;--surface:#321C2D;--rail:#47243A;--ink:#FFF5FC;--ink-strong:#FFFFFF;--ink-soft:#F5D2E6;--ink-faint:#D89DBB;--border:#63314D;--border-strong:#A64B78;--accent:#FE5D9F;--accent-ink:#F6E9F8;--accent-tint:rgba(254,93,159,.20);--on-accent:#261522;--audio:#F98CB9;--audio-tint:rgba(249,140,185,.18);--mute:#F4BBD3;--mute-tint:rgba(244,187,211,.14);--danger:#FE5D9F;--danger-tint:rgba(254,93,159,.16);--success:#F98CB9;--success-tint:rgba(249,140,185,.14);--shiba:#F98CB9;--shiba-deep:#FE5D9F;--shiba-cream:#F6E9F8;}',
      '.fetcher-deenapie-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="deenapie"] .main>.stage,html[data-easter-palette="deenapie"] .main>.foot,html[data-easter-palette="deenapie"] .main>.settings-nav,html[data-easter-palette="deenapie"] .main>.settings-content,html[data-easter-palette="deenapie"] .main>.about,html[data-easter-palette="deenapie"] .main>.donate,html[data-easter-palette="deenapie"] .main>.updates,html[data-easter-palette="deenapie"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-deenapie-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;transform:translate3d(var(--dee-sx),var(--dee-sy),0);animation:fetcher-deenapie-flight var(--dee-duration) cubic-bezier(.38,.08,.62,.96) var(--dee-delay) both;will-change:transform,opacity;}',
      '.fetcher-deenapie-pie{position:absolute;left:0;top:0;width:var(--dee-size);height:calc(var(--dee-size) * .82);transform:translate(-50%,-50%) rotate(var(--dee-r0));transform-origin:center;animation:fetcher-deenapie-turn var(--dee-duration) cubic-bezier(.38,.08,.62,.96) var(--dee-delay) both;filter:drop-shadow(0 9px 16px rgba(74,35,64,.10));will-change:transform;}',
      '.fetcher-deenapie-pie svg{display:block;width:100%;height:100%;overflow:visible;}',
      'html[data-theme="dark"][data-easter-palette="deenapie"] .fetcher-deenapie-pie{filter:drop-shadow(0 10px 19px rgba(0,0,0,.20));}',
      '.fetcher-deenapie-transition{position:fixed;inset:0;z-index:10030;pointer-events:auto;background:#F6E9F8;opacity:0;transition:opacity 620ms cubic-bezier(.45,0,.55,1);}',
      '.fetcher-deenapie-transition.show{opacity:1;}',
      '.fetcher-deenapie-transition.reveal{opacity:0;transition-duration:1100ms;}',
      '@keyframes fetcher-deenapie-flight{0%{opacity:0;transform:translate3d(var(--dee-sx),var(--dee-sy),0);}9%{opacity:var(--dee-opacity);}48%{opacity:var(--dee-opacity);transform:translate3d(var(--dee-mx),var(--dee-my),0);}91%{opacity:var(--dee-opacity);transform:translate3d(var(--dee-ex),var(--dee-ey),0);}100%{opacity:0;transform:translate3d(var(--dee-ex),var(--dee-ey),0);}}',
      '@keyframes fetcher-deenapie-turn{0%{transform:translate(-50%,-50%) rotate(var(--dee-r0));}48%{transform:translate(-50%,-50%) rotate(var(--dee-r1));}100%{transform:translate(-50%,-50%) rotate(var(--dee-r2));}}',
      'html[data-motion="reduced"] .fetcher-deenapie-layer{display:none!important;}',
      'html[data-motion="reduced"] .fetcher-deenapie-transition{transition-duration:180ms!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#261522' : '#F6E9F8');
  }

  function applyDeenapiePalette() {
    try { window.sessionStorage.setItem(STORAGE_KEY, SECRET); } catch (e) {}
    root.setAttribute('data-easter-palette', SECRET);
    syncBrowserColor();
    syncMasterActivity();
    startRenderer();
    try { document.dispatchEvent(new CustomEvent('fetcher:easter-change', { detail: { palette: SECRET } })); } catch (e) {}
  }

  function patchPrefs() {
    var prefs = window.FetcherPrefs;
    if (!prefs || prefs.__deenapiePatched) return !!prefs;

    var originalGet = prefs.getEasterPalette ? prefs.getEasterPalette.bind(prefs) : function () { return ''; };
    var originalSet = prefs.setEasterPalette ? prefs.setEasterPalette.bind(prefs) : null;
    var originalApply = prefs.applyEasterPalette ? prefs.applyEasterPalette.bind(prefs) : null;

    prefs.getEasterPalette = function () {
      if (rawStoredPalette() === SECRET) return SECRET;
      return originalGet();
    };

    prefs.setEasterPalette = function (value) {
      value = String(value || '').trim().toLowerCase();
      if (value === SECRET) {
        applyDeenapiePalette();
        return;
      }
      if (originalSet) originalSet(value);
    };

    prefs.applyEasterPalette = function () {
      if (rawStoredPalette() === SECRET) {
        root.setAttribute('data-easter-palette', SECRET);
        syncBrowserColor();
        syncMasterActivity();
        startRenderer();
        return;
      }
      if (originalApply) originalApply();
    };

    prefs.__deenapiePatched = true;
    return true;
  }

  function runTransition() {
    ensureStyles();
    if (!document.body || motionMode() === 'reduced') {
      applyDeenapiePalette();
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      var wash = document.createElement('div');
      wash.className = 'fetcher-deenapie-transition';
      wash.setAttribute('aria-hidden', 'true');
      document.body.appendChild(wash);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { wash.classList.add('show'); });
      });

      window.setTimeout(function () {
        applyDeenapiePalette();
        window.setTimeout(function () {
          wash.classList.add('reveal');
          window.setTimeout(function () {
            if (wash.parentNode) wash.remove();
            resolve();
          }, 1180);
        }, 120);
      }, 660);
    });
  }

  function patchTransition() {
    var controller = window.FetcherEaster;
    if (!controller || controller.__deenapiePatched) return !!controller;
    var original = controller.transitionTo ? controller.transitionTo.bind(controller) : null;
    controller.transitionTo = function (name) {
      if (String(name || '').trim().toLowerCase() === SECRET) return runTransition();
      return original ? original(name) : Promise.resolve();
    };
    controller.__deenapiePatched = true;
    return true;
  }

  function secretHoldTime() {
    var motion = motionMode();
    if (motion === 'reduced') return 300;
    if (motion === 'reserved') return 320;
    return 620;
  }

  function runSecret() {
    if (secretBusy) return;
    var input = document.getElementById('url-input');
    if (!input) return;
    secretBusy = true;
    var wasReadOnly = input.readOnly;
    input.readOnly = true;
    input.value = 'found you.';
    input.classList.add('fetcher-easter-confirmation');
    var wrap = document.getElementById('fetch-wrap');
    if (wrap) wrap.classList.add('show');
    try {
      if (window.FetcherPrefs && FetcherPrefs.playFoundYouCue) FetcherPrefs.playFoundYouCue();
    } catch (e) {}

    window.setTimeout(function () {
      Promise.resolve(runTransition()).catch(function () { applyDeenapiePalette(); }).then(function () {
        input.value = '';
        input.readOnly = wasReadOnly;
        input.classList.remove('fetcher-easter-confirmation');
        secretBusy = false;
      });
    }, secretHoldTime());
  }

  function matchesSecret(value) {
    return String(value || '').trim().toLowerCase() === SECRET;
  }

  function installSecretListeners() {
    if (document.documentElement.getAttribute('data-deenapie-listeners') === '1') return;
    document.documentElement.setAttribute('data-deenapie-listeners', '1');

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || secretBusy) return;
      var input = document.getElementById('url-input');
      if (!input || document.activeElement !== input || !matchesSecret(input.value)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runSecret();
    }, true);

    document.addEventListener('click', function (event) {
      if (secretBusy) return;
      var target = event.target && event.target.closest ? event.target.closest('#fetch-btn') : null;
      if (!target) return;
      var input = document.getElementById('url-input');
      if (!input || !matchesSecret(input.value)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runSecret();
    }, true);
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherDeenapiePiesShared) {
        topWindow.FetcherDeenapiePiesShared = { pies: [], nextId: 1, timer: null, running: false };
      }
      return topWindow.FetcherDeenapiePiesShared;
    } catch (e) {
      if (!window.FetcherDeenapiePiesShared) window.FetcherDeenapiePiesShared = { pies: [], nextId: 1, timer: null, running: false };
      return window.FetcherDeenapiePiesShared;
    }
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-deenapie-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function piePalette() {
    return pick([
      { crust:'#F5D2E6', fill:'#FE5D9F', detail:'#F6E9F8', outline:'#C94B84' },
      { crust:'#F4BBD3', fill:'#F98CB9', detail:'#F6E9F8', outline:'#B94B7A' },
      { crust:'#F5D2E6', fill:'#F4BBD3', detail:'#FE5D9F', outline:'#AD5B82' },
      { crust:'#F6E9F8', fill:'#F98CB9', detail:'#F5D2E6', outline:'#B84A79' }
    ]);
  }

  function makePie(offsetMs) {
    var viewportW = Math.max(720, window.innerWidth || 1280);
    var viewportH = Math.max(520, window.innerHeight || 720);
    var leftToRight = Math.random() < .54;
    var startX = leftToRight ? rand(-125, -72) : rand(viewportW + 72, viewportW + 125);
    var endX = leftToRight ? rand(viewportW + 72, viewportW + 145) : rand(-145, -72);
    var minY = Math.max(72, viewportH * .10);
    var maxY = Math.min(viewportH * .70, viewportH - 96);
    var startY = rand(minY, Math.max(minY + 90, maxY));
    var endY = Math.max(62, Math.min(viewportH * .76, startY + rand(-105, 105)));
    var colors = piePalette();
    var size = rand(46, 72);
    return {
      id: sharedState().nextId++, bornAt: Date.now() + (offsetMs || 0), duration: rand(9000, 13200),
      opacity: rand(.43, .64), startX:startX, startY:startY,
      midX:(startX + endX) / 2 + rand(-58,58), midY:((startY + endY) / 2) + rand(-62,62),
      endX:endX, endY:endY, size:size,
      r0:rand(-16,16), r1:rand(-8,8), r2:rand(-18,18),
      crust:colors.crust, fill:colors.fill, detail:colors.detail, outline:colors.outline,
      pattern:Math.floor(rand(0,3))
    };
  }

  function addSweep(shared) {
    shared.pies.push(makePie(0));
    if (Math.random() < .20) shared.pies.push(makePie(rand(420, 980)));
  }

  function prune(shared) {
    var now = Date.now();
    shared.pies = shared.pies.filter(function (pie) { return now < pie.bornAt + pie.duration + 300; });
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
      if (shared.pies.length < 3) addSweep(shared);
      schedule();
    }, rand(7600, 11800));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (!shared.running) {
      shared.running = true;
      shared.pies = [];
      addSweep(shared);
    }
    if (!masterReducedMotion() && !shared.timer) schedule();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.timer);
    shared.timer = null;
    shared.running = false;
    shared.pies = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function pieSvg(pie) {
    var decor = '';
    if (pie.pattern === 0) {
      decor = '<circle cx="48" cy="35" r="4.5" fill="' + pie.detail + '"/><circle cx="61" cy="43" r="3.5" fill="' + pie.detail + '"/><circle cx="48" cy="53" r="3.2" fill="' + pie.detail + '"/>';
    } else if (pie.pattern === 1) {
      decor = '<path d="M39 30 62 52M47 25 69 46M37 45 53 59" stroke="' + pie.detail + '" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
    } else {
      decor = '<path d="M40 36 Q53 27 66 37" fill="none" stroke="' + pie.detail + '" stroke-width="4" stroke-linecap="round"/><circle cx="54" cy="49" r="4" fill="' + pie.detail + '"/>';
    }
    return [
      '<svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">',
      '<path d="M12 40 L72 12 Q84 18 88 40 Q84 62 72 68 Z" fill="', pie.fill, '" stroke="', pie.outline, '" stroke-width="2.2" stroke-linejoin="round"/>',
      '<path d="M72 12 Q91 20 92 40 Q91 60 72 68" fill="none" stroke="', pie.crust, '" stroke-width="12" stroke-linecap="round"/>',
      '<path d="M72 15 Q87 22 88 40 Q87 58 72 65" fill="none" stroke="', pie.outline, '" stroke-width="1.7" stroke-linecap="round" opacity=".45"/>',
      '<path d="M17 40 69 17" stroke="', pie.detail, '" stroke-width="2" stroke-linecap="round" opacity=".34"/>',
      decor,
      '</svg>'
    ].join('');
  }

  function renderPie(pie) {
    var node = document.createElement('div');
    node.className = 'fetcher-deenapie-flight';
    node.setAttribute('data-deenapie-pie-id', String(pie.id));
    node.style.setProperty('--dee-sx', pie.startX + 'px');
    node.style.setProperty('--dee-sy', pie.startY + 'px');
    node.style.setProperty('--dee-mx', pie.midX + 'px');
    node.style.setProperty('--dee-my', pie.midY + 'px');
    node.style.setProperty('--dee-ex', pie.endX + 'px');
    node.style.setProperty('--dee-ey', pie.endY + 'px');
    node.style.setProperty('--dee-duration', pie.duration + 'ms');
    node.style.setProperty('--dee-delay', (-(Date.now() - pie.bornAt)) + 'ms');
    node.style.setProperty('--dee-opacity', String(pie.opacity));
    node.style.setProperty('--dee-size', pie.size + 'px');
    node.style.setProperty('--dee-r0', pie.r0 + 'deg');
    node.style.setProperty('--dee-r1', pie.r1 + 'deg');
    node.style.setProperty('--dee-r2', pie.r2 + 'deg');
    var art = document.createElement('span');
    art.className = 'fetcher-deenapie-pie';
    art.innerHTML = pieSvg(pie);
    node.appendChild(art);
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
    prune(shared);
    var live = {};
    shared.pies.forEach(function (pie) {
      live[String(pie.id)] = true;
      if (!target.querySelector('[data-deenapie-pie-id="' + pie.id + '"]')) target.appendChild(renderPie(pie));
    });
    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-deenapie-flight'), function (node) {
      if (!live[node.getAttribute('data-deenapie-pie-id')]) node.remove();
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
    syncBrowserColor();
    ensureLayer();
    syncMasterActivity();
    syncRendered();
  }

  function restoreStoredTheme() {
    if (rawStoredPalette() !== SECRET) return;
    root.setAttribute('data-easter-palette', SECRET);
    syncBrowserColor();
    syncMasterActivity();
    startRenderer();
  }

  function installHooks() {
    patchPrefs();
    patchTransition();
    installSecretListeners();
    restoreStoredTheme();
    if ((!window.FetcherPrefs || !window.FetcherEaster) && document.body) {
      window.setTimeout(installHooks, 40);
    }
  }

  document.addEventListener('fetcher:easter-change', function () {
    if (rawStoredPalette() === SECRET && !active()) root.setAttribute('data-easter-palette', SECRET);
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
      syncBrowserColor();
      if (active() && !reducedMotion()) {
        syncMasterActivity();
        if (!renderTimer) startRenderer();
      } else {
        stopRenderer();
      }
    }).observe(root, { attributes:true, attributeFilter:['data-easter-palette','data-motion','data-theme'] });
  }

  function init() {
    ensureStyles();
    installHooks();
    restoreStoredTheme();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();