/* Launch-wide browser polish: dynamic browser chrome, milestones and tiny user delight. */
(function () {
  'use strict';

  var root = document.documentElement;
  var RETURN_404_KEY = 'fetcher.returnFrom404';
  var returningFrom404 = false;
  var isTopWindow = true;

  try {
    returningFrom404 = sessionStorage.getItem(RETURN_404_KEY) === '1';
    if (returningFrom404) root.classList.add('fetcher-return-from-404');
  } catch (e) {}
  try { isTopWindow = window.self === window.top; } catch (e) { isTopWindow = false; }

  var BASE = { light: '#F2F0EA', dark: '#19181C' };
  var EASTER = {
    light: {
      ailincia: '#FFB6C1', vitaviita: '#8993FF', stonakah: '#DDB892',
      suki: '#856B9B', kaywordley: '#FFA53D', wahibah: '#C16499',
      jackigoe: '#3E9B66', keem: '#050506'
    },
    dark: {
      ailincia: '#4A2733', vitaviita: '#26346A', stonakah: '#111114',
      suki: '#1F143C', kaywordley: '#26030B', wahibah: '#100C1D',
      jackigoe: '#14261B', keem: '#050506'
    }
  };

  var titleTimer = null;
  var titleRestore = document.title;
  var keemHaloTimer = null;
  var ambientTimer = null;
  var ambientPalette = '';
  var petCompletedThisVisit = false;

  var grooveCanvas = null;
  var grooveCtx = null;
  var groovePoints = [];
  var grooveFrame = null;
  var grooveLastPoint = null;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function motionMode() { return root.getAttribute('data-motion') || 'full'; }

  function ensureStyles() {
    if (document.getElementById('fetcher-launch-v2-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-launch-v2-styles';
    style.textContent = `
      .fetcher-ambience-v2{position:fixed;inset:0;z-index:9994;pointer-events:none;overflow:hidden;}

      .fetcher-v2-petal{
        position:absolute;width:14px;height:9px;border-radius:82% 12% 78% 18%;
        background:var(--v2-color);opacity:0;
        box-shadow:0 2px 12px color-mix(in srgb,var(--v2-color) 18%,transparent);
        animation:fetcher-v2-petal var(--v2-duration) ease-in-out var(--v2-delay) both;
      }
      @keyframes fetcher-v2-petal{
        0%{opacity:0;transform:translate3d(0,0,0) rotate(var(--v2-rot)) scale(.86);}
        12%{opacity:var(--v2-opacity);}
        76%{opacity:calc(var(--v2-opacity) * .88);}
        100%{opacity:0;transform:translate3d(var(--v2-dx),var(--v2-dy),0) rotate(calc(var(--v2-rot) + var(--v2-spin))) scale(1.04);}
      }

      .fetcher-v2-ripple{
        position:absolute;width:var(--v2-size);height:var(--v2-size);border-radius:50%;
        border:1.5px solid rgba(172,203,255,.58);opacity:0;
        box-shadow:0 0 26px rgba(137,147,255,.10),inset 0 0 16px rgba(244,250,255,.10);
        transform:translate(-50%,-50%) scale(.08);
        animation:fetcher-v2-ripple 2600ms cubic-bezier(.22,.72,.28,1) var(--v2-delay) both;
      }
      .fetcher-v2-ripple::after{
        content:"";position:absolute;inset:22%;border-radius:50%;border:1px solid rgba(219,237,255,.34);
      }
      @keyframes fetcher-v2-ripple{
        0%{opacity:0;transform:translate(-50%,-50%) scale(.08);}
        14%{opacity:.62;}
        65%{opacity:.24;}
        100%{opacity:0;transform:translate(-50%,-50%) scale(1);}
      }

      .fetcher-v2-crescent{
        position:absolute;color:rgba(217,203,226,.78);font-family:Georgia,'Times New Roman',serif;
        font-size:var(--v2-size);line-height:1;opacity:0;
        text-shadow:0 0 18px rgba(166,145,184,.30);
        animation:fetcher-v2-crescent var(--v2-duration) cubic-bezier(.45,0,.55,1) both;
      }
      .fetcher-v2-crescent-star{
        position:absolute;left:80%;top:-15%;font-size:8px;color:rgba(235,225,242,.90);
        animation:fetcher-v2-star-twinkle 1800ms ease-in-out 700ms both;
      }
      @keyframes fetcher-v2-crescent{
        0%{opacity:0;transform:translate(0,0) rotate(-5deg) scale(.88);}
        18%{opacity:.72;}
        70%{opacity:.55;transform:translate(var(--v2-orbit-x),var(--v2-orbit-y)) rotate(5deg) scale(1);}
        100%{opacity:0;transform:translate(calc(var(--v2-orbit-x) * .7),calc(var(--v2-orbit-y) * .7)) rotate(8deg) scale(.96);}
      }
      @keyframes fetcher-v2-star-twinkle{0%,100%{opacity:0;transform:scale(.4);}48%{opacity:1;transform:scale(1.25);}}

      .fetcher-v2-sunset-dust{
        position:absolute;width:var(--v2-size);height:var(--v2-size);border-radius:50%;
        background:var(--v2-color);opacity:0;filter:blur(var(--v2-blur));
        box-shadow:0 0 10px color-mix(in srgb,var(--v2-color) 25%,transparent);
        animation:fetcher-v2-sunset-dust var(--v2-duration) ease-in-out var(--v2-delay) both;
      }
      @keyframes fetcher-v2-sunset-dust{
        0%{opacity:0;transform:translate(0,8px) scale(.7);}
        20%{opacity:var(--v2-opacity);}
        72%{opacity:calc(var(--v2-opacity) * .75);transform:translate(var(--v2-dx),var(--v2-dy)) scale(1);}
        100%{opacity:0;transform:translate(calc(var(--v2-dx) * 1.15),calc(var(--v2-dy) * 1.15)) scale(.92);}
      }
      .fetcher-v2-sunset-shimmer{
        position:absolute;width:var(--v2-size);height:var(--v2-size);border-radius:50%;opacity:0;
        background:radial-gradient(circle,rgba(255,190,61,.18) 0%,rgba(255,133,61,.10) 28%,rgba(242,0,57,.045) 52%,transparent 72%);
        filter:blur(12px);transform:translate(-50%,-50%) scale(.8);
        animation:fetcher-v2-sunset-shimmer 4800ms cubic-bezier(.45,0,.55,1) both;
      }
      @keyframes fetcher-v2-sunset-shimmer{
        0%,100%{opacity:0;transform:translate(-50%,-50%) scale(.8);}
        28%{opacity:.72;}
        64%{opacity:.42;transform:translate(-50%,-50%) scale(1.08);}
      }

      .fetcher-v2-constellation{
        position:absolute;overflow:visible;opacity:0;
        filter:drop-shadow(0 0 12px rgba(254,194,168,.16));
        animation:fetcher-v2-constellation 6200ms cubic-bezier(.45,0,.55,1) both;
      }
      .fetcher-v2-constellation-line{
        stroke:rgba(254,194,168,.40);stroke-width:1.1;vector-effect:non-scaling-stroke;
        stroke-dasharray:1;stroke-dashoffset:1;opacity:0;
        animation:fetcher-v2-constellation-line 5600ms cubic-bezier(.45,0,.55,1) var(--v2-line-delay) both;
      }
      .fetcher-v2-constellation-star{
        fill:#FEC2A8;opacity:0;transform-box:fill-box;transform-origin:center;
        animation:fetcher-v2-constellation-star 5600ms cubic-bezier(.45,0,.55,1) var(--v2-star-delay) both;
      }
      @keyframes fetcher-v2-constellation{
        0%{opacity:0;transform:scale(.97);}
        10%{opacity:1;}
        82%{opacity:1;}
        100%{opacity:0;transform:scale(1.015);}
      }
      @keyframes fetcher-v2-constellation-line{
        0%,14%{opacity:0;stroke-dashoffset:1;}
        22%{opacity:.18;}
        54%{opacity:.58;stroke-dashoffset:0;}
        78%{opacity:.48;stroke-dashoffset:0;}
        100%{opacity:0;stroke-dashoffset:0;}
      }
      @keyframes fetcher-v2-constellation-star{
        0%,8%{opacity:0;transform:scale(.35);filter:none;}
        20%{opacity:.75;transform:scale(1);}
        66%{opacity:.82;transform:scale(1);filter:none;}
        76%{opacity:1;transform:scale(1.42);filter:drop-shadow(0 0 6px #FEC2A8);}
        84%{opacity:.86;transform:scale(1);filter:drop-shadow(0 0 3px #FEC2A8);}
        100%{opacity:0;transform:scale(.85);filter:none;}
      }

      .fetcher-v2-jack-bit{
        position:absolute;opacity:0;background:var(--v2-color);transform-origin:center;
        animation:fetcher-v2-jack 900ms cubic-bezier(.16,.82,.24,1) var(--v2-delay) both;
      }
      .fetcher-v2-jack-bit.rect{width:8px;height:4px;border-radius:1px;}
      .fetcher-v2-jack-bit.dot{width:6px;height:6px;border-radius:50%;}
      .fetcher-v2-jack-bit.streamer{width:12px;height:3px;border-radius:999px;}
      @keyframes fetcher-v2-jack{
        0%{opacity:0;transform:rotate(var(--v2-angle)) translateX(0) rotate(var(--v2-rot)) scale(.45);}
        16%{opacity:1;}
        68%{opacity:.82;}
        100%{opacity:0;transform:rotate(var(--v2-angle)) translateX(var(--v2-distance)) rotate(calc(var(--v2-rot) + 80deg)) scale(1);}
      }

      .fetcher-stonakah-groove{
        position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;
      }
      html.fetcher-stonakah-carve-active body{background:var(--bg)!important;}
      html.fetcher-stonakah-carve-active .app,
      html.fetcher-stonakah-carve-active .main,
      html.fetcher-stonakah-carve-active .fetcher-content-host,
      html.fetcher-stonakah-carve-active .fetcher-page-frame{
        background-color:transparent!important;
      }
      html.fetcher-stonakah-carve-active body>.app,
      html.fetcher-stonakah-carve-active body>.main{
        position:relative;z-index:1;
      }

      html[data-motion="reduced"] .fetcher-ambience-v2,
      html[data-motion="reduced"] .fetcher-stonakah-groove{display:none!important;}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  ensureStyles();

  function syncThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var easter = root.getAttribute('data-easter-palette') || '';
    var color = easter && EASTER[theme][easter] ? EASTER[theme][easter] : BASE[theme];
    meta.setAttribute('content', color);
  }

  syncThemeColor();
  if (window.MutationObserver) {
    new MutationObserver(syncThemeColor).observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-easter-palette']
    });
  }

  function foundYouTitle() {
    if (document.title !== 'found you.') titleRestore = document.title;
    window.clearTimeout(titleTimer);
    document.title = 'found you.';
    var delay = motionMode() === 'reduced' ? 650 : (motionMode() === 'reserved' ? 1500 : 2200);
    titleTimer = window.setTimeout(function () {
      if (document.title === 'found you.') document.title = titleRestore;
    }, delay);
  }

  function restoreTitleNow() {
    window.clearTimeout(titleTimer);
    if (document.title === 'found you.') document.title = titleRestore;
  }

  function clearKeemHalo() {
    window.clearTimeout(keemHaloTimer);
    var old = document.querySelector('.fetcher-name-signature-keem');
    if (old) old.remove();
  }

  function showKeemHalo() {
    if (!isTopWindow) return;
    clearKeemHalo();
    if (!document.body || motionMode() === 'reduced') return;
    var layer = document.createElement('div');
    layer.className = 'fetcher-name-signature fetcher-name-signature-keem';
    layer.setAttribute('aria-hidden', 'true');
    var halo = document.createElement('span');
    halo.className = 'fetcher-signature-halo';
    layer.appendChild(halo);
    document.body.appendChild(layer);
    keemHaloTimer = window.setTimeout(function () {
      if (layer.parentNode) layer.remove();
    }, 2600);
  }

  function ambienceLayer() {
    var layer = document.getElementById('fetcher-ambience-v2');
    if (!layer && document.body) {
      layer = document.createElement('div');
      layer.id = 'fetcher-ambience-v2';
      layer.className = 'fetcher-ambience-v2';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }

  function clearAmbience() {
    window.clearTimeout(ambientTimer);
    ambientTimer = null;
    ambientPalette = '';
    var layer = document.getElementById('fetcher-ambience-v2');
    if (layer) layer.replaceChildren();
  }

  function scheduleAmbient(fn, min, max, initial) {
    window.clearTimeout(ambientTimer);
    function tick() {
      if (!ambientPalette || motionMode() === 'reduced') return;
      fn();
      ambientTimer = window.setTimeout(tick, rand(min, max));
    }
    ambientTimer = window.setTimeout(tick, typeof initial === 'number' ? initial : rand(500, 1100));
  }

  function spawnPetals() {
    var layer = ambienceLayer();
    if (!layer) return;
    var colors = ['#FFB6C1', '#FFDAB9', '#FFE4E1', '#FFF0F5'];
    var count = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < count; i += 1) {
      var petal = document.createElement('span');
      petal.className = 'fetcher-v2-petal';
      petal.style.left = rand(-2, 72) + '%';
      petal.style.top = rand(-6, 58) + '%';
      petal.style.setProperty('--v2-color', pick(colors));
      petal.style.setProperty('--v2-dx', rand(180, 340) + 'px');
      petal.style.setProperty('--v2-dy', rand(130, 270) + 'px');
      petal.style.setProperty('--v2-rot', rand(-40, 30) + 'deg');
      petal.style.setProperty('--v2-spin', rand(120, 260) + 'deg');
      petal.style.setProperty('--v2-opacity', rand(.32, .48));
      petal.style.setProperty('--v2-duration', rand(7200, 10200) + 'ms');
      petal.style.setProperty('--v2-delay', (i * rand(180, 360)) + 'ms');
      layer.appendChild(petal);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 11800); })(petal);
    }
  }

  function spawnRipples() {
    var layer = ambienceLayer();
    if (!layer) return;
    var count = Math.random() < .34 ? 2 : 1;
    for (var i = 0; i < count; i += 1) {
      var ring = document.createElement('span');
      ring.className = 'fetcher-v2-ripple';
      ring.style.left = rand(8, 92) + '%';
      ring.style.top = rand(8, 86) + '%';
      ring.style.setProperty('--v2-size', rand(105, 185) + 'px');
      ring.style.setProperty('--v2-delay', (i * 260) + 'ms');
      layer.appendChild(ring);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 3200); })(ring);
    }
  }

  function spawnCrescents() {
    var layer = ambienceLayer();
    if (!layer) return;
    var count = Math.random() < .35 ? 2 : 1;
    for (var i = 0; i < count; i += 1) {
      var edge = Math.floor(Math.random() * 4);
      var moon = document.createElement('span');
      moon.className = 'fetcher-v2-crescent';
      if (edge === 0) { moon.style.left = rand(2, 10) + '%'; moon.style.top = rand(12, 82) + '%'; }
      if (edge === 1) { moon.style.right = rand(2, 10) + '%'; moon.style.top = rand(12, 82) + '%'; }
      if (edge === 2) { moon.style.left = rand(12, 88) + '%'; moon.style.top = rand(2, 9) + '%'; }
      if (edge === 3) { moon.style.left = rand(12, 88) + '%'; moon.style.bottom = rand(7, 15) + '%'; }
      moon.style.setProperty('--v2-size', rand(27, 36) + 'px');
      moon.style.setProperty('--v2-orbit-x', rand(-16, 16) + 'px');
      moon.style.setProperty('--v2-orbit-y', rand(-11, 11) + 'px');
      moon.style.setProperty('--v2-duration', rand(5200, 7000) + 'ms');
      moon.textContent = '☾';
      if (Math.random() < .62) {
        var star = document.createElement('span');
        star.className = 'fetcher-v2-crescent-star';
        star.textContent = '✦';
        moon.appendChild(star);
      }
      layer.appendChild(moon);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 7600); })(moon);
    }
  }

  function spawnSunset() {
    var layer = ambienceLayer();
    if (!layer) return;
    var colors = ['#FFBE3D', '#FFA53D', '#FF853D', '#FF8B72', '#F59BC8'];
    var count = 5 + Math.floor(Math.random() * 5);
    for (var i = 0; i < count; i += 1) {
      var dust = document.createElement('span');
      dust.className = 'fetcher-v2-sunset-dust';
      dust.style.left = rand(7, 94) + '%';
      dust.style.top = rand(10, 87) + '%';
      dust.style.setProperty('--v2-color', pick(colors));
      dust.style.setProperty('--v2-size', rand(3, 8) + 'px');
      dust.style.setProperty('--v2-blur', rand(.2, 1.1) + 'px');
      dust.style.setProperty('--v2-opacity', rand(.22, .45));
      dust.style.setProperty('--v2-dx', rand(-24, 30) + 'px');
      dust.style.setProperty('--v2-dy', rand(-35, -10) + 'px');
      dust.style.setProperty('--v2-duration', rand(4700, 7200) + 'ms');
      dust.style.setProperty('--v2-delay', (i * rand(75, 170)) + 'ms');
      layer.appendChild(dust);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 8200); })(dust);
    }
    if (Math.random() < .62) {
      var shimmer = document.createElement('span');
      shimmer.className = 'fetcher-v2-sunset-shimmer';
      shimmer.style.left = rand(18, 84) + '%';
      shimmer.style.top = rand(18, 76) + '%';
      shimmer.style.setProperty('--v2-size', rand(180, 310) + 'px');
      layer.appendChild(shimmer);
      window.setTimeout(function () { if (shimmer.parentNode) shimmer.remove(); }, 5200);
    }
  }

  function spawnConstellation() {
    var layer = ambienceLayer();
    if (!layer) return;

    var viewW = 600;
    var viewH = 360;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + viewW + ' ' + viewH);
    svg.classList.add('fetcher-v2-constellation');

    var cssW = Math.max(300, Math.min(window.innerWidth * .52, 760));
    var cssH = Math.max(220, Math.min(window.innerHeight * .50, 520));
    if (window.innerWidth < 620) {
      cssW = Math.min(window.innerWidth * .78, 430);
      cssH = Math.min(window.innerHeight * .46, 360);
    }
    svg.style.width = cssW + 'px';
    svg.style.height = cssH + 'px';
    svg.style.left = rand(10, Math.max(12, window.innerWidth - cssW - 10)) + 'px';
    svg.style.top = rand(18, Math.max(20, window.innerHeight - cssH - 18)) + 'px';

    var count = 5 + Math.floor(Math.random() * 4);
    var points = [];
    for (var i = 0; i < count; i += 1) {
      points.push([rand(55, 545), rand(45, 315)]);
    }
    points.sort(function (a, b) { return a[0] - b[0]; });

    for (var j = 0; j < points.length - 1; j += 1) {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', points[j][0]);
      line.setAttribute('y1', points[j][1]);
      line.setAttribute('x2', points[j + 1][0]);
      line.setAttribute('y2', points[j + 1][1]);
      line.setAttribute('pathLength', '1');
      line.setAttribute('class', 'fetcher-v2-constellation-line');
      line.style.setProperty('--v2-line-delay', (700 + j * 240) + 'ms');
      svg.appendChild(line);
    }

    points.forEach(function (p, index) {
      var star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      star.setAttribute('cx', p[0]);
      star.setAttribute('cy', p[1]);
      star.setAttribute('r', index % 3 === 0 ? '4.2' : (index % 2 ? '3.2' : '2.6'));
      star.setAttribute('class', 'fetcher-v2-constellation-star');
      star.style.setProperty('--v2-star-delay', (180 + index * 170) + 'ms');
      svg.appendChild(star);
    });

    layer.appendChild(svg);
    window.setTimeout(function () { if (svg.parentNode) svg.remove(); }, 7000);
  }

  function spawnJackBurst(x, y) {
    var layer = ambienceLayer();
    if (!layer) return;
    x = typeof x === 'number' ? x : rand(window.innerWidth * .14, window.innerWidth * .88);
    y = typeof y === 'number' ? y : rand(window.innerHeight * .12, window.innerHeight * .82);
    var colors = ['#CDDB01', '#F3A6D8', '#F03A55', '#FFFFFF'];
    var count = 5 + Math.floor(Math.random() * 4);
    for (var i = 0; i < count; i += 1) {
      var bit = document.createElement('span');
      bit.className = 'fetcher-v2-jack-bit ' + (i % 3 === 0 ? 'streamer' : (i % 2 ? 'dot' : 'rect'));
      bit.style.left = x + 'px';
      bit.style.top = y + 'px';
      bit.style.setProperty('--v2-angle', rand(0, 360) + 'deg');
      bit.style.setProperty('--v2-distance', rand(28, 66) + 'px');
      bit.style.setProperty('--v2-rot', rand(-90, 90) + 'deg');
      bit.style.setProperty('--v2-color', pick(colors));
      bit.style.setProperty('--v2-delay', (i * 18) + 'ms');
      layer.appendChild(bit);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 1200); })(bit);
    }
  }

  function startAmbient(palette) {
    if (!isTopWindow) return;
    clearAmbience();
    ambientPalette = palette || '';
    if (!ambientPalette || motionMode() === 'reduced') return;

    if (ambientPalette === 'ailincia') scheduleAmbient(spawnPetals, 2800, 4600, 500);
    else if (ambientPalette === 'vitaviita') scheduleAmbient(spawnRipples, 2200, 4100, 450);
    else if (ambientPalette === 'suki') scheduleAmbient(spawnCrescents, 2400, 4100, 450);
    else if (ambientPalette === 'kaywordley') scheduleAmbient(spawnSunset, 2600, 4400, 500);
    else if (ambientPalette === 'wahibah') scheduleAmbient(spawnConstellation, 4800, 6500, 650);
    else if (ambientPalette === 'jackigoe') scheduleAmbient(spawnJackBurst, 4300, 7200, 800);
  }

  function interactionAt(x, y) {
    if (!isTopWindow || motionMode() === 'reduced') return;
    if (ambientPalette === 'jackigoe') spawnJackBurst(x, y);
  }

  if (isTopWindow) {
    window.FetcherAmbientInteraction = interactionAt;
    document.addEventListener('click', function (event) {
      interactionAt(event.clientX, event.clientY);
    }, true);
  } else {
    document.addEventListener('click', function (event) {
      try {
        if (!window.parent || !window.parent.FetcherAmbientInteraction || !window.frameElement) return;
        var rect = window.frameElement.getBoundingClientRect();
        window.parent.FetcherAmbientInteraction(rect.left + event.clientX, rect.top + event.clientY);
      } catch (e) {}
    }, true);
  }

  function resizeGrooveCanvas() {
    if (!grooveCanvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    grooveCanvas.width = Math.round(window.innerWidth * dpr);
    grooveCanvas.height = Math.round(window.innerHeight * dpr);
    grooveCanvas.style.width = window.innerWidth + 'px';
    grooveCanvas.style.height = window.innerHeight + 'px';
    grooveCtx = grooveCanvas.getContext('2d');
    if (grooveCtx) grooveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ensureGrooveCanvas() {
    if (grooveCanvas || !document.body) return grooveCanvas;
    grooveCanvas = document.createElement('canvas');
    grooveCanvas.className = 'fetcher-stonakah-groove';
    grooveCanvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(grooveCanvas, document.body.firstChild);
    resizeGrooveCanvas();
    return grooveCanvas;
  }

  function clearGroove() {
    groovePoints = [];
    grooveLastPoint = null;
    if (grooveCtx) grooveCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function stopGroove() {
    root.classList.remove('fetcher-stonakah-carve-active');
    clearGroove();
    if (grooveFrame) cancelAnimationFrame(grooveFrame);
    grooveFrame = null;
    if (grooveCanvas) grooveCanvas.style.display = 'none';
  }

  function grooveColor(alpha, lightEdge) {
    var darkTheme = root.getAttribute('data-theme') === 'dark';
    if (darkTheme) {
      return lightEdge ? 'rgba(221,184,146,' + (alpha * .55) + ')' : 'rgba(0,0,0,' + (alpha * .80) + ')';
    }
    return lightEdge ? 'rgba(246,224,202,' + (alpha * .90) + ')' : 'rgba(89,55,35,' + alpha + ')';
  }

  function drawGroove() {
    grooveFrame = null;
    if (root.getAttribute('data-easter-palette') !== 'stonakah' || motionMode() === 'reduced') return;
    if (!grooveCtx) return;

    var now = performance.now();
    groovePoints = groovePoints.filter(function (p) { return now - p.t < 2100; });
    grooveCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    grooveCtx.lineCap = 'round';
    grooveCtx.lineJoin = 'round';

    for (var i = 1; i < groovePoints.length; i += 1) {
      var a = groovePoints[i - 1];
      var b = groovePoints[i];
      if (b.breakBefore || b.t - a.t > 120) continue;
      var age = now - b.t;
      var life = Math.max(0, 1 - age / 2100);
      var alpha = Math.pow(life, 1.35);
      if (alpha <= .005) continue;

      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;

      grooveCtx.save();
      grooveCtx.filter = 'blur(2.2px)';
      grooveCtx.strokeStyle = grooveColor(alpha * .16, true);
      grooveCtx.lineWidth = 22;
      grooveCtx.beginPath();
      grooveCtx.moveTo(a.x, a.y);
      grooveCtx.lineTo(b.x, b.y);
      grooveCtx.stroke();
      grooveCtx.restore();

      grooveCtx.strokeStyle = grooveColor(alpha * .27, false);
      grooveCtx.lineWidth = 12;
      grooveCtx.beginPath();
      grooveCtx.moveTo(a.x, a.y);
      grooveCtx.lineTo(b.x, b.y);
      grooveCtx.stroke();

      grooveCtx.strokeStyle = grooveColor(alpha * .12, true);
      grooveCtx.lineWidth = 3;
      grooveCtx.beginPath();
      grooveCtx.moveTo(a.x + nx * 5, a.y + ny * 5);
      grooveCtx.lineTo(b.x + nx * 5, b.y + ny * 5);
      grooveCtx.stroke();
      grooveCtx.beginPath();
      grooveCtx.moveTo(a.x - nx * 5, a.y - ny * 5);
      grooveCtx.lineTo(b.x - nx * 5, b.y - ny * 5);
      grooveCtx.stroke();
    }

    if (groovePoints.length) grooveFrame = requestAnimationFrame(drawGroove);
  }

  function startGroove() {
    if (motionMode() === 'reduced') {
      stopGroove();
      return;
    }
    ensureGrooveCanvas();
    if (!grooveCanvas) return;
    root.classList.add('fetcher-stonakah-carve-active');
    grooveCanvas.style.display = 'block';
    clearGroove();
  }

  function groovePointer(event) {
    if (root.getAttribute('data-easter-palette') !== 'stonakah' || motionMode() === 'reduced') return;
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    ensureGrooveCanvas();
    var now = performance.now();
    var p = { x: event.clientX, y: event.clientY, t: now, breakBefore: false };
    if (grooveLastPoint) {
      var dx = p.x - grooveLastPoint.x;
      var dy = p.y - grooveLastPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) < 2) return;
      if (now - grooveLastPoint.t > 120) p.breakBefore = true;
    } else {
      p.breakBefore = true;
    }
    groovePoints.push(p);
    if (groovePoints.length > 420) groovePoints.splice(0, groovePoints.length - 420);
    grooveLastPoint = p;
    if (!grooveFrame) grooveFrame = requestAnimationFrame(drawGroove);
  }

  document.addEventListener('pointermove', groovePointer, { passive: true });
  window.addEventListener('resize', function () {
    if (grooveCanvas) {
      resizeGrooveCanvas();
      clearGroove();
    }
  });

  function syncGroove(palette) {
    if (palette === 'stonakah') startGroove();
    else stopGroove();
  }

  document.addEventListener('fetcher:easter-change', function (event) {
    syncThemeColor();
    var palette = event && event.detail ? event.detail.palette : '';
    syncGroove(palette);
    if (!palette) {
      restoreTitleNow();
      clearKeemHalo();
      if (isTopWindow) clearAmbience();
      return;
    }
    foundYouTitle();
    if (palette === 'keem') showKeemHalo();
    else clearKeemHalo();
    if (isTopWindow) startAmbient(palette);
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    syncThemeColor();
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    var palette = root.getAttribute('data-easter-palette') || '';
    syncGroove(palette);
    if (isTopWindow) startAmbient(palette);
  });

  function milestoneNumber() {
    try { return parseInt(localStorage.getItem('fetcher.visitorNumber'), 10) || 0; }
    catch (e) { return 0; }
  }

  function isMilestone(n) {
    return n === 100 || n === 500 || n === 1000 || n === 2500 || n === 5000 || n === 10000;
  }

  function addMilestonePaws() {
    if (!document.body || root.getAttribute('data-motion') === 'reduced') return;
    var layer = document.createElement('div');
    layer.className = 'fetcher-milestone-paws';
    layer.setAttribute('aria-hidden', 'true');
    var points = [
      [-150,-95,22,-18,0],[-88,-145,18,8,90],[-28,-118,20,-7,170],[72,-130,18,15,240],
      [142,-82,22,-11,310],[-135,18,18,10,380],[126,28,20,-6,450],[-78,105,19,14,520],
      [24,126,22,-13,590],[95,92,18,7,660]
    ];
    points.forEach(function (p) {
      var paw = document.createElement('span');
      paw.className = 'fetcher-milestone-paw';
      paw.style.setProperty('--milestone-x', p[0] + 'px');
      paw.style.setProperty('--milestone-y', p[1] + 'px');
      paw.style.setProperty('--milestone-size', p[2] + 'px');
      paw.style.setProperty('--milestone-rot', p[3] + 'deg');
      paw.style.setProperty('--milestone-delay', p[4] + 'ms');
      layer.appendChild(paw);
    });
    document.body.appendChild(layer);
    window.setTimeout(function () { if (layer.parentNode) layer.remove(); }, 2400);
  }

  function maybeCelebrateMilestone() {
    var stat = document.querySelector('.about-stat');
    if (!stat) return;
    var n = milestoneNumber();
    if (!isMilestone(n)) return;
    var key = 'fetcher.milestoneSeen.' + n;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch (e) {}
    var copy = stat.querySelector('.about-stat-copy') || stat;
    var note = document.createElement('div');
    note.className = 'fetcher-milestone-note';
    note.textContent = 'you were visitor #' + n + ' — milestone reached';
    copy.appendChild(note);
    addMilestonePaws();
  }

  function restartClass(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  function showGoodDog() {
    if (!document.body) return;
    var old = document.querySelector('.fetcher-good-dog');
    if (old) old.remove();
    var note = document.createElement('div');
    note.className = 'fetcher-good-dog';
    note.setAttribute('role', 'status');
    note.textContent = 'good dog.';
    document.body.appendChild(note);
    if (root.getAttribute('data-motion') !== 'reduced') {
      var trail = document.createElement('div');
      trail.className = 'fetcher-pet-trail';
      trail.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 9; i += 1) {
        var paw = document.createElement('span');
        paw.className = 'fetcher-pet-print';
        paw.style.setProperty('--pet-left', (-5 + i * 13.5) + '%');
        paw.style.setProperty('--pet-bottom', (18 + (i % 3) * 13) + 'px');
        paw.style.setProperty('--pet-rot', ((i % 2 ? 1 : -1) * (7 + (i % 3) * 4)) + 'deg');
        paw.style.setProperty('--pet-delay', (i * 95) + 'ms');
        trail.appendChild(paw);
      }
      document.body.appendChild(trail);
      window.setTimeout(function () { if (trail.parentNode) trail.remove(); }, 2200);
    }
    window.setTimeout(function () { if (note.parentNode) note.remove(); }, 2100);
  }

  function installPetThePaw() {
    if (!isTopWindow) return;
    var mark = document.querySelector('.rail .mark');
    if (!mark || mark.dataset.fetcherPetInstalled === 'true') return;
    mark.dataset.fetcherPetInstalled = 'true';
    var taps = 0;
    var resetTimer = null;
    mark.addEventListener('click', function () {
      restartClass(mark, 'fetcher-paw-pet');
      window.setTimeout(function () { mark.classList.remove('fetcher-paw-pet'); }, 260);
      if (petCompletedThisVisit) return;
      taps += 1;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () { taps = 0; }, 1900);
      if (taps < 5) return;
      taps = 0;
      window.clearTimeout(resetTimer);
      petCompletedThisVisit = true;
      restartClass(mark, 'fetcher-paw-happy');
      window.setTimeout(function () { mark.classList.remove('fetcher-paw-happy'); }, 650);
      showGoodDog();
    });
  }

  function triggerGoodDogPhrase(input) {
    if (!input || String(input.value || '').trim().toLowerCase() !== 'good dog') return false;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    showGoodDog();
    return true;
  }

  document.addEventListener('keydown', function (event) {
    if (!isTopWindow || event.key !== 'Enter') return;
    var input = event.target && event.target.id === 'url-input' ? event.target : null;
    if (!triggerGoodDogPhrase(input)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', function (event) {
    if (!isTopWindow) return;
    var button = event.target && event.target.closest ? event.target.closest('#fetch-btn') : null;
    if (!button) return;
    var input = document.getElementById('url-input');
    if (!triggerGoodDogPhrase(input)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function install404Return() {
    var link = document.querySelector('.lost a[href="/"]');
    if (!link || link.dataset.fetcherReturnInstalled === 'true') return;
    link.dataset.fetcherReturnInstalled = 'true';
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      try { sessionStorage.setItem(RETURN_404_KEY, '1'); } catch (e) {}
      root.classList.add('fetcher-404-leaving');
      var delay = root.getAttribute('data-motion') === 'reduced' ? 100 : 650;
      window.setTimeout(function () { window.location.assign(link.href); }, delay);
    });
  }

  function revealFrom404() {
    if (!returningFrom404) return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        root.classList.add('fetcher-return-from-404-reveal');
      });
    });
    var reduced = root.getAttribute('data-motion') === 'reduced';
    window.setTimeout(function () {
      root.classList.remove('fetcher-return-from-404', 'fetcher-return-from-404-reveal');
      try { sessionStorage.removeItem(RETURN_404_KEY); } catch (e) {}
    }, reduced ? 180 : 2420);
  }

  function initLaunchPolish() {
    revealFrom404();
    maybeCelebrateMilestone();
    installPetThePaw();
    install404Return();
    var palette = root.getAttribute('data-easter-palette') || '';
    syncGroove(palette);
    if (isTopWindow) startAmbient(palette);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLaunchPolish, { once: true });
  } else {
    initLaunchPolish();
  }
})();