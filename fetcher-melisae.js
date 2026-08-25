/* Melisae-only ambience: tiny playful bees buzzing behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  var layer = null;
  var renderTimer = null;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function active() { return root.getAttribute('data-easter-palette') === 'melisae'; }
  function reduced() { return root.getAttribute('data-motion') === 'reduced'; }
  function masterActive() {
    try { return topWindow.document.documentElement.getAttribute('data-easter-palette') === 'melisae'; }
    catch (e) { return active(); }
  }
  function masterReduced() {
    try { return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced'; }
    catch (e) { return reduced(); }
  }

  function shared() {
    try {
      if (!topWindow.FetcherMelisaeBeeShared || topWindow.FetcherMelisaeBeeShared.version !== 4) {
        topWindow.FetcherMelisaeBeeShared = { version: 4, bees: [], nextId: 1, timer: null, running: false };
      }
      return topWindow.FetcherMelisaeBeeShared;
    } catch (e) {
      if (!window.FetcherMelisaeBeeShared || window.FetcherMelisaeBeeShared.version !== 4) {
        window.FetcherMelisaeBeeShared = { version: 4, bees: [], nextId: 1, timer: null, running: false };
      }
      return window.FetcherMelisaeBeeShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-melisae-styles')) return;
    var s = document.createElement('style');
    s.id = 'fetcher-melisae-styles';
    s.textContent = [
      '.fetcher-melisae-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="melisae"] .main>.stage,html[data-easter-palette="melisae"] .main>.foot,html[data-easter-palette="melisae"] .main>.settings-nav,html[data-easter-palette="melisae"] .main>.settings-content,html[data-easter-palette="melisae"] .main>.about,html[data-easter-palette="melisae"] .main>.donate,html[data-easter-palette="melisae"] .main>.updates,html[data-easter-palette="melisae"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-melisae-bee-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;animation:mel-bee-flight var(--dur) linear var(--delay) both;will-change:transform,opacity;}',
      '.fetcher-melisae-bee{position:absolute;left:0;top:0;width:var(--size);height:calc(var(--size)*.78);transform:translate(-50%,-50%);animation:mel-bee-bob var(--dur) ease-in-out var(--delay) both;filter:drop-shadow(0 5px 8px rgba(75,53,86,.10));}',
      '.fetcher-melisae-bee svg{display:block;width:100%;height:100%;overflow:visible;transform:scaleX(var(--flip,1));transform-origin:center;}',
      '@keyframes mel-bee-flight{0%{opacity:0;transform:translate3d(var(--x0),var(--y0),0)}4%{opacity:var(--op)}11%{transform:translate3d(var(--x1),var(--y1),0)}16%{transform:translate3d(var(--x2),var(--y2),0)}31%{transform:translate3d(var(--x3),var(--y3),0)}37%{transform:translate3d(var(--x3),var(--y3),0)}53%{transform:translate3d(var(--x4),var(--y4),0)}62%{transform:translate3d(var(--x5),var(--y5),0)}70%{transform:translate3d(var(--x5),var(--y5),0)}84%{transform:translate3d(var(--x6),var(--y6),0)}96%{opacity:var(--op)}100%{opacity:0;transform:translate3d(var(--x7),var(--y7),0)}}',
      '@keyframes mel-bee-bob{0%,100%{transform:translate(-50%,-50%) rotate(-4deg)}11%{transform:translate(-50%,-58%) rotate(10deg)}16%{transform:translate(-50%,-52%) rotate(3deg)}31%{transform:translate(-50%,-46%) rotate(-10deg)}37%{transform:translate(-50%,-50%) rotate(-2deg)}53%{transform:translate(-50%,-59%) rotate(9deg)}62%{transform:translate(-50%,-49%) rotate(-6deg)}70%{transform:translate(-50%,-52%) rotate(-1deg)}84%{transform:translate(-50%,-57%) rotate(8deg)}}',
      'html[data-theme="dark"][data-easter-palette="melisae"] .fetcher-melisae-bee{filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));}',
      'html[data-motion="reserved"] .fetcher-melisae-bee-flight,html[data-motion="reserved"] .fetcher-melisae-bee{animation-timing-function:var(--ease);}',
      'html[data-motion="reduced"] .fetcher-melisae-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function syncColor() {
    if (!active()) return;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#211A29' : '#F8F1FC');
  }

  function host() { return document.querySelector('.main') || document.body; }
  function ensureLayer() {
    var p = host();
    if (!p) return null;
    if (layer && layer.isConnected && layer.parentNode === p) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-melisae-layer';
    layer.setAttribute('aria-hidden', 'true');
    p.insertBefore(layer, p.firstChild);
    return layer;
  }

  function art() {
    return '<svg viewBox="0 0 92 62" aria-hidden="true"><ellipse cx="31" cy="22" rx="13" ry="9" fill="#F0CBFF" opacity=".78"/><ellipse cx="48" cy="19" rx="13" ry="9" fill="#DCDCFF" opacity=".82"/><ellipse cx="49" cy="36" rx="21" ry="14" fill="#FEFFA2" stroke="#44364F" stroke-width="3"/><path d="M40 23v26M50 22v28M60 24v23" stroke="#44364F" stroke-width="5" stroke-linecap="round"/><circle cx="27" cy="36" r="8" fill="#44364F"/><circle cx="24" cy="34" r="1.5" fill="#fff"/><path d="m70 35 10 5-10 5Z" fill="#44364F"/><path d="M24 29q-4-8-10-10M30 28q1-8 6-12" fill="none" stroke="#44364F" stroke-width="2.4" stroke-linecap="round"/><circle cx="14" cy="19" r="2.3" fill="#F0CBFF" stroke="#44364F" stroke-width="1.5"/><circle cx="36" cy="16" r="2.3" fill="#DCDCFF" stroke="#44364F" stroke-width="1.5"/></svg>';
  }

  function clampPoint(p) {
    return [clamp(p[0], -8, 108), clamp(p[1], -10, 110)];
  }

  function internalRoute(kind, x, y) {
    var p;
    if (kind === 0) {
      p = [[x-2,y+1],[x+7,y-8],[x+1,y-2],[x-8,y+8],[x-2,y+2],[x+8,y+10],[x+2,y+1],[x-9,y-7]];
    } else if (kind === 1) {
      p = [[x-10,y+3],[x+9,y-9],[x+11,y-7],[x-3,y+11],[x-2,y+9],[x+16,y-3],[x+18,y-5],[x+4,y+11]];
    } else if (kind === 2) {
      p = [[x-8,y],[x+3,y-9],[x+10,y-5],[x+12,y+3],[x+6,y+10],[x-4,y+9],[x-10,y+3],[x-2,y-8]];
    } else if (kind === 3) {
      p = [[x-9,y+5],[x+5,y-5],[x+7,y-4],[x-5,y+6],[x+9,y+10],[x+10,y+9],[x-2,y-7],[x+12,y-3]];
    } else if (kind === 4) {
      p = [[x-5,y+2],[x+5,y-8],[x+11,y],[x+5,y+9],[x-5,y+8],[x-10,y],[x-3,y-7],[x+15,y-10]];
    } else {
      p = [[x,y],[x+7,y-3],[x+4,y+6],[x-5,y+8],[x-10,y+1],[x-4,y-7],[x+8,y-9],[x+15,y+3]];
    }
    return p.map(clampPoint);
  }

  function edgeRoute(edge, kind) {
    var start, end, x, y, p;
    if (edge === 'left') {
      y = rand(16, 84); start = [-6, y]; end = [106, clamp(y + rand(-18, 18), 10, 90)];
      p = [[12,y+rand(-8,8)],[28,y+rand(-14,10)],[34,y+rand(-12,12)],[49,y+rand(-4,16)],[62,y+rand(-16,8)],[76,y+rand(-8,14)]];
    } else if (edge === 'right') {
      y = rand(16, 84); start = [106, y]; end = [-6, clamp(y + rand(-18, 18), 10, 90)];
      p = [[88,y+rand(-8,8)],[72,y+rand(-14,10)],[65,y+rand(-12,12)],[51,y+rand(-4,16)],[37,y+rand(-16,8)],[22,y+rand(-8,14)]];
    } else if (edge === 'top') {
      x = rand(14, 86); start = [x, -7]; end = [clamp(x + rand(-24,24), 8, 92), 107];
      p = [[x+rand(-7,7),14],[x+rand(-13,10),28],[x+rand(-11,12),38],[x+rand(-16,7),53],[x+rand(-8,14),68],[x+rand(-12,12),82]];
    } else {
      x = rand(14, 86); start = [x, 107]; end = [clamp(x + rand(-24,24), 8, 92), -7];
      p = [[x+rand(-7,7),86],[x+rand(-13,10),72],[x+rand(-11,12),61],[x+rand(-16,7),47],[x+rand(-8,14),32],[x+rand(-12,12),17]];
    }

    if (kind === 1) {
      p[1][0] += rand(-8,8); p[2][1] += rand(8,14); p[3][0] += rand(-10,10);
    } else if (kind === 2) {
      p[2][0] += rand(-12,12); p[2][1] += rand(-10,10); p[3] = p[2].slice();
    } else if (kind === 3) {
      p[1][1] += rand(-12,12); p[3][1] += rand(-12,12); p[5][0] += rand(-8,8);
    } else if (kind === 4) {
      p[2][0] += rand(-10,10); p[3][0] += rand(10,16); p[4][0] += rand(-12,-5);
    }
    return [start].concat(p).concat([end]).map(clampPoint);
  }

  function makeBee(offset) {
    var s = shared();
    var offscreen = Math.random() < .60;
    var routeKind = Math.floor(rand(0, 6));
    var route;
    if (offscreen) {
      route = edgeRoute(pick(['left','right','top','bottom']), routeKind);
    } else {
      route = internalRoute(routeKind, rand(13, 87), rand(17, 83));
    }
    return {
      id: s.nextId++,
      bornAt: Date.now() + (offset || 0),
      duration: rand(4600, 7600),
      opacity: rand(.76, .94),
      size: rand(28, 37),
      flip: Math.random() < .5 ? -1 : 1,
      points: route
    };
  }

  function prune(s) {
    var n = Date.now();
    s.bees = s.bees.filter(function (b) { return n < b.bornAt + b.duration + 350; });
  }
  function add(s, offset) { s.bees.push(makeBee(offset || 0)); }

  function schedule() {
    if (!isMaster) return;
    var s = shared();
    clearTimeout(s.timer); s.timer = null;
    if (!s.running || !masterActive() || masterReduced()) return;
    s.timer = setTimeout(function () {
      if (!s.running || !masterActive() || masterReduced()) return;
      prune(s);
      if (s.bees.length < 3) add(s, 0);
      if (Math.random() < .24 && s.bees.length < 2) add(s, rand(500, 950));
      schedule();
    }, rand(3500, 5400));
  }

  function syncMaster() {
    if (!isMaster) return;
    var s = shared();
    if (masterActive() && !masterReduced()) {
      if (!s.running) {
        s.running = true;
        s.bees = [];
        add(s, 300);
        add(s, 1900);
      }
      if (!s.timer) schedule();
    } else {
      clearTimeout(s.timer); s.timer = null; s.running = false; s.bees = [];
    }
  }

  function render(b) {
    var t = ensureLayer();
    if (!t) return;
    var w = Math.max(320, t.clientWidth || window.innerWidth || 900);
    var h = Math.max(320, t.clientHeight || window.innerHeight || 700);
    var age = Date.now() - b.bornAt;
    var n = document.createElement('span');
    n.className = 'fetcher-melisae-bee-flight';
    n.setAttribute('data-melisae-bee-id', b.id);
    n.style.setProperty('--dur', b.duration + 'ms');
    n.style.setProperty('--delay', (-age) + 'ms');
    n.style.setProperty('--op', b.opacity);
    b.points.forEach(function (p, i) {
      n.style.setProperty('--x' + i, (p[0] * w / 100).toFixed(1) + 'px');
      n.style.setProperty('--y' + i, (p[1] * h / 100).toFixed(1) + 'px');
    });
    var a = document.createElement('span');
    a.className = 'fetcher-melisae-bee';
    a.style.setProperty('--size', b.size + 'px');
    a.style.setProperty('--flip', b.flip || 1);
    a.style.setProperty('--dur', b.duration + 'ms');
    a.style.setProperty('--delay', (-age) + 'ms');
    a.innerHTML = art();
    n.appendChild(a);
    t.appendChild(n);
  }

  function syncRendered() {
    if (!active() || reduced()) { if (layer) layer.replaceChildren(); return; }
    var t = ensureLayer();
    var s = shared();
    var now = Date.now();
    var live = {};
    if (!t) return;
    prune(s);
    s.bees.forEach(function (b) {
      if (now >= b.bornAt + b.duration + 350) return;
      live[b.id] = true;
      if (!t.querySelector('[data-melisae-bee-id="' + b.id + '"]')) render(b);
    });
    Array.prototype.forEach.call(t.querySelectorAll('[data-melisae-bee-id]'), function (n) {
      if (!live[n.getAttribute('data-melisae-bee-id')]) n.remove();
    });
  }

  function startRenderer() {
    clearInterval(renderTimer); renderTimer = null;
    if (!active() || reduced()) return;
    ensureLayer(); syncRendered();
    renderTimer = setInterval(syncRendered, 180);
  }
  function stopRenderer() { clearInterval(renderTimer); renderTimer = null; if (layer) layer.replaceChildren(); }
  function syncAll() { syncColor(); syncMaster(); if (active() && !reduced()) startRenderer(); else stopRenderer(); }

  document.addEventListener('fetcher:easter-change', syncAll);
  document.addEventListener('fetcher:pref-change', function (e) {
    if (!e || !e.detail) return;
    if (e.detail.key === 'fetcher.motion') syncAll();
    if (e.detail.key === 'fetcher.theme') syncColor();
  });
  window.addEventListener('pageshow', syncAll);
  window.addEventListener('resize', function () { if (active() && !reduced()) startRenderer(); });
  if (window.MutationObserver) new MutationObserver(syncColor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  function init() { ensureStyles(); syncAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
