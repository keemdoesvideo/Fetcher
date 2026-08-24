/* Launch-wide browser polish: dynamic browser chrome, milestones and tiny user delight. */
(function () {
  'use strict';

  var root = document.documentElement;
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
  document.addEventListener('fetcher:easter-change', syncThemeColor);
  document.addEventListener('fetcher:pref-change', syncThemeColor);

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

  function initLaunchPolish() {
    maybeCelebrateMilestone();
    installPetThePaw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLaunchPolish, { once: true });
  } else {
    initLaunchPolish();
  }
})();
