/* Launch-wide browser polish: dynamic browser chrome, milestones and tiny user delight. */
(function () {
  'use strict';

  var root = document.documentElement;
  var RETURN_404_KEY = 'fetcher.returnFrom404';
  var returningFrom404 = false;

  try {
    returningFrom404 = sessionStorage.getItem(RETURN_404_KEY) === '1';
    if (returningFrom404) root.classList.add('fetcher-return-from-404');
  } catch (e) {}

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
  var lastPointer = null;
  var lastPointerAngle = null;
  var lastPointerAt = 0;
  var isTopWindow = true;

  try { isTopWindow = window.self === window.top; } catch (e) { isTopWindow = false; }

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function motionMode() { return root.getAttribute('data-motion') || 'full'; }

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

  function ambientLayer() {
    var layer = document.getElementById('fetcher-theme-ambience');
    if (!layer && document.body) {
      layer = document.createElement('div');
      layer.id = 'fetcher-theme-ambience';
      layer.className = 'fetcher-theme-ambience';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }

  function clearAmbientNodes() {
    var layer = document.getElementById('fetcher-theme-ambience');
    if (layer) layer.replaceChildren();
    document.querySelectorAll('.fetcher-ember-trail,.fetcher-ember-dot').forEach(function (el) { el.remove(); });
  }

  function stopAmbient() {
    window.clearTimeout(ambientTimer);
    ambientTimer = null;
    ambientPalette = '';
    lastPointer = null;
    lastPointerAngle = null;
    lastPointerAt = 0;
    clearAmbientNodes();
  }

  function scheduleAmbient(fn, min, max) {
    window.clearTimeout(ambientTimer);
    ambientTimer = window.setTimeout(function tick() {
      if (!ambientPalette || motionMode() === 'reduced') return;
      fn();
      ambientTimer = window.setTimeout(tick, rand(min, max));
    }, rand(Math.min(1200, min), Math.min(2400, max)));
  }

  function spawnPetals() {
    var layer = ambientLayer();
    if (!layer) return;
    var colors = ['#FFB6C1', '#FFDAB9', '#FFE4E1'];
    var count = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < count; i += 1) {
      var petal = document.createElement('span');
      petal.className = 'fetcher-ambient-petal';
      petal.style.setProperty('--amb-left', rand(4, 70) + '%');
      petal.style.setProperty('--amb-top', rand(-4, 55) + '%');
      petal.style.setProperty('--amb-dx', rand(140, 260) + 'px');
      petal.style.setProperty('--amb-dy', rand(100, 220) + 'px');
      petal.style.setProperty('--amb-rot', rand(-35, 30) + 'deg');
      petal.style.setProperty('--amb-spin', rand(80, 190) + 'deg');
      petal.style.setProperty('--amb-delay', (i * rand(180, 420)) + 'ms');
      petal.style.setProperty('--amb-dur', rand(6500, 9800) + 'ms');
      petal.style.setProperty('--amb-color', pick(colors));
      petal.style.setProperty('--amb-opacity', rand(.16, .28));
      layer.appendChild(petal);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 11200); })(petal);
    }
  }

  function spawnRipple() {
    var layer = ambientLayer();
    if (!layer) return;
    var count = Math.random() < .25 ? 2 : 1;
    for (var i = 0; i < count; i += 1) {
      var ring = document.createElement('span');
      ring.className = 'fetcher-ambient-ripple';
      ring.style.setProperty('--amb-left', rand(8, 92) + '%');
      ring.style.setProperty('--amb-top', rand(8, 86) + '%');
      ring.style.setProperty('--amb-size', rand(70, 125) + 'px');
      ring.style.setProperty('--amb-delay', (i * 240) + 'ms');
      layer.appendChild(ring);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 2600); })(ring);
    }
  }

  function spawnCrescent() {
    var layer = ambientLayer();
    if (!layer) return;
    var edge = Math.floor(Math.random() * 4);
    var moon = document.createElement('span');
    moon.className = 'fetcher-ambient-crescent';
    if (edge === 0) { moon.style.left = rand(2, 10) + '%'; moon.style.top = rand(12, 82) + '%'; }
    if (edge === 1) { moon.style.right = rand(2, 10) + '%'; moon.style.top = rand(12, 82) + '%'; }
    if (edge === 2) { moon.style.left = rand(12, 88) + '%'; moon.style.top = rand(2, 10) + '%'; }
    if (edge === 3) { moon.style.left = rand(12, 88) + '%'; moon.style.bottom = rand(5, 13) + '%'; }
    moon.style.setProperty('--amb-orbit-x', rand(-12, 12) + 'px');
    moon.style.setProperty('--amb-orbit-y', rand(-9, 9) + 'px');
    moon.textContent = '☾';
    if (Math.random() < .48) {
      var star = document.createElement('span');
      star.className = 'fetcher-ambient-crescent-star';
      star.textContent = '✦';
      moon.appendChild(star);
    }
    layer.appendChild(moon);
    window.setTimeout(function () { if (moon.parentNode) moon.remove(); }, 5200);
  }

  function spawnSparks(x, y) {
    var layer = ambientLayer();
    if (!layer) return;
    x = typeof x === 'number' ? x : rand(window.innerWidth * .16, window.innerWidth * .88);
    y = typeof y === 'number' ? y : rand(window.innerHeight * .12, window.innerHeight * .82);
    var colors = ['#FFBE3D', '#FFA53D', '#F20039'];
    var count = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < count; i += 1) {
      var spark = document.createElement('span');
      spark.className = 'fetcher-ambient-spark';
      spark.style.left = x + 'px';
      spark.style.top = y + 'px';
      spark.style.setProperty('--amb-angle', rand(0, 360) + 'deg');
      spark.style.setProperty('--amb-distance', rand(22, 52) + 'px');
      spark.style.setProperty('--amb-length', rand(7, 16) + 'px');
      spark.style.setProperty('--amb-color', pick(colors));
      spark.style.setProperty('--amb-delay', (i * 24) + 'ms');
      layer.appendChild(spark);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 1050); })(spark);
    }
  }

  function spawnConstellation() {
    var layer = ambientLayer();
    if (!layer) return;
    var isolated = Math.random() < .28;
    var width = 130, height = 100;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.classList.add('fetcher-ambient-constellation');
    svg.style.left = rand(8, 82) + '%';
    svg.style.top = rand(8, 78) + '%';
    var count = isolated ? 1 : 2 + Math.floor(Math.random() * 3);
    var points = [];
    for (var i = 0; i < count; i += 1) points.push([rand(18, 112), rand(18, 82)]);
    if (!isolated) {
      for (var j = 0; j < points.length - 1; j += 1) {
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', points[j][0]);
        line.setAttribute('y1', points[j][1]);
        line.setAttribute('x2', points[j + 1][0]);
        line.setAttribute('y2', points[j + 1][1]);
        line.setAttribute('class', 'fetcher-constellation-line');
        svg.appendChild(line);
      }
    }
    points.forEach(function (p, index) {
      var star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      star.setAttribute('cx', p[0]);
      star.setAttribute('cy', p[1]);
      star.setAttribute('r', index === 0 ? '2.2' : '1.6');
      star.setAttribute('class', 'fetcher-constellation-star');
      star.style.animationDelay = (index * 110) + 'ms';
      svg.appendChild(star);
    });
    layer.appendChild(svg);
    window.setTimeout(function () { if (svg.parentNode) svg.remove(); }, 3300);
  }

  function spawnJackBurst(x, y) {
    var layer = ambientLayer();
    if (!layer) return;
    x = typeof x === 'number' ? x : rand(window.innerWidth * .14, window.innerWidth * .88);
    y = typeof y === 'number' ? y : rand(window.innerHeight * .12, window.innerHeight * .82);
    var colors = ['#CDDB01', '#F3A6D8', '#F03A55', '#FFFFFF'];
    var count = 5 + Math.floor(Math.random() * 4);
    for (var i = 0; i < count; i += 1) {
      var bit = document.createElement('span');
      bit.className = 'fetcher-ambient-jack-bit ' + (i % 3 === 0 ? 'streamer' : (i % 2 ? 'dot' : 'rect'));
      bit.style.left = x + 'px';
      bit.style.top = y + 'px';
      bit.style.setProperty('--amb-angle', rand(0, 360) + 'deg');
      bit.style.setProperty('--amb-distance', rand(28, 66) + 'px');
      bit.style.setProperty('--amb-rot', rand(-90, 90) + 'deg');
      bit.style.setProperty('--amb-color', pick(colors));
      bit.style.setProperty('--amb-delay', (i * 18) + 'ms');
      layer.appendChild(bit);
      (function (node) { window.setTimeout(function () { if (node.parentNode) node.remove(); }, 1200); })(bit);
    }
  }

  function spawnEmberDot(x, y) {
    if (!document.body) return;
    var dot = document.createElement('span');
    dot.className = 'fetcher-ember-dot';
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    document.body.appendChild(dot);
    window.setTimeout(function () { if (dot.parentNode) dot.remove(); }, 760);
  }

  function emberPointer(x, y, pointerType) {
    if (ambientPalette !== 'stonakah' || motionMode() === 'reduced') return;
    if (pointerType && pointerType !== 'mouse' && pointerType !== 'pen') return;
    var now = performance.now();
    if (lastPointerAt && now - lastPointerAt < 18) return;
    if (!lastPointer) {
      lastPointer = { x: x, y: y };
      lastPointerAt = now;
      return;
    }
    var dx = x - lastPointer.x;
    var dy = y - lastPointer.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 2) return;
    var angle = Math.atan2(dy, dx);
    var dt = Math.max(1, now - lastPointerAt);
    var speed = distance / dt;

    var line = document.createElement('span');
    line.className = 'fetcher-ember-trail';
    line.style.left = lastPointer.x + 'px';
    line.style.top = lastPointer.y + 'px';
    line.style.width = Math.min(distance, 80) + 'px';
    line.style.transform = 'rotate(' + angle + 'rad)';
    document.body.appendChild(line);
    window.setTimeout(function () { if (line.parentNode) line.remove(); }, 620);

    if (lastPointerAngle !== null) {
      var delta = Math.abs(angle - lastPointerAngle);
      delta = Math.min(delta, Math.PI * 2 - delta);
      if (speed > .48 && delta > .7 && Math.random() < .55) spawnEmberDot(x, y);
    }
    lastPointerAngle = angle;
    lastPointer = { x: x, y: y };
    lastPointerAt = now;
  }

  function startAmbient(palette) {
    stopAmbient();
    ambientPalette = palette || '';
    if (!ambientPalette || motionMode() === 'reduced' || !isTopWindow) return;
    if (ambientPalette === 'ailincia') scheduleAmbient(spawnPetals, 5200, 9000);
    else if (ambientPalette === 'vitaviita') scheduleAmbient(spawnRipple, 3200, 6200);
    else if (ambientPalette === 'suki') scheduleAmbient(spawnCrescent, 4800, 8200);
    else if (ambientPalette === 'kaywordley') scheduleAmbient(spawnSparks, 4200, 7600);
    else if (ambientPalette === 'wahibah') scheduleAmbient(spawnConstellation, 4700, 8200);
    else if (ambientPalette === 'jackigoe') scheduleAmbient(spawnJackBurst, 4300, 7600);
  }

  function interactionAt(x, y) {
    if (motionMode() === 'reduced') return;
    if (ambientPalette === 'kaywordley') spawnSparks(x, y);
    if (ambientPalette === 'jackigoe') spawnJackBurst(x, y);
  }

  if (isTopWindow) {
    window.FetcherAmbientInteraction = interactionAt;
    window.FetcherAmbientPointer = emberPointer;
    document.addEventListener('click', function (event) {
      interactionAt(event.clientX, event.clientY);
    }, true);
    document.addEventListener('pointermove', function (event) {
      emberPointer(event.clientX, event.clientY, event.pointerType);
    }, { passive: true });
  } else {
    document.addEventListener('click', function (event) {
      try {
        if (!window.parent || !window.parent.FetcherAmbientInteraction || !window.frameElement) return;
        var rect = window.frameElement.getBoundingClientRect();
        window.parent.FetcherAmbientInteraction(rect.left + event.clientX, rect.top + event.clientY);
      } catch (e) {}
    }, true);
    document.addEventListener('pointermove', function (event) {
      try {
        if (!window.parent || !window.parent.FetcherAmbientPointer || !window.frameElement) return;
        var rect = window.frameElement.getBoundingClientRect();
        window.parent.FetcherAmbientPointer(rect.left + event.clientX, rect.top + event.clientY, event.pointerType);
      } catch (e) {}
    }, { passive: true });
  }

  document.addEventListener('fetcher:easter-change', function (event) {
    syncThemeColor();
    var palette = event && event.detail ? event.detail.palette : '';
    if (!palette) {
      restoreTitleNow();
      clearKeemHalo();
      if (isTopWindow) stopAmbient();
      return;
    }
    foundYouTitle();
    if (palette === 'keem') showKeemHalo();
    else clearKeemHalo();
    if (isTopWindow) startAmbient(palette);
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    syncThemeColor();
    if (event && event.detail && event.detail.key === 'fetcher.motion' && isTopWindow) {
      startAmbient(root.getAttribute('data-easter-palette') || '');
    }
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

  function petPawDone() {
    try { return sessionStorage.getItem('fetcher.petPawDone') === '1'; }
    catch (e) { return false; }
  }

  function rememberPetPaw() {
    try { sessionStorage.setItem('fetcher.petPawDone', '1'); } catch (e) {}
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
    var mark = document.querySelector('.rail .mark');
    if (!mark || mark.dataset.fetcherPetInstalled === 'true') return;
    mark.dataset.fetcherPetInstalled = 'true';
    var taps = 0;
    var resetTimer = null;
    mark.addEventListener('click', function () {
      restartClass(mark, 'fetcher-paw-pet');
      window.setTimeout(function () { mark.classList.remove('fetcher-paw-pet'); }, 260);
      if (petPawDone()) return;
      taps += 1;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () { taps = 0; }, 1900);
      if (taps < 5) return;
      taps = 0;
      window.clearTimeout(resetTimer);
      rememberPetPaw();
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
    if (event.key !== 'Enter') return;
    var input = event.target && event.target.id === 'url-input' ? event.target : null;
    if (!triggerGoodDogPhrase(input)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', function (event) {
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
    if (isTopWindow) startAmbient(root.getAttribute('data-easter-palette') || '');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLaunchPolish, { once: true });
  } else {
    initLaunchPolish();
  }
})();
