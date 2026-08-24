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

  var SIGNATURES = {
    ailincia: { kind: 'petal', colors: ['#FFB6C1', '#FFDAB9', '#FFF0F5'] },
    vitaviita: { kind: 'diamond', colors: ['#F4FAFF', '#ACCBFF', '#8993FF'] },
    stonakah: { kind: 'ember', colors: ['#E6CCB2', '#DDB892', '#B08968'] },
    suki: { kind: 'crescent', colors: ['#D9CBE2', '#A691B8', '#856B9B'] },
    kaywordley: { kind: 'spark', colors: ['#FFBE3D', '#FFA53D', '#F20039'] },
    wahibah: { kind: 'star', colors: ['#FEC2A8', '#C16499', '#F4D9EB'] },
    jackigoe: { kind: 'confetti', colors: ['#CDDB01', '#F3A6D8', '#F03A55'] },
    keem: { kind: 'halo', colors: ['#FFFFFF', '#DCE4EB'] }
  };

  var signatureTimer = null;
  var signatureStartTimer = null;
  var titleTimer = null;
  var titleRestore = document.title;

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
  document.addEventListener('fetcher:pref-change', syncThemeColor);

  function motionMode() {
    return root.getAttribute('data-motion') || 'full';
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

  function clearSignature() {
    window.clearTimeout(signatureStartTimer);
    window.clearTimeout(signatureTimer);
    signatureStartTimer = null;
    signatureTimer = null;
    var old = document.querySelector('.fetcher-name-signature');
    if (old) old.remove();
  }

  function showSignature(palette) {
    clearSignature();
    if (!palette || !SIGNATURES[palette] || !document.body) return;
    if (motionMode() === 'reduced') return;

    var config = SIGNATURES[palette];
    var layer = document.createElement('div');
    layer.className = 'fetcher-name-signature fetcher-name-signature-' + palette;
    layer.setAttribute('aria-hidden', 'true');

    if (config.kind === 'halo') {
      var halo = document.createElement('span');
      halo.className = 'fetcher-signature-halo';
      layer.appendChild(halo);
    } else {
      var positions = [
        [16,22,-20,-9,0],[27,66,12,13,90],[39,31,-10,-15,160],[50,75,18,8,230],
        [61,21,-15,12,300],[72,61,14,-10,370],[83,35,-18,14,440],[91,70,9,-7,510],
        [8,54,15,10,580]
      ];
      positions.forEach(function (p, index) {
        var particle = document.createElement('span');
        particle.className = 'fetcher-signature-particle fetcher-signature-' + config.kind;
        particle.style.setProperty('--sig-x', p[0] + '%');
        particle.style.setProperty('--sig-y', p[1] + '%');
        particle.style.setProperty('--sig-dx', p[2] + 'px');
        particle.style.setProperty('--sig-rot', p[3] + 'deg');
        particle.style.setProperty('--sig-delay', p[4] + 'ms');
        particle.style.setProperty('--sig-color', config.colors[index % config.colors.length]);
        particle.style.setProperty('--sig-size', (7 + (index % 3) * 3) + 'px');
        layer.appendChild(particle);
      });
    }

    document.body.appendChild(layer);
    signatureTimer = window.setTimeout(function () {
      if (layer.parentNode) layer.remove();
      signatureTimer = null;
    }, config.kind === 'halo' ? 2600 : 2800);
  }

  function scheduleSignature(palette) {
    if (!palette) {
      clearSignature();
      return;
    }
    window.clearTimeout(signatureStartTimer);
    var delay = motionMode() === 'reserved' ? 170 : 260;
    signatureStartTimer = window.setTimeout(function () {
      signatureStartTimer = null;
      showSignature(palette);
    }, delay);
  }

  document.addEventListener('fetcher:easter-change', function (event) {
    syncThemeColor();
    var palette = event && event.detail ? event.detail.palette : '';
    if (!palette) {
      clearSignature();
      return;
    }
    foundYouTitle();
    scheduleSignature(palette);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLaunchPolish, { once: true });
  } else {
    initLaunchPolish();
  }
})();
