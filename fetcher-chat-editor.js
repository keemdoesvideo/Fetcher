/* Per-message Twitch chat editor: hide, highlight, or isolate a comment. */
(function () {
  'use strict';

  var side = document.querySelector('.chat-side');
  var stack = document.getElementById('chat-stack');
  var loadBtn = document.getElementById('chat-load');
  if (!side || !stack || !loadBtn) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-editor-card{padding:16px}',
    '.chat-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}',
    '.chat-editor-kicker{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);font-weight:800;margin-bottom:3px}',
    '.chat-editor-head h2{font-size:15px;letter-spacing:-.02em;margin:0}',
    '.chat-editor-reset{border:0;background:none;color:var(--ink-faint);font:inherit;font-size:9.5px;font-weight:800;text-decoration:underline;text-underline-offset:2px;cursor:pointer;padding:2px 0}',
    '.chat-editor-reset:hover{color:var(--ink)}',
    '.chat-editor-empty{font-size:10.5px;line-height:1.5;color:var(--ink-faint);padding:9px 10px;border:1px dashed var(--border-strong);border-radius:11px;background:var(--bg)}',
    '.chat-editor-selected{display:grid;gap:8px}',
    '.chat-editor-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.chat-editor-user{font-size:11.5px;font-weight:850;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.chat-editor-time{font-size:9.5px;font-weight:800;color:#7a45db;font-variant-numeric:tabular-nums}',
    '.chat-editor-copy{font-size:10.5px;line-height:1.45;color:var(--ink-soft);padding:9px 10px;border-radius:10px;background:var(--bg);border:1px solid var(--border);max-height:76px;overflow:auto}',
    '.chat-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.chat-editor-action{border:1px solid var(--border-strong);background:var(--bg);color:var(--ink-soft);font:inherit;font-size:9.8px;font-weight:850;padding:8px 7px;border-radius:9px;cursor:pointer}',
    '.chat-editor-action:hover{border-color:color-mix(in srgb,#9146ff 45%,var(--border));color:var(--ink)}',
    '.chat-editor-action.active{background:color-mix(in srgb,#9146ff 11%,var(--surface));border-color:color-mix(in srgb,#9146ff 42%,var(--border));color:#7a45db}',
    '.chat-editor-summary{font-size:9.5px;line-height:1.4;color:var(--ink-faint);margin-top:9px}',
    '.chat-stack .chat-message[data-chat-id]{pointer-events:auto;cursor:pointer}',
    '.chat-message.fetcher-selected{outline:2px solid rgba(255,255,255,.82);outline-offset:2px}',
    '.chat-message.fetcher-highlighted{border-color:rgba(190,143,255,.88)!important;box-shadow:0 8px 24px rgba(0,0,0,.18),0 0 0 2px rgba(145,70,255,.24),0 0 22px rgba(145,70,255,.25)!important}',
    '.chat-message.fetcher-highlighted::before{content:"★";float:right;margin-left:8px;color:#c9a8ff;font-size:10px;line-height:1.35}',
    '@media(max-width:680px){.chat-editor-actions{grid-template-columns:1fr}}'
  ].join('\n');
  document.head.appendChild(css);

  var card = document.createElement('div');
  card.className = 'chat-card chat-editor-card';
  card.innerHTML = [
    '<div class="chat-editor-head"><div><span class="chat-editor-kicker">clean the clip</span><h2>message editor</h2></div><button class="chat-editor-reset" id="chat-editor-reset" type="button">clear edits</button></div>',
    '<div class="chat-editor-empty" id="chat-editor-empty">Play the preview, then click any chat bubble to hide it, highlight it, or keep only that message.</div>',
    '<div class="chat-editor-selected" id="chat-editor-selected" hidden>',
      '<div class="chat-editor-meta"><span class="chat-editor-user" id="chat-editor-user"></span><span class="chat-editor-time" id="chat-editor-time"></span></div>',
      '<div class="chat-editor-copy" id="chat-editor-copy"></div>',
      '<div class="chat-editor-actions">',
        '<button class="chat-editor-action" id="chat-editor-hide" type="button">hide message</button>',
        '<button class="chat-editor-action" id="chat-editor-highlight" type="button">highlight</button>',
        '<button class="chat-editor-action" id="chat-editor-only" type="button">only this message</button>',
        '<button class="chat-editor-action" id="chat-editor-seek" type="button">jump to message</button>',
      '</div>',
    '</div>',
    '<div class="chat-editor-summary" id="chat-editor-summary">0 hidden · 0 highlighted</div>'
  ].join('');

  var insights = side.querySelector('.chat-insights-card');
  var styleCard = side.querySelector('.chat-custom-card');
  side.insertBefore(card, styleCard || (insights && insights.nextSibling) || side.firstChild);

  var empty = document.getElementById('chat-editor-empty');
  var selected = document.getElementById('chat-editor-selected');
  var userEl = document.getElementById('chat-editor-user');
  var timeEl = document.getElementById('chat-editor-time');
  var copyEl = document.getElementById('chat-editor-copy');
  var hideBtn = document.getElementById('chat-editor-hide');
  var highlightBtn = document.getElementById('chat-editor-highlight');
  var onlyBtn = document.getElementById('chat-editor-only');
  var seekBtn = document.getElementById('chat-editor-seek');
  var resetBtn = document.getElementById('chat-editor-reset');
  var summary = document.getElementById('chat-editor-summary');

  var hiddenIds = new Set();
  var highlightedIds = new Set();
  var onlyId = '';
  var selectedId = '';
  var selectionKey = '';
  var knownMessages = new Map();

  function fmt(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }

  function captureKey(body) {
    if (!body) return '';
    return [body.vodId || '', Number(body.start || 0).toFixed(3), Number(body.end || 0).toFixed(3)].join('|');
  }

  function updateSummary() {
    var bits = [hiddenIds.size + ' hidden', highlightedIds.size + ' highlighted'];
    if (onlyId) bits.push('solo message on');
    summary.textContent = bits.join(' · ');
  }

  function currentMessage() {
    return selectedId ? knownMessages.get(selectedId) : null;
  }

  function syncButtons() {
    var message = currentMessage();
    empty.hidden = !!message;
    selected.hidden = !message;
    if (!message) {
      updateSummary();
      return;
    }
    var id = String(message.id || '');
    var user = message.user || {};
    userEl.textContent = user.displayName || user.login || 'viewer';
    timeEl.textContent = fmt(message.offset || message.at || 0);
    copyEl.textContent = message.text || '(emote-only message)';

    var hidden = hiddenIds.has(id);
    var highlighted = highlightedIds.has(id);
    var solo = onlyId === id;
    hideBtn.textContent = hidden ? 'show message' : 'hide message';
    hideBtn.classList.toggle('active', hidden);
    highlightBtn.textContent = highlighted ? 'remove highlight' : 'highlight';
    highlightBtn.classList.toggle('active', highlighted);
    onlyBtn.textContent = solo ? 'show all messages' : 'only this message';
    onlyBtn.classList.toggle('active', solo);
    updateSummary();
  }

  function decorate(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var id = String(node.dataset.chatId || '');
    if (!id) return;
    node.classList.toggle('fetcher-highlighted', highlightedIds.has(id));
    node.classList.toggle('fetcher-selected', selectedId === id);
  }

  function decorateAll() {
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), decorate);
  }

  function select(id) {
    selectedId = String(id || '');
    decorateAll();
    syncButtons();
  }

  function reloadPreview() {
    if (!loadBtn.disabled) loadBtn.click();
  }

  stack.addEventListener('click', function (event) {
    var bubble = event.target.closest && event.target.closest('.chat-message[data-chat-id]');
    if (!bubble || !stack.contains(bubble)) return;
    event.preventDefault();
    event.stopPropagation();
    select(bubble.dataset.chatId);
  });

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], decorate);
    });
  }).observe(stack, { childList: true });

  hideBtn.addEventListener('click', function () {
    var message = currentMessage();
    if (!message) return;
    var id = String(message.id || '');
    if (!id) return;
    if (hiddenIds.has(id)) hiddenIds.delete(id);
    else {
      hiddenIds.add(id);
      if (onlyId === id) onlyId = '';
    }
    syncButtons();
    reloadPreview();
  });

  highlightBtn.addEventListener('click', function () {
    var message = currentMessage();
    if (!message) return;
    var id = String(message.id || '');
    if (!id) return;
    if (highlightedIds.has(id)) highlightedIds.delete(id);
    else highlightedIds.add(id);
    decorateAll();
    syncButtons();
  });

  onlyBtn.addEventListener('click', function () {
    var message = currentMessage();
    if (!message) return;
    var id = String(message.id || '');
    if (!id) return;
    if (onlyId === id) onlyId = '';
    else {
      onlyId = id;
      hiddenIds.delete(id);
    }
    syncButtons();
    reloadPreview();
  });

  seekBtn.addEventListener('click', function () {
    var message = currentMessage();
    if (!message) return;
    var video = document.querySelector('#chat-trim-mount .trim-video');
    if (video) {
      try { video.currentTime = Number(message.offset || 0); } catch (e) {}
      document.getElementById('chat-trim-mount').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  resetBtn.addEventListener('click', function () {
    if (!hiddenIds.size && !highlightedIds.size && !onlyId) return;
    hiddenIds.clear();
    highlightedIds.clear();
    onlyId = '';
    selectedId = '';
    decorateAll();
    syncButtons();
    reloadPreview();
  });

  /* Chain after the existing style/timing wrappers so every chat request and
     export automatically carries the current non-persistent edit state. */
  var upstreamFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    var isCapture = url.indexOf('/api/chat/twitch') !== -1;
    var isExport = url.indexOf('/api/chat/export') !== -1;
    if ((isCapture || isExport) && init && typeof init.body === 'string') {
      try {
        var requestBody = JSON.parse(init.body);
        requestBody.hiddenMessageIds = Array.from(hiddenIds);
        requestBody.highlightedMessageIds = Array.from(highlightedIds);
        requestBody.onlyMessageId = onlyId || null;
        init = Object.assign({}, init, { body: JSON.stringify(requestBody) });
      } catch (e) {}
    }

    var promise = upstreamFetch.call(window, resource, init);
    if (isCapture) {
      promise.then(function (response) {
        if (!response || !response.ok) return;
        response.clone().json().then(function (body) {
          if (!body || !Array.isArray(body.messages)) return;
          var key = captureKey(body);
          if (selectionKey && key && key !== selectionKey) {
            hiddenIds.clear();
            highlightedIds.clear();
            onlyId = '';
            selectedId = '';
            knownMessages.clear();
          }
          if (key) selectionKey = key;
          body.messages.forEach(function (message) {
            var id = String(message && message.id || '');
            if (!id) return;
            knownMessages.set(id, message);
            if (message._fetcherHighlight) highlightedIds.add(id);
          });
          decorateAll();
          syncButtons();
        }).catch(function () {});
      }).catch(function () {});
    }
    return promise;
  };

  syncButtons();
})();
