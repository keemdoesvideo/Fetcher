/* KayWordley-only palette + ambience: orange-led sunset with telephone wire, perched birds, and occasional flying birds. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;

  function rand(min, max) { return min + Math.random() * (max - min); }

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
      if (!topWindow.FetcherKayWordleySunsetSceneShared) {
        topWindow.FetcherKayWordleySunsetSceneShared = {
          flights: [],
          nextFlightId: 1,
          flightTimer: null,
          running: false
        };
      }
      return topWindow.FetcherKayWordleySunsetSceneShared;
    } catch (e) {
      if (!window.FetcherKayWordleySunsetSceneShared) {
        window.FetcherKayWordleySunsetSceneShared = { flights: [], nextFlightId: 1, flightTimer: null, running: false };
      }
      return window.FetcherKayWordleySunsetSceneShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-kaywordley-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-kaywordley-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="kaywordley"]{--bg:#FFD497;--surface:#FFF9C9;--rail:#FBA58B;--ink:#3B2B29;--ink-strong:#241817;--ink-soft:#6B4A47;--ink-faint:#835E58;--border:#FBA58B;--border-strong:#FB918F;--accent:#FB918F;--accent-ink:#7B3435;--accent-tint:#FFF9C9;--on-accent:#3B2B29;--audio:#FBA58B;--audio-tint:#FFF9C9;--mute:#FB918F;--mute-tint:#FDF29A;--danger:#FB918F;--danger-tint:#FFF9C9;--success:#FBA58B;--success-tint:#FFF9C9;--shiba:#FB918F;--shiba-deep:#FBA58B;--shiba-cream:#FFF9C9;}',
      'html[data-theme="light"][data-easter-palette="kaywordley"] .rail-btn:not(.active),html[data-theme="light"][data-easter-palette="kaywordley"] .rail-toggle{color:var(--ink-soft);}',
      'html[data-easter-palette="kaywordley"] .fetcher-ambient-spark{display:none!important;}',
      '.fetcher-kaywordley-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="kaywordley"] .main>.stage,html[data-easter-palette="kaywordley"] .main>.foot,html[data-easter-palette="kaywordley"] .main>.settings-nav,html[data-easter-palette="kaywordley"] .main>.settings-content,html[data-easter-palette="kaywordley"] .main>.about,html[data-easter-palette="kaywordley"] .main>.donate,html[data-easter-palette="kaywordley"] .main>.updates,html[data-easter-palette="kaywordley"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-kaywordley-scene{position:absolute;inset:0;pointer-events:none;opacity:.82;}',
      '.fetcher-kaywordley-scene svg{width:100%;height:100%;display:block;overflow:visible;}',
      '.fetcher-kaywordley-flight{position:absolute;left:0;top:0;opacity:0;transform:translate3d(var(--kay-sx),var(--kay-sy),0) rotate(var(--kay-r0));animation:fetcher-kaywordley-flight var(--kay-duration) linear var(--kay-delay) both;will-change:transform,opacity;}',
      '.fetcher-kaywordley-flight-bird{position:absolute;left:var(--bird-left);top:var(--bird-top);width:var(--bird-size);height:calc(var(--bird-size) * .62);}',
      '.fetcher-kaywordley-flight-bird svg{width:100%;height:100%;display:block;overflow:visible;}',
      '.fetcher-kaywordley-flight-bird path{fill:rgba(72,44,34,.42);}',
      'html[data-theme="dark"][data-easter-palette="kaywordley"] .fetcher-kaywordley-flight-bird path{fill:rgba(236,199,160,.24);}',
      '@keyframes fetcher-kaywordley-flight{0%{opacity:0;transform:translate3d(var(--kay-sx),var(--kay-sy),0) rotate(var(--kay-r0));}9%{opacity:var(--kay-opacity);}50%{opacity:var(--kay-opacity);transform:translate3d(var(--kay-mx),var(--kay-my),0) rotate(var(--kay-r1));}88%{opacity:var(--kay-opacity);transform:translate3d(var(--kay-ex),var(--kay-ey),0) rotate(var(--kay-r2));}100%{opacity:0;transform:translate3d(var(--kay-ex),var(--kay-ey),0) rotate(var(--kay-r2));}}',
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

  function birdPath(size) {
    var w = size;
    var h = size * 0.62;
    var mid = w / 2;
    return [
      'M', (mid - w * 0.46).toFixed(1), (h * 0.68).toFixed(1),
      'Q', (mid - w * 0.24).toFixed(1), (h * 0.16).toFixed(1), mid.toFixed(1), (h * 0.50).toFixed(1),
      'Q', (mid + w * 0.24).toFixed(1), (h * 0.16).toFixed(1), (mid + w * 0.46).toFixed(1), (h * 0.68).toFixed(1),
      'Q', mid.toFixed(1), (h * 0.44).toFixed(1), (mid - w * 0.46).toFixed(1), (h * 0.68).toFixed(1),
      'Z'
    ].join(' ');
  }

  function createScene() {
    var scene = document.createElement('div');
    scene.className = 'fetcher-kaywordley-scene';
    scene.setAttribute('data-kaywordley-scene', '1');
    scene.innerHTML = [
      '<svg viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">',
      '<g opacity="0.46">',
      '<line x1="822" y1="148" x2="822" y2="520" stroke="rgba(71,44,34,.34)" stroke-width="4.2" stroke-linecap="round"/>',
      '<line x1="792" y1="164" x2="854" y2="164" stroke="rgba(71,44,34,.30)" stroke-width="3" stroke-linecap="round"/>',
      '<path d="M 0 180 C 180 176, 360 186, 540 196 S 860 206, 1000 198" fill="none" stroke="rgba(71,44,34,.22)" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M 0 213 C 190 205, 378 214, 548 224 S 862 235, 1000 228" fill="none" stroke="rgba(71,44,34,.18)" stroke-width="1.8" stroke-linecap="round"/>',
      '<path d="M 238 177 Q 244 168 252 176 Q 260 169 266 177 Q 257 173 252 182 Q 247 173 238 177 Z" fill="rgba(71,44,34,.40)"/>',
      '<path d="M 346 185 Q 352 176 360 184 Q 368 177 374 185 Q 365 181 360 190 Q 355 181 346 185 Z" fill="rgba(71,44,34,.38)"/>',
      '<path d="M 640 194 Q 646 185 654 193 Q 662 186 668 194 Q 659 190 654 199 Q 649 190 640 194 Z" fill="rgba(71,44,34,.40)"/>',
      '<path d="M 862 197 Q 868 188 876 196 Q 884 189 890 197 Q 881 193 876 202 Q 871 193 862 197 Z" fill="rgba(71,44,34,.38)"/>',
      '</g>',
      '</svg>'
    ].join('');
    return scene;
  }

  function buildFlightBirds(count) {
    var birds = [];
    for (var i = 0; i < count; i += 1) {
      birds.push({ size: rand(16, 24), left: i * rand(18, 30), top: i === 0 ? 0 : rand(5, 12) });
    }
    return birds;
  }

  function makeFlight() {
    var leftToRight = Math.random() < 0.5;
    var startX = leftToRight ? rand(-70, -30) : rand(window.innerWidth + 20, window.innerWidth + 70);
    var endX = leftToRight ? rand(window.innerWidth + 30, window.innerWidth + 90) : rand(-90, -30);
    var startY = rand(88, Math.max(110, window.innerHeight * 0.36));
    var endY = startY + rand(-38, 34);
    var midX = (startX + endX) / 2 + rand(-24, 24);
    var midY = Math.min(startY, endY) - rand(24, 54);
    var count = Math.random() < 0.65 ? 1 : 2;
    return {
      id: sharedState().nextFlightId++,
      bornAt: Date.now(),
      duration: rand(8200, 10800),
      opacity: rand(.58, .78),
      startX: startX,
      startY: startY,
      midX: midX,
      midY: midY,
      endX: endX,
      endY: endY,
      r0: leftToRight ? rand(-6, -1) : rand(1, 6),
      r1: leftToRight ? rand(1, 5) : rand(-5, -1),
      r2: leftToRight ? rand(4, 8) : rand(-8, -4),
      birds: buildFlightBirds(count)
    };
  }

  function pruneFlights(shared) {
    var now = Date.now();
    shared.flights = shared.flights.filter(function (flight) {
      return now < flight.bornAt + flight.duration + 200;
    });
  }

  function scheduleFlight() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.flightTimer);
    shared.flightTimer = null;
    if (!shared.running || !masterActive() || masterReducedMotion()) return;
    shared.flightTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      pruneFlights(shared);
      if (shared.flights.length < 2) shared.flights.push(makeFlight());
      scheduleFlight();
    }, rand(6800, 11200));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (!shared.running) {
      shared.running = true;
      shared.flights = [];
      shared.flights.push(makeFlight());
    }
    if (!masterReducedMotion() && !shared.flightTimer) scheduleFlight();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.flightTimer);
    shared.flightTimer = null;
    shared.running = false;
    shared.flights = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function renderFlight(flight) {
    var node = document.createElement('div');
    node.className = 'fetcher-kaywordley-flight';
    node.setAttribute('data-kaywordley-flight-id', String(flight.id));
    node.style.setProperty('--kay-sx', flight.startX + 'px');
    node.style.setProperty('--kay-sy', flight.startY + 'px');
    node.style.setProperty('--kay-mx', flight.midX + 'px');
    node.style.setProperty('--kay-my', flight.midY + 'px');
    node.style.setProperty('--kay-ex', flight.endX + 'px');
    node.style.setProperty('--kay-ey', flight.endY + 'px');
    node.style.setProperty('--kay-r0', flight.r0 + 'deg');
    node.style.setProperty('--kay-r1', flight.r1 + 'deg');
    node.style.setProperty('--kay-r2', flight.r2 + 'deg');
    node.style.setProperty('--kay-duration', flight.duration + 'ms');
    node.style.setProperty('--kay-delay', (-(Date.now() - flight.bornAt)) + 'ms');
    node.style.setProperty('--kay-opacity', String(flight.opacity));

    flight.birds.forEach(function (bird) {
      var birdNode = document.createElement('span');
      birdNode.className = 'fetcher-kaywordley-flight-bird';
      birdNode.style.setProperty('--bird-left', bird.left + 'px');
      birdNode.style.setProperty('--bird-top', bird.top + 'px');
      birdNode.style.setProperty('--bird-size', bird.size + 'px');
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + bird.size + ' ' + (bird.size * 0.62));
      var path = document.createElementNS(ns, 'path');
      path.setAttribute('d', birdPath(bird.size));
      svg.appendChild(path);
      birdNode.appendChild(svg);
      node.appendChild(birdNode);
    });
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
    if (!target.querySelector('[data-kaywordley-scene="1"]')) target.appendChild(createScene());

    var shared = sharedState();
    pruneFlights(shared);
    var live = {};
    shared.flights.forEach(function (flight) {
      live[String(flight.id)] = true;
      if (!target.querySelector('[data-kaywordley-flight-id="' + flight.id + '"]')) target.appendChild(renderFlight(flight));
    });
    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-kaywordley-flight'), function (node) {
      if (!live[node.getAttribute('data-kaywordley-flight-id')]) node.remove();
    });
    renderTimer = window.setTimeout(syncRendered, 220);
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