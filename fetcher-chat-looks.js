/* Researched chat Style Lab: visual look + layout + entry + stack motion.
   Visual skin and motion stay independent; the Style Lab UI arranges them separately. */
(function () {
  'use strict';

  var side = document.querySelector('.chat-side');
  var stack = document.getElementById('chat-stack');
  var exportCard = document.querySelector('.chat-export-card');
  if (!side || !stack || !exportCard) return;

  var LOOKS = [
    ['classic', 'Classic', 'Fetcher original'],
    ['y2k', 'Y2K Bubble', 'hard-shadow cards'],
    ['editorial', 'Editorial', 'quiet + professional'],
    ['glass', 'Liquid Glass', 'frosted + luminous'],
    ['messenger', 'Messenger', 'social chat bubbles'],
    ['terminal', 'Terminal', 'green phosphor'],
    ['cyber', 'Cyber HUD', 'cut-corner neon'],
    ['scrapbook', 'Scrapbook', 'paper + tape'],
    ['win95', 'Windows 95', 'desktop nostalgia'],
    ['manga', 'Manga', 'ink + halftone']
  ];
  var LAYOUTS = [
    ['stack', 'stack'],
    ['top-down', 'top-down'],
    ['ticker', 'ticker'],
    ['float', 'float'],
    ['sticker', 'sticker'],
    ['spotlight', 'spotlight'],
    ['emote-cloud', 'emote cloud']
  ];
  var ENTRIES = [
    ['rise', 'rise'],
    ['fade', 'fade'],
    ['pop', 'pop'],
    ['spring', 'spring'],
    ['glide', 'glide'],
    ['type', 'type-on'],
    ['wipe', 'wipe'],
    ['glitch', 'glitch'],
    ['instant', 'instant']
  ];
  var STACK_MOTIONS = [
    ['smooth', 'smooth'],
    ['spring', 'spring'],
    ['instant', 'instant']
  ];

  function options(list) { return list.map(function (item) { return item[0]; }); }
  var allowedLooks = options(LOOKS);
  var allowedLayouts = options(LAYOUTS);
  var allowedEntries = options(ENTRIES);
  var allowedStackMotions = options(STACK_MOTIONS);

  function lookButton(item) {
    return '<button type="button" class="chat-look-option" data-look="' + item[0] + '" aria-pressed="false">' +
      '<span class="chat-look-mini"><i></i><i></i><i></i></span>' +
      '<span class="chat-look-name">' + item[1] + '</span>' +
      '<span class="chat-look-desc">' + item[2] + '</span></button>';
  }

  function pill(item, kind) {
    return '<button type="button" class="chat-style-pill" data-style-kind="' + kind + '" data-style-value="' + item[0] + '" aria-pressed="false">' + item[1] + '</button>';
  }

  function row(label, items, kind, note) {
    return '<div class="chat-style-lab-row" data-motion-row="' + kind + '">' +
      '<div class="chat-style-lab-row-head"><span class="chat-style-lab-label">' + label + '</span>' +
      (note ? '<span class="chat-style-lab-note">' + note + '</span>' : '') + '</div>' +
      '<div class="chat-style-lab-options" role="group" aria-label="' + label + '">' +
      items.map(function (item) { return pill(item, kind); }).join('') + '</div></div>';
  }

  var firstPage = LOOKS.slice(0, 6);
  var secondPage = LOOKS.slice(6);

  var card = document.createElement('div');
  card.className = 'chat-card chat-look-card chat-style-lab-card';
  card.innerHTML = [
    '<div class="chat-look-head"><div><span class="chat-look-kicker">style lab</span><h2>looks</h2></div><p>drag to explore</p></div>',
    '<div class="chat-look-carousel">',
      '<div class="chat-look-viewport" tabindex="0" aria-label="Chat visual looks. Drag horizontally for more.">',
        '<div class="chat-look-track">',
          '<div class="chat-look-page" data-look-page="0">' + firstPage.map(lookButton).join('') + '</div>',
          '<div class="chat-look-page chat-look-page-secondary" data-look-page="1">' + secondPage.map(lookButton).join('') + '</div>',
        '</div>',
      '</div>',
      '<div class="chat-look-carousel-foot">',
        '<span class="chat-look-drag-hint">drag cards sideways</span>',
        '<div class="chat-look-dots" aria-label="Look pages"><button type="button" class="chat-look-dot active" data-look-page-jump="0" aria-label="Looks page 1"></button><button type="button" class="chat-look-dot" data-look-page-jump="1" aria-label="Looks page 2"></button></div>',
      '</div>',
    '</div>'
  ].join('');

  var motionCard = document.createElement('div');
  motionCard.className = 'chat-card chat-motion-card';
  motionCard.innerHTML = [
    '<div class="chat-motion-head"><div><span class="chat-look-kicker">movement</span><h2>motion</h2></div><p>independent from the look</p></div>',
    row('layout', LAYOUTS, 'layout', 'where messages live'),
    row('entry', ENTRIES, 'entry', 'how a new message arrives'),
    row('stack motion', STACK_MOTIONS, 'stack', 'how existing messages make room')
  ].join('');

  var custom = side.querySelector('.chat-custom-card');
  side.insertBefore(card, custom || exportCard);
  side.insertBefore(motionCard, custom || exportCard);

  var visualLook = 'classic';
  var layout = 'stack';
  var entry = 'rise';
  /* Instant is the safe baseline. Smooth/spring are optional and now use a
     target-position FLIP that never measures a message mid-transition. */
  var stackMotion = 'instant';
  var lookButtons = Array.prototype.slice.call(card.querySelectorAll('.chat-look-option'));
  var pills = Array.prototype.slice.call(motionCard.querySelectorAll('.chat-style-pill'));
  var lastRects = new Map();
  var decorateFrame = 0;
  var lookPage = 0;

  function hash(text) {
    text = String(text || 'message');
    var value = 2166136261;
    for (var i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function isMessage(node) {
    return !!node && node.nodeType === 1 && node.classList.contains('chat-message');
  }

  function stopAnimation(node, key) {
    var animation = node && node[key];
    if (animation && typeof animation.cancel === 'function') {
      try { animation.cancel(); } catch (e) {}
    }
    if (node) node[key] = null;
  }

  function stopFloat(node) {
    stopAnimation(node, '_fetcherFloatAnimation');
  }

  function stopStack(node) {
    stopAnimation(node, '_fetcherStackAnimation');
  }

  function clearPlacement(node) {
    if (!isMessage(node)) return;
    if (layout !== 'float') stopFloat(node);
    node.style.removeProperty('left');
    node.style.removeProperty('top');
    node.style.removeProperty('width');
    node.style.removeProperty('max-width');
    node.style.removeProperty('--cloud-scale');
    node.classList.remove('fetcher-no-emote');
  }

  function ensureFloatAnimation(node, seed) {
    if (!node || typeof node.animate !== 'function' || node._fetcherFloatAnimation) return;
    var dx = -18 + ((seed >>> 16) & 255) / 255 * 36;
    var dy = -13 + ((seed >>> 24) & 255) / 255 * 26;
    var duration = 5200 + (seed & 1023) * 3.2;
    try {
      var animation = node.animate([
        { translate: '0px 0px' },
        { translate: dx.toFixed(1) + 'px ' + dy.toFixed(1) + 'px' },
        { translate: '0px 0px' }
      ], {
        duration: duration,
        iterations: Infinity,
        easing: 'ease-in-out'
      });
      try { animation.currentTime = seed % Math.max(1, Math.round(duration)); } catch (e) {}
      node._fetcherFloatAnimation = animation;
    } catch (e) {}
  }

  function decorateMessage(node) {
    if (!isMessage(node)) return;
    clearPlacement(node);
    var seed = hash(node.dataset.chatId || node.textContent || 'message');
    var rotation = -2.6 + (seed & 255) / 255 * 5.2;
    node.style.setProperty('--sticker-rot', rotation.toFixed(2) + 'deg');

    if (layout === 'float') {
      var fx = 6 + (seed & 255) / 255 * 46;
      var fy = 10 + ((seed >>> 8) & 255) / 255 * 68;
      node.style.left = fx.toFixed(2) + '%';
      node.style.top = fy.toFixed(2) + '%';
      ensureFloatAnimation(node, seed);
    }

    if (layout === 'emote-cloud') {
      var emotes = node.querySelectorAll('.chat-emote');
      node.classList.toggle('fetcher-no-emote', !emotes.length);
      var x = 8 + (seed & 255) / 255 * 76;
      var y = 12 + ((seed >>> 8) & 255) / 255 * 62;
      var scale = .86 + ((seed >>> 16) & 255) / 255 * .5;
      node.style.left = x.toFixed(2) + '%';
      node.style.top = y.toFixed(2) + '%';
      node.style.setProperty('--cloud-scale', scale.toFixed(3));
    }
  }

  function decorateAll() {
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), decorateMessage);
  }

  function visibleNodes() {
    return Array.prototype.slice.call(stack.querySelectorAll('.chat-message')).filter(function (node) {
      return node.offsetParent !== null;
    });
  }

  function captureRects(nodes) {
    nodes = nodes || visibleNodes();
    lastRects.clear();
    nodes.forEach(function (node) {
      var rect = node.getBoundingClientRect();
      lastRects.set(node, { left: rect.left, top: rect.top });
    });
  }

  function supportsStackMotion() {
    return layout === 'stack' || layout === 'top-down' || layout === 'sticker';
  }

  function settleStackAnimations(nodes) {
    nodes.forEach(function (node) { stopStack(node); });
  }

  function playStackMotion() {
    var nodes = visibleNodes();
    settleStackAnimations(nodes);

    /* Float owns the individual translate property, and the non-stack layouts do
       not have a meaningful shared reflow. */
    if (stackMotion === 'instant' || !supportsStackMotion() || typeof Element === 'undefined') {
      captureRects(nodes);
      return;
    }

    /* Cancelling old animations first returns every message to its true target
       position. We then compare previous TARGET positions with new TARGET
       positions, never with a half-animated frame. This prevents the old stuck /
       speed-up behaviour when messages arrive rapidly. */
    void stack.offsetHeight;
    var nextRects = new Map();
    var moves = [];

    nodes.forEach(function (node) {
      var after = node.getBoundingClientRect();
      nextRects.set(node, { left: after.left, top: after.top });
      var before = lastRects.get(node);
      if (!before) return;
      var dx = before.left - after.left;
      var dy = before.top - after.top;
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
      moves.push({ node: node, dx: dx, dy: dy });
    });

    lastRects = nextRects;
    if (!moves.length) return;

    var duration = stackMotion === 'spring' ? 430 : 280;
    var easing = stackMotion === 'spring' ? 'cubic-bezier(.16,1.18,.28,1)' : 'cubic-bezier(.2,.82,.22,1)';
    moves.forEach(function (move) {
      if (typeof move.node.animate !== 'function') return;
      try {
        var animation = move.node.animate([
          { translate: move.dx.toFixed(2) + 'px ' + move.dy.toFixed(2) + 'px' },
          { translate: '0px 0px' }
        ], {
          duration: duration,
          easing: easing,
          fill: 'none'
        });
        move.node._fetcherStackAnimation = animation;
        animation.onfinish = function () {
          if (move.node._fetcherStackAnimation === animation) move.node._fetcherStackAnimation = null;
        };
        animation.oncancel = function () {
          if (move.node._fetcherStackAnimation === animation) move.node._fetcherStackAnimation = null;
        };
      } catch (e) {}
    });
  }

  function scheduleDecorateAndMotion() {
    if (decorateFrame) return;
    decorateFrame = requestAnimationFrame(function () {
      decorateFrame = 0;
      decorateAll();
      playStackMotion();
    });
  }

  function pressed(button, active) {
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function apply(options) {
    options = options || {};
    stack.dataset.chatLook = visualLook;
    stack.dataset.chatLayout = layout;
    stack.dataset.entryAnimation = entry;
    stack.dataset.stackMotion = stackMotion;

    lookButtons.forEach(function (button) { pressed(button, button.dataset.look === visualLook); });
    pills.forEach(function (button) {
      var kind = button.dataset.styleKind;
      var value = button.dataset.styleValue;
      var active = (kind === 'layout' && value === layout) ||
        (kind === 'entry' && value === entry) ||
        (kind === 'stack' && value === stackMotion);
      pressed(button, active);
    });

    decorateAll();
    if (options.skipMotion || stackMotion === 'instant' || !supportsStackMotion()) {
      requestAnimationFrame(function () { captureRects(); });
    } else {
      requestAnimationFrame(playStackMotion);
    }

    window.dispatchEvent(new CustomEvent('fetcher:chat-look', {
      detail: {
        look: visualLook,
        visualLook: visualLook,
        layout: layout,
        entry: entry,
        stackMotion: stackMotion
      }
    }));
  }

  lookButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      visualLook = allowedLooks.indexOf(button.dataset.look) !== -1 ? button.dataset.look : 'classic';
      apply({ skipMotion: true });
    });
  });

  pills.forEach(function (button) {
    button.addEventListener('click', function () {
      var kind = button.dataset.styleKind;
      var value = button.dataset.styleValue;
      if (kind === 'layout' && allowedLayouts.indexOf(value) !== -1) layout = value;
      if (kind === 'entry' && allowedEntries.indexOf(value) !== -1) entry = value;
      if (kind === 'stack' && allowedStackMotions.indexOf(value) !== -1) stackMotion = value;
      apply({ skipMotion: kind === 'stack' || kind === 'layout' });
    });
  });

  new MutationObserver(function (mutations) {
    var changed = false;
    mutations.forEach(function (mutation) {
      if ((mutation.addedNodes && mutation.addedNodes.length) || (mutation.removedNodes && mutation.removedNodes.length)) changed = true;
    });
    if (changed) scheduleDecorateAndMotion();
  }).observe(stack, { childList: true });

  /* Two-page, six-at-a-time look carousel. Pointer dragging works directly on
     cards; a horizontal drag suppresses the card click and springs to the next
     page. */
  var viewport = card.querySelector('.chat-look-viewport');
  var track = card.querySelector('.chat-look-track');
  var dots = Array.prototype.slice.call(card.querySelectorAll('.chat-look-dot'));
  var drag = null;
  var suppressClick = false;

  function updateCarousel(animate) {
    if (!viewport || !track) return;
    var width = viewport.clientWidth || 1;
    track.style.transition = animate ? 'transform 480ms cubic-bezier(.16,1.12,.28,1)' : 'none';
    track.style.transform = 'translate3d(' + (-lookPage * width) + 'px,0,0)';
    dots.forEach(function (dot) {
      dot.classList.toggle('active', Number(dot.dataset.lookPageJump) === lookPage);
    });
  }

  if (viewport && track) {
    viewport.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      var width = viewport.clientWidth || 1;
      drag = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, started: performance.now(), width: width };
      track.style.transition = 'none';
      try { viewport.setPointerCapture(event.pointerId); } catch (e) {}
      viewport.classList.add('dragging');
    });

    viewport.addEventListener('pointermove', function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      drag.lastX = event.clientX;
      var dx = event.clientX - drag.startX;
      var edgeResistance = (lookPage === 0 && dx > 0) || (lookPage === 1 && dx < 0) ? .22 : 1;
      var x = -lookPage * drag.width + dx * edgeResistance;
      track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
      if (Math.abs(dx) > 7) suppressClick = true;
    });

    function finishDrag(event) {
      if (!drag || (event && event.pointerId !== undefined && event.pointerId !== drag.id)) return;
      var dx = drag.lastX - drag.startX;
      var elapsed = Math.max(1, performance.now() - drag.started);
      var velocity = dx / elapsed;
      var threshold = Math.min(90, drag.width * .14);
      if ((dx < -threshold || velocity < -.55) && lookPage < 1) lookPage += 1;
      else if ((dx > threshold || velocity > .55) && lookPage > 0) lookPage -= 1;
      drag = null;
      viewport.classList.remove('dragging');
      updateCarousel(true);
      window.setTimeout(function () { suppressClick = false; }, 80);
    }

    viewport.addEventListener('pointerup', finishDrag);
    viewport.addEventListener('pointercancel', finishDrag);
    viewport.addEventListener('click', function (event) {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    viewport.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' && lookPage < 1) {
        lookPage += 1;
        updateCarousel(true);
        event.preventDefault();
      } else if (event.key === 'ArrowLeft' && lookPage > 0) {
        lookPage -= 1;
        updateCarousel(true);
        event.preventDefault();
      }
    });
    window.addEventListener('resize', function () { updateCarousel(false); });
    requestAnimationFrame(function () { updateCarousel(false); });
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      lookPage = Math.max(0, Math.min(1, Number(dot.dataset.lookPageJump) || 0));
      updateCarousel(true);
    });
  });

  /* Keep export requests aware of all four style axes. */
  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.visualLook = visualLook;
        body.chatLayout = layout;
        body.entryAnimation = entry;
        body.stackMotion = stackMotion;
        /* Compatibility with the existing renderer while the branch evolves. */
        body.chatLook = layout === 'ticker' ? 'ticker' :
          layout === 'sticker' ? 'staggered' :
          layout === 'spotlight' ? 'spotlight' :
          layout === 'emote-cloud' ? 'emote-cloud' : 'bubble';
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nextFetch.call(window, resource, init);
  };

  function aliasLook(value) {
    var aliases = {
      bubble: 'classic',
      'fade-stack': 'classic',
      ticker: 'classic',
      staggered: 'classic',
      spotlight: 'classic',
      'emote-cloud': 'classic'
    };
    return aliases[value] || value;
  }

  function aliasEntry(value) {
    var aliases = { slide: 'rise', float: 'rise' };
    return aliases[value] || value;
  }

  window.FetcherChatLooks = {
    getLook: function () { return visualLook; },
    getVisualLook: function () { return visualLook; },
    getLayout: function () { return layout; },
    getEntry: function () { return entry; },
    getStackMotion: function () { return stackMotion; },
    setLook: function (value) {
      value = aliasLook(String(value || ''));
      if (allowedLooks.indexOf(value) !== -1) visualLook = value;
      apply({ skipMotion: true });
    },
    setVisualLook: function (value) {
      if (allowedLooks.indexOf(value) !== -1) visualLook = value;
      apply({ skipMotion: true });
    },
    setLayout: function (value) {
      if (allowedLayouts.indexOf(value) !== -1) layout = value;
      apply({ skipMotion: true });
    },
    setEntry: function (value) {
      value = aliasEntry(String(value || ''));
      if (allowedEntries.indexOf(value) !== -1) entry = value;
      apply({ skipMotion: true });
    },
    setStackMotion: function (value) {
      if (allowedStackMotions.indexOf(value) !== -1) stackMotion = value;
      apply({ skipMotion: true });
    }
  };

  apply({ skipMotion: true });
})();