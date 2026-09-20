/* Tight/full canvas controls for chat export. No-op outside chat.html. */
(function () {
  'use strict';

  var card = document.querySelector('.chat-custom-card');
  if (!card) return;
  var grid = card.querySelector('.chat-custom-grid');
  var divider = card.querySelector('.chat-custom-divider');
  if (!grid || !divider) return;

  var canvasField = document.createElement('label');
  canvasField.className = 'chat-custom-field';
  canvasField.innerHTML = [
    '<span>export canvas</span>',
    '<select id="chat-canvas-mode">',
      '<option value="full">Full frame · current</option>',
      '<option value="tight">Tight · crop to chat</option>',
    '</select>'
  ].join('');

  var paddingField = document.createElement('div');
  paddingField.className = 'chat-custom-field';
  paddingField.innerHTML = [
    '<div class="chat-custom-line"><span>canvas padding</span><output id="chat-canvas-padding-out">32 px</output></div>',
    '<input id="chat-canvas-padding" type="range" min="0" max="160" step="4" value="32">'
  ].join('');

  grid.appendChild(canvasField);
  grid.appendChild(paddingField);

  var note = document.createElement('p');
  note.className = 'chat-custom-note';
  note.id = 'chat-canvas-note';
  note.textContent = 'Full frame keeps the existing 16:9 plate. Tight canvas wraps the exported file around the chat stack.';
  card.insertBefore(note, divider);

  var modeEl = document.getElementById('chat-canvas-mode');
  var paddingEl = document.getElementById('chat-canvas-padding');
  var paddingOut = document.getElementById('chat-canvas-padding-out');

  function updateUi() {
    var tight = modeEl.value === 'tight';
    paddingEl.disabled = !tight;
    paddingField.style.opacity = tight ? '1' : '.5';
    paddingOut.textContent = paddingEl.value + ' px';
    note.textContent = tight
      ? 'Tight canvas keeps the same chat size but removes unused transparent frame space. Padding stays around shadows and motion.'
      : 'Full frame keeps the existing 16:9 export exactly as before.';
  }

  modeEl.addEventListener('change', updateUi);
  paddingEl.addEventListener('input', updateUi);

  // Layer on top of the existing style/sound request wrapper. This only adds the
  // two canvas fields and leaves every validated export setting untouched.
  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.canvasMode = modeEl.value === 'tight' ? 'tight' : 'full';
        body.canvasPadding = Number(paddingEl.value || 32);
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nextFetch.call(window, resource, init);
  };

  updateUi();
})();
