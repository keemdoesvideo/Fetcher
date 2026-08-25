/* Luumi-only ambience: one continuous satin ribbon drifting behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var layer = null;
  var DURATION = 18000;

  function active() {
    return root.getAttribute('data-easter-palette') === 'luumi';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherLuumiRibbonShared || topWindow.FetcherLuumiRibbonShared.version !== 1) {
        topWindow.FetcherLuumiRibbonShared = { version: 1, startedAt: Date.now() };
      }
      return topWindow.FetcherLuumiRibbonShared;
    } catch (e) {
      if (!window.FetcherLuumiRibbonShared || window.FetcherLuumiRibbonShared.version !== 1) {
        window.FetcherLuumiRibbonShared = { version: 1, startedAt: Date.now() };
      }
      return window.FetcherLuumiRibbonShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-luumi-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-luumi-styles';
    style.textContent = [
      'html[data-theme="light"][data-easter-palette="luumi"]{--bg:#FBFEFB;--surface:#FFFFFF;--rail:#F9CCD7;--ink:#4A1F2E;--ink-strong:#2D101A;--ink-soft:#7B4052;--ink-faint:#A86B7A;--border:#F6BCC4;--border-strong:#F98EA9;--accent:#F52E6F;--accent-ink:#B5164A;--accent-tint:#F9CCD7;--on-accent:#FFFFFF;--audio:#F98EA9;--audio-tint:#FCE0E7;--mute:#F6BCC4;--mute-tint:#FDEBF0;--danger:#F52E6F;--danger-tint:#F9CCD7;--success:#D95E86;--success-tint:#FCE0E7;--shiba:#F98EA9;--shiba-deep:#F52E6F;--shiba-cream:#FBFEFB;}',
      'html[data-theme="dark"][data-easter-palette="luumi"]{--bg:#251219;--surface:#321821;--rail:#421D2B;--ink:#FFF7FA;--ink-strong:#FFFFFF;--ink-soft:#F9CCD7;--ink-faint:#D98FA4;--border:#5C2A3B;--border-strong:#8C3B58;--accent:#F52E6F;--accent-ink:#F9CCD7;--accent-tint:rgba(245,46,111,.20);--on-accent:#FFFFFF;--audio:#F98EA9;--audio-tint:rgba(249,142,169,.18);--mute:#F6BCC4;--mute-tint:rgba(246,188,196,.13);--danger:#F52E6F;--danger-tint:rgba(245,46,111,.18);--success:#F98EA9;--success-tint:rgba(249,142,169,.14);--shiba:#F98EA9;--shiba-deep:#F52E6F;--shiba-cream:#F9CCD7;}',
      '.fetcher-luumi-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="luumi"] .main>.stage,html[data-easter-palette="luumi"] .main>.foot,html[data-easter-palette="luumi"] .main>.settings-nav,html[data-easter-palette="luumi"] .main>.settings-content,html[data-easter-palette="luumi"] .main>.about,html[data-easter-palette="luumi"] .main>.donate,html[data-easter-palette="luumi"] .main>.updates,html[data-easter-palette="luumi"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-luumi-ribbon{position:absolute;left:0;top:50%;width:300%;height:min(54vh,430px);transform:translate3d(0,-50%,0);opacity:.66;animation:fetcher-luumi-travel 18000ms linear var(--luumi-delay,0ms) infinite;will-change:transform;}',
      '.fetcher-luumi-ribbon svg{display:block;width:100%;height:100%;overflow:visible;}',
      '.fetcher-luumi-shadow{filter:drop-shadow(0 9px 12px rgba(132,28,65,.08));}',
      '.fetcher-luumi-bow{filter:drop-shadow(0 5px 7px rgba(132,28,65,.09));}',
      'html[data-theme="dark"][data-easter-palette="luumi"] .fetcher-luumi-ribbon{opacity:.72;}',
      'html[data-theme="dark"][data-easter-palette="luumi"] .fetcher-luumi-shadow{filter:drop-shadow(0 10px 16px rgba(0,0,0,.18));}',
      '@keyframes fetcher-luumi-travel{0%{transform:translate3d(0,-50%,0);}25%{transform:translate3d(-8.333%,-48.5%,0);}50%{transform:translate3d(-16.666%,-51.5%,0);}75%{transform:translate3d(-25%,-49%,0);}100%{transform:translate3d(-33.333%,-50%,0);}}',
      'html[data-motion="reserved"] .fetcher-luumi-ribbon{animation-timing-function:linear;}',
      'html[data-motion="reduced"] .fetcher-luumi-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#251219' : '#FBFEFB');
  }

  function host() {
    return document.querySelector('.main') || document.body;
  }

  function ribbonSvg() {
    var wave = 'M0 250 C100 92 300 92 400 250 S700 408 800 250 S1100 92 1200 250 S1500 408 1600 250 S1900 92 2000 250 S2300 408 2400 250';
    function bow(x, y, rotation) {
      return [
        '<g class="fetcher-luumi-bow" transform="translate(', x, ' ', y, ') rotate(', rotation, ')">',
        '<path d="M-7 0 C-42 -32 -72 -28 -66 2 C-61 28 -34 26 -7 8 Z" fill="#F98EA9" stroke="#F52E6F" stroke-width="5" stroke-linejoin="round"/>',
        '<path d="M7 0 C42 -32 72 -28 66 2 C61 28 34 26 7 8 Z" fill="#F6BCC4" stroke="#F52E6F" stroke-width="5" stroke-linejoin="round"/>',
        '<path d="M-4 10 L-27 49 L1 35 L11 12 Z" fill="#F9CCD7" stroke="#F52E6F" stroke-width="4" stroke-linejoin="round"/>',
        '<path d="M4 10 L27 49 L-1 35 L-11 12 Z" fill="#F98EA9" stroke="#F52E6F" stroke-width="4" stroke-linejoin="round"/>',
        '<ellipse cx="0" cy="4" rx="15" ry="13" fill="#F52E6F"/>',
        '<ellipse cx="-4" cy="0" rx="6" ry="4" fill="#FBFEFB" opacity=".42"/>',
        '</g>'
      ].join('');
    }

    return [
      '<svg viewBox="0 0 2400 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">',
      '<defs><linearGradient id="fetcher-luumi-ribbon-gradient" x1="0" y1="0" x2="1" y2="0">',
      '<stop offset="0%" stop-color="#F52E6F"/><stop offset="24%" stop-color="#F98EA9"/><stop offset="50%" stop-color="#F6BCC4"/><stop offset="72%" stop-color="#F98EA9"/><stop offset="100%" stop-color="#F52E6F"/>',
      '</linearGradient></defs>',
      '<path class="fetcher-luumi-shadow" d="', wave, '" fill="none" stroke="#F9CCD7" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/>',
      '<path d="', wave, '" fill="none" stroke="url(#fetcher-luumi-ribbon-gradient)" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>',
      '<path d="', wave, '" fill="none" stroke="#FBFEFB" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".48" transform="translate(0 -5)"/>',
      bow(405, 246, -10), bow(1205, 246, 8), bow(2005, 246, -10),
      '</svg>'
    ].join('');
  }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();

    layer = document.createElement('div');
    layer.className = 'fetcher-luumi-layer';
    layer.setAttribute('aria-hidden', 'true');

    var ribbon = document.createElement('div');
    ribbon.className = 'fetcher-luumi-ribbon';
    var elapsed = Math.max(0, Date.now() - sharedState().startedAt) % DURATION;
    ribbon.style.setProperty('--luumi-delay', (-elapsed) + 'ms');
    ribbon.innerHTML = ribbonSvg();
    layer.appendChild(ribbon);
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function clearLayer() {
    if (layer && layer.parentNode) layer.remove();
    layer = null;
  }

  function syncAll() {
    ensureStyles();
    syncBrowserColor();
    if (!active() || reducedMotion()) {
      clearLayer();
      return;
    }
    ensureLayer();
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
