/* JackIgoe-only ambience: occasional stylised playing cards sweeping behind the UI. */
(function () {
  'use strict';

  var root = document.documentElement;
  var topWindow = window;
  try { if (window.top) topWindow = window.top; } catch (e) { topWindow = window; }
  var isMaster = topWindow === window;
  var layer = null;
  var renderTimer = null;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }

  function active() {
    return root.getAttribute('data-easter-palette') === 'jackigoe';
  }

  function reducedMotion() {
    return root.getAttribute('data-motion') === 'reduced';
  }

  function masterActive() {
    try { return topWindow.document.documentElement.getAttribute('data-easter-palette') === 'jackigoe'; }
    catch (e) { return active(); }
  }

  function masterReducedMotion() {
    try { return topWindow.document.documentElement.getAttribute('data-motion') === 'reduced'; }
    catch (e) { return reducedMotion(); }
  }

  function sharedState() {
    try {
      if (!topWindow.FetcherJackIgoeCardsShared) {
        topWindow.FetcherJackIgoeCardsShared = {
          cards: [],
          nextCardId: 1,
          cardTimer: null,
          running: false
        };
      }
      return topWindow.FetcherJackIgoeCardsShared;
    } catch (e) {
      if (!window.FetcherJackIgoeCardsShared) {
        window.FetcherJackIgoeCardsShared = { cards: [], nextCardId: 1, cardTimer: null, running: false };
      }
      return window.FetcherJackIgoeCardsShared;
    }
  }

  function ensureStyles() {
    if (document.getElementById('fetcher-jackigoe-styles')) return;
    var style = document.createElement('style');
    style.id = 'fetcher-jackigoe-styles';
    style.textContent = [
      'html[data-easter-palette="jackigoe"] .fetcher-ambient-jack-bit{display:none!important;}',
      '.fetcher-jackigoe-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit;}',
      'html[data-easter-palette="jackigoe"] .main>.stage,html[data-easter-palette="jackigoe"] .main>.foot,html[data-easter-palette="jackigoe"] .main>.settings-nav,html[data-easter-palette="jackigoe"] .main>.settings-content,html[data-easter-palette="jackigoe"] .main>.about,html[data-easter-palette="jackigoe"] .main>.donate,html[data-easter-palette="jackigoe"] .main>.updates,html[data-easter-palette="jackigoe"] .main>.soon{position:relative;z-index:1;}',
      '.fetcher-jackigoe-card-flight{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;transform:translate3d(var(--jack-sx),var(--jack-sy),0);animation:fetcher-jackigoe-flight var(--jack-duration) cubic-bezier(.38,.08,.62,.96) var(--jack-delay) both;will-change:transform,opacity;}',
      '.fetcher-jackigoe-card{position:absolute;left:0;top:0;width:var(--jack-w);height:var(--jack-h);transform:translate(-50%,-50%) rotate(var(--jack-r0));transform-origin:center;animation:fetcher-jackigoe-card-turn var(--jack-duration) cubic-bezier(.38,.08,.62,.96) var(--jack-delay) both;border-radius:calc(var(--jack-w) * .12);background:var(--jack-bg);color:var(--jack-ink);border:1px solid color-mix(in srgb,var(--jack-ink) 24%,transparent);box-shadow:0 10px 24px rgba(8,20,12,.10);overflow:hidden;will-change:transform;}',
      '.fetcher-jackigoe-card::after{content:"";position:absolute;inset:5px;border:1px solid color-mix(in srgb,var(--jack-ink) 18%,transparent);border-radius:calc(var(--jack-w) * .075);}',
      '.fetcher-jackigoe-corner{position:absolute;left:7px;top:6px;z-index:1;display:flex;flex-direction:column;align-items:center;font:800 calc(var(--jack-w) * .22)/.82 Arial,sans-serif;letter-spacing:-.04em;}',
      '.fetcher-jackigoe-corner .suit{font-size:.72em;margin-top:3px;}',
      '.fetcher-jackigoe-corner.bottom{left:auto;top:auto;right:7px;bottom:6px;transform:rotate(180deg);}',
      '.fetcher-jackigoe-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1;font:900 calc(var(--jack-w) * .46)/1 Arial,sans-serif;letter-spacing:-.08em;}',
      '.fetcher-jackigoe-center.suit{font-size:calc(var(--jack-w) * .54);}',
      '.fetcher-jackigoe-jack-signature{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);z-index:1;font:800 6px/1 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase;opacity:.56;}',
      'html[data-theme="dark"][data-easter-palette="jackigoe"] .fetcher-jackigoe-card{box-shadow:0 12px 30px rgba(0,0,0,.18);}',
      '@keyframes fetcher-jackigoe-flight{0%{opacity:0;transform:translate3d(var(--jack-sx),var(--jack-sy),0);}8%{opacity:var(--jack-opacity);}48%{opacity:var(--jack-opacity);transform:translate3d(var(--jack-mx),var(--jack-my),0);}91%{opacity:var(--jack-opacity);transform:translate3d(var(--jack-ex),var(--jack-ey),0);}100%{opacity:0;transform:translate3d(var(--jack-ex),var(--jack-ey),0);}}',
      '@keyframes fetcher-jackigoe-card-turn{0%{transform:translate(-50%,-50%) rotate(var(--jack-r0));}48%{transform:translate(-50%,-50%) rotate(var(--jack-r1));}100%{transform:translate(-50%,-50%) rotate(var(--jack-r2));}}',
      'html[data-motion="reduced"] .fetcher-jackigoe-layer{display:none!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function host() { return document.querySelector('.main') || document.body; }

  function ensureLayer() {
    var parent = host();
    if (!parent) return null;
    if (layer && layer.isConnected && layer.parentNode === parent) return layer;
    if (layer && layer.parentNode) layer.remove();
    layer = document.createElement('div');
    layer.className = 'fetcher-jackigoe-layer';
    layer.setAttribute('aria-hidden', 'true');
    parent.insertBefore(layer, parent.firstChild);
    return layer;
  }

  function cardPalette() {
    return pick([
      { bg: '#CDDB01', ink: '#20311F' },
      { bg: '#F3A6D8', ink: '#572842' },
      { bg: '#F03A55', ink: '#FFF3F6' }
    ]);
  }

  function makeCard(offsetMs) {
    var viewportW = Math.max(720, window.innerWidth || 1280);
    var viewportH = Math.max(520, window.innerHeight || 720);
    var leftToRight = Math.random() < 0.54;
    var startX = leftToRight ? rand(-125, -70) : rand(viewportW + 70, viewportW + 125);
    var endX = leftToRight ? rand(viewportW + 70, viewportW + 145) : rand(-145, -70);
    var minY = Math.max(72, viewportH * .09);
    var maxY = Math.min(viewportH * .68, viewportH - 100);
    var startY = rand(minY, Math.max(minY + 90, maxY));
    var endY = Math.max(62, Math.min(viewportH * .74, startY + rand(-130, 130)));
    var midX = (startX + endX) / 2 + rand(-60, 60);
    var midY = ((startY + endY) / 2) + rand(-72, 72);
    var width = rand(44, 70);
    var isJack = Math.random() < .17;
    var ranks = ['A', '2', '3', '5', '7', '9', 'Q', 'K'];
    var suits = ['♠', '♥', '♦', '♣'];
    var palette = cardPalette();
    var direction = leftToRight ? 1 : -1;

    return {
      id: sharedState().nextCardId++,
      bornAt: Date.now() + (offsetMs || 0),
      duration: rand(8200, 12600),
      opacity: rand(.42, .62),
      startX: startX,
      startY: startY,
      midX: midX,
      midY: midY,
      endX: endX,
      endY: endY,
      width: width,
      height: width * 1.42,
      r0: rand(-18, 18) + (direction * rand(-4, 4)),
      r1: rand(-9, 9),
      r2: rand(-20, 20) - (direction * rand(-3, 5)),
      bg: palette.bg,
      ink: palette.ink,
      rank: isJack ? 'J' : pick(ranks),
      suit: pick(suits),
      isJack: isJack
    };
  }

  function addSweep(shared) {
    var pair = Math.random() < .30;
    shared.cards.push(makeCard(0));
    if (pair) shared.cards.push(makeCard(rand(320, 920)));
  }

  function pruneCards(shared) {
    var now = Date.now();
    shared.cards = shared.cards.filter(function (card) {
      return now < card.bornAt + card.duration + 250;
    });
  }

  function scheduleSweep() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.cardTimer);
    shared.cardTimer = null;
    if (!shared.running || !masterActive() || masterReducedMotion()) return;
    shared.cardTimer = window.setTimeout(function () {
      if (!shared.running || !masterActive() || masterReducedMotion()) return;
      pruneCards(shared);
      if (shared.cards.length < 3) addSweep(shared);
      scheduleSweep();
    }, rand(6800, 10800));
  }

  function startShared() {
    if (!isMaster) return;
    var shared = sharedState();
    if (!shared.running) {
      shared.running = true;
      shared.cards = [];
      addSweep(shared);
    }
    if (!masterReducedMotion() && !shared.cardTimer) scheduleSweep();
  }

  function stopShared() {
    if (!isMaster) return;
    var shared = sharedState();
    window.clearTimeout(shared.cardTimer);
    shared.cardTimer = null;
    shared.running = false;
    shared.cards = [];
  }

  function syncMasterActivity() {
    if (!isMaster) return;
    if (masterActive() && !masterReducedMotion()) startShared();
    else stopShared();
  }

  function renderCard(card) {
    var node = document.createElement('div');
    node.className = 'fetcher-jackigoe-card-flight';
    node.setAttribute('data-jackigoe-card-id', String(card.id));
    node.style.setProperty('--jack-sx', card.startX + 'px');
    node.style.setProperty('--jack-sy', card.startY + 'px');
    node.style.setProperty('--jack-mx', card.midX + 'px');
    node.style.setProperty('--jack-my', card.midY + 'px');
    node.style.setProperty('--jack-ex', card.endX + 'px');
    node.style.setProperty('--jack-ey', card.endY + 'px');
    node.style.setProperty('--jack-duration', card.duration + 'ms');
    node.style.setProperty('--jack-delay', (-(Date.now() - card.bornAt)) + 'ms');
    node.style.setProperty('--jack-opacity', String(card.opacity));
    node.style.setProperty('--jack-w', card.width + 'px');
    node.style.setProperty('--jack-h', card.height + 'px');
    node.style.setProperty('--jack-r0', card.r0 + 'deg');
    node.style.setProperty('--jack-r1', card.r1 + 'deg');
    node.style.setProperty('--jack-r2', card.r2 + 'deg');
    node.style.setProperty('--jack-bg', card.bg);
    node.style.setProperty('--jack-ink', card.ink);

    var face = document.createElement('div');
    face.className = 'fetcher-jackigoe-card';

    var topCorner = document.createElement('span');
    topCorner.className = 'fetcher-jackigoe-corner';
    topCorner.innerHTML = '<span>' + card.rank + '</span><span class="suit">' + card.suit + '</span>';

    var bottomCorner = document.createElement('span');
    bottomCorner.className = 'fetcher-jackigoe-corner bottom';
    bottomCorner.innerHTML = '<span>' + card.rank + '</span><span class="suit">' + card.suit + '</span>';

    var center = document.createElement('span');
    center.className = 'fetcher-jackigoe-center' + (card.isJack ? '' : ' suit');
    center.textContent = card.isJack ? 'J' : card.suit;

    face.appendChild(topCorner);
    face.appendChild(center);
    face.appendChild(bottomCorner);

    if (card.isJack) {
      var signature = document.createElement('span');
      signature.className = 'fetcher-jackigoe-jack-signature';
      signature.textContent = 'jack';
      face.appendChild(signature);
    }

    node.appendChild(face);
    return node;
  }

  function syncRendered() {
    window.clearTimeout(renderTimer);
    renderTimer = null;
    if (!active() || reducedMotion()) {
      if (layer) layer.replaceChildren();
      return;
    }

    ensureStyles();
    var target = ensureLayer();
    if (!target) return;

    var shared = sharedState();
    pruneCards(shared);
    var live = {};
    shared.cards.forEach(function (card) {
      live[String(card.id)] = true;
      if (!target.querySelector('[data-jackigoe-card-id="' + card.id + '"]')) target.appendChild(renderCard(card));
    });
    Array.prototype.forEach.call(target.querySelectorAll('.fetcher-jackigoe-card-flight'), function (node) {
      if (!live[node.getAttribute('data-jackigoe-card-id')]) node.remove();
    });
    renderTimer = window.setTimeout(syncRendered, 220);
  }

  function stopRenderer() {
    window.clearTimeout(renderTimer);
    renderTimer = null;
    if (layer) layer.replaceChildren();
  }

  function startRenderer() {
    stopRenderer();
    if (!active() || reducedMotion()) return;
    ensureStyles();
    ensureLayer();
    syncMasterActivity();
    syncRendered();
  }

  document.addEventListener('fetcher:easter-change', function () {
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
    else stopRenderer();
  });

  document.addEventListener('fetcher:pref-change', function (event) {
    if (!event || !event.detail || event.detail.key !== 'fetcher.motion') return;
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
    else stopRenderer();
  });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      syncMasterActivity();
      if (active() && !reducedMotion()) {
        if (!renderTimer) startRenderer();
      } else {
        stopRenderer();
      }
    }).observe(root, { attributes:true, attributeFilter:['data-easter-palette','data-motion'] });
  }

  function init() {
    ensureStyles();
    syncMasterActivity();
    if (active() && !reducedMotion()) startRenderer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();