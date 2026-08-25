/* Shanjuanita-only ambience: elegant creeping vines and sparse drifting leaves. */
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
      if (!target.FetcherShanjuanitaShared || target.FetcherShanjuanitaShared.version !== 1) {
        target.FetcherShanjuanitaShared = {
          version: 1,
          nextId: 1,
          vines: [],
          leaves: [],
          nextVineAt: Date.now() + 350,
          nextLeafAt: Date.now() + 2100
        };
      }
      return target.FetcherShanjuanitaShared;
    } catch (e) {
      if (!window.FetcherShanjuanitaShared || window.FetcherShanjuanitaShared.version !== 1) {
        window.FetcherShanjuanitaShared = {
          version: 1,
          nextId: 1,
          vines: [],
          leaves: [],
          nextVineAt: Date.now() + 350,
          nextLeafAt: Date.now() + 2100
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
      '.fetcher-shanjuanita-vine{position:absolute;inset:0;opacity:var(--vine-opacity,.72);}',
      '.fetcher-shanjuanita-vine svg{display:block;width:100%;height:100%;overflow:visible;}',
      '.fetcher-shanjuanita-stem{fill:none;stroke:var(--vine-stroke);stroke-width:3.1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1;animation:fetcher-shanjuanita-vine-life var(--vine-duration) cubic-bezier(.42,0,.22,1) var(--vine-delay) both;}',
      '.fetcher-shanjuanita-leaf-shape{opacity:0;transform-box:fill-box;transform-origin:center;animation:fetcher-shanjuanita-leaf-bloom var(--vine-duration) cubic-bezier(.2,.7,.25,1) var(--leaf-delay) both;filter:drop-shadow(0 3px 5px rgba(77,49,108,.06));}',
      '@keyframes fetcher-shanjuanita-vine-life{0%{opacity:0;stroke-dashoffset:1;}5%{opacity:.35;}42%{opacity:1;stroke-dashoffset:0;}68%{opacity:1;stroke-dashoffset:0;}88%{opacity:.34;stroke-dashoffset:.88;}100%{opacity:0;stroke-dashoffset:1;}}',
      '@keyframes fetcher-shanjuanita-leaf-bloom{0%,7%{opacity:0;transform:scale(.25) rotate(-6deg);}18%{opacity:1;transform:scale(1.04) rotate(2deg);}25%,68%{opacity:1;transform:scale(1) rotate(0deg);}84%{opacity:.2;transform:scale(.78) rotate(4deg);}100%{opacity:0;transform:scale(.45) rotate(7deg);}}',
      '.fetcher-shanjuanita-falling{position:absolute;left:var(--fall-x);top:-10%;width:var(--fall-size);height:calc(var(--fall-size)*.72);border-radius:85% 12% 85% 12%;background:var(--fall-color);border:1px solid rgba(77,49,108,.10);opacity:0;transform-origin:center;animation:fetcher-shanjuanita-fall var(--fall-duration) cubic-bezier(.28,.34,.34,1) var(--fall-delay) both;will-change:transform,opacity;filter:drop-shadow(0 4px 7px rgba(77,49,108,.07));}',
      '.fetcher-shanjuanita-falling::after{content:"";position:absolute;left:48%;top:14%;width:1px;height:72%;background:rgba(77,49,108,.20);transform:rotate(-38deg);transform-origin:center;}',
      '@keyframes fetcher-shanjuanita-fall{0%{opacity:0;transform:translate3d(0,-6vh,0) rotate(var(--fall-r0));}8%{opacity:var(--fall-opacity);}35%{transform:translate3d(calc(var(--fall-drift)*.35),35vh,0) rotate(var(--fall-r1));}68%{opacity:var(--fall-opacity);transform:translate3d(calc(var(--fall-drift)*-.22),74vh,0) rotate(var(--fall-r2));}92%{opacity:var(--fall-opacity);}100%{opacity:0;transform:translate3d(var(--fall-drift),118vh,0) rotate(var(--fall-r3));}}',
      'html[data-theme="dark"][data-easter-palette="shanjuanita"] .fetcher-shanjuanita-vine{opacity:.8;}',
      'html[data-motion="reserved"] .fetcher-shanjuanita-stem,html[data-motion="reserved"] .fetcher-shanjuanita-leaf-shape,html[data-motion="reserved"] .fetcher-shanjuanita-falling{animation-timing-function:var(--ease);}',
      'html[data-motion="reduced"] .fetcher-shanjuanita-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  var VINES = [
    { path: 'M-35 88 C72 24 190 52 174 158 C158 260 286 294 340 196 C393 99 515 105 548 205', leaves: [[75,57,-34],[139,83,24],[173,145,-42],[203,218,32],[286,250,-27],[335,202,38],[404,132,-31],[486,151,29]] },
    { path: 'M-28 646 C104 670 176 584 120 500 C65 416 196 347 270 416 C344 485 432 401 389 310', leaves: [[74,636,24],[135,594,-31],[121,516,36],[141,445,-28],[226,397,32],[284,433,-34],[353,409,30],[396,343,-25]] },
    { path: 'M1235 88 C1128 24 1010 52 1026 158 C1042 260 914 294 860 196 C807 99 685 105 652 205', leaves: [[1125,57,34],[1061,83,-24],[1027,145,42],[997,218,-32],[914,250,27],[865,202,-38],[796,132,31],[714,151,-29]] },
    { path: 'M1228 646 C1096 670 1024 584 1080 500 C1135 416 1004 347 930 416 C856 485 768 401 811 310', leaves: [[1126,636,-24],[1065,594,31],[1079,516,-36],[1059,445,28],[974,397,-32],[916,433,34],[847,409,-30],[804,343,25]] },
    { path: 'M-30 352 C90 290 189 325 178 410 C167 496 287 515 338 430 C388 346 487 349 516 425', leaves: [[70,325,-32],[143,335,27],[180,395,-38],[220,467,31],[295,480,-26],[339,430,35],[411,372,-29],[485,394,26]] },
    { path: 'M1230 350 C1110 288 1011 323 1022 408 C1033 494 913 513 862 428 C812 344 713 347 684 423', leaves: [[1130,323,32],[1057,333,-27],[1020,393,38],[980,465,-31],[905,478,26],[861,428,-35],[789,370,29],[715,392,-26]] }
  ];

  function leafSvg(x, y, rotation, color, index) {
    var scale = index % 3 === 0 ? 1.08 : (index % 3 === 1 ? .92 : 1);
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rotation + ') scale(' + scale + ')"><path class="fetcher-shanjuanita-leaf-shape" style="--leaf-delay:var(--leaf-delay-' + index + ')" d="M0 0 C13 -17 31 -16 37 -2 C25 12 10 15 0 0 Z" fill="' + color + '"/></g>';
  }

  function vineSvg(vine) {
    var def = VINES[vine.variant % VINES.length];
    var leafColors = [COLORS.sage, COLORS.deepSage, COLORS.softPurple, COLORS.sage, COLORS.cream];
    var parts = ['<svg viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true" focusable="false">','<path class="fetcher-shanjuanita-stem" pathLength="1" d="', def.path, '"/>'];
    def.leaves.forEach(function (item, index) { parts.push(leafSvg(item[0], item[1], item[2], leafColors[(vine.colorShift + index) % leafColors.length], index)); });
    parts.push('</svg>');
    return parts.join('');
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
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function syncBrowserColor() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#1D1724' : '#F0E9DE');
  }

  function spawnVine(state, now) {
    var recent = state.vines.length ? state.vines[state.vines.length - 1].variant : -1;
    var variant = Math.floor(rand(0, VINES.length));
    if (variant === recent) variant = (variant + 1 + Math.floor(rand(0, VINES.length - 1))) % VINES.length;
    state.vines.push({ id: state.nextId++, bornAt: now, duration: rand(17000, 22500), variant: variant, colorShift: Math.floor(rand(0, 5)), stroke: Math.random() < .68 ? COLORS.deepSage : COLORS.sage, opacity: rand(.58, .76) });
    state.nextVineAt = now + rand(8500, 12800);
  }

  function spawnFallingLeaf(state, now) {
    var colors = [COLORS.deepSage, COLORS.sage, COLORS.softPurple, COLORS.cream];
    state.leaves.push({ id: state.nextId++, bornAt: now, duration: rand(7800, 11800), x: rand(8, 92), size: rand(12, 21), drift: rand(-70, 70), opacity: rand(.48, .72), color: colors[Math.floor(rand(0, colors.length))], r0: rand(-45, 35), r1: rand(55, 145), r2: rand(150, 260), r3: rand(265, 390) });
    state.nextLeafAt = now + rand(4200, 7200);
  }

  function maintainShared() {
    var state = sharedState();
    var now = Date.now();
    state.vines = state.vines.filter(function (vine) { return now < vine.bornAt + vine.duration + 500; });
    state.leaves = state.leaves.filter(function (leaf) { return now < leaf.bornAt + leaf.duration + 350; });
    if (now >= state.nextVineAt) { if (state.vines.length < 2) spawnVine(state, now); else state.nextVineAt = now + rand(2600, 4400); }
    if (now >= state.nextLeafAt) { if (state.leaves.length < 2) spawnFallingLeaf(state, now); else state.nextLeafAt = now + rand(1800, 3200); }
    return state;
  }

  function renderVine(vine) {
    var target = ensureLayer();
    if (!target) return;
    var age = Date.now() - vine.bornAt;
    var node = document.createElement('div');
    node.className = 'fetcher-shanjuanita-vine';
    node.setAttribute('data-shanjuanita-vine-id', String(vine.id));
    node.style.setProperty('--vine-duration', vine.duration + 'ms');
    node.style.setProperty('--vine-delay', (-age) + 'ms');
    node.style.setProperty('--vine-stroke', vine.stroke);
    node.style.setProperty('--vine-opacity', String(vine.opacity));
    for (var i = 0; i < 8; i += 1) node.style.setProperty('--leaf-delay-' + i, ((-age) + 160 + i * 245) + 'ms');
    node.innerHTML = vineSvg(vine);
    target.appendChild(node);
  }

  function renderFallingLeaf(leaf) {
    var target = ensureLayer();
    if (!target) return;
    var age = Date.now() - leaf.bornAt;
    var node = document.createElement('span');
    node.className = 'fetcher-shanjuanita-falling';
    node.setAttribute('data-shanjuanita-leaf-id', String(leaf.id));
    node.style.setProperty('--fall-x', leaf.x.toFixed(2) + '%');
    node.style.setProperty('--fall-size', leaf.size.toFixed(1) + 'px');
    node.style.setProperty('--fall-drift', leaf.drift.toFixed(1) + 'px');
    node.style.setProperty('--fall-opacity', String(leaf.opacity));
    node.style.setProperty('--fall-color', leaf.color);
    node.style.setProperty('--fall-duration', leaf.duration + 'ms');
    node.style.setProperty('--fall-delay', (-age) + 'ms');
    node.style.setProperty('--fall-r0', leaf.r0.toFixed(1) + 'deg');
    node.style.setProperty('--fall-r1', leaf.r1.toFixed(1) + 'deg');
    node.style.setProperty('--fall-r2', leaf.r2.toFixed(1) + 'deg');
    node.style.setProperty('--fall-r3', leaf.r3.toFixed(1) + 'deg');
    target.appendChild(node);
  }

  function syncRendered() {
    if (!active() || reducedMotion()) { if (layer) layer.replaceChildren(); return; }
    var target = ensureLayer();
    if (!target) return;
    var state = maintainShared();
    var now = Date.now();
    var liveVines = {}, liveLeaves = {};
    state.vines.forEach(function (vine) { if (now >= vine.bornAt + vine.duration + 500) return; liveVines[String(vine.id)] = true; if (!target.querySelector('[data-shanjuanita-vine-id="' + vine.id + '"]')) renderVine(vine); });
    state.leaves.forEach(function (leaf) { if (now >= leaf.bornAt + leaf.duration + 350) return; liveLeaves[String(leaf.id)] = true; if (!target.querySelector('[data-shanjuanita-leaf-id="' + leaf.id + '"]')) renderFallingLeaf(leaf); });
    Array.prototype.forEach.call(target.querySelectorAll('[data-shanjuanita-vine-id]'), function (node) { if (!liveVines[node.getAttribute('data-shanjuanita-vine-id')]) node.remove(); });
    Array.prototype.forEach.call(target.querySelectorAll('[data-shanjuanita-leaf-id]'), function (node) { if (!liveLeaves[node.getAttribute('data-shanjuanita-leaf-id')]) node.remove(); });
  }

  function startRenderer() { window.clearInterval(renderTimer); renderTimer = null; if (!active() || reducedMotion()) return; ensureLayer(); syncRendered(); renderTimer = window.setInterval(syncRendered, 220); }
  function stopRenderer() { window.clearInterval(renderTimer); renderTimer = null; if (layer) layer.replaceChildren(); }
  function syncAll() { ensureStyles(); syncBrowserColor(); if (active() && !reducedMotion()) startRenderer(); else stopRenderer(); }

  document.addEventListener('fetcher:easter-change', syncAll);
  document.addEventListener('fetcher:pref-change', function (event) { if (!event || !event.detail) return; if (event.detail.key === 'fetcher.motion') syncAll(); if (event.detail.key === 'fetcher.theme') syncBrowserColor(); });
  window.addEventListener('pageshow', syncAll);
  if (window.MutationObserver) new MutationObserver(function () { syncBrowserColor(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll, { once: true }); else syncAll();
})();
