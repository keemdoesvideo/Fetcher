/* Ailincia-only ambience: cute pink/peach bubbles that float behind Fetcher's UI and softly pop. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;

  var layer = null;
  var renderTimer = null;
  var pointerFrame = null;
  var lastPointer = null;
  var MAX_BUBBLES = 6;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function active() {
    return root.getAttribute('data-easter-palette') === 'ailincia' &&
      root.getAttribute('data-motion') !== 'reduced';
  }

  function masterActive() {
    try {
      var masterRoot = topWindow.document.documentElement;
      return masterRoot.getAttribute('data-easter-palette') === 'ailincia' &&
        masterRoot.getAttribute('data-motion') !== 'reduced';
    } catch (e) {
      return active();
    }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherAilinciaShared) {
        topWindow.FetcherAilinciaShared = {
          bubbles: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return topWindow.FetcherAilinciaShared;
    } catch (e) {
      if (!window.FetcherAilinciaShared) {
        window.FetcherAilinciaShared = {
          bubbles: [],
          nextId: 1,
          spawnTimer: null,
          running: false
        };
      }
      return window.FetcherAilinciaShared;
    }
  }

  function pruneShared() {
    var shared = sharedState();
    var now = Date.now();
    shared.bubbles = shared.bubbles.filter(function (bubble) {
      return !bubble.popped && now < bubble.bornAt + bubble.duration + 650;
    });
  }

  function makeBubbleModel(delay) {
    var pink = Math.random() < .52;
    var drift = rand(-82, 82);
    return {
      id: sharedState().nextId++,
      bornAt: Date.now() + (delay || 0),
      duration: rand(11500, 17500),
      pink: pink,
      size: rand(28, 68),
      opacity: rand(.58, .74),
      left: rand(7, 93),
      drift: drift,
      swayA: drift + rand(-38, 38),
      swayB: drift + rand(-48, 48),
      popped: false
    };
  }

  function addSharedBubble(delay) {
    if (!isMaster || !masterActive()) return;
    var shared = sharedState();
    pruneShared();
    if (shared.bubbles.length >= MAX_BUBBLES) return;
    shared.bubbles.push(makeBubbleModel(delay || 0));
  }

  function scheduleSharedSpawn() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    if (!shared.running || !masterActive()) return;
    shared.spawnTimer = window.setTimeout(function tick() {
      if (!shared.running || !masterActive()) return;
      addSharedBubble(0);
      scheduleSharedSpawn();
    }, rand(1500, 2600));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (shared.running) return;
    shared.running = true;
    shared.bubbles = [];
    addSharedBubble(0);
    addSharedBubble(650);
    addSharedBubble(1350);
    scheduleSharedSpawn();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.spawnTimer);
    shared.spawnTimer = null;
    shared.running = false;
    shared.bubbles = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive()) startShared();
    else stopShared();
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-ailincia-bubble-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-ailincia-bubble-styles';
    style.textContent = [
      'html[data-easter-palette="ailincia"] .fetcher-ambient-petal{display:none!important;}',
      '.main{position:relative;isolation:isolate;}',
      '.fetcher-ailincia-bubbles{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      '.main>.stage,.main>.foot,.main>.settings-nav,.main>.settings-content,.main>.about,.main>.donate,.main>.updates,.main>.soon{position:relative;z-index:1;}',
      '.fetcher-ailincia-bubble{position:absolute;left:var(--bubble-left);bottom:-100px;width:var(--bubble-size);height:var(--bubble-size);border-radius:50%;opacity:0;pointer-events:none;will-change:transform,opacity;filter:saturate(1.08);animation:fetcher-ailincia-float var(--bubble-duration) cubic-bezier(.32,.04,.38,1) var(--bubble-delay) forwards;}',
      '.fetcher-ailincia-bubble::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 29% 24%,rgba(255,255,255,.98) 0 5%,rgba(255,255,255,.72) 6% 11%,rgba(255,255,255,.20) 12% 21%,transparent 22%),radial-gradient(circle at 68% 73%,rgba(255,255,255,.20),transparent 46%),linear-gradient(145deg,var(--bubble-fill-a),var(--bubble-fill-b));border:2px solid var(--bubble-edge);box-shadow:inset -8px -12px 18px rgba(125,52,83,.11),inset 7px 8px 16px rgba(255,255,255,.22),0 6px 18px rgba(122,64,84,.12);}',
      '.fetcher-ailincia-bubble::after{content:"";position:absolute;left:22%;top:17%;width:25%;height:13%;border-radius:50%;background:rgba(255,255,255,.88);filter:blur(.25px);transform:rotate(-28deg);box-shadow:14px 12px 0 -4px rgba(255,255,255,.28);}',
      '.fetcher-ailincia-pop-fx{position:absolute;width:1px;height:1px;z-index:1;pointer-events:none;}',
      '.fetcher-ailincia-pop-ring{position:absolute;left:0;top:0;width:var(--pop-size);height:var(--pop-size);margin-left:calc(var(--pop-size) / -2);margin-top:calc(var(--pop-size) / -2);border-radius:50%;border:2px solid var(--pop-ring);opacity:0;box-shadow:0 0 12px rgba(255,255,255,.22);animation:fetcher-ailincia-pop-ring 340ms cubic-bezier(.2,.72,.3,1) forwards;}',
      '.fetcher-ailincia-pop-dot{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--pop-dot);opacity:0;box-shadow:0 0 7px rgba(255,255,255,.22);animation:fetcher-ailincia-pop-dot 360ms cubic-bezier(.2,.72,.3,1) var(--pop-delay) forwards;}',
      '@keyframes fetcher-ailincia-float{0%{opacity:0;transform:translate3d(0,0,0) scale(.84);}8%{opacity:var(--bubble-opacity);}34%{transform:translate3d(var(--bubble-sway-a),-34vh,0) scale(.96);}67%{opacity:var(--bubble-opacity);transform:translate3d(var(--bubble-sway-b),-70vh,0) scale(1.03);}92%{opacity:var(--bubble-opacity);}100%{opacity:0;transform:translate3d(var(--bubble-drift),calc(-100vh - 165px),0) scale(1.08);}}',
      '@keyframes fetcher-ailincia-pop-ring{0%{opacity:.92;transform:scale(.28);}48%{opacity:.72;}100%{opacity:0;transform:scale(1.55);}}',
      '@keyframes fetcher-ailincia-pop-dot{0%{opacity:.92;transform:translate(0,0) scale(.45);}100%{opacity:0;transform:translate(var(--pop-x),var(--pop-y)) scale(.95);}}',
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

  function applyBubbleTone(node, pink) {
    if (pink) {
      node.style.setProperty('--bubble-fill-a', 'rgba(255,137,171,.82)');
      node.style.setProperty('--bubble-fill-b', 'rgba(255,205,218,.62)');
      node.style.setProperty('--bubble-edge', 'rgba(184,68,105,.72)');
    } else {
      node.style.setProperty('--bubble-fill-a', 'rgba(255,179,126,.84)');
      node.style.setProperty('--bubble-fill-b', 'rgba(255,223,190,.64)');
      node.style.setProperty('--bubble-edge', 'rgba(191,112,60,.68)');
    }
  }

  function createBubbleNode(model) {
    var node = document.createElement('span');
    node.className = 'fetcher-ailincia-bubble';
    node.setAttribute('data-bubble-id', String(model.id));
    node.setAttribute('data-bubble-tone', model.pink ? 'pink' : 'peach');
    node.style.setProperty('--bubble-left', model.left + '%');
    node.style.setProperty('--bubble-size', model.size + 'px');
    node.style.setProperty('--bubble-opacity', model.opacity.toFixed(2));
    node.style.setProperty('--bubble-drift', model.drift + 'px');
    node.style.setProperty('--bubble-sway-a', model.swayA + 'px');
    node.style.setProperty('--bubble-sway-b', model.swayB + 'px');
    node.style.setProperty('--bubble-duration', model.duration + 'ms');
    var elapsed = Date.now() - model.bornAt;
    node.style.setProperty('--bubble-delay', (-elapsed) + 'ms');
    applyBubbleTone(node, model.pink);
    return node;
  }

  function spawnPopFx(bubble) {
    if (!layer || !bubble) return;
    var rect = bubble.getBoundingClientRect();
    var hostRect = layer.getBoundingClientRect();
    var fx = document.createElement('span');
    fx.className = 'fetcher-ailincia-pop-fx';
    fx.style.left = (rect.left - hostRect.left + rect.width / 2) + 'px';
    fx.style.top = (rect.top - hostRect.top + rect.height / 2) + 'px';
    fx.style.setProperty('--pop-size', Math.max(24, rect.width * .78) + 'px');

    var pink = bubble.getAttribute('data-bubble-tone') !== 'peach';
    fx.style.setProperty('--pop-ring', pink ? 'rgba(255,244,248,.92)' : 'rgba(255,247,236,.92)');
    fx.style.setProperty('--pop-dot', pink ? 'rgba(255,174,198,.92)' : 'rgba(255,199,151,.94)');

    var ring = document.createElement('span');
    ring.className = 'fetcher-ailincia-pop-ring';
    fx.appendChild(ring);

    var dots = 3;
    for (var i = 0; i < dots; i += 1) {
      var dot = document.createElement('span');
      dot.className = 'fetcher-ailincia-pop-dot';
      var angle = (Math.PI * 2 * i / dots) + rand(-.28, .28);
      var distance = rand(16, 28);
      dot.style.setProperty('--pop-x', (Math.cos(angle) * distance) + 'px');
      dot.style.setProperty('--pop-y', (Math.sin(angle) * distance) + 'px');
      dot.style.setProperty('--pop-delay', (i * 22) + 'ms');
      fx.appendChild(dot);
    }

    layer.appendChild(fx);
    window.setTimeout(function () { if (fx.parentNode) fx.remove(); }, 430);
  }

  function popBubble(bubble) {
    if (!bubble || bubble.dataset.popping === 'true') return;
    bubble.dataset.popping = 'true';
    var id = Number(bubble.getAttribute('data-bubble-id'));
    var shared = sharedState();
    shared.bubbles.forEach(function (model) {
      if (model.id === id) model.popped = true;
    });
    spawnPopFx(bubble);
    removeBubble(bubble);
  }

  function syncRenderedBubbles() {
    window.clearTimeout(renderTimer);
    renderTimer = null;

    if (!active()) {
      if (layer) layer.replaceChildren();
      return;
    }

    ensureStyles();
    var host = ensureLayer();
    if (!host) return;
    pruneShared();

    var shared = sharedState();
    var liveIds = {};
    var now = Date.now();

    shared.bubbles.forEach(function (model) {
      if (model.popped || now >= model.bornAt + model.duration + 500) return;
      liveIds[String(model.id)] = true;
      if (!host.querySelector('[data-bubble-id="' + model.id + '"]')) {
        host.appendChild(createBubbleNode(model));
      }
    });

    Array.prototype.forEach.call(host.querySelectorAll('.fetcher-ailincia-bubble'), function (node) {
      if (!liveIds[node.getAttribute('data-bubble-id')]) node.remove();
    });

    renderTimer = window.setTimeout(syncRenderedBubbles, 160);
  }

  function stopRenderer() {
    window.clearTimeout(renderTimer);
    renderTimer = null;
    if (layer) layer.replaceChildren();
  }

  function startRenderer() {
    stopRenderer();
    if (!active()) return;
    ensureStyles();
    ensureLayer();
    syncRenderedBubbles();
  }

  function bubbleAt(x, y) {
    if (!layer || !active()) return null;
    var bubbles = Array.prototype.slice.call(layer.querySelectorAll('.fetcher-ailincia-bubble'));
    for (var i = bubbles.length - 1; i >= 0; i -= 1) {
      var bubble = bubbles[i];
      if (bubble.dataset.popping === 'true') continue;
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
    syncMasterActivity();
    if (active()) startRenderer();
    else stopRenderer();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    syncMasterActivity();
    if (active()) startRenderer();
    else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncMasterActivity();
      if (active()) {
        if (!renderTimer) startRenderer();
      } else {
        stopRenderer();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-motion'] });
  }

  function init() {
    ensureStyles();
    syncMasterActivity();
    if (active()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();