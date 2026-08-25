/* Iaar-only ambience: a continuous three-lane editor timeline behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var layer = null;
  var motion = null;
  var LOOP_MS = 26000;
  var FLASH_MS = 11200;
  var CYCLE_PX = 972;

  var FRAMES = [
    { tone: 'black' },
    { tone: 'white' },
    { tone: 'blue' },
    { tone: 'black', cut: true },
    { tone: 'red' },
    { tone: 'white' },
    { tone: 'blue', flash: true },
    { tone: 'black' },
    { tone: 'red', cut: true },
    { tone: 'white' },
    { tone: 'black' },
    { tone: 'blue' },
    { tone: 'red' },
    { tone: 'black' },
    { tone: 'white', flash: true },
    { tone: 'blue', cut: true },
    { tone: 'black' },
    { tone: 'red' }
  ];

  var SUBTITLES = [
    { left: 18, width: 148, text: 'okay, roll it.' },
    { left: 208, width: 116, text: 'cut here' },
    { left: 360, width: 176, text: 'hold that frame' },
    { left: 584, width: 136, text: 'one more take' },
    { left: 758, width: 174, text: "that's the shot" }
  ];

  var WAVE_HEIGHTS = [
    8,14,19,11,23,17,9,26,20,13,7,18,24,15,10,28,21,12,17,9,25,18,13,22,
    11,16,27,14,8,20,24,17,10,29,19,12,23,15,9,26,18,13,21,11,16,25,14,8,
    19,27,15,10,22,17,12,28,20,9,24,16,13,26,18,11,21,15,8,29,17,12,23,19,
    10,25,16,13,27,18,9,22,14,11,28,20,12,24,17,10,26,15,13,21,18,9,25,16
  ];

  function active() {
    return root.getAttribute('data-easter-palette') === 'iaar';
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherIaarShared || topWindow.FetcherIaarShared.version !== 2) {
        topWindow.FetcherIaarShared = { version: 2, startedAt: Date.now() };
      }
      return topWindow.FetcherIaarShared;
    } catch (e) {
      if (!window.FetcherIaarShared || window.FetcherIaarShared.version !== 2) {
        window.FetcherIaarShared = { version: 2, startedAt: Date.now() };
      }
      return window.FetcherIaarShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-iaar-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-iaar-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="iaar"]{--bg:#FFFFFF;--surface:#F5F7F8;--rail:#F1F3F5;--ink:#101214;--ink-strong:#000000;--ink-soft:#3C4650;--ink-faint:#6D7780;--border:#D9DEE3;--border-strong:#0088CB;--accent:#0088CB;--accent-ink:#006C9F;--accent-tint:#DDF3FC;--on-accent:#FFFFFF;--audio:#ED1C24;--audio-tint:#FDE3E5;--mute:#000000;--mute-tint:#ECEFF1;--danger:#ED1C24;--danger-tint:#FDE3E5;--success:#0088CB;--success-tint:#DDF3FC;--shiba:#FFCB05;--shiba-deep:#ED1C24;--shiba-cream:#FFFFFF;}',
      'html[data-theme="dark"][data-easter-palette="iaar"]{--bg:#050505;--surface:#111315;--rail:#0A0A0B;--ink:#F7F8F9;--ink-strong:#FFFFFF;--ink-soft:#D4D9DD;--ink-faint:#9BA4AC;--border:#252A2E;--border-strong:#0088CB;--accent:#0088CB;--accent-ink:#FFFFFF;--accent-tint:rgba(0,136,203,.22);--on-accent:#FFFFFF;--audio:#ED1C24;--audio-tint:rgba(237,28,36,.18);--mute:#FFFFFF;--mute-tint:rgba(255,255,255,.08);--danger:#ED1C24;--danger-tint:rgba(237,28,36,.18);--success:#0088CB;--success-tint:rgba(0,136,203,.18);--shiba:#FFCB05;--shiba-deep:#ED1C24;--shiba-cream:#FFFFFF;}',
      '.fetcher-iaar-layer{position:absolute;left:0;right:0;bottom:0;height:108px;z-index:0;pointer-events:none;overflow:hidden;border-radius:0 0 inherit inherit;opacity:.82;--iaar-cycle:972px;}',
      '.fetcher-iaar-layer.is-inline{position:relative;left:auto;right:auto;bottom:auto;width:100%;height:108px;margin-top:10px;border-radius:12px;}',
      '.fetcher-iaar-layer::before{content:"";position:absolute;inset:0;border-top:1px solid rgba(0,0,0,.09);background:linear-gradient(180deg,rgba(255,255,255,0),rgba(0,0,0,.028));}',
      'html[data-theme="dark"][data-easter-palette="iaar"] .fetcher-iaar-layer::before{border-top-color:rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(0,0,0,0),rgba(255,255,255,.028));}',
      'html[data-easter-palette="iaar"] .main>.stage,html[data-easter-palette="iaar"] .main>.foot,html[data-easter-palette="iaar"] .main>.settings-nav,html[data-easter-palette="iaar"] .main>.settings-content,html[data-easter-palette="iaar"] .main>.about,html[data-easter-palette="iaar"] .main>.donate,html[data-easter-palette="iaar"] .main>.updates,html[data-easter-palette="iaar"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-iaar-motion{position:absolute;left:0;top:0;height:108px;display:flex;width:max-content;animation:fetcher-iaar-roll 26000ms linear infinite;will-change:transform;backface-visibility:hidden;transform:translateZ(0);}',
      '.fetcher-iaar-cycle{position:relative;flex:0 0 var(--iaar-cycle);width:var(--iaar-cycle);height:108px;overflow:hidden;}',
      '.fetcher-iaar-subtitle-lane{position:absolute;left:0;right:0;top:7px;height:24px;border-bottom:1px solid rgba(0,136,203,.14);}',
      '.fetcher-iaar-subtitle{position:absolute;top:1px;height:18px;padding:0 8px;border-radius:4px;border:1px solid rgba(0,136,203,.28);background:rgba(255,255,255,.78);color:#111214;font-size:9.5px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,.04);}',
      'html[data-theme="dark"][data-easter-palette="iaar"] .fetcher-iaar-subtitle{background:rgba(17,19,21,.88);color:#F7F8F9;border-color:rgba(0,136,203,.42);}',
      '.fetcher-iaar-subtitle::before{content:"CC";display:inline-block;margin-right:6px;color:#0088CB;font-size:7px;font-weight:700;letter-spacing:.04em;vertical-align:1px;}',
      '.fetcher-iaar-video-lane{position:absolute;left:0;right:0;top:37px;height:38px;display:flex;align-items:center;gap:8px;padding-right:8px;box-sizing:border-box;}',
      '.fetcher-iaar-frame{position:relative;flex:0 0 46px;width:46px;height:28px;padding:3px;border:1px solid rgba(17,18,20,.28);border-radius:4px;box-sizing:border-box;background:rgba(255,255,255,.58);box-shadow:0 2px 7px rgba(0,0,0,.05);overflow:visible;}',
      'html[data-theme="dark"][data-easter-palette="iaar"] .fetcher-iaar-frame{border-color:rgba(255,255,255,.24);background:rgba(0,0,0,.42);box-shadow:0 2px 9px rgba(0,0,0,.22);}',
      '.fetcher-iaar-frame-fill{display:block;width:100%;height:100%;border-radius:2px;background:var(--iaar-frame,#000);box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);}',
      '.fetcher-iaar-frame[data-tone="black"]{--iaar-frame:#000000;}',
      '.fetcher-iaar-frame[data-tone="white"]{--iaar-frame:#FFFFFF;}',
      '.fetcher-iaar-frame[data-tone="blue"]{--iaar-frame:#0088CB;}',
      '.fetcher-iaar-frame[data-tone="red"]{--iaar-frame:#ED1C24;}',
      '.fetcher-iaar-cut{position:absolute;right:-5px;top:-7px;width:2px;height:40px;border-radius:2px;background:#ED1C24;box-shadow:0 0 0 1px rgba(237,28,36,.08);}',
      '.fetcher-iaar-cut::before{content:"";position:absolute;left:-2px;top:-1px;width:6px;height:2px;border-radius:2px;background:#ED1C24;}',
      '.fetcher-iaar-flash{position:absolute;inset:3px;border-radius:2px;background:#FFFFFF;opacity:0;animation:fetcher-iaar-flash 11200ms linear infinite;pointer-events:none;}',
      '.fetcher-iaar-tick{position:absolute;left:5px;bottom:-6px;width:9px;height:2px;border-radius:2px;background:rgba(0,136,203,.56);}',
      '.fetcher-iaar-frame:nth-child(6n) .fetcher-iaar-tick{background:rgba(237,28,36,.62);}',
      '.fetcher-iaar-audio-lane{position:absolute;left:0;right:0;bottom:6px;height:25px;display:flex;align-items:center;padding:0 6px;box-sizing:border-box;border-top:1px solid rgba(237,28,36,.13);}',
      '.fetcher-iaar-waveform{width:100%;height:23px;display:flex;align-items:center;justify-content:space-around;gap:1px;overflow:hidden;}',
      '.fetcher-iaar-wavebar{display:block;flex:0 0 3px;width:3px;min-height:3px;border-radius:2px;background:#0088CB;opacity:.62;}',
      '.fetcher-iaar-wavebar:nth-child(9n),.fetcher-iaar-wavebar:nth-child(13n){background:#ED1C24;opacity:.72;}',
      'html[data-theme="dark"][data-easter-palette="iaar"] .fetcher-iaar-wavebar{opacity:.74;}',
      '@keyframes fetcher-iaar-roll{from{transform:translate3d(0,0,0);}to{transform:translate3d(calc(-1 * var(--iaar-cycle)),0,0);}}',
      '@keyframes fetcher-iaar-flash{0%,72%,76%,100%{opacity:0;}73%{opacity:.92;}74%{opacity:.18;}75%{opacity:.72;}}',
      'html[data-motion="reserved"] .fetcher-iaar-layer{opacity:.72;}',
      'html[data-motion="reduced"] .fetcher-iaar-motion{animation:none!important;transform:translate3d(-214px,0,0)!important;}',
      'html[data-motion="reduced"] .fetcher-iaar-flash{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#050505' : '#FFFFFF');
  }

  function placement() {
    var controls = document.querySelector('.stage-inner > .controls-row');
    if (controls && controls.parentNode) {
      return { parent: controls.parentNode, after: controls, inline: true };
    }
    return { parent: document.querySelector('.main') || document.body, after: null, inline: false };
  }

  function makeFrame(spec, index) {
    var frame = document.createElement('span');
    frame.className = 'fetcher-iaar-frame';
    frame.setAttribute('data-tone', spec.tone);

    var fill = document.createElement('span');
    fill.className = 'fetcher-iaar-frame-fill';
    frame.appendChild(fill);

    var tick = document.createElement('span');
    tick.className = 'fetcher-iaar-tick';
    frame.appendChild(tick);

    if (spec.cut) {
      var cut = document.createElement('span');
      cut.className = 'fetcher-iaar-cut';
      frame.appendChild(cut);
    }

    if (spec.flash) {
      var flash = document.createElement('span');
      flash.className = 'fetcher-iaar-flash';
      flash.setAttribute('data-iaar-flash', String(index));
      frame.appendChild(flash);
    }

    return frame;
  }

  function makeSubtitleLane() {
    var lane = document.createElement('div');
    lane.className = 'fetcher-iaar-subtitle-lane';
    SUBTITLES.forEach(function (spec) {
      var clip = document.createElement('span');
      clip.className = 'fetcher-iaar-subtitle';
      clip.textContent = spec.text;
      clip.style.left = spec.left + 'px';
      clip.style.width = spec.width + 'px';
      lane.appendChild(clip);
    });
    return lane;
  }

  function makeVideoLane() {
    var lane = document.createElement('div');
    lane.className = 'fetcher-iaar-video-lane';
    FRAMES.forEach(function (spec, index) {
      lane.appendChild(makeFrame(spec, index));
    });
    return lane;
  }

  function makeAudioLane() {
    var lane = document.createElement('div');
    lane.className = 'fetcher-iaar-audio-lane';
    var waveform = document.createElement('div');
    waveform.className = 'fetcher-iaar-waveform';
    WAVE_HEIGHTS.forEach(function (height) {
      var bar = document.createElement('span');
      bar.className = 'fetcher-iaar-wavebar';
      bar.style.height = height + 'px';
      waveform.appendChild(bar);
    });
    lane.appendChild(waveform);
    return lane;
  }

  function makeCycle() {
    var cycle = document.createElement('div');
    cycle.className = 'fetcher-iaar-cycle';
    cycle.appendChild(makeSubtitleLane());
    cycle.appendChild(makeVideoLane());
    cycle.appendChild(makeAudioLane());
    return cycle;
  }

  function applyPhase() {
    if (!motion || !layer) return;
    var shared = sharedState();
    var elapsed = Math.max(0, Date.now() - shared.startedAt);
    motion.style.animationDelay = -(elapsed % LOOP_MS) + 'ms';
    Array.prototype.forEach.call(layer.querySelectorAll('.fetcher-iaar-flash'), function (flash) {
      flash.style.animationDelay = -(elapsed % FLASH_MS) + 'ms';
    });
  }

  function ensureLayer() {
    var spot = placement();
    var parent = spot.parent;
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent && layer.classList.contains('is-inline') === spot.inline) {
      return layer;
    }

    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-iaar-layer' + (spot.inline ? ' is-inline' : '');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--iaar-cycle', CYCLE_PX + 'px');

    motion = document.createElement('div');
    motion.className = 'fetcher-iaar-motion';
    motion.appendChild(makeCycle());
    motion.appendChild(makeCycle());
    layer.appendChild(motion);

    if (spot.inline) {
      parent.insertBefore(layer, spot.after.nextSibling);
    } else {
      parent.insertBefore(layer, parent.firstChild);
    }
    applyPhase();
    return layer;
  }

  function stop() {
    if (layer && layer.parentNode) layer.remove();
    layer = null;
    motion = null;
  }

  function start() {
    if (!active()) {
      stop();
      return;
    }
    ensureStyles();
    syncBrowserColor();
    ensureLayer();
  }

  document.addEventListener('fetcher:easter-change', start);
  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail) return;
    if (event.detail.key === 'fetcher.theme') syncBrowserColor();
    if (event.detail.key === 'fetcher.motion') start();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      start();
    }).observe(root, { attributes: true, attributeFilter: ['data-easter-palette', 'data-theme', 'data-motion'] });
  }

  function init() {
    ensureStyles();
    if (active()) start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
