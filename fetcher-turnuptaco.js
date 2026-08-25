/* TurnupTaco-only palette + ambience: hot-sauce splats and tiny taco hops. */
(function () {
  'use strict';

  var SECRET = 'turnuptaco';
  var STORAGE_KEY = 'fetcher.easterPalette';
  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var tacoTimer = null;
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
    if (document.getElementById('fetcher-turnuptaco-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-turnuptaco-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="turnuptaco"]{--bg:#F9AE00;--surface:#F2E848;--rail:#F2DA2B;--ink:#3A2400;--ink-strong:#241500;--ink-soft:#704500;--ink-faint:#91610A;--border:#FDD059;--border-strong:#FA9F48;--accent:#FA6A00;--accent-ink:#B94900;--accent-tint:#FDD059;--on-accent:#FFFFFF;--audio:#FA9F48;--audio-tint:#FDD059;--mute:#F2DA2B;--mute-tint:#F2E848;--danger:#FA6A00;--danger-tint:#FDD059;--success:#F9AE00;--success-tint:#F2E848;--shiba:#FA9F48;--shiba-deep:#FA6A00;--shiba-cream:#F2E848;}',
      'html[data-theme="dark"][data-easter-palette="turnuptaco"]{--bg:#241500;--surface:#342000;--rail:#472B00;--ink:#FFF6D5;--ink-strong:#FFFFFF;--ink-soft:#FDD059;--ink-faint:#E8AD45;--border:#684000;--border-strong:#A65B00;--accent:#FA6A00;--accent-ink:#F2E848;--accent-tint:rgba(250,106,0,.22);--on-accent:#241500;--audio:#FA9F48;--audio-tint:rgba(250,159,72,.18);--mute:#F2DA2B;--mute-tint:rgba(242,218,43,.14);--danger:#FA6A00;--danger-tint:rgba(250,106,0,.18);--success:#F9AE00;--success-tint:rgba(249,174,0,.14);--shiba:#FA9F48;--shiba-deep:#FA6A00;--shiba-cream:#F2E848;}',
      '.fetcher-turnuptaco-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="turnuptaco"] .main>.stage,html[data-easter-palette="turnuptaco"] .main>.foot,html[data-easter-palette="turnuptaco"] .main>.settings-nav,html[data-easter-palette="turnuptaco"] .main>.settings-content,html[data-easter-palette="turnuptaco"] .main>.about,html[data-easter-palette="turnuptaco"] .main>.donate,html[data-easter-palette="turnuptaco"] .main>.updates,html[data-easter-palette="turnuptaco"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-turnuptaco-splat{position:absolute;width:86px;height:86px;transform:translate(-50%,-50%) rotate(var(--tt-rot)) scale(.42);opacity:0;animation:fetcher-turnuptaco-splat 920ms cubic-bezier(.16,.82,.24,1) both;filter:drop-shadow(0 7px 12px rgba(114,63,0,.08));}',
      '.fetcher-turnuptaco-splat svg{display:block;width:100%;height:100%;overflow:visible;}',
      '.fetcher-turnuptaco-taco-run{position:absolute;left:var(--tt-start-x);bottom:18px;width:1px;height:1px;opacity:0;animation:fetcher-turnuptaco-run var(--tt-duration) linear both;will-change:transform,opacity;}',
      '.fetcher-turnuptaco-taco{position:absolute;left:0;top:0;width:var(--tt-size);height:calc(var(--tt-size) * .72);transform:translate(-50%,-100%) scaleX(var(--tt-dir));transform-origin:50% 100%;filter:drop-shadow(0 7px 10px rgba(97,55,0,.12));will-change:transform;}',
      '.fetcher-turnuptaco-taco.hops-2{animation:fetcher-turnuptaco-hop2 var(--tt-duration) cubic-bezier(.2,.72,.25,1) both;}',
      '.fetcher-turnuptaco-taco.hops-3{animation:fetcher-turnuptaco-hop3 var(--tt-duration) cubic-bezier(.2,.72,.25,1) both;}',
      '.fetcher-turnuptaco-taco svg{display:block;width:100%;height:100%;overflow:visible;}',
      '.fetcher-turnuptaco-transition{position:fixed;inset:0;z-index:10030;pointer-events:auto;background:#F9AE00;opacity:0;transition:opacity 620ms cubic-bezier(.45,0,.55,1);}',
      '.fetcher-turnuptaco-transition.show{opacity:1;}',
      '.fetcher-turnuptaco-transition.reveal{opacity:0;transition-duration:1100ms;}',
      '@keyframes fetcher-turnuptaco-splat{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--tt-rot)) scale(.42);}18%{opacity:.9;}48%{opacity:.84;transform:translate(-50%,-50%) rotate(var(--tt-rot)) scale(1.08);}72%{opacity:.64;transform:translate(-50%,-50%) rotate(var(--tt-rot)) scale(.98);}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--tt-rot)) scale(1.12);}}',
      '@keyframes fetcher-turnuptaco-run{0%{opacity:0;transform:translate3d(0,0,0);}7%{opacity:var(--tt-opacity);}92%{opacity:var(--tt-opacity);}100%{opacity:0;transform:translate3d(var(--tt-distance),0,0);}}',
      '@keyframes fetcher-turnuptaco-hop2{0%{transform:translate(-50%,-100%) scaleX(var(--tt-dir)) scaleY(.86);}8%{transform:translate(-50%,-112%) scaleX(var(--tt-dir)) scaleY(1.06);}24%{transform:translate(-50%,-205%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt1)) scaleY(1.02);}42%{transform:translate(-50%,-100%) scaleX(var(--tt-dir-108)) scaleY(.78);}50%{transform:translate(-50%,-112%) scaleX(var(--tt-dir)) scaleY(1.05);}70%{transform:translate(-50%,-188%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt2));}90%{transform:translate(-50%,-100%) scaleX(var(--tt-dir-106)) scaleY(.80);}100%{transform:translate(-50%,-100%) scaleX(var(--tt-dir));}}',
      '@keyframes fetcher-turnuptaco-hop3{0%{transform:translate(-50%,-100%) scaleX(var(--tt-dir)) scaleY(.86);}6%{transform:translate(-50%,-111%) scaleX(var(--tt-dir)) scaleY(1.05);}18%{transform:translate(-50%,-188%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt1));}31%{transform:translate(-50%,-100%) scaleX(var(--tt-dir-107)) scaleY(.79);}38%{transform:translate(-50%,-111%) scaleX(var(--tt-dir)) scaleY(1.04);}50%{transform:translate(-50%,-205%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt2));}64%{transform:translate(-50%,-100%) scaleX(var(--tt-dir-108)) scaleY(.78);}71%{transform:translate(-50%,-111%) scaleX(var(--tt-dir)) scaleY(1.04);}83%{transform:translate(-50%,-177%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt3));}94%{transform:translate(-50%,-100%) scaleX(var(--tt-dir-105)) scaleY(.81);}100%{transform:translate(-50%,-100%) scaleX(var(--tt-dir));}}',
      'html[data-motion="reduced"] .fetcher-turnuptaco-layer{display:none!important;}',
      'html[data-motion="reduced"] .fetcher-turnuptaco-transition{transition-duration:180ms!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#241500' : '#F9AE00');
  }

  function applyTurnupTacoPalette() {
    try { window.sessionStorage.setItem(STORAGE_KEY, SECRET); } catch (e) {}
    root.setAttribute('data-easter-palette', SECRET);
    syncBrowserColor();
    syncTacoActivity();
    ensureLayer();
    try { document.dispatchEvent(new CustomEvent('fetcher:easter-change', { detail: { palette: SECRET } })); } catch (e) {}
  }

  function patchPrefs() {
    var prefs = window.FetcherPrefs;
    if (!prefs || prefs.__turnupTacoPatched) return !!prefs;
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
        applyTurnupTacoPalette();
        return;
      }
      if (originalSet) originalSet(value);
    };

    prefs.applyEasterPalette = function () {
      if (rawStoredPalette() === SECRET) {
        root.setAttribute('data-easter-palette', SECRET);
        syncBrowserColor();
        syncTacoActivity();
        ensureLayer();
        return;
      }
      if (originalApply) originalApply();
    };

    prefs.__turnupTacoPatched = true;
    return true;
  }

  function runTransition() {
    ensureStyles();
    if (!document.body || motionMode() === 'reduced') {
      applyTurnupTacoPalette();
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      var wash = document.createElement('div');
      wash.className = 'fetcher-turnuptaco-transition';
      wash.setAttribute('aria-hidden', 'true');
      document.body.appendChild(wash);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { wash.classList.add('show'); });
      });
      window.setTimeout(function () {
        applyTurnupTacoPalette();
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
    if (!controller || controller.__turnupTacoPatched) return !!controller;
    var original = controller.transitionTo ? controller.transitionTo.bind(controller) : null;
    controller.transitionTo = function (name) {
      if (String(name || '').trim().toLowerCase() === SECRET) return runTransition();
      return original ? original(name) : Promise.resolve();
    };
    controller.__turnupTacoPatched = true;
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
      Promise.resolve(runTransition()).catch(function () { applyTurnupTacoPalette(); }).then(function () {
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
    if (document.documentElement.getAttribute('data-turnuptaco-listeners') === '1') return;
    document.documentElement.setAttribute('data-turnuptaco-listeners', '1');

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
      var fetchTarget = event.target && event.target.closest ? event.target.closest('#fetch-btn') : null;
      if (!fetchTarget) return;
      var input = document.getElementById('url-input');
      if (!input || !matchesSecret(input.value)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runSecret();
    }, true);
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-turnuptaco-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function splatSvg(fill, detail) {
    return [
      '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">',
      '<path d="M51 18c8 0 11 9 18 12 8 3 18-1 22 7 4 9-7 14-8 22-1 7 7 14 2 21-5 7-14 0-22 2-8 2-10 12-19 11-9-1-8-12-15-17-6-5-17-2-20-11-3-9 8-13 11-21 3-8-2-17 6-22 8-5 14 5 22 6 8 1 15-11 23-9Z" fill="', fill, '"/>',
      '<circle cx="17" cy="24" r="6" fill="', detail, '"/>',
      '<circle cx="83" cy="16" r="4.5" fill="', detail, '"/>',
      '<circle cx="91" cy="69" r="5.3" fill="', fill, '"/>',
      '<circle cx="22" cy="86" r="3.8" fill="', fill, '"/>',
      '<ellipse cx="49" cy="50" rx="18" ry="9" fill="', detail, '" opacity=".20" transform="rotate(-18 49 50)"/>',
      '</svg>'
    ].join('');
  }

  function spawnSplat(clientX, clientY) {
    if (!active() || reducedMotion()) return;
    var target = ensureLayer();
    var parent = host();
    if (!target || !parent) return;
    var rect = parent.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    var colors = pick([
      ['#FA6A00', '#FDD059'],
      ['#FA9F48', '#F2E848'],
      ['#F9AE00', '#FA6A00'],
      ['#FDD059', '#FA9F48']
    ]);
    var node = document.createElement('span');
    node.className = 'fetcher-turnuptaco-splat';
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.width = rand(70, 96) + 'px';
    node.style.height = node.style.width;
    node.style.setProperty('--tt-rot', rand(-34, 34) + 'deg');
    node.innerHTML = splatSvg(colors[0], colors[1]);
    target.appendChild(node);
    window.setTimeout(function () { if (node.parentNode) node.remove(); }, 1050);
  }

  function backgroundClick(event) {
    if (!active() || reducedMotion() || event.defaultPrevented || event.button !== 0) return;
    var target = event.target;
    if (!target || !target.closest) return;
    var main = target.closest('.main');
    if (!main) return;
    if (target.closest('a,button,input,textarea,select,label,[role="button"],[contenteditable="true"],.segmented,.input-row,.trim-mount,.fetch-progress,.fetch-status,.toast,.modal,.popover,.menu')) return;
    spawnSplat(event.clientX, event.clientY);
  }

  function tacoSvg() {
    return [
      '<svg viewBox="0 0 100 72" aria-hidden="true" focusable="false">',
      '<path d="M12 54 Q24 12 50 12 Q76 12 88 54 Z" fill="#FDD059" stroke="#FA6A00" stroke-width="4" stroke-linejoin="round"/>',
      '<path d="M20 50 Q31 24 50 23 Q69 24 80 50" fill="none" stroke="#F2DA2B" stroke-width="9" stroke-linecap="round"/>',
      '<path d="M27 44 Q35 34 44 40 T62 39 T75 45" fill="none" stroke="#FA9F48" stroke-width="7" stroke-linecap="round"/>',
      '<path d="M31 35 Q38 29 45 34 M54 34 Q61 28 68 35" fill="none" stroke="#F2E848" stroke-width="5" stroke-linecap="round"/>',
      '<circle cx="39" cy="47" r="4" fill="#FA6A00"/><circle cx="58" cy="43" r="3.6" fill="#F9AE00"/><circle cx="67" cy="49" r="3" fill="#FA6A00"/>',
      '</svg>'
    ].join('');
  }

  function spawnTaco() {
    if (!active() || reducedMotion()) return;
    var target = ensureLayer();
    var parent = host();
    if (!target || !parent || target.querySelector('.fetcher-turnuptaco-taco-run')) return;
    var width = Math.max(320, parent.clientWidth || window.innerWidth || 900);
    var distance = rand(150, Math.min(310, width * .34));
    var dir = Math.random() < .5 ? 1 : -1;
    var startMin = dir > 0 ? 48 : distance + 56;
    var startMax = dir > 0 ? width - distance - 56 : width - 48;
    if (startMax <= startMin) {
      dir = 1;
      startMin = 48;
      startMax = Math.max(64, width - distance - 48);
    }
    var startX = rand(startMin, Math.max(startMin + 1, startMax));
    var hops = Math.random() < .48 ? 2 : 3;
    var duration = hops === 2 ? rand(2500, 3300) : rand(3100, 4100);

    var run = document.createElement('span');
    run.className = 'fetcher-turnuptaco-taco-run';
    run.style.setProperty('--tt-start-x', startX + 'px');
    run.style.setProperty('--tt-distance', (distance * dir) + 'px');
    run.style.setProperty('--tt-duration', duration + 'ms');
    run.style.setProperty('--tt-opacity', String(rand(.72, .9)));

    var taco = document.createElement('span');
    taco.className = 'fetcher-turnuptaco-taco hops-' + hops;
    taco.style.setProperty('--tt-size', rand(40, 54) + 'px');
    taco.style.setProperty('--tt-dir', String(dir));
    taco.style.setProperty('--tt-dir-108', String(dir * 1.08));
    taco.style.setProperty('--tt-dir-107', String(dir * 1.07));
    taco.style.setProperty('--tt-dir-106', String(dir * 1.06));
    taco.style.setProperty('--tt-dir-105', String(dir * 1.05));
    taco.style.setProperty('--tt-duration', duration + 'ms');
    taco.style.setProperty('--tt-tilt1', rand(-9, 9) + 'deg');
    taco.style.setProperty('--tt-tilt2', rand(-8, 8) + 'deg');
    taco.style.setProperty('--tt-tilt3', rand(-7, 7) + 'deg');
    taco.innerHTML = tacoSvg();
    run.appendChild(taco);
    target.appendChild(run);

    window.setTimeout(function () { if (run.parentNode) run.remove(); }, duration + 160);
  }

  function scheduleTaco() {
    if (!isMaster) return;
    window.clearTimeout(tacoTimer);
    tacoTimer = null;
    if (!masterActive() || masterReducedMotion()) return;
    tacoTimer = window.setTimeout(function () {
      if (!masterActive() || masterReducedMotion()) return;
      spawnTaco();
      scheduleTaco();
    }, rand(9000, 15000));
  }

  function syncTacoActivity() {
    if (!isMaster) return;
    window.clearTimeout(tacoTimer);
    tacoTimer = null;
    if (masterActive() && !masterReducedMotion()) scheduleTaco();
  }

  function restoreStoredTheme() {
    if (rawStoredPalette() !== SECRET) return;
    root.setAttribute('data-easter-palette', SECRET);
    syncBrowserColor();
    ensureLayer();
    syncTacoActivity();
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

  document.addEventListener('click', backgroundClick, false);

  document.addEventListener('fetcher:easter-change', function () {
    if (rawStoredPalette() === SECRET && !active()) root.setAttribute('data-easter-palette', SECRET);
    if (active() && !reducedMotion()) {
      ensureLayer();
      syncTacoActivity();
    } else {
      if (layer) layer.replaceChildren();
      if (isMaster) { window.clearTimeout(tacoTimer); tacoTimer = null; }
    }
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.motion') {
      if (active() && !reducedMotion()) {
        ensureLayer();
        syncTacoActivity();
      } else {
        if (layer) layer.replaceChildren();
        if (isMaster) { window.clearTimeout(tacoTimer); tacoTimer = null; }
      }
    }
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncBrowserColor();
      if (active() && !reducedMotion()) {
        ensureLayer();
        if (isMaster && !tacoTimer) syncTacoActivity();
      } else if (layer) {
        layer.replaceChildren();
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
