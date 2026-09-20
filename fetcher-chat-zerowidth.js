/* Composite 7TV zero-width emotes over the previous emote in chat preview. */
(function () {
  'use strict';

  var stack = document.getElementById('chat-stack');
  if (!stack) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-emote-slot{display:inline-block;position:relative;vertical-align:middle;height:1.65em;margin:0 2px;line-height:1;white-space:nowrap}',
    '.chat-emote-slot>.chat-emote{display:block;height:100%;width:auto;margin:0;vertical-align:top;object-fit:contain}',
    '.chat-emote-slot>.chat-emote.chat-emote-zero{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:none;pointer-events:none}'
  ].join('\n');
  document.head.appendChild(css);

  var messages = new Map();

  function rememberPayload(body) {
    messages.clear();
    if (!body || !Array.isArray(body.messages)) return;
    body.messages.forEach(function (message) {
      if (!message || !message.id || !Array.isArray(message.fragments)) return;
      if (!message.fragments.some(function (fragment) {
        return fragment && fragment.emoteUrl && fragment.zeroWidth;
      })) return;
      messages.set(String(message.id), message);
    });
  }

  function appendText(body, text) {
    if (text) body.appendChild(document.createTextNode(text));
  }

  function makeImage(fragment, zero) {
    var img = document.createElement('img');
    img.className = 'chat-emote' + (zero ? ' chat-emote-zero' : '');
    img.src = fragment.emoteUrl;
    img.alt = fragment.text || 'emote';
    img.loading = 'eager';
    if (fragment.emoteSource) img.dataset.emoteSource = fragment.emoteSource;
    return img;
  }

  function makeSlot(fragment) {
    var slot = document.createElement('span');
    slot.className = 'chat-emote-slot';
    slot.appendChild(makeImage(fragment, false));
    return slot;
  }

  function rebuild(node, message) {
    if (!node || node.dataset.fetcherZeroWidth === '1') return;
    var body = node.querySelector('.chat-body');
    if (!body) return;

    body.textContent = '';
    var lastSlot = null;
    var pendingSpace = '';

    (message.fragments || []).forEach(function (fragment) {
      if (!fragment) return;

      if (fragment.emoteUrl) {
        if (fragment.zeroWidth && lastSlot) {
          // 7TV modifiers are typed as their own token, commonly with a space
          // before them. Native 7TV rendering consumes that separator and paints
          // the modifier over the previous emote without advancing chat width.
          pendingSpace = '';
          lastSlot.appendChild(makeImage(fragment, true));
          return;
        }

        appendText(body, pendingSpace);
        pendingSpace = '';
        lastSlot = makeSlot(fragment);
        body.appendChild(lastSlot);
        return;
      }

      var text = String(fragment.text || '');
      if (!text) return;
      if (/^\s+$/.test(text) && lastSlot) {
        pendingSpace += text;
        return;
      }

      appendText(body, pendingSpace);
      pendingSpace = '';
      appendText(body, text);
      lastSlot = null;
    });

    appendText(body, pendingSpace);
    node.dataset.fetcherZeroWidth = '1';
  }

  function processNode(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var id = String(node.dataset.chatId || '');
    var message = messages.get(id);
    if (message) rebuild(node, message);
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], processNode);
    });
  });
  observer.observe(stack, { childList: true });

  // Capture the enriched replay payload before the original controller renders
  // it. Waiting for the clone to parse keeps the zero-width metadata ready by
  // the time chat bubbles are inserted into the DOM.
  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    return nextFetch.call(window, resource, init).then(function (response) {
      if (url.indexOf('/api/chat/twitch') === -1) return response;
      return response.clone().json().then(function (body) {
        rememberPayload(body);
        return response;
      }).catch(function () { return response; });
    });
  };
})();
