/* Selectable chat looks + entry animations. Preview and export share the choice. */
(function () {
  'use strict';

  var side = document.querySelector('.chat-side');
  var stack = document.getElementById('chat-stack');
  var exportCard = document.querySelector('.chat-export-card');
  if (!side || !stack || !exportCard) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-look-card{padding:16px}',
    '.chat-look-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}',
    '.chat-look-kicker{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);font-weight:800;margin-bottom:3px}',
    '.chat-look-head h2{margin:0;font-size:15px;letter-spacing:-.02em}',
    '.chat-look-head p{margin:0;font-size:9.5px;color:var(--ink-faint)}',
    '.chat-look-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
    '.chat-look-option{position:relative;min-width:0;border:1px solid var(--border);background:var(--bg);color:var(--ink-soft);border-radius:12px;padding:8px;text-align:left;cursor:pointer;font:inherit;transition:transform .16s var(--ease),border-color .16s var(--ease),background .16s var(--ease),box-shadow .16s var(--ease)}',
    '.chat-look-option:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 45%,var(--border))}',
    '.chat-look-option[aria-pressed="true"]{border-color:color-mix(in srgb,var(--accent) 62%,var(--border));background:color-mix(in srgb,var(--accent) 8%,var(--surface));box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 8%,transparent)}',
    '.chat-look-mini{height:44px;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 82%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--ink) 5%,transparent),transparent);margin-bottom:7px;position:relative;overflow:hidden}',
    '.chat-look-mini i{position:absolute;display:block;border-radius:4px;background:color-mix(in srgb,var(--accent) 38%,var(--ink));opacity:.82;box-shadow:0 2px 6px color-mix(in srgb,var(--ink) 10%,transparent)}',
    '.chat-look-option[data-look="bubble"] .chat-look-mini i:nth-child(1){width:58%;height:8px;left:8px;bottom:7px}',
    '.chat-look-option[data-look="bubble"] .chat-look-mini i:nth-child(2){width:48%;height:8px;left:8px;bottom:18px;opacity:.7}',
    '.chat-look-option[data-look="bubble"] .chat-look-mini i:nth-child(3){width:38%;height:8px;left:8px;bottom:29px;opacity:.55}',
    '.chat-look-option[data-look="fade-stack"] .chat-look-mini i{width:55%;height:8px;left:8px}.chat-look-option[data-look="fade-stack"] .chat-look-mini i:nth-child(1){bottom:7px;opacity:.9}.chat-look-option[data-look="fade-stack"] .chat-look-mini i:nth-child(2){bottom:18px;opacity:.5}.chat-look-option[data-look="fade-stack"] .chat-look-mini i:nth-child(3){bottom:29px;opacity:.22}',
    '.chat-look-option[data-look="ticker"] .chat-look-mini i:nth-child(1){width:78%;height:9px;left:11%;bottom:8px}.chat-look-option[data-look="ticker"] .chat-look-mini i:nth-child(n+2){display:none}',
    '.chat-look-option[data-look="staggered"] .chat-look-mini i{width:48%;height:8px}.chat-look-option[data-look="staggered"] .chat-look-mini i:nth-child(1){left:8px;bottom:7px}.chat-look-option[data-look="staggered"] .chat-look-mini i:nth-child(2){left:18px;bottom:18px;opacity:.68}.chat-look-option[data-look="staggered"] .chat-look-mini i:nth-child(3){left:28px;bottom:29px;opacity:.5}',
    '.chat-look-option[data-look="spotlight"] .chat-look-mini i:nth-child(1){width:62%;height:14px;left:19%;top:15px;border-radius:6px}.chat-look-option[data-look="spotlight"] .chat-look-mini i:nth-child(n+2){display:none}',
    '.chat-look-option[data-look="emote-cloud"] .chat-look-mini i{width:9px!important;height:9px!important;border-radius:50%;bottom:auto}.chat-look-option[data-look="emote-cloud"] .chat-look-mini i:nth-child(1){left:18%;top:24px}.chat-look-option[data-look="emote-cloud"] .chat-look-mini i:nth-child(2){left:52%;top:8px;transform:scale(1.35)}.chat-look-option[data-look="emote-cloud"] .chat-look-mini i:nth-child(3){left:74%;top:26px;opacity:.58}',
    '.chat-look-name{display:block;font-size:9.8px;font-weight:850;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-look-desc{display:block;font-size:8.6px;color:var(--ink-faint);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-entry-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}',
    '.chat-entry-label{font-size:9px;text-transform:uppercase;letter-spacing:.07em;font-weight:850;color:var(--ink-faint);margin-right:3px}',
    '.chat-entry-option{border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);border-radius:999px;padding:6px 9px;font:inherit;font-size:9.5px;font-weight:800;cursor:pointer}',
    '.chat-entry-option[aria-pressed="true"]{border-color:color-mix(in srgb,var(--accent) 55%,var(--border));background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent-ink)}',

    '#chat-stack[data-chat-look="fade-stack"] .chat-message:nth-last-child(n+4){opacity:.5}',
    '#chat-stack[data-chat-look="fade-stack"] .chat-message:nth-last-child(3){opacity:.68}',
    '#chat-stack[data-chat-look="fade-stack"] .chat-message:nth-last-child(2){opacity:.84}',
    '#chat-stack[data-chat-look="ticker"]{left:5%;width:90%;bottom:6%}',
    '#chat-stack[data-chat-look="ticker"] .chat-message{width:100%!important;max-width:100%!important}',
    '#chat-stack[data-chat-look="ticker"] .chat-message:not(:last-child){display:none!important}',
    '#chat-stack[data-chat-look="staggered"] .chat-message:nth-last-child(3n+2){margin-left:14px}',
    '#chat-stack[data-chat-look="staggered"] .chat-message:nth-last-child(3n+1){margin-left:28px}',
    '#chat-stack[data-chat-look="spotlight"]{inset:0!important;width:100%!important;display:block!important}',
    '#chat-stack[data-chat-look="spotlight"] .chat-message{position:absolute!important;left:50%;top:62%;transform:translate(-50%,-50%);width:min(66%,620px)!important;max-width:min(66%,620px)!important}',
    '#chat-stack[data-chat-look="spotlight"] .chat-message:not(:last-child){display:none!important}',
    '#chat-stack[data-chat-look="emote-cloud"]{inset:0!important;width:100%!important;display:block!important}',
    '#chat-stack[data-chat-look="emote-cloud"] .chat-message{position:absolute!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;padding:0!important;width:auto!important;max-width:none!important;scale:var(--cloud-scale,1)}',
    '#chat-stack[data-chat-look="emote-cloud"] .chat-name-row{display:none!important}',
    '#chat-stack[data-chat-look="emote-cloud"] .chat-body{font-size:0!important;white-space:nowrap}',
    '#chat-stack[data-chat-look="emote-cloud"] .chat-emote{height:3.1rem;margin:0 2px}',
    '#chat-stack[data-chat-look="emote-cloud"] .chat-message.fetcher-no-emote{display:none!important}',

    '#chat-stack[data-entry-animation="slide"] .chat-message{animation:fetcher-chat-slide .24s cubic-bezier(.2,.9,.25,1.2) both}',
    '#chat-stack[data-entry-animation="fade"] .chat-message{animation:fetcher-chat-fade .26s ease both}',
    '#chat-stack[data-entry-animation="pop"] .chat-message{animation:fetcher-chat-pop .28s cubic-bezier(.18,.95,.22,1.3) both}',
    '#chat-stack[data-entry-animation="float"] .chat-message{animation:fetcher-chat-float .32s cubic-bezier(.2,.9,.25,1) both}',
    '#chat-stack[data-entry-animation="instant"] .chat-message{animation:none}',
    '@keyframes fetcher-chat-slide{from{opacity:0;transform:translateY(8px) scale(.975)}to{opacity:1;transform:none}}',
    '@keyframes fetcher-chat-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes fetcher-chat-pop{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:none}}',
    '@keyframes fetcher-chat-float{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}',
    '@media(max-width:820px){.chat-look-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  ].join('\n');
  document.head.appendChild(css);

  function lookButton(value, name, desc) {
    return '<button type="button" class="chat-look-option" data-look="' + value + '" aria-pressed="false"><span class="chat-look-mini"><i></i><i></i><i></i></span><span class="chat-look-name">' + name + '</span><span class="chat-look-desc">' + desc + '</span></button>';
  }

  function entryButton(value, name) {
    return '<button type="button" class="chat-entry-option" data-entry="' + value + '" aria-pressed="false">' + name + '</button>';
  }

  var card = document.createElement('div');
  card.className = 'chat-card chat-look-card';
  card.innerHTML = [
    '<div class="chat-look-head"><div><span class="chat-look-kicker">overlay personality</span><h2>looks</h2></div><p>preview + export</p></div>',
    '<div class="chat-look-grid" role="group" aria-label="Chat look">',
      lookButton('bubble', 'Bubble cards', 'clean card stack'),
      lookButton('fade-stack', 'Fade stack', 'older chat recedes'),
      lookButton('ticker', 'Ticker', 'latest line only'),
      lookButton('staggered', 'Staggered', 'layered offset stack'),
      lookButton('spotlight', 'Spotlight', 'single centred message'),
      lookButton('emote-cloud', 'Emote cloud', 'floating emotes only'),
    '</div>',
    '<div class="chat-entry-row" role="group" aria-label="Entry animation">',
      '<span class="chat-entry-label">entry animation</span>',
      entryButton('slide', 'slide up'),
      entryButton('fade', 'fade'),
      entryButton('pop', 'pop'),
      entryButton('float', 'float'),
      entryButton('instant', 'instant'),
    '</div>'
  ].join('');

  var custom = side.querySelector('.chat-custom-card');
  side.insertBefore(card, custom || exportCard);

  var look = 'bubble';
  var entry = 'slide';
  var allowedLooks = ['bubble', 'fade-stack', 'ticker', 'staggered', 'spotlight', 'emote-cloud'];
  var allowedEntries = ['slide', 'fade', 'pop', 'float', 'instant'];
  var lookButtons = Array.prototype.slice.call(card.querySelectorAll('.chat-look-option'));
  var entryButtons = Array.prototype.slice.call(card.querySelectorAll('.chat-entry-option'));

  function hash(text) {
    text = String(text || 'message');
    var value = 2166136261;
    for (var i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function decorateCloud(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var emotes = node.querySelectorAll('.chat-emote');
    node.classList.toggle('fetcher-no-emote', !emotes.length);
    var seed = hash(node.dataset.chatId || node.textContent || 'message');
    var x = 8 + (seed & 255) / 255 * 76;
    var y = 12 + ((seed >>> 8) & 255) / 255 * 62;
    var scale = .86 + ((seed >>> 16) & 255) / 255 * .5;
    node.style.left = x.toFixed(2) + '%';
    node.style.top = y.toFixed(2) + '%';
    node.style.setProperty('--cloud-scale', scale.toFixed(3));
  }

  function clearCloudPlacement(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    if (look === 'emote-cloud') return;
    node.style.removeProperty('left');
    node.style.removeProperty('top');
    node.style.removeProperty('--cloud-scale');
    node.classList.remove('fetcher-no-emote');
  }

  function decorateAll() {
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), function (node) {
      if (look === 'emote-cloud') decorateCloud(node);
      else clearCloudPlacement(node);
    });
  }

  function apply() {
    stack.dataset.chatLook = look;
    stack.dataset.entryAnimation = entry;
    lookButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.look === look ? 'true' : 'false');
    });
    entryButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.entry === entry ? 'true' : 'false');
    });
    decorateAll();
    window.dispatchEvent(new CustomEvent('fetcher:chat-look', { detail: { look: look, entry: entry } }));
  }

  lookButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      look = allowedLooks.indexOf(button.dataset.look) !== -1 ? button.dataset.look : 'bubble';
      apply();
    });
  });

  entryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      entry = allowedEntries.indexOf(button.dataset.entry) !== -1 ? button.dataset.entry : 'slide';
      apply();
    });
  });

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
        if (look === 'emote-cloud') decorateCloud(node);
      });
    });
  }).observe(stack, { childList: true });

  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.chatLook = look;
        body.entryAnimation = entry;
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nextFetch.call(window, resource, init);
  };

  window.FetcherChatLooks = {
    getLook: function () { return look; },
    getEntry: function () { return entry; },
    setLook: function (value) {
      if (allowedLooks.indexOf(value) !== -1) look = value;
      apply();
    },
    setEntry: function (value) {
      if (allowedEntries.indexOf(value) !== -1) entry = value;
      apply();
    }
  };

  apply();
})();