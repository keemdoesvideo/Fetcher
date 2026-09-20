/* Chat font selector shared by preview + export. */
(function () {
  'use strict';

  var card = document.querySelector('.chat-custom-card');
  var stack = document.getElementById('chat-stack');
  if (!card || !stack) return;

  var grid = card.querySelector('.chat-custom-grid');
  if (!grid) return;

  var field = document.createElement('label');
  field.className = 'chat-custom-field';
  field.innerHTML = [
    '<span>font</span>',
    '<select id="chat-font">',
      '<option value="system">Fetcher default</option>',
      '<option value="arial">Arial</option>',
      '<option value="helvetica">Helvetica</option>',
      '<option value="verdana">Verdana</option>',
      '<option value="georgia">Georgia</option>',
      '<option value="courier">Courier New</option>',
    '</select>'
  ].join('');
  grid.appendChild(field);

  var fontEl = document.getElementById('chat-font');
  var stacks = {
    system: '',
    arial: 'Arial, sans-serif',
    helvetica: 'Helvetica, Arial, sans-serif',
    verdana: 'Verdana, Geneva, sans-serif',
    georgia: 'Georgia, serif',
    courier: '"Courier New", Courier, monospace'
  };

  function applyFont() {
    var value = Object.prototype.hasOwnProperty.call(stacks, fontEl.value) ? fontEl.value : 'system';
    stack.dataset.chatFont = value;
    stack.style.fontFamily = stacks[value] || '';
  }

  fontEl.addEventListener('change', applyFont);

  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.chatFont = Object.prototype.hasOwnProperty.call(stacks, fontEl.value) ? fontEl.value : 'system';
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nextFetch.call(window, resource, init);
  };

  applyFont();
})();