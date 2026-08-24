/* Ailincia-only ambience: dreamy pink/peach bubbles that float and softly pop. */
(function () {
  'use strict';

  var root = document.documentElement;
  var isTopWindow = true;
  try { isTopWindow = window.self === window.top; } catch (e) { isTopWindow = false; }
  if (!isTopWindow) return;

  var layer = null;
  var spawnTimer = null;
  var pointerFrame = null;
  var lastPointer = null;
  var MAX_BUBBLES = 6;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function active() {
    return root.getAttribute('data-easter-palette') === 'ailincia' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-ailincia-bubble-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-ailincia-bubble-styles';
    style.textContent = [
      '.fetcher-ailincia-bubbles{position:fixed;inset:0;z-index:2;pointer-events:none;overflow:hidden;}',
      '.fetcher-ailincia-bubble{position:absolute;left:var(--bubble-left);bottom:-90px;width:var(--bubble-size);height:var(--bubble-size);border-radius:50%;opacity:0;pointer-events:none;will-change:transform,opacity;animation:fetcher-ailincia-float var(--bubble-duration) cubic-bezier(.32,.04,.38,1) var(--bubble-delay) forwards;}',
      '.fetcher-ailincia-bubble::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 32% 27%,rgba(255,255,255,.56) 0 7%,rgba(255,255,255,.12) 16%,transparent 29%),linear-gradient(145deg,var(--bubble-fill-a),var(--bubble-fill-b));border:1px solid var(--bubble-edge);box-shadow:inset -7px -10px 18px rgba(255,255,255,.08),0 5px 22px rgba(122,64,84,.08);}',
      '.fetcher-ailincia-bubble::after{content:"";position:absolute;left:25%;top:19%;width:22%;height:12%;border-radius:50%;background:rgba(255,255,255,.40);filter:blur(.5px);transform:rotate(-28deg);}',
      '.fetcher-ailincia-bubble.is-popping{animation:fetcher-ailincia-pop 300ms cubic-bezier(.2,.72,.3,1) forwards!important;}',
      '@keyframes fetcher-ailincia-float{0%{opacity:0;transform:translate3d(0,0,0) scale(.88);}10%{opacity:var(--bubble-opacity);}34%{transform:translate3d(var(--bubble-sway-a),-34vh,0) scale(.96);}67%{opacity:var(--bubble-opacity);transform:translate3d(var(--bubble-sway-b),-70vh,0) scale(1.02);}100%{opacity:0;transform:translate3d(var(--bubble-drift),calc(-100vh - 150px),0) scale(1.05);}}',
      '@keyframes fetcher-ailincia-pop{0%{opacity:var(--bubble-opacity);transform:scale(1);}55%{opacity:.34;transform:scale(1.24);}100%{opacity:0;transform:scale(1.42);}}',
      '.rail,.stage-inner,.foot,.dl-bubble,.dl-bubble-toggle,.kbd-bubble,.kbd-bubble-toggle{position:relative;z-index:3;}',
      'html[data-motion="reduced"] .fetcher-ailincia-bubbles{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    if (!document.body) return null;
    layer = document.createElement('div');
    layer.className = 'fetcher-ailincia-bubbles';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return layer;
  }

  function removeBubble(bubble) {
    if (!bubble || !bubble.parentNode) return;
    bubble.remove();
  }

  function popBubble(bubble) {
    if (!bubble || bubble.classList.contains('is-popping')) return;
    bubble.classList.add('is-popping');
    window.setTimeout(function () { removeBubble(bubble); }, 330);
  }

  function spawnBubble(delay) {
    if (!active()) return;
    var host = ensureLayer();
    if (!host) return;
    var existing = host.querySelectorAll('.fetcher-ailincia-bubble').length;
    if (existing >= MAX_BUBBLES) return;

    var bubble = document.createElement('span');
    bubble.className = 'fetcher-ailincia-bubble';

    var palette = Math.random() < .52 ? 'pink' : 'peach';
    var size = rand(24, 58);
    var opacity = rand(.24, .42);
    var drift = rand(-78, 78);
    var swayA = drift + rand(-34, 34);
    var swayB = drift + rand(-42, 42);
    var duration = rand(11500, 17500);

    bubble.style.setProperty('--bubble-left', rand(8, 94) + '%');
    bubble.style.setProperty('--bubble-size', size + 'px');
    bubble.style.setProperty('--bubble-opacity', opacity.toFixed(2));
    bubble.style.setProperty('--bubble-drift', drift + 'px');
    bubble.style.setProperty('--bubble-sway-a', swayA + 'px');
    bubble.style.setProperty('--bubble-sway-b', swayB + 'px');
    bubble.style.setProperty('--bubble-duration', duration + 'ms');
    bubble.style.setProperty('--bubble-delay', (delay || 0) + 'ms');

    if (palette === 'pink') {
      bubble.style.setProperty('--bubble-fill-a', 'rgba(255,182,193,.30)');
      bubble.style.setProperty('--bubble-fill-b', 'rgba(255,228,225,.15)');
      bubble.style.setProperty('--bubble-edge', 'rgba(217,111,140,.34)');
    } else {
      bubble.style.setProperty('--bubble-fill-a', 'rgba(255,218,185,.34)');
      bubble.style.setProperty('--bubble-fill-b', 'rgba(255,240,245,.14)');
      bubble.style.setProperty('--bubble-edge', 'rgba(201,138,85,.28)');
    }

    host.appendChild(bubble);
    window.setTimeout(function () { removeBubble(bubble); }, duration + (delay || 0) + 500);
  }

  function scheduleNext() {
    window.clearTimeout(spawnTimer);
    if (!active()) return;
    spawnTimer = window.setTimeout(function () {
      spawnBubble(0);
      scheduleNext();
    }, rand(1500, 2600));
  }

  function stop() {
    window.clearTimeout(spawnTimer);
    spawnTimer = null;
    if (layer) layer.replaceChildren();
  }

  function start() {
    stop();
    if (!active()) return;
    ensureStyles();
    ensureLayer();
    spawnBubble(0);
    spawnBubble(700);
    spawnBubble(1500);
    scheduleNext();
  }

  function bubbleAt(x, y) {
    if (!layer || !active()) return null;
    var bubbles = Array.prototype.slice.call(layer.querySelectorAll('.fetcher-ailincia-bubble'));
    for (var i = bubbles.length - 1; i >= 0; i -= 1) {
      var bubble = bubbles[i];
      if (bubble.classList.contains('is-popping')) continue;
      var rect = bubble.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var radius = Math.max(rect.width, rect.height) * .58;
      var dx = x - cx;
      var dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) return bubble;
    }
    return null;
  }

  document.addEventListener('pointermove', function (event) {
    if (!active()) return;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(function () {
      pointerFrame = null;
      if (!lastPointer) return;
      var bubble = bubbleAt(lastPointer.x, lastPointer.y);
      if (bubble) popBubble(bubble);
    });
  }, { passive: true });

  document.addEventListener('click', function (event) {
    if (!active()) return;
    var bubble = bubbleAt(event.clientX, event.clientY);
    if (bubble) popBubble(bubble);
  }, true);

  document.addEventListener('fetcher:easter-change', function () {
    if (root.getAttribute('data-easter-palette') === 'ailincia') start();
    else stop();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    if (active()) start();
    else stop();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (root.getAttribute('data-easter-palette') === 'ailincia') {
        if (!spawnTimer && active()) start();
      } else {
        stop();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-motion'] });
  }

  function init() {
    ensureStyles();
    if (active()) start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();