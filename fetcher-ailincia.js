/* Ailincia-only ambience: cute pink/peach bubbles that float behind Fetcher's UI and softly pop. */
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
  function active() {
    return root.getAttribute('data-easter-palette') === 'ailincia' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-ailincia-bubble-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-ailincia-bubble-styles';
    style.textContent = [
      'html[data-easter-palette="ailincia"] .fetcher-ambient-petal{display:none!important;}',

      /* The ambience is a child of .main, not a viewport overlay. */
      '.main{isolation:isolate;}',
      '.fetcher-ailincia-bubbles{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      '.main>.stage,.main>.foot,.main>.fetch-status,.main>.fetch-progress,.main>.trim-mount,.main>.fetcher-content-host{position:relative;z-index:1;}',
      '.dl-bubble,.dl-bubble-toggle,.kbd-bubble,.kbd-bubble-toggle{position:relative;z-index:2;}',

      '.fetcher-ailincia-bubble{position:absolute;left:var(--bubble-left);bottom:-100px;width:var(--bubble-size);height:var(--bubble-size);border-radius:50%;opacity:0;pointer-events:none;will-change:transform,opacity;filter:saturate(1.08);animation:fetcher-ailincia-float var(--bubble-duration) cubic-bezier(.32,.04,.38,1) var(--bubble-delay) forwards;}',
      '.fetcher-ailincia-bubble::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 29% 24%,rgba(255,255,255,.96) 0 5%,rgba(255,255,255,.64) 6% 11%,rgba(255,255,255,.18) 12% 21%,transparent 22%),radial-gradient(circle at 68% 73%,rgba(255,255,255,.18),transparent 46%),linear-gradient(145deg,var(--bubble-fill-a),var(--bubble-fill-b));border:2px solid var(--bubble-edge);box-shadow:inset -8px -12px 18px rgba(125,52,83,.10),inset 7px 8px 16px rgba(255,255,255,.18),0 6px 18px rgba(122,64,84,.10);}',
      '.fetcher-ailincia-bubble::after{content:"";position:absolute;left:22%;top:17%;width:25%;height:13%;border-radius:50%;background:rgba(255,255,255,.82);filter:blur(.25px);transform:rotate(-28deg);box-shadow:14px 12px 0 -4px rgba(255,255,255,.24);}',
      '.fetcher-ailincia-bubble.is-popping{animation:fetcher-ailincia-pop 320ms cubic-bezier(.2,.72,.3,1) forwards!important;}',
      '@keyframes fetcher-ailincia-float{0%{opacity:0;transform:translate3d(0,0,0) scale(.84);}8%{opacity:var(--bubble-opacity);}34%{transform:translate3d(var(--bubble-sway-a),-34vh,0) scale(.96);}67%{opacity:var(--bubble-opacity);transform:translate3d(var(--bubble-sway-b),-70vh,0) scale(1.03);}92%{opacity:calc(var(--bubble-opacity) * .88);}100%{opacity:0;transform:translate3d(var(--bubble-drift),calc(-100vh - 165px),0) scale(1.08);}}',
      '@keyframes fetcher-ailincia-pop{0%{opacity:var(--bubble-opacity);transform:scale(1);}48%{opacity:.76;transform:scale(1.16);}100%{opacity:0;transform:scale(1.48);}}',
      'html[data-motion="reduced"] .fetcher-ailincia-bubbles{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function bubbleHost() {
    return document.querySelector('.main') || document.body;
  }

  function ensureLayer() {
    var host = bubbleHost();
    if (!host) return null;
    if (layer && layer.isConnected && layer.parentNode === host) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-ailincia-bubbles';
    layer.setAttribute('aria-hidden', 'true');
    host.insertBefore(layer, host.firstChild);
    return layer;
  }

  function removeBubble(bubble) {
    if (bubble && bubble.parentNode) bubble.remove();
  }

  function popBubble(bubble) {
    if (!bubble || bubble.classList.contains('is-popping')) return;
    bubble.classList.add('is-popping');
    window.setTimeout(function () { removeBubble(bubble); }, 350);
  }

  function spawnBubble(delay) {
    if (!active()) return;
    var host = ensureLayer();
    if (!host) return;
    if (host.querySelectorAll('.fetcher-ailincia-bubble').length >= MAX_BUBBLES) return;

    var bubble = document.createElement('span');
    bubble.className = 'fetcher-ailincia-bubble';

    var pink = Math.random() < .52;
    var size = rand(28, 68);
    var opacity = rand(.55, .72);
    var drift = rand(-82, 82);
    var swayA = drift + rand(-38, 38);
    var swayB = drift + rand(-48, 48);
    var duration = rand(11500, 17500);

    bubble.style.setProperty('--bubble-left', rand(7, 93) + '%');
    bubble.style.setProperty('--bubble-size', size + 'px');
    bubble.style.setProperty('--bubble-opacity', opacity.toFixed(2));
    bubble.style.setProperty('--bubble-drift', drift + 'px');
    bubble.style.setProperty('--bubble-sway-a', swayA + 'px');
    bubble.style.setProperty('--bubble-sway-b', swayB + 'px');
    bubble.style.setProperty('--bubble-duration', duration + 'ms');
    bubble.style.setProperty('--bubble-delay', (delay || 0) + 'ms');

    if (pink) {
      bubble.style.setProperty('--bubble-fill-a', 'rgba(255,137,171,.78)');
      bubble.style.setProperty('--bubble-fill-b', 'rgba(255,205,218,.56)');
      bubble.style.setProperty('--bubble-edge', 'rgba(184,68,105,.66)');
    } else {
      bubble.style.setProperty('--bubble-fill-a', 'rgba(255,179,126,.80)');
      bubble.style.setProperty('--bubble-fill-b', 'rgba(255,223,190,.58)');
      bubble.style.setProperty('--bubble-edge', 'rgba(191,112,60,.62)');
    }

    host.appendChild(bubble);
    window.setTimeout(function () { removeBubble(bubble); }, duration + (delay || 0) + 600);
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
    spawnBubble(650);
    spawnBubble(1350);
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
    if (event.target && event.target.closest && event.target.closest('button,a,input,textarea,select,[role="button"]')) return;
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