/*
 * fetcher-prefs.js
 * Shared preference storage + theme/motion resolution for all Fetcher pages.
 * Load this as the very first thing in <head>, before any stylesheet, so
 * data-theme/data-motion are set on <html> before the page paints (no flash
 * of the wrong theme). Every page that needs prefs just reads
 * window.FetcherPrefs — no per-page duplication of this logic.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    'fetcher.theme': 'auto',
    'fetcher.videoQuality': 'best',
    'fetcher.videoFormat': 'mp4',
    'fetcher.audioFormat': 'mp3',
    'fetcher.audioQuality': 'best',
    'fetcher.filenameStyle': 'clean',
    'fetcher.motion': 'system',
    'fetcher.showShortcuts': 'on',
    'fetcher.showDownloads': 'on'
  };

  var EASTER_KEY = 'fetcher.easterPalette';
  var EASTER_PALETTES = {
    ailincia: true,
    vitaviita: true,
    stonakah: true,
    suki: true,
    kaywordley: true,
    wahibah: true,
    keem: true
  };
  var snowReady = false;

  function get(key) {
    try {
      var v = global.localStorage.getItem(key);
      return v === null ? DEFAULTS[key] : v;
    } catch (e) {
      return DEFAULTS[key];
    }
  }

  function set(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch (e) {
      /* storage unavailable (private mode, etc) — setting still applies for this session */
    }
    try {
      document.dispatchEvent(
        new CustomEvent('fetcher:pref-change', { detail: { key: key, value: value } })
      );
    } catch (e) {}
  }

  function getEasterPalette() {
    try {
      var value = global.sessionStorage.getItem(EASTER_KEY) || '';
      return EASTER_PALETTES[value] ? value : '';
    } catch (e) {
      return '';
    }
  }

  function ensureSnowStyles() {
    if (document.getElementById('fetcher-keem-snow-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-keem-snow-styles';
    style.textContent = [
      '.fetcher-keem-snow{position:fixed;inset:0;z-index:9990;pointer-events:none;overflow:hidden;contain:strict;}',
      '.fetcher-keem-snowflake{position:absolute;top:-12vh;left:var(--snow-x);width:var(--snow-size);height:var(--snow-size);border-radius:999px;background:rgba(255,255,255,.94);opacity:var(--snow-opacity);box-shadow:0 0 6px rgba(255,255,255,.30),0 0 14px rgba(255,255,255,.18),0 0 24px rgba(255,255,255,.10);filter:blur(.35px);animation:fetcher-keem-fall var(--snow-duration) linear var(--snow-delay) infinite;will-change:transform;}',
      '@keyframes fetcher-keem-fall{from{transform:translate3d(0,-12vh,0) rotate(0deg);}to{transform:translate3d(var(--snow-drift),116vh,0) rotate(360deg);}}',
      'html[data-motion="reserved"] .fetcher-keem-snowflake{animation-timing-function:linear;}',
      'html[data-motion="reduced"] .fetcher-keem-snow{display:none;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncKeemSnow(value) {
    try {
      if (global.self !== global.top) return;
    } catch (e) { return; }

    var existing = document.getElementById('fetcher-keem-snow');
    if (value !== 'keem') {
      if (existing) existing.remove();
      return;
    }

    if (!document.body) {
      if (!snowReady) {
        snowReady = true;
        document.addEventListener('DOMContentLoaded', function () {
          snowReady = false;
          syncKeemSnow(getEasterPalette());
        }, { once: true });
      }
      return;
    }
    if (existing) return;

    ensureSnowStyles();
    var flakes = [
      [4,3,.46,32,-4,-18],[10,4,.62,36,-11,24],[17,2,.42,41,-17,12],[23,3,.56,33,-7,-28],
      [30,5,.52,39,-18,22],[37,3,.38,29,-9,-14],[44,4,.60,37,-15,32],[51,2,.48,31,-3,-22],
      [58,3,.58,42,-20,18],[64,5,.44,35,-13,-30],[70,2,.50,28,-8,14],[76,4,.64,44,-22,28],
      [82,3,.40,32,-5,-18],[88,5,.54,38,-16,24],[94,2,.46,30,-12,-12],[7,2,.36,43,-23,30],
      [34,2,.44,33,-14,16],[55,4,.60,42,-6,-24],[73,3,.42,36,-19,20],[97,3,.52,40,-10,-28]
    ];
    var layer = document.createElement('div');
    layer.id = 'fetcher-keem-snow';
    layer.className = 'fetcher-keem-snow';
    layer.setAttribute('aria-hidden', 'true');
    flakes.forEach(function (f) {
      var flake = document.createElement('span');
      flake.className = 'fetcher-keem-snowflake';
      flake.style.setProperty('--snow-x', f[0] + '%');
      flake.style.setProperty('--snow-size', f[1] + 'px');
      flake.style.setProperty('--snow-opacity', f[2]);
      flake.style.setProperty('--snow-duration', f[3] + 's');
      flake.style.setProperty('--snow-delay', f[4] + 's');
      flake.style.setProperty('--snow-drift', f[5] + 'px');
      layer.appendChild(flake);
    });
    document.body.appendChild(layer);
  }

  function applyEasterPalette() {
    var value = getEasterPalette();
    if (value) document.documentElement.setAttribute('data-easter-palette', value);
    else document.documentElement.removeAttribute('data-easter-palette');
    syncKeemSnow(value);
  }

  function setEasterPalette(value) {
    value = EASTER_PALETTES[value] ? value : '';
    try {
      if (value) global.sessionStorage.setItem(EASTER_KEY, value);
      else global.sessionStorage.removeItem(EASTER_KEY);
    } catch (e) {}
    applyEasterPalette();
    try {
      document.dispatchEvent(new CustomEvent('fetcher:easter-change', { detail: { palette: value } }));
    } catch (e) {}
  }

  function systemPrefersDark() {
    return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function systemPrefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function resolveTheme() {
    var pref = get('fetcher.theme');
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return systemPrefersDark() ? 'dark' : 'light';
  }

  /*
   * Motion has four user-facing choices:
   *   system   -> follow the OS reduced-motion preference
   *   reduced  -> accessibility-first minimal movement
   *   reserved -> Fetcher motion without playful overshoot
   *   full     -> Fetcher's expressive bounce/overshoot language
   */
  function resolveMotion() {
    var pref = get('fetcher.motion');
    if (pref === 'reduced') return 'reduced';
    if (pref === 'reserved') return 'reserved';
    if (pref === 'full') return 'full';
    return systemPrefersReducedMotion() ? 'reduced' : 'full';
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', resolveTheme());
  }

  function applyMotion() {
    document.documentElement.setAttribute('data-motion', resolveMotion());
  }

  // Floating-chrome visibility (shortcuts + downloads bubbles). Set as html
  // attributes pre-paint so CSS can hide them with no flash. 'off' hides.
  function applyChrome() {
    document.documentElement.setAttribute(
      'data-shortcuts', get('fetcher.showShortcuts') === 'off' ? 'off' : 'on');
    document.documentElement.setAttribute(
      'data-downloads', get('fetcher.showDownloads') === 'off' ? 'off' : 'on');
  }

  applyTheme();
  applyMotion();
  applyChrome();
  applyEasterPalette();

  if (global.matchMedia) {
    var mqDark = global.matchMedia('(prefers-color-scheme: dark)');
    var onDarkChange = function () {
      if (get('fetcher.theme') === 'auto') applyTheme();
    };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onDarkChange);
    else if (mqDark.addListener) mqDark.addListener(onDarkChange);

    var mqMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
    var onMotionChange = function () {
      if (get('fetcher.motion') === 'system') applyMotion();
    };
    if (mqMotion.addEventListener) mqMotion.addEventListener('change', onMotionChange);
    else if (mqMotion.addListener) mqMotion.addListener(onMotionChange);
  }

  document.addEventListener('fetcher:pref-change', function (e) {
    if (!e.detail) return;
    if (e.detail.key === 'fetcher.theme') applyTheme();
    if (e.detail.key === 'fetcher.motion') applyMotion();
    if (e.detail.key === 'fetcher.showShortcuts' || e.detail.key === 'fetcher.showDownloads') applyChrome();
  });

  global.addEventListener('storage', function (e) {
    if (!e || !e.key) return;
    if (e.key === 'fetcher.theme') applyTheme();
    if (e.key === 'fetcher.motion') applyMotion();
    if (e.key === 'fetcher.showShortcuts' || e.key === 'fetcher.showDownloads') applyChrome();
    if (e.key === EASTER_KEY) applyEasterPalette();
  });

  global.FetcherPrefs = {
    get: get,
    set: set,
    defaults: DEFAULTS,
    resolveTheme: resolveTheme,
    resolveMotion: resolveMotion,
    applyTheme: applyTheme,
    applyMotion: applyMotion,
    applyChrome: applyChrome,
    getEasterPalette: getEasterPalette,
    setEasterPalette: setEasterPalette,
    applyEasterPalette: applyEasterPalette
  };
})(window);

/*
 * Easter transition renderer.
 * Secret palettes and the base-Fetcher reset all use the same proven rounded
 * top-right -> bottom-left paint spill. Unlocks add a restrained sparkle field;
 * Keem replaces the unlock sparkles with persistent light snowfall.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var WASH_COLORS = {
    light: {
      fetcher: '#F2F0EA',
      ailincia: '#FFB6C1',
      vitaviita: '#8993FF',
      stonakah: '#DDB892',
      suki: '#856B9B',
      kaywordley: '#FFC917',
      wahibah: '#AE445A',
      keem: '#050506'
    },
    dark: {
      fetcher: '#19181C',
      ailincia: '#4A2733',
      vitaviita: '#26346A',
      stonakah: '#111114',
      suki: '#1F143C',
      kaywordley: '#8C0000',
      wahibah: '#1D1A39',
      keem: '#050506'
    }
  };

  function motionMode() {
    return root.getAttribute('data-motion') || 'full';
  }

  function timings(reset, name) {
    var motion = motionMode();
    if (motion === 'reduced') return { wash: 220, reveal: name === 'keem' ? 360 : 260 };
    if (motion === 'reserved') return { wash: 1240, reveal: name === 'keem' ? 1120 : (reset ? 620 : 720) };
    return { wash: 1900, reveal: name === 'keem' ? 1650 : (reset ? 900 : 1080) };
  }

  function washColor(name) {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var key = name || 'fetcher';
    return (WASH_COLORS[theme] && WASH_COLORS[theme][key]) || WASH_COLORS.light.fetcher;
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-easter-polish-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-easter-polish-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="suki"]{--bg:#856B9B;--surface:#D9CBE2;--rail:#A691B8;--ink:#1F143C;--ink-strong:#120A26;--ink-soft:#3D2B55;--ink-faint:#58426D;--border:#705887;--border-strong:#4C306B;--accent:#4C306B;--accent-ink:#35204D;--accent-tint:#C8B7D4;--on-accent:#FFFFFF;--audio:#6A4C86;--audio-tint:#C8B7D4;--mute:#856B9B;--mute-tint:#D9CBE2;--danger:#4C306B;--danger-tint:#D9CBE2;--success:#6A4C86;--success-tint:#D9CBE2;--shiba:#856B9B;--shiba-deep:#4C306B;--shiba-cream:#D9CBE2;}',
      'html[data-theme="dark"][data-easter-palette="suki"]{--bg:#1F143C;--surface:#2A1B4A;--rail:#4C306B;--ink:#F7F2FA;--ink-strong:#FFFFFF;--ink-soft:#D9CBE2;--ink-faint:#A691B8;--border:#60477A;--border-strong:#856B9B;--accent:#A691B8;--accent-ink:#D9CBE2;--accent-tint:rgba(166,145,184,.22);--on-accent:#1F143C;--audio:#856B9B;--audio-tint:rgba(133,107,155,.24);--mute:#856B9B;--mute-tint:rgba(133,107,155,.18);--danger:#B58BC3;--danger-tint:rgba(181,139,195,.18);--success:#A691B8;--success-tint:rgba(166,145,184,.18);}',
      'html[data-theme="light"][data-easter-palette="kaywordley"]{--bg:#FFC917;--surface:#FFF6BF;--rail:#FFE100;--ink:#321500;--ink-strong:#190800;--ink-soft:#6D2D00;--ink-faint:#824000;--border:#F8650C;--border-strong:#D94000;--accent:#F8650C;--accent-ink:#8C0000;--accent-tint:#FFE99A;--on-accent:#FFFFFF;--audio:#F00000;--audio-tint:#FFD3A6;--mute:#F8650C;--mute-tint:#FFE99A;--danger:#F00000;--danger-tint:#FFD1C7;--success:#8C0000;--success-tint:#FFE99A;--shiba:#F8650C;--shiba-deep:#8C0000;--shiba-cream:#FFE99A;}',
      'html[data-theme="dark"][data-easter-palette="kaywordley"]{--bg:#3A0B08;--surface:#55100B;--rail:#8C0000;--ink:#FFF7D1;--ink-strong:#FFFFFF;--ink-soft:#FFD67A;--ink-faint:#F89B5F;--border:#A62A0B;--border-strong:#F00000;--accent:#F8650C;--accent-ink:#FFC917;--accent-tint:rgba(248,101,12,.22);--on-accent:#190800;--audio:#FFE100;--audio-tint:rgba(255,225,0,.16);--mute:#F00000;--mute-tint:rgba(240,0,0,.18);--danger:#F00000;--danger-tint:rgba(240,0,0,.18);--success:#FFC917;--success-tint:rgba(255,201,23,.16);}',
      'html[data-theme="light"][data-easter-palette="wahibah"]{--bg:#AE445A;--surface:#E8BCB9;--rail:#F39F5A;--ink:#1D1A39;--ink-strong:#111025;--ink-soft:#451952;--ink-faint:#662549;--border:#8A304E;--border-strong:#662549;--accent:#662549;--accent-ink:#451952;--accent-tint:#F1C7BC;--on-accent:#FFFFFF;--audio:#F39F5A;--audio-tint:#F5D0B2;--mute:#AE445A;--mute-tint:#E8BCB9;--danger:#662549;--danger-tint:#E8BCB9;--success:#451952;--success-tint:#E8BCB9;--shiba:#AE445A;--shiba-deep:#662549;--shiba-cream:#E8BCB9;}',
      'html[data-theme="dark"][data-easter-palette="wahibah"]{--bg:#1D1A39;--surface:#2A1839;--rail:#451952;--ink:#FFF2ED;--ink-strong:#FFFFFF;--ink-soft:#E8BCB9;--ink-faint:#C17C82;--border:#662549;--border-strong:#8B3557;--accent:#F39F5A;--accent-ink:#E8BCB9;--accent-tint:rgba(243,159,90,.20);--on-accent:#1D1A39;--audio:#AE445A;--audio-tint:rgba(174,68,90,.22);--mute:#662549;--mute-tint:rgba(102,37,73,.28);--danger:#AE445A;--danger-tint:rgba(174,68,90,.18);--success:#F39F5A;--success-tint:rgba(243,159,90,.16);}',
      'html[data-theme="light"][data-easter-palette="keem"],html[data-theme="dark"][data-easter-palette="keem"]{--bg:#050506;--surface:#101012;--rail:#0A0A0B;--ink:#F7FBFF;--ink-strong:#FFFFFF;--ink-soft:#DCE4EB;--ink-faint:#AAB6C0;--border:#2B2D31;--border-strong:#454950;--accent:#FFFFFF;--accent-ink:#E6EDF3;--accent-tint:rgba(255,255,255,.11);--on-accent:#050506;--audio:#DCE4EB;--audio-tint:rgba(255,255,255,.10);--mute:#BFC8D0;--mute-tint:rgba(255,255,255,.08);--danger:#FFFFFF;--danger-tint:rgba(255,255,255,.10);--success:#FFFFFF;--success-tint:rgba(255,255,255,.10);--shiba:#FFFFFF;--shiba-deep:#DCE4EB;--shiba-cream:#F7FBFF;}',
      '.fetcher-easter-v2-paint{position:fixed;left:50%;top:50%;width:230vmax;height:170vmax;z-index:10020;pointer-events:none;opacity:1;background:var(--easter-wash-bg,#fff);transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);transform-origin:center;will-change:transform,opacity;}',
      '.fetcher-easter-v2-lobe{position:absolute;bottom:-22vmax;width:94vmax;height:44vmax;border-radius:50%;background:var(--easter-wash-bg,#fff);}',
      '.fetcher-easter-v2-lobe:nth-child(1){left:-3vmax;bottom:-18vmax;width:92vmax;height:39vmax;}',
      '.fetcher-easter-v2-lobe:nth-child(2){left:67vmax;bottom:-24vmax;width:100vmax;height:48vmax;}',
      '.fetcher-easter-v2-lobe:nth-child(3){left:143vmax;bottom:-17vmax;width:92vmax;height:38vmax;}',
      '.fetcher-easter-v2-paint.in{animation:fetcher-easter-v2-spill-full 1900ms cubic-bezier(.18,.82,.22,1) both;}',
      '.fetcher-easter-v2-paint.reveal{opacity:0;transition:opacity var(--easter-reveal,1080ms) cubic-bezier(.16,1,.3,1);}',
      '@keyframes fetcher-easter-v2-spill-full{0%{transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);}70%{transform:translate(-50%,-50%) rotate(45deg) translateY(-24vmax);}87%{transform:translate(-50%,-50%) rotate(45deg) translateY(2.5vmax);}95%{transform:translate(-50%,-50%) rotate(45deg) translateY(-.7vmax);}100%{transform:translate(-50%,-50%) rotate(45deg) translateY(0);}}',
      '.fetcher-easter-v2-sparkles{position:fixed;inset:0;z-index:10030;pointer-events:none;overflow:hidden;}',
      '.fetcher-easter-v2-spark{position:absolute;width:var(--spark-size,7px);height:var(--spark-size,7px);opacity:0;animation:fetcher-easter-v2-sparkle 1500ms cubic-bezier(.16,1,.3,1) var(--spark-delay,0ms) both;}',
      '.fetcher-easter-v2-spark::before,.fetcher-easter-v2-spark::after{content:"";position:absolute;left:50%;top:50%;background:rgba(255,255,255,.94);border-radius:999px;box-shadow:0 0 14px rgba(255,255,255,.42);transform:translate(-50%,-50%);}',
      '.fetcher-easter-v2-spark::before{width:2px;height:100%;}',
      '.fetcher-easter-v2-spark::after{width:100%;height:2px;}',
      '@keyframes fetcher-easter-v2-sparkle{0%{opacity:0;transform:scale(.18) rotate(0deg) translateY(5px);}15%{opacity:.96;}48%{opacity:.82;transform:scale(1.16) rotate(34deg) translateY(-2px);}100%{opacity:0;transform:scale(.5) rotate(88deg) translateY(-12px);}}',
      'html[data-motion="reserved"] .fetcher-easter-v2-paint.in{animation:fetcher-easter-v2-spill-reserved 1240ms var(--ease) both;}',
      '@keyframes fetcher-easter-v2-spill-reserved{from{transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);}to{transform:translate(-50%,-50%) rotate(45deg) translateY(0);}}',
      'html[data-motion="reserved"] .fetcher-easter-v2-spark{animation-duration:980ms;}',
      'html[data-motion="reduced"] .fetcher-easter-v2-paint{inset:0;left:0;top:0;width:100%;height:100%;transform:none!important;opacity:0;animation:none!important;transition:opacity var(--easter-reveal,260ms) linear;}',
      'html[data-motion="reduced"] .fetcher-easter-v2-paint.in{opacity:1;}',
      'html[data-motion="reduced"] .fetcher-easter-v2-paint.reveal{opacity:0;}',
      'html[data-motion="reduced"] .fetcher-easter-v2-lobe,html[data-motion="reduced"] .fetcher-easter-v2-sparkles{display:none;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function makeSparkles() {
    var motion = motionMode();
    if (motion === 'reduced' || !document.body) return;
    var points = motion === 'reserved'
      ? [[18,24,6,60],[76,18,7,140],[64,64,5,220],[31,71,6,300],[86,52,5,380],[48,36,5,450]]
      : [[12,20,6,40],[26,37,8,120],[44,16,5,200],[61,31,7,280],[79,17,6,360],[89,42,8,450],[71,58,5,530],[52,69,7,620],[32,62,5,710],[17,78,7,800],[82,77,6,900],[43,48,5,1010]];
    var layer = document.createElement('div');
    layer.className = 'fetcher-easter-v2-sparkles';
    layer.setAttribute('aria-hidden', 'true');
    points.forEach(function (point) {
      var spark = document.createElement('span');
      spark.className = 'fetcher-easter-v2-spark';
      spark.style.left = point[0] + '%';
      spark.style.top = point[1] + '%';
      spark.style.setProperty('--spark-size', point[2] + 'px');
      spark.style.setProperty('--spark-delay', point[3] + 'ms');
      layer.appendChild(spark);
    });
    document.body.appendChild(layer);
    window.setTimeout(function () {
      if (layer.parentNode) layer.remove();
    }, motion === 'reserved' ? 1500 : 2700);
  }

  function buildPaint(name, revealMs) {
    var paint = document.createElement('div');
    paint.className = 'fetcher-easter-v2-paint';
    paint.setAttribute('aria-hidden', 'true');
    paint.style.setProperty('--easter-wash-bg', washColor(name));
    paint.style.setProperty('--easter-reveal', Math.max(0, revealMs || 0) + 'ms');
    for (var i = 0; i < 3; i += 1) {
      var lobe = document.createElement('span');
      lobe.className = 'fetcher-easter-v2-lobe';
      paint.appendChild(lobe);
    }
    return paint;
  }

  function transitionTo(name) {
    name = WASH_COLORS.light[name] ? name : '';
    var reset = !name;
    var t = timings(reset, name);

    return new Promise(function (resolve) {
      if (!document.body || !window.FetcherPrefs || !FetcherPrefs.setEasterPalette) {
        if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(name);
        resolve();
        return;
      }

      ensureStyles();
      var layer = buildPaint(name, t.reveal);
      document.body.appendChild(layer);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { layer.classList.add('in'); });
      });

      window.setTimeout(function () {
        FetcherPrefs.setEasterPalette(name);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (!reset && name !== 'keem') makeSparkles();
            layer.classList.add('reveal');
            window.setTimeout(function () {
              if (layer.parentNode) layer.remove();
              resolve();
            }, t.reveal + 80);
          });
        });
      }, t.wash);
    });
  }

  function install() {
    ensureStyles();
    if (!window.FetcherEaster || !window.FetcherPrefs) {
      window.setTimeout(install, 16);
      return;
    }
    if (window.FetcherEaster.__polished) return;
    window.FetcherEaster.transitionTo = transitionTo;
    window.FetcherEaster.__polished = true;
  }

  install();
})();

/* Extra exact-name triggers added after the original Easter system shipped. */
(function () {
  'use strict';

  var root = document.documentElement;
  var EXTRA_NAMES = {
    suki: 'suki',
    kaywordley: 'kaywordley',
    wahibah: 'wahibah',
    keem: 'keem'
  };
  var busy = false;

  function matchSecret(value) {
    var key = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(EXTRA_NAMES, key) ? EXTRA_NAMES[key] : '';
  }

  function holdTime() {
    var motion = root.getAttribute('data-motion') || 'full';
    if (motion === 'reduced') return 300;
    if (motion === 'reserved') return 320;
    return 620;
  }

  function runSecret(palette) {
    if (!palette || busy) return;
    var input = document.getElementById('url-input');
    var fetchBtn = document.getElementById('fetch-btn');
    var pasteBtn = document.getElementById('paste-btn');
    var fetchWrap = document.getElementById('fetch-wrap');
    if (!input || !fetchBtn) return;

    busy = true;
    if (window.FetcherTrimmer && window.FetcherTrimmer.close) window.FetcherTrimmer.close();

    var wasReadOnly = input.readOnly;
    input.readOnly = true;
    input.classList.add('fetcher-easter-confirmation');
    fetchBtn.disabled = true;
    if (pasteBtn) pasteBtn.disabled = true;
    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function (btn) { btn.disabled = true; });

    input.value = 'found you.';
    if (fetchWrap) fetchWrap.classList.add('show');

    var host = window;
    try {
      if (window.parent && window.parent !== window && window.parent.FetcherEaster) host = window.parent;
    } catch (e) {}
    var controller = host.FetcherEaster || window.FetcherEaster;

    var transition = new Promise(function (resolve) {
      window.setTimeout(resolve, holdTime());
    }).then(function () {
      return controller && controller.transitionTo
        ? controller.transitionTo(palette)
        : Promise.resolve().then(function () {
            if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(palette);
          });
    });

    Promise.resolve(transition).catch(function () {
      if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(palette);
    }).then(function () {
      if (window.FetcherPrefs && FetcherPrefs.applyEasterPalette) FetcherPrefs.applyEasterPalette();
      input.value = '';
      input.readOnly = wasReadOnly;
      input.classList.remove('fetcher-easter-confirmation');
      fetchBtn.disabled = false;
      if (pasteBtn) pasteBtn.disabled = false;
      Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function (btn) { btn.disabled = false; });
      if (fetchWrap) fetchWrap.classList.remove('show');
      busy = false;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || busy) return;
    var input = document.getElementById('url-input');
    if (!input || document.activeElement !== input) return;
    var palette = matchSecret(input.value);
    if (!palette) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runSecret(palette);
  }, true);

  document.addEventListener('click', function (event) {
    if (busy) return;
    var target = event.target && event.target.closest ? event.target.closest('#fetch-btn') : null;
    if (!target) return;
    var input = document.getElementById('url-input');
    if (!input) return;
    var palette = matchSecret(input.value);
    if (!palette) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runSecret(palette);
  }, true);
})();
