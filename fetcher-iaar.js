/* Iaar-only ambience: a continuous editor-film conveyor behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var layer = null;
  var track = null;
  var LOOP_MS = 26000;

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

  function active() {
    return root.getAttribute('data-easter-palette') === 'iaar';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherIaarShared || topWindow.FetcherIaarShared.version !== 1) {
        topWindow.FetcherIaarShared = { version: 1, startedAt: Date.now() };
      }
      return topWindow.FetcherIaarShared;
    } catch (e) {
      if (!window.FetcherIaarShared || window.FetcherIaarShared.version !== 1) {
        window.FetcherIaarShared = { version: 1, startedAt: Date.now() };
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
      '.fetcher-iaar-layer{position:absolute;left:0;right:0;bottom:0;height:54px;z-index:0;pointer-events:none;overflow:hidden;border-radius:0 0 inherit inherit;opacity:.82;}',
      '.fetcher-iaar-layer::before{content:"";position:absolute;left:0;right:0;bottom:0;height:46px;border-top:1px solid rgba(0,0,0,.10);background:linear-gradient(180deg,rgba(255,255,255,0),rgba(0,0,0,.035));}',
      'html[data-theme="dark"][data-easter-palette="iaar"] .fetcher-iaar-layer::before{border-top-color:rgba(255,255,255,.10);background:linear-gradient(180deg,rgba(0,0,0,0),rgba(255,255,255,.035));}',
      'html[data-easter-palette="iaar"] .main>.stage,html[data-easter-palette="iaar"] .main>.foot,html[data-easter-palette="iaar"] .main>.settings-nav,html[data-easter-palette="iaar"] .main>.settings-content,html[data-easter-palette="iaar"] .main>.about,html[data-easter-palette="iaar"] .main>.donate,html[data-easter-palette="iaar"] .main>.updates,html[data-easter-palette="iaar"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-iaar-track{position:absolute;left:0;bottom:8px;display:flex;width:max-content;animation:fetcher-iaar-roll 26000ms linear infinite;will-change:transform;}',
      '.fetcher-iaar-sequence{display:flex;align-items:center;gap:8px;padding-right:8px;}',
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
      '@keyframes fetcher-iaar-roll{from{transform:translate3d(0,0,0);}to{transform:translate3d(-50%,0,0);}}',
      '@keyframes fetcher-iaar-flash{0%,72%,76%,100%{opacity:0;}73%{opacity:.92;}74%{opacity:.18;}75%{opacity:.72;}}',
      'html[data-motion="reserved"] .fetcher-iaar-layer{opacity:.72;}',
      'html[data-motion="reduced"] .fetcher-iaar-track{animation:none!important;transform:translate3d(-22%,0,0)!important;}',
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

  function host() {
    return document.querySelector('.main') || document.body;
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

  function makeSequence() {
    var sequence = document.createElement('span');
    sequence.className = 'fetcher-iaar-sequence';
    FRAMES.forEach(function (spec, index) {
      sequence.appendChild(makeFrame(spec, index));
    });
    return sequence;
  }

  function applyPhase() {
    if (!track) return;
    var shared = sharedState();
    var delay = -(Date.now() - shared.startedAt);
    track.style.animationDelay = delay + 'ms';
    Array.prototype.forEach.call(layer.querySelectorAll('.fetcher-iaar-flash'), function (flash) {
      flash.style.animationDelay = delay + 'ms';
    });
  }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) {
      applyPhase();
      return layer;
    }

    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-iaar-layer';
    layer.setAttribute('aria-hidden', 'true');

    track = document.createElement('div');
    track.className = 'fetcher-iaar-track';
    track.appendChild(makeSequence());
    track.appendChild(makeSequence());
    layer.appendChild(track);
    parent.insertBefore(layer, parent.firstChild);
    applyPhase();
    return layer;
  }

  function stop() {
    if (layer && layer.parentNode) layer.remove();
    layer = null;
    track = null;
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
