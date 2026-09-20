/* Full/tight canvas + social aspect controls for chat export. No-op outside chat.html. */
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
      '<option value="full">Full frame</option>',
      '<option value="tight">Tight · crop to chat</option>',
    '</select>'
  ].join('');

  var aspectField = document.createElement('label');
  aspectField.className = 'chat-custom-field';
  aspectField.innerHTML = [
    '<span>frame shape</span>',
    '<select id="chat-canvas-aspect">',
      '<option value="16:9">16:9 · landscape</option>',
      '<option value="9:16">9:16 · vertical</option>',
      '<option value="4:5">4:5 · social portrait</option>',
      '<option value="1:1">1:1 · square</option>',
    '</select>'
  ].join('');

  var paddingField = document.createElement('div');
  paddingField.className = 'chat-custom-field';
  paddingField.innerHTML = [
    '<div class="chat-custom-line"><span>canvas padding</span><output id="chat-canvas-padding-out">32 px</output></div>',
    '<input id="chat-canvas-padding" type="range" min="0" max="160" step="4" value="32">'
  ].join('');

  grid.appendChild(canvasField);
  grid.appendChild(aspectField);
  grid.appendChild(paddingField);

  var note = document.createElement('p');
  note.className = 'chat-custom-note';
  note.id = 'chat-canvas-note';
  note.textContent = 'Full frame can export landscape, vertical, 4:5 or square. Tight canvas wraps the file around the chat itself.';
  card.insertBefore(note, divider);

  var modeEl = document.getElementById('chat-canvas-mode');
  var aspectEl = document.getElementById('chat-canvas-aspect');
  var paddingEl = document.getElementById('chat-canvas-padding');
  var paddingOut = document.getElementById('chat-canvas-padding-out');

  function updateUi() {
    var tight = modeEl.value === 'tight';
    aspectEl.disabled = tight;
    aspectField.style.opacity = tight ? '.5' : '1';
    paddingEl.disabled = !tight;
    paddingField.style.opacity = tight ? '1' : '.5';
    paddingOut.textContent = paddingEl.value + ' px';

    if (tight) {
      note.textContent = 'Tight canvas ignores frame shape, keeps the existing chat scale, and removes unused transparent space around the stack.';
      return;
    }

    var labels = {
      '16:9': '16:9 landscape',
      '9:16': '9:16 vertical',
      '4:5': '4:5 portrait',
      '1:1': '1:1 square'
    };
    note.textContent = 'Full frame will export a ' + (labels[aspectEl.value] || '16:9 landscape') + ' canvas. Chat keeps the selected 1080p/720p text and emote scale.';
  }

  modeEl.addEventListener('change', updateUi);
  aspectEl.addEventListener('change', updateUi);
  paddingEl.addEventListener('input', updateUi);

  // Layer on top of the existing style/sound request wrapper. This only adds
  // canvas fields and leaves every previously validated export option alone.
  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.canvasMode = modeEl.value === 'tight' ? 'tight' : 'full';
        body.canvasAspect = ['16:9', '9:16', '4:5', '1:1'].indexOf(aspectEl.value) !== -1 ? aspectEl.value : '16:9';
        body.canvasPadding = Number(paddingEl.value || 32);
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nextFetch.call(window, resource, init);
  };

  updateUi();
})();
