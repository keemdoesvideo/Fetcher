/* Live chat style parity + optional message sounds. No-op outside chat.html. */
(function () {
  'use strict';

  var side = document.querySelector('.chat-side');
  var stack = document.getElementById('chat-stack');
  var stage = document.getElementById('chat-stage');
  var exportCard = document.querySelector('.chat-export-card');
  var exportBtn = document.getElementById('chat-export-btn');
  if (!side || !stack || !stage || !exportCard || !exportBtn) return;

  var style = document.createElement('style');
  style.textContent = [
    '.chat-custom-card{padding:16px}',
    '.chat-custom-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}',
    '.chat-custom-head h2{font-size:14px;margin:0}',
    '.chat-custom-sub{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:800;color:var(--ink-faint)}',
    '.chat-custom-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
    '.chat-custom-field{display:grid;gap:6px}',
    '.chat-custom-field.full{grid-column:1/-1}',
    '.chat-custom-field>span,.chat-custom-line>span:first-child{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:var(--ink-faint)}',
    '.chat-custom-field select{width:100%;appearance:none;border:1px solid var(--border-strong);border-radius:11px;background:var(--bg);color:var(--ink);font:inherit;font-size:11.5px;padding:9px 28px 9px 10px;outline:0}',
    '.chat-custom-field select:focus{border-color:#9146ff;box-shadow:0 0 0 3px color-mix(in srgb,#9146ff 10%,transparent)}',
    '.chat-custom-line{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center}',
    '.chat-custom-line output{font-size:10.5px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}',
    '.chat-custom-field input[type="range"]{width:100%;accent-color:#9146ff}',
    '.chat-custom-divider{height:1px;background:var(--border);margin:14px 0}',
    '.chat-custom-upload{display:flex;align-items:center;gap:8px}',
    '.chat-custom-upload button{border:1px solid var(--border-strong);background:var(--bg);color:var(--ink);font:inherit;font-size:10.5px;font-weight:800;border-radius:10px;padding:8px 10px;cursor:pointer}',
    '.chat-custom-file{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--ink-faint)}',
    '.chat-custom-note{font-size:10px;line-height:1.45;color:var(--ink-faint);margin-top:8px}',
    '.chat-custom-note.error{color:var(--danger,#b34545)}',
    '.chat-stack[data-bubble-width="auto"]{align-items:flex-start}',
    '.chat-stack[data-bubble-width="auto"] .chat-message{width:auto;max-width:100%;box-sizing:border-box}',
    '.chat-stack[data-bubble-width="uniform"]{align-items:stretch}',
    '.chat-stack[data-bubble-width="uniform"] .chat-message{width:auto;box-sizing:border-box}',
    '@media(max-width:900px){.chat-custom-card{grid-row:auto}}',
    '@media(max-width:680px){.chat-custom-grid{grid-template-columns:1fr}.chat-custom-field.full{grid-column:auto}}'
  ].join('\n');
  document.head.appendChild(style);

  var card = document.createElement('div');
  card.className = 'chat-card chat-custom-card';
  card.innerHTML = [
    '<div class="chat-custom-head"><div><span class="chat-custom-sub">preview + export</span><h2>style & sound</h2></div></div>',
    '<div class="chat-custom-grid">',
      '<label class="chat-custom-field"><span>bubble width</span><select id="chat-bubble-width"><option value="uniform">Uniform</option><option value="auto">Auto · fit message</option></select></label>',
      '<div class="chat-custom-field"><div class="chat-custom-line"><span>bubble gap</span><output id="chat-gap-out">20 px</output></div><input id="chat-bubble-gap" type="range" min="8" max="40" step="1" value="20"></div>',
    '</div>',
    '<p class="chat-custom-note">20 px is the old Fetcher preview spacing. Export scales it to the chosen canvas so Resolve matches what you see here.</p>',
    '<div class="chat-custom-divider"></div>',
    '<div class="chat-custom-grid">',
      '<label class="chat-custom-field full"><span>message sound</span><select id="chat-sound-preset"><option value="off">Off</option><option value="pop">Soft pop</option><option value="tick">Soft tick</option><option value="bubble">Bubble blip</option><option value="custom">Custom upload</option></select></label>',
      '<div class="chat-custom-field"><div class="chat-custom-line"><span>volume</span><output id="chat-volume-out">65%</output></div><input id="chat-sound-volume" type="range" min="0" max="100" step="1" value="65"></div>',
      '<div class="chat-custom-field"><div class="chat-custom-line"><span>minimum gap</span><output id="chat-sound-gap-out">120 ms</output></div><input id="chat-sound-gap" type="range" min="0" max="600" step="20" value="120"></div>',
      '<div class="chat-custom-field full" id="chat-custom-upload-row" hidden><span>custom sound · 2 MB max · first 2 sec used</span><div class="chat-custom-upload"><button id="chat-custom-upload" type="button">choose sound</button><span class="chat-custom-file" id="chat-custom-file">no file selected</span><input id="chat-custom-file-input" type="file" accept="audio/wav,audio/mpeg,audio/ogg,audio/webm,audio/mp4,.wav,.mp3,.ogg,.webm,.m4a" hidden></div></div>',
    '</div>',
    '<p class="chat-custom-note" id="chat-sound-note">Sound is optional. When enabled, each new message gets a cue; minimum gap stops busy chats from turning into a machine gun.</p>'
  ].join('');
  side.insertBefore(card, exportCard);

  var widthEl = document.getElementById('chat-bubble-width');
  var gapEl = document.getElementById('chat-bubble-gap');
  var gapOut = document.getElementById('chat-gap-out');
  var soundEl = document.getElementById('chat-sound-preset');
  var volumeEl = document.getElementById('chat-sound-volume');
  var volumeOut = document.getElementById('chat-volume-out');
  var soundGapEl = document.getElementById('chat-sound-gap');
  var soundGapOut = document.getElementById('chat-sound-gap-out');
  var uploadRow = document.getElementById('chat-custom-upload-row');
  var uploadBtn = document.getElementById('chat-custom-upload');
  var fileInput = document.getElementById('chat-custom-file-input');
  var fileLabel = document.getElementById('chat-custom-file');
  var soundNote = document.getElementById('chat-sound-note');

  var customSoundData = '';
  var customBuffer = null;
  var audioCtx = null;
  var lastSoundAt = -Infinity;

  function getAudioContext() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
    return audioCtx;
  }

  function previewGapPx() {
    return Math.max(1, Number(gapEl.value || 20) * Math.max(1, stage.clientHeight) / 1080);
  }

  function applyStyle() {
    stack.dataset.bubbleWidth = widthEl.value === 'auto' ? 'auto' : 'uniform';
    stack.style.gap = previewGapPx().toFixed(2) + 'px';
    gapOut.textContent = gapEl.value + ' px';
  }

  function updateSoundUi() {
    uploadRow.hidden = soundEl.value !== 'custom';
    volumeOut.textContent = volumeEl.value + '%';
    soundGapOut.textContent = soundGapEl.value + ' ms';
    soundNote.classList.remove('error');
    soundNote.textContent = soundEl.value === 'off'
      ? 'Sound is optional. Turn it on to add a cue when each new message appears.'
      : 'Preview and export both use this cue. Minimum gap keeps very busy chats from stacking too many sounds.';
  }

  function playSynth(kind, gainValue) {
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    if (kind === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now);
      gain.gain.setValueAtTime(gainValue * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.start(now); osc.stop(now + 0.07);
    } else if (kind === 'bubble') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainValue * 0.28, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now); osc.stop(now + 0.19);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(810, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainValue * 0.26, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now); osc.stop(now + 0.13);
    }
  }

  function playMessageSound() {
    var kind = soundEl.value;
    if (kind === 'off') return;
    var nowMs = performance.now();
    var gap = Number(soundGapEl.value || 0);
    if (nowMs - lastSoundAt < gap) return;
    lastSoundAt = nowMs;
    var volume = Math.max(0, Math.min(1, Number(volumeEl.value || 0) / 100));
    if (!volume) return;
    if (kind === 'custom') {
      var ctx = getAudioContext();
      if (!ctx || !customBuffer) return;
      var source = ctx.createBufferSource();
      var gain = ctx.createGain();
      source.buffer = customBuffer;
      gain.gain.value = volume;
      source.connect(gain).connect(ctx.destination);
      source.start();
      return;
    }
    playSynth(kind, volume);
  }

  widthEl.addEventListener('change', applyStyle);
  gapEl.addEventListener('input', applyStyle);
  window.addEventListener('resize', applyStyle);
  soundEl.addEventListener('change', updateSoundUi);
  volumeEl.addEventListener('input', updateSoundUi);
  soundGapEl.addEventListener('input', updateSoundUi);

  uploadBtn.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    customSoundData = '';
    customBuffer = null;
    if (!file) {
      fileLabel.textContent = 'no file selected';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      fileInput.value = '';
      fileLabel.textContent = 'file too large';
      soundNote.classList.add('error');
      soundNote.textContent = 'Keep the custom message sound under 2 MB.';
      return;
    }
    fileLabel.textContent = file.name;
    var reader = new FileReader();
    reader.onload = function () { customSoundData = String(reader.result || ''); };
    reader.readAsDataURL(file);
    file.arrayBuffer().then(function (buf) {
      var ctx = getAudioContext();
      if (!ctx) return;
      return ctx.decodeAudioData(buf.slice(0)).then(function (decoded) {
        customBuffer = decoded;
      });
    }).catch(function () {
      soundNote.classList.add('error');
      soundNote.textContent = 'That sound could not be previewed. Try WAV, MP3, OGG, WebM or M4A.';
    });
  });

  var observer = new MutationObserver(function (mutations) {
    var added = false;
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('chat-message')) added = true;
      });
    });
    if (added) playMessageSound();
  });
  observer.observe(stack, { childList: true });

  // Add WYSIWYG style/sound settings to the existing export request without
  // coupling this enhancement to the original chat controller's private state.
  var nativeFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.bubbleWidth = widthEl.value === 'auto' ? 'auto' : 'uniform';
        body.bubbleGap = Number(gapEl.value || 20);
        body.soundPreset = soundEl.value;
        body.soundVolume = Number(volumeEl.value || 65);
        body.soundMinGapMs = Number(soundGapEl.value || 120);
        if (soundEl.value === 'custom') body.soundData = customSoundData || null;
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nativeFetch.call(window, resource, init);
  };

  // Stop the old export handler before it fires if Custom is selected without a
  // file. This keeps the error local instead of starting a doomed server job.
  exportBtn.addEventListener('click', function (event) {
    if (soundEl.value === 'custom' && !customSoundData) {
      event.preventDefault();
      event.stopImmediatePropagation();
      soundNote.classList.add('error');
      soundNote.textContent = 'Choose a custom sound first, or switch message sound back to Off.';
    }
  }, true);

  applyStyle();
  updateSoundUi();
})();
