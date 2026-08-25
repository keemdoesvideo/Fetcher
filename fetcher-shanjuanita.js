/* Shanjuanita-only ambience: continuous diagonal falling leaves with soft sun rays. */
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
  function active() { return root.getAttribute('data-easter-palette') === 'shanjuanita'; }
  function reducedMotion() { return root.getAttribute('data-motion') === 'reduced'; }

  function sharedState() {
    var target = topWindow;
    try {
      if (!target.FetcherShanjuanitaShared || target.FetcherShanjuanitaShared.version !== 2) {
        target.FetcherShanjuanitaShared = {
          version: 2,
          nextId: 1,
          leaves: [],
          nextLeafAt: Date.now(),
          seeded: false
        };
      }
      return target.FetcherShanjuanitaShared;
    } catch (e) {
      if (!window.FetcherShanjuanitaShared || window.FetcherShanjuanitaShared.version !== 2) {
        window.FetcherShanjuanitaShared = {
          version: 2,
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
      '.fetcher-shanjuanita-ray:nth-child(1){width:31%;transform:rotate(7deg);opacity:.36;animation-delay:-3s;}',
      '.fetcher-shanjuanita-ray:nth-child(2){width:42%;transform:rotate(18deg);opacity:.24;animation-delay:-9s;}',
      '.fetcher-shanjuanita-ray:nth-child(3){width:25%;transform:rotate(31deg);opacity:.18;animation-delay:-14s;}',
      '@keyframes fetcher-shanjuanita-ray-breathe{0%{opacity:.72;filter:blur(5px);transform:rotate(var(--ray-rot,0deg)) scaleX(.98);}100%{opacity:1;filter:blur(7px);transform:rotate(var(--ray-rot,0deg)) scaleX(1.04);}}',
      '.fetcher-shanjuanita-ray:nth-child(1){--ray-rot:7deg;}.fetcher-shanjuanita-ray:nth-child(2){--ray-rot:18deg;}.fetcher-shanjuanita-ray:nth-child(3){--ray-rot:31deg;}',
      'html[data-theme="dark"][data-easter-palette="shanjuanita"] .fetcher-shanjuanita-rays{opacity:.34;}',
      'html[data-theme="dark"][data-easter-palette="shanjuanita"] .fetcher-shanjuanita-ray{background:linear-gradient(180deg,rgba(240,233,222,.24) 0%,rgba(169,186,171,.10) 45%,rgba(240,233,222,0) 100%);}',
      '.fetcher-shanjuanita-leaf-flight{position:absolute;left:var(--leaf-x);top:-12%;width:var(--leaf-size);height:calc(var(--leaf-size)*.70);opacity:0;transform-origin:center;animation:fetcher-shanjuanita-leaf-fall var(--leaf-duration) linear var(--leaf-delay) both;will-change:transform,opacity;}',
      '.fetcher-shanjuanita-leaf{position:absolute;inset:0;border-radius:88% 14% 88% 14%;background:var(--leaf-color);border:1px solid rgba(77,49,108,.10);filter:drop-shadow(0 4px 7px rgba(77,49,108,.07));}',
      '.fetcher-shanjuanita-leaf::before{content:"";position:absolute;left:49%;top:12%;width:1px;height:76%;background:rgba(77,49,108,.18);transform:rotate(-38deg);transform-origin:center;}',
      '.fetcher-shanjuanita-leaf::after{content:"";position:absolute;left:42%;top:43%;width:36%;height:1px;background:rgba(77,49,108,.12);transform:rotate(-18deg);transform-origin:left center;}',
      '@keyframes fetcher-shanjuanita-leaf-fall{0%{opacity:0;transform:translate3d(0,-8vh,0) rotate(var(--leaf-r0));}6%{opacity:var(--leaf-opacity);}34%{opacity:var(--leaf-opacity);transform:translate3d(calc(var(--leaf-drift)*.34),38vh,0) rotate(var(--leaf-r1));}68%{opacity:var(--leaf-opacity);transform:translate3d(calc(var(--leaf-drift)*.69),78vh,0) rotate(var(--leaf-r2));}94%{opacity:var(--leaf-opacity);}100%{opacity:0;transform:translate3d(var(--leaf-drift),120vh,0) rotate(var(--leaf-r3));}}',
      'html[data-motion="reserved"] .fetcher-shanjuanita-leaf-flight{animation-timing-function:linear;}',
      'html[data-motion="reduced"] .fetcher-shanjuanita-leaf-flight{display:none!important;}',
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

    var rays = document.createElement('div');
    rays.className = 'fetcher-shanjuanita-rays';
    rays.innerHTML = '<span class="fetcher-shanjuanita-ray"></span><span class="fetcher-shanjuanita-ray"></span><span class="fetcher-shanjuanita-ray"></span>';
    layer.appendChild(rays);

    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#1D1724' : '#F0E9DE');
  }

  function makeLeaf(state, bornAt) {
    var colors = [COLORS.deepSage, COLORS.sage, COLORS.softPurple, COLORS.cream];
    var duration = rand(9000, 13800);
    var spin = Math.random() < .5 ? -1 : 1;
    var totalRotation = rand(170, 340) * spin;
    var startRotation = rand(-55, 55);
    return {
      id: state.nextId++,
      bornAt: bornAt,
      duration: duration,
      x: rand(28, 106),
      size: rand(12, 21),
      drift: rand(-170, -82),
      opacity: rand(.46, .72),
      color: colors[Math.floor(rand(0, colors.length))],
      r0: startRotation,
      r1: startRotation + totalRotation * .34,
      r2: startRotation + totalRotation * .69,
      r3: startRotation + totalRotation
    };
  }

  function seedLeaves(state, now) {
    if (state.seeded) return;
    state.seeded = true;
    for (var i = 0; i < 6; i += 1) {
      var leaf = makeLeaf(state, now);
      leaf.bornAt = now - leaf.duration * ((i + .35) / 6.7);
      state.leaves.push(leaf);
    }
    state.nextLeafAt = now + rand(900, 1700);
  }

  function maintainShared() {
    var state = sharedState();
    var now = Date.now();
    seedLeaves(state, now);
    state.leaves = state.leaves.filter(function (leaf) {
      return now < leaf.bornAt + leaf.duration + 300;
    });

    if (!reducedMotion() && now >= state.nextLeafAt) {
      if (state.leaves.length < 7) state.leaves.push(makeLeaf(state, now));
      state.nextLeafAt = now + rand(1350, 2450);
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
    flight.style.setProperty('--leaf-x', leaf.x + '%');
    flight.style.setProperty('--leaf-size', leaf.size + 'px');
    flight.style.setProperty('--leaf-duration', leaf.duration + 'ms');
    flight.style.setProperty('--leaf-delay', (-age) + 'ms');
    flight.style.setProperty('--leaf-drift', leaf.drift + 'px');
    flight.style.setProperty('--leaf-opacity', String(leaf.opacity));
    flight.style.setProperty('--leaf-r0', leaf.r0 + 'deg');
    flight.style.setProperty('--leaf-r1', leaf.r1 + 'deg');
    flight.style.setProperty('--leaf-r2', leaf.r2 + 'deg');
    flight.style.setProperty('--leaf-r3', leaf.r3 + 'deg');

    var body = document.createElement('span');
    body.className = 'fetcher-shanjuanita-leaf';
    body.style.setProperty('--leaf-color', leaf.color);
    flight.appendChild(body);
    target.appendChild(flight);
  }

  function syncRendered() {
    if (!active()) {
      if (layer) layer.remove();
      layer = null;
      return;
    }

    var target = ensureLayer();
    if (!target) return;
    var state = maintainShared();
    var now = Date.now();
    var live = {};

    if (!reducedMotion()) {
      state.leaves.forEach(function (leaf) {
        if (now >= leaf.bornAt + leaf.duration + 300) return;
        live[String(leaf.id)] = true;
        if (!target.querySelector('[data-shanjuanita-leaf-id="' + leaf.id + '"]')) renderLeaf(leaf);
      });
    }

    Array.prototype.forEach.call(target.querySelectorAll('[data-shanjuanita-leaf-id]'), function (node) {
      if (!live[node.getAttribute('data-shanjuanita-leaf-id')]) node.remove();
    });
  }

  function startRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (!active()) return;
    ensureLayer();
    syncRendered();
    renderTimer = window.setInterval(syncRendered, 220);
  }

  function stopRenderer() {
    window.clearInterval(renderTimer);
    renderTimer = null;
    if (layer && layer.parentNode) layer.remove();
    layer = null;
  }

  function syncAll() {
    ensureStyles();
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

  if (window.MutationObserver) {
    new MutationObserver(function () { syncBrowserColor(); })
      .observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll, { once: true });
  else syncAll();
})();
