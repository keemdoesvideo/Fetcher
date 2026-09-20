/* Twitch replay event labels for Fetcher's chat preview. */
(function () {
  'use strict';

  var stack = document.getElementById('chat-stack');
  var previewMeta = document.getElementById('chat-preview-meta');
  if (!stack) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-message.chat-event-message{border-left:3px solid #9146ff}',
    '.chat-event-chip{display:inline-flex;align-items:center;flex:0 0 auto;font-size:8px;font-weight:900;line-height:1;padding:3px 5px;border-radius:4px;background:rgba(145,70,255,.34);color:#eadfff;letter-spacing:.04em;white-space:nowrap}',
    '.chat-message[data-chat-event="bits"] .chat-event-chip{background:rgba(244,190,70,.28);color:#ffe8a6}',
    '.chat-message[data-chat-event="gift"] .chat-event-chip,.chat-message[data-chat-event="gift-bomb"] .chat-event-chip{background:rgba(224,92,168,.28);color:#ffd8ef}',
    '.chat-message[data-chat-event="raid"] .chat-event-chip{background:rgba(145,70,255,.44);color:#f2e9ff}'
  ].join('\n');
  document.head.appendChild(css);

  var eventById = Object.create(null);
  var lastEventCount = 0;

  function decorate(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var id = String(node.dataset.chatId || '');
    var event = id && eventById[id];
    if (!event) return;

    node.classList.add('chat-event-message');
    node.dataset.chatEvent = String(event.type || 'event');

    var row = node.querySelector('.chat-name-row');
    if (!row || row.querySelector('.chat-event-chip')) return;
    var chip = document.createElement('span');
    chip.className = 'chat-event-chip';
    chip.textContent = String(event.label || event.type || 'EVENT').toUpperCase();
    chip.title = 'Twitch ' + String(event.type || 'event').replace(/-/g, ' ');
    row.insertBefore(chip, row.firstChild);
  }

  function decorateAll() {
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), decorate);
  }

  function rememberPayload(body) {
    eventById = Object.create(null);
    lastEventCount = Number(body && body.eventCount || 0);
    var messages = body && Array.isArray(body.messages) ? body.messages : [];
    messages.forEach(function (message) {
      if (!message || !message.id || !message.event) return;
      eventById[String(message.id)] = message.event;
    });
    decorateAll();

    // Function-first status only: make it easy to confirm the classifier found
    // events without introducing another permanent panel.
    if (previewMeta && lastEventCount > 0) {
      var current = String(previewMeta.textContent || '').replace(/ · \d+ Twitch events?$/, '');
      previewMeta.textContent = current + ' · ' + lastEventCount + ' Twitch event' + (lastEventCount === 1 ? '' : 's');
    }
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
        if (node && node.nodeType === 1) {
          decorate(node);
          Array.prototype.forEach.call(node.querySelectorAll ? node.querySelectorAll('.chat-message') : [], decorate);
        }
      });
    });
  }).observe(stack, { childList: true, subtree: true });

  // Capture the structured event metadata from the same response the core chat
  // player already consumes. Chain after the existing Fetcher fetch wrappers.
  var upstreamFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    var responsePromise = upstreamFetch.call(window, resource, init);
    if (url.indexOf('/api/chat/twitch') !== -1) {
      responsePromise.then(function (response) {
        if (!response || !response.ok) return;
        response.clone().json().then(function (body) {
          if (body && Array.isArray(body.messages)) rememberPayload(body);
        }).catch(function () {});
      }).catch(function () {});
    }
    return responsePromise;
  };
})();
