/* Twitch VOD chat-capture workspace. */
(function () {
  'use strict';

  var input = document.getElementById('chat-url');
  var pasteBtn = document.getElementById('chat-paste');
  var sourceState = document.getElementById('chat-source-state');
  var sourceNote = document.getElementById('chat-source-note');
  var startInput = document.getElementById('chat-start');
  var endInput = document.getElementById('chat-end');
  var loadBtn = document.getElementById('chat-load');
  var workspace = document.getElementById('chat-workspace');
  var trimMount = document.getElementById('chat-trim-mount');
  var stack = document.getElementById('chat-stack');
  var emptyPreview = document.getElementById('chat-empty-preview');
  var playBtn = document.getElementById('chat-play');
  var restartBtn = document.getElementById('chat-restart');
  var speedBtn = document.getElementById('chat-speed');
  var timeLabel = document.getElementById('chat-time');
  var progressFill = document.getElementById('chat-progress-fill');
  var statMessages = document.getElementById('chat-stat-messages');
  var statRange = document.getElementById('chat-stat-range');
  var previewMeta = document.getElementById('chat-preview-meta');
  var truncationNote = document.getElementById('chat-truncation-note');

  var detectSeq = 0;
  var supported = false;
  var data = null;
  var playing = false;
  var speed = 1;
  var playhead = 0;
  var nextMessage = 0;
  var raf = 0;
  var lastTick = 0;
  var visible = [];
  var MAX_VISIBLE = 7;
  var MESSAGE_TTL = 12;

  if (window.FetcherTrimmer && trimMount) {
    window.FetcherTrimmer.mount(trimMount);
  }

  function fmt(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
  }

  function setNote(text, isError) {
    sourceNote.textContent = text || '';
    sourceNote.classList.toggle('error', !!isError);
  }

  function setSourceState(label, ready) {
    sourceState.classList.toggle('ready', !!ready);
    sourceState.innerHTML = '<span class="dot"></span><span>' + label + '</span>';
  }

  function setSupported(on) {
    supported = !!on;
    loadBtn.disabled = !supported;
  }

  function setLoading(on) {
    loadBtn.disabled = on || !supported;
    loadBtn.innerHTML = on ? '<span class="chat-load-spinner"></span>reading chat…' : 'load chat';
  }

  function detect() {
    var url = input.value.trim();
    var seq = ++detectSeq;
    setSupported(false);
    if (window.FetcherTrimmer) window.FetcherTrimmer.close();
    if (!url) {
      setSourceState('waiting', false);
      setNote('paste a finished Twitch VOD link to start');
      return;
    }
    setSourceState('checking', false);
    setNote('checking that link…');
    fetch('/api/detect?url=' + encodeURIComponent(url))
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (seq !== detectSeq) return;
        if (!result || !result.supported || result.provider !== 'twitch' || !result.longForm) {
          setSourceState('not a vod', false);
          setNote('chat capture currently starts with finished Twitch VOD links', true);
          return;
        }
        setSourceState('twitch vod', true);
        setSupported(true);
        setNote('drag the preview handles to choose a section, or type start/end times below');
        if (window.FetcherTrimmer) window.FetcherTrimmer.open(url, 'twitch');
      })
      .catch(function () {
        if (seq !== detectSeq) return;
        setSourceState('offline', false);
        setNote('couldn’t inspect that link — try again', true);
      });
  }

  var detectTimer = 0;
  input.addEventListener('input', function () {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(detect, 350);
  });

  pasteBtn.addEventListener('click', function () {
    if (!(navigator.clipboard && navigator.clipboard.readText)) {
      input.focus();
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      if (!text) return;
      input.value = text.trim();
      detect();
    }).catch(function () { input.focus(); });
  });

  function selectedRange() {
    if (window.FetcherTrimmer && window.FetcherTrimmer.isOpen()) {
      var selection = window.FetcherTrimmer.getSelection();
      if (selection) {
        startInput.value = fmt(selection.start);
        endInput.value = fmt(selection.end);
        return { start: startInput.value, end: endInput.value };
      }
    }
    var start = startInput.value.trim();
    var end = endInput.value.trim();
    if (!start || !end) return null;
    return { start: start, end: end };
  }

  loadBtn.addEventListener('click', function () {
    if (!supported) return;
    var range = selectedRange();
    if (!range) {
      setNote('choose a section with the scrubber handles, or enter both start and end times', true);
      return;
    }
    setLoading(true);
    setNote('reading Twitch replay chat for that section…');
    fetch('/api/chat/twitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: input.value.trim(),
        start: range.start,
        end: range.end
      })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          return { ok: r.ok, body: body };
        });
      })
      .then(function (result) {
        setLoading(false);
        if (!result.ok) {
          setNote(result.body && result.body.error && result.body.error.message || 'couldn’t read that chat — try again', true);
          return;
        }
        data = result.body;
        setNote('chat loaded — press play to preview it in real time');
        showWorkspace();
      })
      .catch(function () {
        setLoading(false);
        setNote('couldn’t reach the chat service — try again', true);
      });
  });

  function showWorkspace() {
    workspace.hidden = false;
    resetPlayback();
    var count = Number(data.messageCount || (data.messages || []).length || 0);
    statMessages.textContent = String(count);
    statRange.textContent = fmt(data.duration || 0);
    previewMeta.textContent = count + ' message' + (count === 1 ? '' : 's') + ' · ' + fmt(data.duration || 0);
    truncationNote.hidden = !data.truncated;
    emptyPreview.hidden = count > 0;
    if (!count) {
      emptyPreview.textContent = 'no replay-chat messages landed inside this section';
    }
    workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function badgeLabel(setId) {
    var map = {
      broadcaster: 'LIVE',
      moderator: 'MOD',
      vip: 'VIP',
      subscriber: 'SUB',
      founder: 'OG',
      staff: 'STAFF'
    };
    return map[setId] || '';
  }

  function renderMessage(message) {
    var el = document.createElement('div');
    el.className = 'chat-message';
    el.dataset.chatId = message.id || '';

    var nameRow = document.createElement('div');
    nameRow.className = 'chat-name-row';
    (message.badges || []).forEach(function (badge) {
      var label = badgeLabel(badge.setId);
      if (!label) return;
      var b = document.createElement('span');
      b.className = 'chat-badge';
      b.textContent = label;
      nameRow.appendChild(b);
    });

    var user = document.createElement('span');
    user.className = 'chat-user';
    user.textContent = message.user && message.user.displayName || 'viewer';
    var color = message.user && message.user.color;
    if (/^#[0-9a-fA-F]{6}$/.test(color || '')) user.style.color = color;
    nameRow.appendChild(user);

    var body = document.createElement('div');
    body.className = 'chat-body';
    (message.fragments || []).forEach(function (fragment) {
      if (fragment.emoteUrl) {
        var img = document.createElement('img');
        img.className = 'chat-emote';
        img.src = fragment.emoteUrl;
        img.alt = fragment.text || 'emote';
        img.loading = 'eager';
        body.appendChild(img);
      } else if (fragment.text) {
        body.appendChild(document.createTextNode(fragment.text));
      }
    });
    if (!body.childNodes.length && message.text) body.textContent = message.text;

    el.appendChild(nameRow);
    el.appendChild(body);
    stack.appendChild(el);
    visible.push({ el: el, born: playhead });

    while (visible.length > MAX_VISIBLE) removeVisible(0);
  }

  function removeVisible(index) {
    var item = visible[index];
    if (!item) return;
    visible.splice(index, 1);
    item.el.classList.add('leaving');
    setTimeout(function () { if (item.el.parentNode) item.el.remove(); }, 190);
  }

  function pruneMessages() {
    while (visible.length && playhead - visible[0].born > MESSAGE_TTL) removeVisible(0);
  }

  function clearStack() {
    visible = [];
    stack.innerHTML = '';
  }

  function resetPlayback() {
    playing = false;
    cancelAnimationFrame(raf);
    raf = 0;
    lastTick = 0;
    playhead = 0;
    nextMessage = 0;
    clearStack();
    playBtn.textContent = 'play';
    updateClock();
  }

  function updateClock() {
    var duration = data ? Number(data.duration || 0) : 0;
    timeLabel.textContent = fmt(playhead) + ' / ' + fmt(duration);
    var pct = duration > 0 ? Math.min(100, Math.max(0, playhead / duration * 100)) : 0;
    progressFill.style.width = pct + '%';
  }

  function tick(now) {
    if (!playing || !data) return;
    if (!lastTick) lastTick = now;
    var delta = Math.min(.25, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    playhead += delta * speed;

    var messages = data.messages || [];
    while (nextMessage < messages.length && Number(messages[nextMessage].at || 0) <= playhead) {
      renderMessage(messages[nextMessage]);
      nextMessage++;
    }
    pruneMessages();

    var duration = Number(data.duration || 0);
    if (playhead >= duration) {
      playhead = duration;
      playing = false;
      playBtn.textContent = 'play';
      updateClock();
      return;
    }
    updateClock();
    raf = requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', function () {
    if (!data || !Number(data.duration || 0)) return;
    if (playhead >= Number(data.duration || 0)) resetPlayback();
    playing = !playing;
    playBtn.textContent = playing ? 'pause' : 'play';
    lastTick = 0;
    if (playing) raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(raf);
  });

  restartBtn.addEventListener('click', function () {
    resetPlayback();
  });

  speedBtn.addEventListener('click', function () {
    speed = speed === 1 ? 2 : (speed === 2 ? 4 : 1);
    speedBtn.textContent = speed + '×';
  });

  setSourceState('waiting', false);
  setNote('paste a finished Twitch VOD link to start');
})();
