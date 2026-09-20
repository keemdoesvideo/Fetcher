/* Replace Fetcher's text Twitch badges with real Twitch badge artwork. */
(function () {
  'use strict';

  var stack = document.getElementById('chat-stack');
  if (!stack) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-badge-image{display:inline-block;height:1.15em;width:auto;flex:0 0 auto;object-fit:contain;vertical-align:middle}',
    '.chat-name-row>.chat-badge-image{margin:0}'
  ].join('\n');
  document.head.appendChild(css);

  var messages = new Map();
  var fallbackLabels = {
    broadcaster: 'LIVE',
    moderator: 'MOD',
    vip: 'VIP',
    subscriber: 'SUB',
    founder: 'OG',
    staff: 'STAFF'
  };

  function rememberPayload(body) {
    messages.clear();
    if (!body || !Array.isArray(body.messages)) return;
    body.messages.forEach(function (message) {
      if (!message || !message.id || !Array.isArray(message.badges)) return;
      messages.set(String(message.id), message);
    });
    decorateAll();
  }

  function fallbackBadge(badge) {
    var setId = String(badge && badge.setId || '');
    var label = fallbackLabels[setId] || '';
    if (!label) return null;
    var span = document.createElement('span');
    span.className = 'chat-badge';
    span.textContent = label;
    return span;
  }

  function badgeNode(badge) {
    if (!badge || !badge.imageUrl) return fallbackBadge(badge);
    var img = document.createElement('img');
    img.className = 'chat-badge-image';
    img.src = badge.imageUrl;
    img.alt = badge.title || badge.setId || 'Twitch badge';
    img.title = badge.title || badge.setId || 'Twitch badge';
    img.loading = 'eager';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', function () {
      var fallback = fallbackBadge(badge);
      if (fallback && img.parentNode) img.parentNode.replaceChild(fallback, img);
      else if (img.parentNode) img.remove();
    }, { once: true });
    return img;
  }

  function decorate(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var id = String(node.dataset.chatId || '');
    var message = messages.get(id);
    if (!message) return;

    var row = node.querySelector('.chat-name-row');
    var user = row && row.querySelector('.chat-user');
    if (!row || !user) return;

    Array.prototype.forEach.call(
      row.querySelectorAll('.chat-badge,.chat-badge-image'),
      function (badge) { badge.remove(); }
    );

    (message.badges || []).forEach(function (badge) {
      var el = badgeNode(badge);
      if (el) row.insertBefore(el, user);
    });
    node.dataset.fetcherTwitchBadges = '1';
  }

  function decorateAll() {
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), decorate);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
        if (!node || node.nodeType !== 1) return;
        decorate(node);
        Array.prototype.forEach.call(
          node.querySelectorAll ? node.querySelectorAll('.chat-message') : [],
          decorate
        );
      });
    });
  }).observe(stack, { childList: true, subtree: true });

  // Read the same enriched payload the chat player already receives. The core
  // renderer remains untouched and still supplies text badges if artwork fails.
  var upstreamFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    var responsePromise = upstreamFetch.call(window, resource, init);
    if (url.indexOf('/api/chat/twitch') !== -1) {
      responsePromise.then(function (response) {
        if (!response || !response.ok) return;
        response.clone().json().then(rememberPayload).catch(function () {});
      }).catch(function () {});
    }
    return responsePromise;
  };
})();
