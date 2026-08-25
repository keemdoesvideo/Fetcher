/* Luumi-only ambience: crisp rising pixel hearts behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var layer = null;
  var renderTimer = null;

  var COLORS = ['#F52E6F', '#F98EA9', '#F6BCC4', '#F9CCD7'];

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(rand(0, list.length))]; }
  function active() { return root.getAttribute('data-easter-palette') === 'luumi'; }
  function reducedMotion() { return root.getAttribute('data-motion') === 'reduced'; }

  function sharedState() {
    var target = topWindow;
    try {
      if (!target.FetcherLuumiHeartShared || target.FetcherLuumiHeartShared.version !== 1) {
        target.FetcherLuumiHeartShared = {
          version: 1,
          nextId: 1,
          hearts: [],
          nextHeartAt: Date.now(),
          seeded: false
        };
      }
      return target.FetcherLuumiHeartShared;
    } catch (e) {
      if (!window.FetcherLuumiHeartShared || window.FetcherLuumiHeartShared.version !== 1) {
        window.FetcherLuumiHeartShared = {
          version: 1,
          nextId: 1,
          hearts: [],
          nextHeartAt: Date.now(),
          seeded: false
        };
      }
      return window.FetcherLuumiHeartShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-luumi-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-luumi-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="luumi"]{--bg:#FBFEFB;--surface:#FFFFFF;--rail:#F9CCD7;--ink:#4A1F2E;--ink-strong:#2D101A;--ink-soft:#7B4052;--ink-faint:#A86B7A;--border:#F6BCC4;--border-strong:#F98EA9;--accent:#F52E6F;--accent-ink:#B5164A;--accent-tint:#F9CCD7;--on-accent:#FFFFFF;--audio:#F98EA9;--audio-tint:#FCE0E7;--mute:#F6BCC4;--mute-tint:#FDEBF0;--danger:#F52E6F;--danger-tint:#F9CCD7;--success:#D95E86;--success-tint:#FCE0E7;--shiba:#F98EA9;--shiba-deep:#F52E6F;--shiba-cream:#FBFEFB;}',
      'html[data-theme="dark"][data-easter-palette="luumi"]{--bg:#251219;--surface:#321821;--rail:#421D2B;--ink:#FFF7FA;--ink-strong:#FFFFFF;--ink-soft:#F9CCD7;--ink-faint:#D98FA4;--border:#5C2A3B;--border-strong:#8C3B58;--accent:#F52E6F;--accent-ink:#F9CCD7;--accent-tint:rgba(245,46,111,.20);--on-accent:#FFFFFF;--audio:#F98EA9;--audio-tint:rgba(249,142,169,.18);--mute:#F6BCC4;--mute-tint:rgba(246,188,196,.13);--danger:#F52E6F;--danger-tint:rgba(245,46,111,.18);--success:#F98EA9;--success-tint:rgba(249,142,169,.14);--shiba:#F98EA9;--shiba-deep:#F52E6F;--shiba-cream:#F9CCD7;}',
      '.fetcher-luumi-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;contain:layout paint style;}',
      'html[data-easter-palette="luumi"] .main>.stage,html[data-easter-palette="luumi"] .main>.foot,html[data-easter-palette="luumi"] .main>.settings-nav,html[data-easter-palette="luumi"] .main>.settings-content,html[data-easter-palette="luumi"] .main>.about,html[data-easter-palette="luumi"] .main>.donate,html[data-easter-palette="luumi"] .main>.updates,html[data-easter-palette="luumi"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-luumi-heart-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;animation:fetcher-luumi-heart-rise var(--heart-duration) linear var(--heart-delay) both;will-change:transform,opacity;backface-visibility:hidden;}',
      '.fetcher-luumi-pixel-heart{position:absolute;left:0;top:0;width:var(--heart-size);height:calc(var(--heart-size)*.875);transform:translate(-50%,-50%);image-rendering:pixelated;animation:fetcher-luumi-heart-tilt var(--heart-duration) linear var(--heart-delay) both;will-change:transform;backface-visibility:hidden;}',
      '.fetcher-luumi-pixel-heart svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:crispEdges;}',
      '@keyframes fetcher-luumi-heart-rise{0%{opacity:0;transform:translate3d(var(--hx0),var(--hy0),0);}7%{opacity:var(--heart-opacity);}34%{opacity:var(--heart-opacity);transform:translate3d(var(--hx1),var(--hy1),0);}68%{opacity:var(--heart-opacity);transform:translate3d(var(--hx2),var(--hy2),0);}92%{opacity:var(--heart-opacity);}100%{opacity:0;transform:translate3d(var(--hx3),var(--hy3),0);}}',
      '@keyframes fetcher-luumi-heart-tilt{0%{transform:translate(-50%,-50%) rotate(var(--hr0)) scale(1);}35%{transform:translate(-50%,-50%) rotate(var(--hr1)) scale(1);}68%{transform:translate(-50%,-50%) rotate(var(--hr2)) scale(1);}100%{transform:translate(-50%,-50%) rotate(var(--hr3)) scale(1);}}',
      'html[data-motion="reserved"] .fetcher-luumi-heart-flight,html[data-motion="reserved"] .fetcher-luumi-pixel-heart{animation-timing-function:linear;}',
      'html[data-motion="reduced"] .fetcher-luumi-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    clearLayer();
    layer = document.createElement('div');
    layer.className = 'fetcher-luumi-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function clearLayer() {
    if (layer && layer.parentNode) layer.remove();
    layer = null;
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#251219' : '#FBFEFB');
  }

  function heartSvg(color, highlight) {
    return [
      '<svg viewBox="0 0 8 7" aria-hidden="true" focusable="false">',
      '<g fill="', color, '">',
      '<rect x="1" y="0" width="2" height="1"/><rect x="5" y="0" width="2" height="1"/>',
      '<rect x="0" y="1" width="4" height="1"/><rect x="4" y="1" width="4" height="1"/>',
      '<rect x="0" y="2" width="8" height="2"/>',
      '<rect x="1" y="4" width="6" height="1"/>',
      '<rect x="2" y="5" width="4" height="1"/>',
      '<rect x="3" y="6" width="2" height="1"/>',
      '</g>',
      '<rect x="1" y="1" width="1" height="1" fill="', highlight, '" opacity=".68"/>',
      '</svg>'
    ].join('');
  }

  function createHeart(now, ageOffset) {
    var startX = rand(8, 92);
    var drift = rand(-8, 8);
    var wobble = rand(-3.5, 3.5);
    var duration = rand(11500, 16500);
    var color = pick(COLORS);
    var highlight = color === '#F52E6F' ? '#F98EA9' : '#FBFEFB';
    var rotate = rand(-4, 4);
    return {
      id: sharedState().nextId++,
      bornAt: now - (ageOffset || 0),
      duration: duration,
      size: rand(13, 24),
      opacity: rand(.62, .88),
      color: color,
      highlight: highlight,
      x0: startX,
      x1: startX + drift * .30 + wobble,
      x2: startX + drift * .68 - wobble * .35,
      x3: startX + drift,
      y0: rand(103, 116),
      y1: rand(67, 76),
      y2: rand(29, 41),
      y3: rand(-18, -8),
      r0: rotate,
      r1: rotate + rand(-3, 3),
      r2: rotate + rand(-4, 4),
      r3: rotate + rand(-2, 2)
    };
  }

  function seedHearts(state, now) {
    if (state.seeded) return;
    state.seeded = true;
    for (var i = 0; i < 5; i += 1) {
      state.hearts.push(createHeart(now, rand(0, 11000)));
    }
    state.nextHeartAt = now + rand(1500, 2300);
  }

  function maintainShared() {
    var state = sharedState();
    var now = Date.now();
    seedHearts(state, now);
    state.hearts = state.hearts.filter(function (heart) {
      return now < heart.bornAt + heart.duration + 250;
    });
    if (now >= state.nextHeartAt) {
      if (state.hearts.length < 8) state.hearts.push(createHeart(now, 0));
      state.nextHeartAt = now + rand(1500, 2600);
    }
    return state;
  }

  function renderHeart(heart) {
    var target = ensureLayer();
    if (!target) return;
    var age = Date.now() - heart.bornAt;

    var flight = document.createElement('span');
    flight.className = 'fetcher-luumi-heart-flight';
    flight.setAttribute('data-luumi-heart-id', String(heart.id));
    flight.style.setProperty('--heart-duration', heart.duration + 'ms');
    flight.style.setProperty('--heart-delay', (-age) + 'ms');
    flight.style.setProperty('--heart-opacity', String(heart.opacity));
    flight.style.setProperty('--hx0', heart.x0 + 'vw');
    flight.style.setProperty('--hx1', heart.x1 + 'vw');
    flight.style.setProperty('--hx2', heart.x2 + 'vw');
    flight.style.setProperty('--hx3', heart.x3 + 'vw');
    flight.style.setProperty('--hy0', heart.y0 + 'vh');
    flight.style.setProperty('--hy1', heart.y1 + 'vh');
    flight.style.setProperty('--hy2', heart.y2 + 'vh');
    flight.style.setProperty('--hy3', heart.y3 + 'vh');

    var art = document.createElement('span');
    art.className = 'fetcher-luumi-pixel-heart';
    art.style.setProperty('--heart-size', heart.size + 'px');
    art.style.setProperty('--heart-duration', heart.duration + 'ms');
    art.style.setProperty('--heart-delay', (-age) + 'ms');
    art.style.setProperty('--hr0', heart.r0 + 'deg');
    art.style.setProperty('--hr1', heart.r1 + 'deg');
    art.style.setProperty('--hr2', heart.r2 + 'deg');
    art.style.setProperty('--hr3', heart.r3 + 'deg');
    art.innerHTML = heartSvg(heart.color, heart.highlight);

    flight.appendChild(art);
    target.appendChild(flight);
  }

  function syncRendered() {
    if (!active() || reducedMotion()) {
      clearLayer();
      return;
    }

    var target = ensureLayer();
    if (!target) return;
    var state = maintainShared();
    var now = Date.now();
    var live = {};

    state.hearts.forEach(function (heart) {
      if (now >= heart.bornAt + heart.duration + 250) return;
      live[String(heart.id)] = true;
      if (!target.querySelector('[data-luumi-heart-id="' + heart.id + '"]')) renderHeart(heart);
    });

    Array.prototype.forEach.call(target.querySelectorAll('[data-luumi-heart-id]'), function (node) {
      if (!live[node.getAttribute('data-luumi-heart-id')]) node.remove();
    });
  }

  function startRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (!active() || reducedMotion()) {
      clearLayer();
      return;
    }
    ensureStyles();
    syncBrowserColor();
    ensureLayer();
    syncRendered();
    renderTimer = window.setInterval(syncRendered, 320);
  }

  function stopRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    clearLayer();
  }

  function syncAll() {
    ensureStyles();
    if (active() && !reducedMotion()) startRenderer();
    else stopRenderer();
    syncBrowserColor();
  }

  document.addEventListener('fetcher:easter-change', syncAll);
  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.motion') syncAll();
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
  });
  window.addEventListener('pageshow', syncAll);

  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      var needsFullSync = false;
      var themeOnly = false;
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === 'data-easter-palette' || mutation.attributeName === 'data-motion') needsFullSync = true;
        if (mutation.attributeName === 'data-theme') themeOnly = true;
      });
      if (needsFullSync) syncAll();
      else if (themeOnly) syncBrowserColor();
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-motion', 'data-theme'] });
  }

  function init() {
    ensureStyles();
    syncAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
