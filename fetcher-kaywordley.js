/* KayWordley-only palette + ambience: orange-led sunset with distant evening aircraft and fading contrails. */
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
      if (!topWindow.FetcherKayWordleyAirTrafficShared) {
        topWindow.FetcherKayWordleyAirTrafficShared = {
          flights: [],
          nextFlightId: 1,
          flightTimer: null,
          running: false
        };
      }
      return topWindow.FetcherKayWordleyAirTrafficShared;
    } catch (e) {
      if (!window.FetcherKayWordleyAirTrafficShared) {
        window.FetcherKayWordleyAirTrafficShared = { flights: [], nextFlightId: 1, flightTimer: null, running: false };
      }
      return window.FetcherKayWordleyAirTrafficShared;
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
      '.fetcher-kaywordley-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;transform:translate3d(var(--kay-sx),var(--kay-sy),0);animation:fetcher-kaywordley-flight var(--kay-duration) linear var(--kay-delay) both;will-change:transform,opacity;}',
      '.fetcher-kaywordley-aircraft{position:absolute;left:0;top:0;width:1px;height:1px;transform:rotate(var(--kay-tilt)) scaleX(var(--kay-facing));transform-origin:0 0;}',
      '.fetcher-kaywordley-plane{position:absolute;left:0;top:0;width:var(--kay-plane-size);height:var(--kay-plane-height);transform:translate(-50%,-50%);}',
      '.fetcher-kaywordley-plane svg{width:100%;height:100%;display:block;overflow:visible;}',
      '.fetcher-kaywordley-plane path{fill:rgba(67,42,34,.58);}',
      '.fetcher-kaywordley-contrails{position:absolute;right:var(--kay-trail-offset);top:0;width:var(--kay-trail-length);height:10px;transform:translateY(-50%);opacity:var(--kay-trail-opacity);}',
      '.fetcher-kaywordley-contrail{position:absolute;right:0;width:100%;height:var(--kay-trail-width);border-radius:999px;background:linear-gradient(90deg,transparent 0%,var(--kay-trail-faint) 34%,var(--kay-trail-color) 100%);filter:blur(.25px);}',
      '.fetcher-kaywordley-contrail:first-child{top:2.5px;}',
      '.fetcher-kaywordley-contrail:last-child{bottom:2.5px;opacity:.76;}',
      'html[data-theme="dark"][data-easter-palette="kaywordley"] .fetcher-kaywordley-plane path{fill:rgba(255,225,190,.34);}',
      'html[data-theme="dark"][data-easter-palette="kaywordley"] .fetcher-kaywordley-contrails{opacity:.38;}',
      '@keyframes fetcher-kaywordley-flight{0%{opacity:0;transform:translate3d(var(--kay-sx),var(--kay-sy),0);}8%{opacity:var(--kay-opacity);}46%{opacity:var(--kay-opacity);transform:translate3d(var(--kay-mx),var(--kay-my),0);}90%{opacity:var(--kay-opacity);transform:translate3d(var(--kay-ex),var(--kay-ey),0);}100%{opacity:0;transform:translate3d(var(--kay-ex),var(--kay-ey),0);}}',
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

  function trailPalette() {
    return pick([
      { color: 'rgba(251,145,143,.56)', faint: 'rgba(251,145,143,.10)' },
      { color: 'rgba(251,165,139,.54)', faint: 'rgba(251,165,139,.09)' },
      { color: 'rgba(255,212,151,.62)', faint: 'rgba(255,212,151,.10)' }
    ]);
  }

  function makeFlight() {
    var viewportW = Math.max(720, window.innerWidth || 1280);
    var viewportH = Math.max(520, window.innerHeight || 720);
    var leftToRight = Math.random() < 0.56;
    var startX = leftToRight ? rand(-150, -70) : rand(viewportW + 70, viewportW + 150);
    var endX = leftToRight ? rand(viewportW + 70, viewportW + 170) : rand(-170, -70);
    var topBand = Math.max(70, viewportH * 0.10);
    var bottomBand = Math.min(viewportH * 0.52, viewportH - 130);
    var startY = rand(topBand, Math.max(topBand + 80, bottomBand));
    var endY = startY + rand(-54, 50);
    endY = Math.max(58, Math.min(viewportH * 0.58, endY));
    var midX = (startX + endX) / 2 + rand(-55, 55);
    var midY = ((startY + endY) / 2) + rand(-30, 22);
    var planeSize = rand(18, 30);
    var palette = trailPalette();

    return {
      id: sharedState().nextFlightId++,
      bornAt: Date.now(),
      duration: rand(12800, 18800),
      opacity: rand(.44, .64),
      startX: startX,
      startY: startY,
      midX: midX,
      midY: midY,
      endX: endX,
      endY: endY,
      facing: leftToRight ? -1 : 1,
      tilt: rand(-2.8, 2.8),
      planeSize: planeSize,
      planeHeight: planeSize * .44,
      hasTrail: Math.random() < 0.66,
      trailLength: rand(105, 220),
      trailOffset: planeSize * .34,
      trailWidth: rand(.7, 1.2),
      trailOpacity: rand(.44, .68),
      trailColor: palette.color,
      trailFaint: palette.faint
    };
  }

  function pruneFlights(shared) {
    var now = Date.now();
    shared.flights = shared.flights.filter(function (flight) {
      return now < flight.bornAt + flight.duration + 250;
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
    }, rand(5600, 9200));
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

  function planeSvg() {
    return [
      '<svg viewBox="0 0 64 28" aria-hidden="true" focusable="false">',
      '<path d="M2 15.2 22.4 12.1 37.4 2.4 43 2.4 37.2 10.8 57.5 8.8 63 12.2 57.4 15.6 37.1 16.3 43 25.7 37.3 25.7 22.3 17.2 2 15.2Z"/>',
      '</svg>'
    ].join('');
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
    node.style.setProperty('--kay-duration', flight.duration + 'ms');
    node.style.setProperty('--kay-delay', (-(Date.now() - flight.bornAt)) + 'ms');
    node.style.setProperty('--kay-opacity', String(flight.opacity));
    node.style.setProperty('--kay-facing', String(flight.facing));
    node.style.setProperty('--kay-tilt', flight.tilt + 'deg');
    node.style.setProperty('--kay-plane-size', flight.planeSize + 'px');
    node.style.setProperty('--kay-plane-height', flight.planeHeight + 'px');
    node.style.setProperty('--kay-trail-length', flight.trailLength + 'px');
    node.style.setProperty('--kay-trail-offset', flight.trailOffset + 'px');
    node.style.setProperty('--kay-trail-width', flight.trailWidth + 'px');
    node.style.setProperty('--kay-trail-opacity', String(flight.trailOpacity));
    node.style.setProperty('--kay-trail-color', flight.trailColor);
    node.style.setProperty('--kay-trail-faint', flight.trailFaint);

    var aircraft = document.createElement('div');
    aircraft.className = 'fetcher-kaywordley-aircraft';

    if (flight.hasTrail) {
      var trails = document.createElement('span');
      trails.className = 'fetcher-kaywordley-contrails';
      var trailA = document.createElement('span');
      var trailB = document.createElement('span');
      trailA.className = 'fetcher-kaywordley-contrail';
      trailB.className = 'fetcher-kaywordley-contrail';
      trails.appendChild(trailA);
      trails.appendChild(trailB);
      aircraft.appendChild(trails);
    }

    var plane = document.createElement('span');
    plane.className = 'fetcher-kaywordley-plane';
    plane.innerHTML = planeSvg();
    aircraft.appendChild(plane);
    node.appendChild(aircraft);
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