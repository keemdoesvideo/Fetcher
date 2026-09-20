/* Saved chat presentation/export presets. Stored only in this browser. */
(function () {
  'use strict';

  var side = document.querySelector('.chat-side');
  var exportCard = document.querySelector('.chat-export-card');
  if (!side || !exportCard) return;

  var STORAGE_KEY = 'fetcher.chat.presets.v1';
  var MAX_PRESETS = 12;

  var fields = [
    { id: 'chat-timing-mode', type: 'value' },
    { id: 'chat-max-visible', type: 'value' },
    { id: 'chat-message-lifetime', type: 'value' },
    { id: 'chat-hide-bots', type: 'checked' },
    { id: 'chat-bubble-width', type: 'value' },
    { id: 'chat-bubble-gap', type: 'value' },
    { id: 'chat-sound-preset', type: 'sound' },
    { id: 'chat-sound-volume', type: 'value' },
    { id: 'chat-sound-gap', type: 'value' },
    { id: 'chat-export-format', type: 'value' },
    { id: 'chat-export-resolution', type: 'value' },
    { id: 'chat-export-fps', type: 'value' },
    { id: 'chat-canvas-mode', type: 'value' },
    { id: 'chat-canvas-aspect', type: 'value' },
    { id: 'chat-canvas-padding', type: 'value' }
  ];

  var css = document.createElement('style');
  css.textContent = [
    '.chat-presets-card{padding:16px}',
    '.chat-presets-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}',
    '.chat-presets-kicker{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);font-weight:800;margin-bottom:3px}',
    '.chat-presets-head h2{font-size:14px;margin:0}',
    '.chat-presets-save{display:grid;grid-template-columns:1fr auto;gap:7px}',
    '.chat-presets-save input,.chat-presets-select{min-width:0;width:100%;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit;font-size:11px;padding:9px 10px;outline:0;box-sizing:border-box}',
    '.chat-presets-save input:focus,.chat-presets-select:focus{border-color:#9146ff;box-shadow:0 0 0 3px color-mix(in srgb,#9146ff 10%,transparent)}',
    '.chat-presets-btn{border:1px solid var(--border-strong);background:var(--bg);color:var(--ink);font:inherit;font-size:10.5px;font-weight:800;border-radius:10px;padding:8px 10px;cursor:pointer}',
    '.chat-presets-btn.primary{border-color:color-mix(in srgb,#9146ff 38%,var(--border-strong));color:#7a45db}',
    '.chat-presets-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.chat-presets-row{display:grid;grid-template-columns:1fr auto auto;gap:7px;margin-top:8px}',
    '.chat-presets-note{font-size:9.8px;line-height:1.4;color:var(--ink-faint);margin:8px 1px 0}',
    '.chat-presets-note.error{color:var(--danger,#b34545)}'
  ].join('\n');
  document.head.appendChild(css);

  var card = document.createElement('div');
  card.className = 'chat-card chat-presets-card';
  card.innerHTML = [
    '<div class="chat-presets-head"><div><span class="chat-presets-kicker">workflow</span><h2>saved presets</h2></div></div>',
    '<div class="chat-presets-save"><input id="chat-preset-name" type="text" maxlength="40" placeholder="TikTok chat, clean overlay…"><button class="chat-presets-btn primary" id="chat-preset-save" type="button">save current</button></div>',
    '<div class="chat-presets-row"><select class="chat-presets-select" id="chat-preset-select" aria-label="Saved chat preset"><option value="">no saved presets</option></select><button class="chat-presets-btn" id="chat-preset-apply" type="button">apply</button><button class="chat-presets-btn" id="chat-preset-delete" type="button">delete</button></div>',
    '<p class="chat-presets-note" id="chat-preset-note">Presets stay in this browser and restore look, timing, canvas, sound and export settings in one click.</p>'
  ].join('');

  var styleCard = side.querySelector('.chat-custom-card');
  side.insertBefore(card, styleCard || exportCard);

  var nameEl = document.getElementById('chat-preset-name');
  var saveBtn = document.getElementById('chat-preset-save');
  var selectEl = document.getElementById('chat-preset-select');
  var applyBtn = document.getElementById('chat-preset-apply');
  var deleteBtn = document.getElementById('chat-preset-delete');
  var noteEl = document.getElementById('chat-preset-note');

  function note(text, error) {
    noteEl.textContent = text;
    noteEl.classList.toggle('error', !!error);
  }

  function readPresets() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.name === 'string' && item.settings && typeof item.settings === 'object';
      }).slice(0, MAX_PRESETS);
    } catch (e) {
      return [];
    }
  }

  function writePresets(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_PRESETS)));
      return true;
    } catch (e) {
      note('Could not save presets in this browser.', true);
      return false;
    }
  }

  function captureSettings() {
    var settings = {};
    fields.forEach(function (field) {
      var el = document.getElementById(field.id);
      if (!el) return;
      if (field.type === 'checked') settings[field.id] = !!el.checked;
      else if (field.type === 'sound') settings[field.id] = el.value === 'custom' ? 'off' : el.value;
      else settings[field.id] = el.value;
    });
    if (window.FetcherChatLooks) {
      settings.__chatLook = window.FetcherChatLooks.getLook();
      settings.__entryAnimation = window.FetcherChatLooks.getEntry();
    }
    return settings;
  }

  function setControl(el, value, type) {
    if (!el) return;
    if (type === 'checked') el.checked = !!value;
    else el.value = String(value);
    // Existing enhancement scripts listen to both depending on the control.
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applySettings(settings) {
    fields.forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(settings, field.id)) return;
      setControl(document.getElementById(field.id), settings[field.id], field.type);
    });
    if (window.FetcherChatLooks) {
      if (settings.__chatLook) window.FetcherChatLooks.setLook(String(settings.__chatLook));
      if (settings.__entryAnimation) window.FetcherChatLooks.setEntry(String(settings.__entryAnimation));
    }
  }

  function refresh(selectedName) {
    var items = readPresets();
    selectEl.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'no saved presets';
      selectEl.appendChild(empty);
    } else {
      items.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        selectEl.appendChild(option);
      });
      if (selectedName && items.some(function (item) { return item.name === selectedName; })) {
        selectEl.value = selectedName;
      }
    }
    var has = !!selectEl.value && items.length > 0;
    applyBtn.disabled = !has;
    deleteBtn.disabled = !has;
  }

  saveBtn.addEventListener('click', function () {
    var name = String(nameEl.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!name) {
      note('Give the preset a name first.', true);
      nameEl.focus();
      return;
    }
    var items = readPresets();
    var existing = items.findIndex(function (item) { return item.name.toLowerCase() === name.toLowerCase(); });
    var item = { name: name, settings: captureSettings(), updatedAt: Date.now() };
    if (existing >= 0) {
      items[existing] = item;
    } else {
      if (items.length >= MAX_PRESETS) {
        note('You can keep up to ' + MAX_PRESETS + ' presets. Delete one first.', true);
        return;
      }
      items.push(item);
    }
    items.sort(function (a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); });
    if (!writePresets(items)) return;
    refresh(name);
    nameEl.value = '';
    note((existing >= 0 ? 'Updated ' : 'Saved ') + '“' + name + '”. Custom sound files themselves are not stored.', false);
  });

  applyBtn.addEventListener('click', function () {
    var name = selectEl.value;
    var item = readPresets().find(function (entry) { return entry.name === name; });
    if (!item) return;
    applySettings(item.settings || {});
    note('Applied “' + item.name + '”.', false);
  });

  deleteBtn.addEventListener('click', function () {
    var name = selectEl.value;
    if (!name) return;
    var items = readPresets().filter(function (item) { return item.name !== name; });
    if (!writePresets(items)) return;
    refresh('');
    note('Deleted “' + name + '”.', false);
  });

  nameEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveBtn.click();
    }
  });

  refresh('');
})();