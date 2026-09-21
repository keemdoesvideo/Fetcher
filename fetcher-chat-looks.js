/* Researched chat Style Lab: visual look + layout + entry + stack motion.
   The four axes stay independent so one visual skin can be reused with many motions. */
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

  function row(label, items, kind) {
    return '<div class="chat-style-lab-row"><span class="chat-style-lab-label">' + label + '</span><div class="chat-style-lab-options" role="group" aria-label="' + label + '">' +
      items.map(function (item) { return pill(item, kind); }).join('') + '</div></div>';
  }

  var card = document.createElement('div');
  card.className = 'chat-card chat-look-card chat-style-lab-card';
  card.innerHTML = [
    '<div class="chat-look-head"><div><span class="chat-look-kicker">style lab</span><h2>looks</h2></div><p>skin × motion</p></div>',
    '<div class="chat-look-grid" role="group" aria-label="Chat visual look">',
      LOOKS.map(lookButton).join(''),
    '</div>',
    row('layout', LAYOUTS, 'layout'),
    row('entry', ENTRIES, 'entry'),
    row('stack motion', STACK_MOTIONS, 'stack')
  ].join('');

  var custom = side.querySelector('.chat-custom-card');
  side.insertBefore(card, custom || exportCard);

  var visualLook = 'classic';
  var layout = 'stack';
  var entry = 'rise';
  var stackMotion = 'smooth';
  var lookButtons = Array.prototype.slice.call(card.querySelectorAll('.chat-look-option'));
  var pills = Array.prototype.slice.call(card.querySelectorAll('.chat-style-pill'));
  var lastRects = new Map();
  var decorateFrame = 0;

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

  function clearPlacement(node) {
    if (!isMessage(node)) return;
    node.style.removeProperty('left');
    node.style.removeProperty('top');
    node.style.removeProperty('width');
    node.style.removeProperty('max-width');
    node.style.removeProperty('--cloud-scale');
    node.classList.remove('fetcher-no-emote');
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

  function captureRects() {
    lastRects.clear();
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), function (node) {
      if (node.offsetParent === null) return;
      var rect = node.getBoundingClientRect();
      lastRects.set(node, { left: rect.left, top: rect.top });
    });
  }

  function playStackMotion() {
    if (stackMotion === 'instant') {
      captureRects();
      return;
    }
    var nodes = Array.prototype.slice.call(stack.querySelectorAll('.chat-message'));
    var moves = [];
    nodes.forEach(function (node) {
      if (node.offsetParent === null) return;
      var before = lastRects.get(node);
      if (!before) return;
      var after = node.getBoundingClientRect();
      var dx = before.left - after.left;
      var dy = before.top - after.top;
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
      node.style.transition = 'none';
      node.style.setProperty('--fetcher-flip-x', dx.toFixed(2) + 'px');
      node.style.setProperty('--fetcher-flip-y', dy.toFixed(2) + 'px');
      moves.push(node);
    });
    if (!moves.length) {
      captureRects();
      return;
    }
    requestAnimationFrame(function () {
      moves.forEach(function (node) {
        node.style.removeProperty('transition');
        node.style.setProperty('--fetcher-flip-x', '0px');
        node.style.setProperty('--fetcher-flip-y', '0px');
      });
      window.setTimeout(captureRects, stackMotion === 'spring' ? 470 : 320);
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
    if (!options.skipMotion) requestAnimationFrame(playStackMotion);
    else requestAnimationFrame(captureRects);

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
      apply();
    });
  });

  pills.forEach(function (button) {
    button.addEventListener('click', function () {
      var kind = button.dataset.styleKind;
      var value = button.dataset.styleValue;
      if (kind === 'layout' && allowedLayouts.indexOf(value) !== -1) layout = value;
      if (kind === 'entry' && allowedEntries.indexOf(value) !== -1) entry = value;
      if (kind === 'stack' && allowedStackMotions.indexOf(value) !== -1) stackMotion = value;
      apply();
    });
  });

  new MutationObserver(function (mutations) {
    var changed = false;
    mutations.forEach(function (mutation) {
      if ((mutation.addedNodes && mutation.addedNodes.length) || (mutation.removedNodes && mutation.removedNodes.length)) changed = true;
    });
    if (changed) scheduleDecorateAndMotion();
  }).observe(stack, { childList: true });

  /* Keep export requests aware of all four style axes. The branch backend accepts
     them; older servers safely ignore the extra values. */
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
      apply();
    },
    setVisualLook: function (value) {
      if (allowedLooks.indexOf(value) !== -1) visualLook = value;
      apply();
    },
    setLayout: function (value) {
      if (allowedLayouts.indexOf(value) !== -1) layout = value;
      apply();
    },
    setEntry: function (value) {
      value = aliasEntry(String(value || ''));
      if (allowedEntries.indexOf(value) !== -1) entry = value;
      apply();
    },
    setStackMotion: function (value) {
      if (allowedStackMotions.indexOf(value) !== -1) stackMotion = value;
      apply();
    }
  };

  apply({ skipMotion: true });
})();
