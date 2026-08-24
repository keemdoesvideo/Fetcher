/*
 * Fetcher Easter transition polish.
 * Keeps the approved secret-name/palette system in fetcher-nav.js, but owns the
 * final visual transition so unlocks can feel celebratory and the reset drain
 * can avoid the expensive giant backdrop-filter paint sheet.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var WASH_COLORS = {
    light: { ailincia: '#FFB6C1', vitaviita: '#8993FF', stonakah: '#DDB892' },
    dark: { ailincia: '#4A2733', vitaviita: '#26346A', stonakah: '#111114' }
  };

  function motionMode() {
    return root.getAttribute('data-motion') || 'full';
  }

  function timings(reset) {
    var motion = motionMode();
    if (motion === 'reduced') return { wash: 220, reveal: 260 };
    if (motion === 'reserved') return { wash: 1240, reveal: reset ? 620 : 720 };
    return { wash: 1900, reveal: reset ? 900 : 1080 };
  }

  function washColor(name) {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return (WASH_COLORS[theme] && WASH_COLORS[theme][name]) || '#fff';
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-easter-polish-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-easter-polish-styles';
    style.textContent = [
      '.fetcher-easter-v2-paint{position:fixed;left:50%;top:50%;width:230vmax;height:170vmax;z-index:10020;pointer-events:none;opacity:1;background:var(--easter-wash-bg,#fff);transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);transform-origin:center;will-change:transform,opacity;}',
      '.fetcher-easter-v2-lobe{position:absolute;bottom:-22vmax;width:94vmax;height:44vmax;border-radius:50%;background:var(--easter-wash-bg,#fff);}',
      '.fetcher-easter-v2-lobe:nth-child(1){left:-3vmax;bottom:-18vmax;width:92vmax;height:39vmax;}',
      '.fetcher-easter-v2-lobe:nth-child(2){left:67vmax;bottom:-24vmax;width:100vmax;height:48vmax;}',
      '.fetcher-easter-v2-lobe:nth-child(3){left:143vmax;bottom:-17vmax;width:92vmax;height:38vmax;}',
      '.fetcher-easter-v2-paint.in{animation:fetcher-easter-v2-spill-full 1900ms cubic-bezier(.18,.82,.22,1) both;}',
      '.fetcher-easter-v2-paint.reveal{opacity:0;transition:opacity 1080ms cubic-bezier(.16,1,.3,1);}',
      '@keyframes fetcher-easter-v2-spill-full{0%{transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);}70%{transform:translate(-50%,-50%) rotate(45deg) translateY(-24vmax);}87%{transform:translate(-50%,-50%) rotate(45deg) translateY(2.5vmax);}95%{transform:translate(-50%,-50%) rotate(45deg) translateY(-.7vmax);}100%{transform:translate(-50%,-50%) rotate(45deg) translateY(0);}}',
      '.fetcher-easter-v2-drain{position:fixed;inset:0;z-index:10020;pointer-events:none;opacity:1;background:rgba(128,128,128,.008);-webkit-backdrop-filter:grayscale(1) saturate(0);backdrop-filter:grayscale(1) saturate(0);-webkit-mask-image:linear-gradient(135deg,#000 0 43%,rgba(0,0,0,.97) 47%,rgba(0,0,0,.58) 50%,transparent 55%);mask-image:linear-gradient(135deg,#000 0 43%,rgba(0,0,0,.97) 47%,rgba(0,0,0,.58) 50%,transparent 55%);-webkit-mask-size:260% 260%;mask-size:260% 260%;-webkit-mask-position:100% 0%;mask-position:100% 0%;will-change:-webkit-mask-position,mask-position,opacity;contain:paint;}',
      '.fetcher-easter-v2-drain.in{animation:fetcher-easter-v2-drain-full 1900ms cubic-bezier(.18,.82,.22,1) both;}',
      '.fetcher-easter-v2-drain.reveal{opacity:0;transition:opacity 900ms cubic-bezier(.16,1,.3,1);}',
      '@keyframes fetcher-easter-v2-drain-full{from{-webkit-mask-position:100% 0%;mask-position:100% 0%;}to{-webkit-mask-position:0% 100%;mask-position:0% 100%;}}',
      '.fetcher-easter-v2-sparkles{position:fixed;inset:0;z-index:10030;pointer-events:none;overflow:hidden;}',
      '.fetcher-easter-v2-spark{position:absolute;width:var(--spark-size,7px);height:var(--spark-size,7px);opacity:0;animation:fetcher-easter-v2-sparkle 1500ms cubic-bezier(.16,1,.3,1) var(--spark-delay,0ms) both;}',
      '.fetcher-easter-v2-spark::before,.fetcher-easter-v2-spark::after{content:"";position:absolute;left:50%;top:50%;background:rgba(255,255,255,.94);border-radius:999px;box-shadow:0 0 14px rgba(255,255,255,.42);transform:translate(-50%,-50%);}',
      '.fetcher-easter-v2-spark::before{width:2px;height:100%;}',
      '.fetcher-easter-v2-spark::after{width:100%;height:2px;}',
      '@keyframes fetcher-easter-v2-sparkle{0%{opacity:0;transform:scale(.18) rotate(0deg) translateY(5px);}15%{opacity:.96;}48%{opacity:.82;transform:scale(1.16) rotate(34deg) translateY(-2px);}100%{opacity:0;transform:scale(.5) rotate(88deg) translateY(-12px);}}',
      'html[data-motion="reserved"] .fetcher-easter-v2-paint.in{animation:fetcher-easter-v2-spill-reserved 1240ms var(--ease) both;}',
      'html[data-motion="reserved"] .fetcher-easter-v2-paint.reveal{transition-duration:720ms;}',
      'html[data-motion="reserved"] .fetcher-easter-v2-drain.in{animation:fetcher-easter-v2-drain-reserved 1240ms var(--ease) both;}',
      'html[data-motion="reserved"] .fetcher-easter-v2-drain.reveal{transition-duration:620ms;}',
      'html[data-motion="reserved"] .fetcher-easter-v2-spark{animation-duration:980ms;}',
      '@keyframes fetcher-easter-v2-spill-reserved{from{transform:translate(-50%,-50%) rotate(45deg) translateY(-215vmax);}to{transform:translate(-50%,-50%) rotate(45deg) translateY(0);}}',
      '@keyframes fetcher-easter-v2-drain-reserved{from{-webkit-mask-position:100% 0%;mask-position:100% 0%;}to{-webkit-mask-position:0% 100%;mask-position:0% 100%;}}',
      'html[data-motion="reduced"] .fetcher-easter-v2-paint,html[data-motion="reduced"] .fetcher-easter-v2-drain{inset:0;left:0;top:0;width:100%;height:100%;transform:none!important;-webkit-mask-image:none!important;mask-image:none!important;opacity:0;animation:none!important;transition:opacity 260ms linear;}',
      'html[data-motion="reduced"] .fetcher-easter-v2-paint.in,html[data-motion="reduced"] .fetcher-easter-v2-drain.in{opacity:1;}',
      'html[data-motion="reduced"] .fetcher-easter-v2-paint.reveal,html[data-motion="reduced"] .fetcher-easter-v2-drain.reveal{opacity:0;}',
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

  function buildPaint(name) {
    var paint = document.createElement('div');
    paint.className = 'fetcher-easter-v2-paint';
    paint.setAttribute('aria-hidden', 'true');
    paint.style.setProperty('--easter-wash-bg', washColor(name));
    for (var i = 0; i < 3; i += 1) {
      var lobe = document.createElement('span');
      lobe.className = 'fetcher-easter-v2-lobe';
      paint.appendChild(lobe);
    }
    return paint;
  }

  function buildDrain() {
    var drain = document.createElement('div');
    drain.className = 'fetcher-easter-v2-drain';
    drain.setAttribute('aria-hidden', 'true');
    return drain;
  }

  function transitionTo(name) {
    name = WASH_COLORS.light[name] ? name : '';
    var reset = !name;
    var t = timings(reset);

    return new Promise(function (resolve) {
      if (!document.body || !window.FetcherPrefs || !FetcherPrefs.setEasterPalette) {
        if (window.FetcherPrefs && FetcherPrefs.setEasterPalette) FetcherPrefs.setEasterPalette(name);
        resolve();
        return;
      }

      ensureStyles();
      var layer = reset ? buildDrain() : buildPaint(name);
      document.body.appendChild(layer);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { layer.classList.add('in'); });
      });

      window.setTimeout(function () {
        FetcherPrefs.setEasterPalette(name);

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (!reset) makeSparkles();
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
