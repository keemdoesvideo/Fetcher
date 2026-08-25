/* Shanjuanita-only ambience: crisp continuous falling leaves with soft sun rays. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var layer = null;
  var renderTimer = null;

  var COLORS = {
    purple: '#4D316C',
    softPurple: '#705A89',
    sage: '#A9BAAB',
    deepSage: '#869B8B',
    cream: '#F0E9DE'
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(rand(0, list.length))]; }
  function active() { return root.getAttribute('data-easter-palette') === 'shanjuanita'; }
  function reducedMotion() { return root.getAttribute('data-motion') === 'reduced'; }

  function sharedState() {
    var target = topWindow;
    try {
      if (!target.FetcherShanjuanitaShared || target.FetcherShanjuanitaShared.version !== 3) {
        target.FetcherShanjuanitaShared = {
          version: 3,
          nextId: 1,
          leaves: [],
          nextLeafAt: Date.now(),
          seeded: false
        };
      }
      return target.FetcherShanjuanitaShared;
    } catch (e) {
      if (!window.FetcherShanjuanitaShared || window.FetcherShanjuanitaShared.version !== 3) {
        window.FetcherShanjuanitaShared = {
          version: 3,
          nextId: 1,
          leaves: [],
          nextLeafAt: Date.now(),
          seeded: false
        };
      }
      return window.FetcherShanjuanitaShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-shanjuanita-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-shanjuanita-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="shanjuanita"]{--bg:#F0E9DE;--surface:#FAF7F1;--rail:#A9BAAB;--ink:#342440;--ink-strong:#21162A;--ink-soft:#5D4C68;--ink-faint:#796D7E;--border:#CCD3CA;--border-strong:#869B8B;--accent:#705A89;--accent-ink:#4D316C;--accent-tint:#E2DCE7;--on-accent:#FFFFFF;--audio:#869B8B;--audio-tint:#DCE5DD;--mute:#A9BAAB;--mute-tint:#E5E9E3;--danger:#705A89;--danger-tint:#E7DFEA;--success:#869B8B;--success-tint:#DCE5DD;--shiba:#A9BAAB;--shiba-deep:#4D316C;--shiba-cream:#F0E9DE;}',
      'html[data-theme="dark"][data-easter-palette="shanjuanita"]{--bg:#1D1724;--surface:#281F31;--rail:#33293D;--ink:#F8F4EE;--ink-strong:#FFFFFF;--ink-soft:#DED7E2;--ink-faint:#A99FAF;--border:#44374F;--border-strong:#705A89;--accent:#B4A6C0;--accent-ink:#F0E9DE;--accent-tint:rgba(112,90,137,.24);--on-accent:#1D1724;--audio:#A9BAAB;--audio-tint:rgba(169,186,171,.18);--mute:#869B8B;--mute-tint:rgba(134,155,139,.16);--danger:#B4A6C0;--danger-tint:rgba(112,90,137,.20);--success:#A9BAAB;--success-tint:rgba(169,186,171,.16);--shiba:#A9BAAB;--shiba-deep:#705A89;--shiba-cream:#F0E9DE;}',
      '.fetcher-shanjuanita-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="shanjuanita"] .main>.stage,html[data-easter-palette="shanjuanita"] .main>.foot,html[data-easter-palette="shanjuanita"] .main>.settings-nav,html[data-easter-palette="shanjuanita"] .main>.settings-content,html[data-easter-palette="shanjuanita"] .main>.about,html[data-easter-palette="shanjuanita"] .main>.donate,html[data-easter-palette="shanjuanita"] .main>.updates,html[data-easter-palette="shanjuanita"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-shanjuanita-rays{position:absolute;inset:0;overflow:hidden;opacity:.74;}',
      '.fetcher-shanjuanita-ray{position:absolute;right:-8%;top:-10%;height:88%;transform-origin:100% 0;clip-path:polygon(100% 0,72% 100%,0 100%,82% 0);background:linear-gradient(180deg,rgba(255,250,234,.38) 0%,rgba(240,233,222,.20) 40%,rgba(240,233,222,0) 100%);filter:blur(5px);animation:fetcher-shanjuanita-ray-breathe 18s ease-in-out infinite alternate;}',
      '.fetcher-shanjuanita-ray:nth-child(1){width:31%;transform:rotate(7deg);opacity:.36;animation-delay:-3s;--ray-rot:7deg;}',
      '.fetcher-shanjuanita-ray:nth-child(2){width:42%;transform:rotate(18deg);opacity:.24;animation-delay:-9s;--ray-rot:18deg;}',
      '.fetcher-shanjuanita-ray:nth-child(3){width:25%;transform:rotate(31deg);opacity:.18;animation-delay:-14s;--ray-rot:31deg;}',
      '@keyframes fetcher-shanjuanita-ray-breathe{0%{opacity:.72;filter:blur(5px);transform:rotate(var(--ray-rot,0deg)) scaleX(.98);}100%{opacity:1;filter:blur(7px);transform:rotate(var(--ray-rot,0deg)) scaleX(1.04);}}',
      'html[data-theme="dark"][data-easter-palette="shanjuanita"] .fetcher-shanjuanita-rays{opacity:.34;}',
      'html[data-theme="dark"][data-easter-palette="shanjuanita"] .fetcher-shanjuanita-ray{background:linear-gradient(180deg,rgba(240,233,222,.24) 0%,rgba(169,186,171,.10) 45%,rgba(240,233,222,0) 100%);}',
      '.fetcher-shanjuanita-leaf-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;will-change:transform,opacity;animation:fetcher-shanjuanita-leaf-fall var(--leaf-duration) linear var(--leaf-delay) both;}',
      '.fetcher-shanjuanita-leaf-svg{position:absolute;left:0;top:0;width:var(--leaf-size);height:var(--leaf-size);transform:translate(-50%,-50%) rotate(var(--spin-0)) scale(var(--scale-0));transform-origin:center;will-change:transform;animation:fetcher-shanjuanita-leaf-tumble var(--leaf-duration) linear var(--leaf-delay) both;filter:drop-shadow(0 4px 7px rgba(77,49,108,.08));}',
      '.fetcher-shanjuanita-leaf-svg svg{display:block;width:100%;height:100%;overflow:visible;}',
      '@keyframes fetcher-shanjuanita-leaf-fall{0%{opacity:0;transform:translate3d(var(--x0),var(--y0),0);}5%{opacity:var(--leaf-opacity);}33%{opacity:var(--leaf-opacity);transform:translate3d(var(--x1),var(--y1),0);}66%{opacity:var(--leaf-opacity);transform:translate3d(var(--x2),var(--y2),0);}94%{opacity:var(--leaf-opacity);}100%{opacity:0;transform:translate3d(var(--x3),var(--y3),0);}}',
      '@keyframes fetcher-shanjuanita-leaf-tumble{0%{transform:translate(-50%,-50%) rotate(var(--spin-0)) scale(var(--scale-0));}24%{transform:translate(-50%,-50%) rotate(var(--spin-1)) scale(var(--scale-1));}50%{transform:translate(-50%,-50%) rotate(var(--spin-2)) scale(var(--scale-0));}76%{transform:translate(-50%,-50%) rotate(var(--spin-3)) scale(var(--scale-1));}100%{transform:translate(-50%,-50%) rotate(var(--spin-4)) scale(var(--scale-2));}}',
      'html[data-motion="reserved"] .fetcher-shanjuanita-leaf-flight,html[data-motion="reserved"] .fetcher-shanjuanita-leaf-svg{animation-timing-function:linear;}',
      'html[data-motion="reduced"] .fetcher-shanjuanita-leaf-flight,html[data-motion="reduced"] .fetcher-shanjuanita-leaf-svg{display:none!important;}',
      'html[data-motion="reduced"] .fetcher-shanjuanita-ray{animation:none!important;opacity:.55;filter:blur(6px);}'
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
    layer.className = 'fetcher-shanjuanita-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function ensureRays(target) {
    var rays = target.querySelector('.fetcher-shanjuanita-rays');
    if (rays) return rays;
    rays = document.createElement('div');
    rays.className = 'fetcher-shanjuanita-rays';
    rays.innerHTML = '<div class="fetcher-shanjuanita-ray"></div><div class="fetcher-shanjuanita-ray"></div><div class="fetcher-shanjuanita-ray"></div>';
    target.appendChild(rays);
    return rays;
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#1D1724' : '#F0E9DE');
  }

  function leafShapePath(kind) {
    if (kind === 0) return 'M18 3 C24 4 31 11 31 18 C31 28 23 36 16 38 C8 33 6 24 8 15 C10 8 14 4 18 3 Z';
    if (kind === 1) return 'M17 4 C24 5 29 10 31 17 C32 25 28 33 19 39 C10 36 6 28 6 20 C6 12 10 6 17 4 Z';
    if (kind === 2) return 'M18 2 L24 7 L31 8 L28 15 L34 21 L28 27 L30 34 L22 33 L18 39 L14 33 L6 34 L8 27 L2 21 L8 15 L5 8 L12 7 Z';
    if (kind === 3) return 'M20 3 C27 7 31 13 30 20 C29 29 22 36 14 38 C8 33 6 26 7 18 C8 10 13 5 20 3 Z';
    return 'M18 2 C26 4 32 12 31 20 C30 31 20 39 12 37 C8 31 8 22 10 14 C12 8 15 4 18 2 Z';
  }

  function leafSvg(leaf) {
    var vein = root.getAttribute('data-theme') === 'dark' ? 'rgba(240,233,222,.16)' : 'rgba(77,49,108,.20)';
    var sideVein = root.getAttribute('data-theme') === 'dark' ? 'rgba(240,233,222,.10)' : 'rgba(77,49,108,.12)';
    var path = leafShapePath(leaf.shape);
    return [
      '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">',
      '<path d="', path, '" fill="', leaf.color, '"/>',
      '<path d="M19 6 C19 12 20 19 20 34" fill="none" stroke="', vein, '" stroke-width="1.15" stroke-linecap="round"/>',
      '<path d="M20 17 C15 16 12 13 10 10" fill="none" stroke="', sideVein, '" stroke-width=".9" stroke-linecap="round"/>',
      '<path d="M20 22 C25 20 29 17 31 14" fill="none" stroke="', sideVein, '" stroke-width=".9" stroke-linecap="round"/>',
      '</svg>'
    ].join('');
  }

  function createLeaf(now, ageOffset) {
    var colors = [COLORS.sage, COLORS.deepSage, COLORS.cream, COLORS.softPurple, COLORS.sage, COLORS.cream];
    var duration = rand(9000, 13200);
    var startX = rand(20, 112);
    var travelX = rand(120, 320);
    var widthStep = rand(0.02, 0.08);
    return {
      id: sharedState().nextId++,
      bornAt: now - (ageOffset || 0),
      duration: duration,
      startX: startX,
      x1: startX - travelX * 0.34 / 10 + rand(-widthStep, widthStep),
      x2: startX - travelX * 0.70 / 10 + rand(-widthStep, widthStep),
      x3: startX - travelX / 10,
      y0: rand(-20, -4),
      y1: rand(28, 42),
      y2: rand(62, 82),
      y3: rand(112, 124),
      opacity: rand(.62, .9),
      size: rand(10, 20),
      shape: Math.floor(rand(0, 5)),
      color: pick(colors),
      spin0: rand(-110, 70),
      spin1: rand(80, 210),
      spin2: rand(200, 360),
      spin3: rand(330, 520),
      spin4: rand(470, 700),
      scale0: rand(.92, 1.04),
      scale1: rand(.98, 1.12),
      scale2: rand(.90, 1.02)
    };
  }

  function seedLeaves(state, now) {
    if (state.seeded) return;
    state.seeded = true;
    for (var i = 0; i < 7; i += 1) {
      var leaf = createLeaf(now, rand(0, 9000));
      state.leaves.push(leaf);
    }
    state.nextLeafAt = now + rand(850, 1250);
  }

  function maintainShared() {
    var state = sharedState();
    var now = Date.now();
    seedLeaves(state, now);
    state.leaves = state.leaves.filter(function (leaf) {
      return now < leaf.bornAt + leaf.duration + 250;
    });
    if (now >= state.nextLeafAt) {
      if (state.leaves.length < 11) state.leaves.push(createLeaf(now, 0));
      state.nextLeafAt = now + rand(820, 1320);
    }
    return state;
  }

  function renderLeaf(leaf) {
    var target = ensureLayer();
    if (!target) return;
    var age = Date.now() - leaf.bornAt;
    var flight = document.createElement('span');
    flight.className = 'fetcher-shanjuanita-leaf-flight';
    flight.setAttribute('data-shanjuanita-leaf-id', String(leaf.id));
    flight.style.setProperty('--leaf-duration', leaf.duration + 'ms');
    flight.style.setProperty('--leaf-delay', (-age) + 'ms');
    flight.style.setProperty('--leaf-opacity', String(leaf.opacity));
    flight.style.setProperty('--x0', leaf.startX + 'vw');
    flight.style.setProperty('--x1', leaf.x1 + 'vw');
    flight.style.setProperty('--x2', leaf.x2 + 'vw');
    flight.style.setProperty('--x3', leaf.x3 + 'vw');
    flight.style.setProperty('--y0', leaf.y0 + 'vh');
    flight.style.setProperty('--y1', leaf.y1 + 'vh');
    flight.style.setProperty('--y2', leaf.y2 + 'vh');
    flight.style.setProperty('--y3', leaf.y3 + 'vh');

    var art = document.createElement('span');
    art.className = 'fetcher-shanjuanita-leaf-svg';
    art.style.setProperty('--leaf-size', leaf.size + 'px');
    art.style.setProperty('--leaf-duration', leaf.duration + 'ms');
    art.style.setProperty('--leaf-delay', (-age) + 'ms');
    art.style.setProperty('--spin-0', leaf.spin0 + 'deg');
    art.style.setProperty('--spin-1', leaf.spin1 + 'deg');
    art.style.setProperty('--spin-2', leaf.spin2 + 'deg');
    art.style.setProperty('--spin-3', leaf.spin3 + 'deg');
    art.style.setProperty('--spin-4', leaf.spin4 + 'deg');
    art.style.setProperty('--scale-0', String(leaf.scale0));
    art.style.setProperty('--scale-1', String(leaf.scale1));
    art.style.setProperty('--scale-2', String(leaf.scale2));
    art.innerHTML = leafSvg(leaf);
    flight.appendChild(art);
    target.appendChild(flight);
  }

  function syncRendered() {
    if (!active()) {
      if (layer) layer.replaceChildren();
      return;
    }
    var target = ensureLayer();
    if (!target) return;
    ensureRays(target);
    if (reducedMotion()) {
      Array.prototype.forEach.call(target.querySelectorAll('[data-shanjuanita-leaf-id]'), function (node) { node.remove(); });
      return;
    }

    var state = maintainShared();
    var now = Date.now();
    var live = {};

    state.leaves.forEach(function (leaf) {
      if (now >= leaf.bornAt + leaf.duration + 250) return;
      live[String(leaf.id)] = true;
      if (!target.querySelector('[data-shanjuanita-leaf-id="' + leaf.id + '"]')) renderLeaf(leaf);
    });

    Array.prototype.forEach.call(target.querySelectorAll('[data-shanjuanita-leaf-id]'), function (node) {
      if (!live[node.getAttribute('data-shanjuanita-leaf-id')]) node.remove();
    });
  }

  function startRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (!active()) return;
    ensureStyles();
    syncBrowserColor();
    ensureRays(ensureLayer());
    syncRendered();
    renderTimer = window.setInterval(syncRendered, 180);
  }

  function stopRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (!layer) return;
    var rays = layer.querySelector('.fetcher-shanjuanita-rays');
    layer.replaceChildren();
    if (rays && active()) layer.appendChild(rays);
  }

  function syncAll() {
    syncBrowserColor();
    if (active()) startRenderer();
    else stopRenderer();
  }

  document.addEventListener('fetcher:easter-change', syncAll);
  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.motion') syncAll();
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
  });
  window.addEventListener('pageshow', syncAll);
  window.addEventListener('resize', function () { if (active()) startRenderer(); });

  if (window.MutationObserver) {
    new MutationObserver(function () { syncBrowserColor(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function init() {
    ensureStyles();
    syncAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
