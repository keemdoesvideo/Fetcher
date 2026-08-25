/* TurnupTaco-only ambience: cute taco hops across the current page. */
(function () {
  'use strict';

  var root = document.documentElement;
  var layer = null;
  var tacoTimer = null;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function active() {
    return root.getAttribute('data-easter-palette') === 'turnuptaco';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
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
      '.fetcher-turnuptaco-taco-run{position:absolute;left:var(--tt-start-x);top:var(--tt-start-y);width:1px;height:1px;opacity:0;animation:fetcher-turnuptaco-run var(--tt-duration) linear both;will-change:transform,opacity;}',
      '.fetcher-turnuptaco-taco{position:absolute;left:0;top:0;width:var(--tt-size);height:calc(var(--tt-size) * .72);transform:translate(-50%,-50%) scaleX(var(--tt-dir));transform-origin:50% 100%;filter:drop-shadow(0 7px 10px rgba(97,55,0,.12));will-change:transform;}',
      '.fetcher-turnuptaco-taco.hops-2{animation:fetcher-turnuptaco-hop2 var(--tt-duration) cubic-bezier(.2,.72,.25,1) both;}',
      '.fetcher-turnuptaco-taco.hops-3{animation:fetcher-turnuptaco-hop3 var(--tt-duration) cubic-bezier(.2,.72,.25,1) both;}',
      '.fetcher-turnuptaco-taco svg{display:block;width:100%;height:100%;overflow:visible;}',
      'html[data-theme="dark"][data-easter-palette="turnuptaco"] .fetcher-turnuptaco-taco{filter:drop-shadow(0 8px 13px rgba(0,0,0,.20));}',
      '@keyframes fetcher-turnuptaco-run{0%{opacity:0;transform:translate3d(0,0,0);}6%{opacity:var(--tt-opacity);}93%{opacity:var(--tt-opacity);}100%{opacity:0;transform:translate3d(var(--tt-travel-x),var(--tt-travel-y),0);}}',
      '@keyframes fetcher-turnuptaco-hop2{0%{transform:translate(-50%,-50%) scaleX(var(--tt-dir)) scaleY(.86);}8%{transform:translate(-50%,-57%) scaleX(var(--tt-dir)) scaleY(1.06);}24%{transform:translate(-50%,-138%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt1)) scaleY(1.02);}42%{transform:translate(-50%,-50%) scaleX(var(--tt-dir-108)) scaleY(.78);}50%{transform:translate(-50%,-57%) scaleX(var(--tt-dir)) scaleY(1.05);}70%{transform:translate(-50%,-124%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt2));}90%{transform:translate(-50%,-50%) scaleX(var(--tt-dir-106)) scaleY(.80);}100%{transform:translate(-50%,-50%) scaleX(var(--tt-dir));}}',
      '@keyframes fetcher-turnuptaco-hop3{0%{transform:translate(-50%,-50%) scaleX(var(--tt-dir)) scaleY(.86);}6%{transform:translate(-50%,-57%) scaleX(var(--tt-dir)) scaleY(1.05);}18%{transform:translate(-50%,-124%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt1));}31%{transform:translate(-50%,-50%) scaleX(var(--tt-dir-107)) scaleY(.79);}38%{transform:translate(-50%,-57%) scaleX(var(--tt-dir)) scaleY(1.04);}50%{transform:translate(-50%,-140%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt2));}64%{transform:translate(-50%,-50%) scaleX(var(--tt-dir-108)) scaleY(.78);}71%{transform:translate(-50%,-57%) scaleX(var(--tt-dir)) scaleY(1.04);}83%{transform:translate(-50%,-115%) scaleX(var(--tt-dir)) rotate(var(--tt-tilt3));}94%{transform:translate(-50%,-50%) scaleX(var(--tt-dir-105)) scaleY(.81);}100%{transform:translate(-50%,-50%) scaleX(var(--tt-dir));}}',
      'html[data-motion="reduced"] .fetcher-turnuptaco-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#241500' : '#F9AE00');
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

  function currentTacos(target) {
    return Array.prototype.slice.call(target.querySelectorAll('.fetcher-turnuptaco-taco-run'));
  }

  function chooseSpawnPoint(target, width, height) {
    var existing = currentTacos(target);
    var point = { x: width / 2, y: height / 2 };
    var marginX = Math.min(72, Math.max(42, width * .07));
    var marginY = Math.min(82, Math.max(52, height * .08));

    for (var attempt = 0; attempt < 14; attempt += 1) {
      point.x = rand(marginX, Math.max(marginX + 1, width - marginX));
      point.y = rand(marginY, Math.max(marginY + 1, height - marginY));
      var clear = existing.every(function (node) {
        var ox = parseFloat(node.getAttribute('data-taco-x') || '0');
        var oy = parseFloat(node.getAttribute('data-taco-y') || '0');
        var dx = ox - point.x;
        var dy = oy - point.y;
        return Math.sqrt(dx * dx + dy * dy) > 145;
      });
      if (clear) break;
    }
    return point;
  }

  function spawnTaco() {
    if (!active() || reducedMotion()) return false;
    var target = ensureLayer();
    var parent = host();
    if (!target || !parent) return false;

    var existing = currentTacos(target);
    if (existing.length >= 4) return false;

    var width = Math.max(320, parent.clientWidth || window.innerWidth || 900);
    var height = Math.max(320, parent.clientHeight || window.innerHeight || 700);
    var point = chooseSpawnPoint(target, width, height);
    var roomLeft = point.x - 44;
    var roomRight = width - point.x - 44;
    var dir = Math.random() < .5 ? -1 : 1;
    if (dir < 0 && roomLeft < 110) dir = 1;
    if (dir > 0 && roomRight < 110) dir = -1;

    var maxDistance = Math.max(90, Math.min(230, dir > 0 ? roomRight : roomLeft));
    var distance = rand(90, Math.max(91, maxDistance));
    var travelY = rand(-26, 28);
    var hops = Math.random() < .46 ? 2 : 3;
    var duration = hops === 2 ? rand(4800, 6100) : rand(5600, 7200);

    var run = document.createElement('span');
    run.className = 'fetcher-turnuptaco-taco-run';
    run.setAttribute('data-taco-x', point.x.toFixed(1));
    run.setAttribute('data-taco-y', point.y.toFixed(1));
    run.style.setProperty('--tt-start-x', point.x + 'px');
    run.style.setProperty('--tt-start-y', point.y + 'px');
    run.style.setProperty('--tt-travel-x', (distance * dir) + 'px');
    run.style.setProperty('--tt-travel-y', travelY + 'px');
    run.style.setProperty('--tt-duration', duration + 'ms');
    run.style.setProperty('--tt-opacity', String(rand(.74, .92)));

    var taco = document.createElement('span');
    taco.className = 'fetcher-turnuptaco-taco hops-' + hops;
    taco.style.setProperty('--tt-size', rand(42, 58) + 'px');
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

    window.setTimeout(function () {
      if (run.parentNode) run.remove();
    }, duration + 180);
    return true;
  }

  function stopTacos() {
    window.clearTimeout(tacoTimer);
    tacoTimer = null;
    if (layer) layer.replaceChildren();
  }

  function scheduleTaco() {
    window.clearTimeout(tacoTimer);
    tacoTimer = null;
    if (!active() || reducedMotion()) return;

    tacoTimer = window.setTimeout(function () {
      if (!active() || reducedMotion()) return;
      spawnTaco();
      scheduleTaco();
    }, rand(1400, 2400));
  }

  function startTacos(seed) {
    window.clearTimeout(tacoTimer);
    tacoTimer = null;
    if (!active() || reducedMotion()) return;

    ensureLayer();
    if (seed && layer && currentTacos(layer).length === 0) {
      spawnTaco();
      window.setTimeout(function () {
        if (active() && !reducedMotion()) spawnTaco();
      }, 650);
    }
    scheduleTaco();
  }

  document.addEventListener('fetcher:easter-change', function () {
    if (active() && !reducedMotion()) startTacos(true);
    else stopTacos();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.motion') {
      if (active() && !reducedMotion()) startTacos(true);
      else stopTacos();
    }
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncBrowserColor();
      if (active() && !reducedMotion()) {
        ensureLayer();
        if (!tacoTimer) startTacos(false);
      } else {
        stopTacos();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-motion', 'data-theme'] });
  }

  function init() {
    ensureStyles();
    syncBrowserColor();
    if (active() && !reducedMotion()) startTacos(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();