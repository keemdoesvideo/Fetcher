/* Twitch clip-finding helpers: heatmap, loaded-chat search and timing controls. */
(function () {
  'use strict';

  var side = document.querySelector('.chat-side');
  var sourceCard = document.querySelector('.chat-source');
  var stack = document.getElementById('chat-stack');
  var stage = document.getElementById('chat-stage');
  var loadBtn = document.getElementById('chat-load');
  var urlInput = document.getElementById('chat-url');
  var trimMount = document.getElementById('chat-trim-mount');
  if (!side || !sourceCard || !stack || !stage || !loadBtn || !urlInput || !trimMount) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-insights-card{padding:16px}',
    '.chat-insights-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:13px}',
    '.chat-insights-kicker{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);font-weight:800;margin-bottom:3px}',
    '.chat-insights-head h2{font-size:16px;letter-spacing:-.02em;margin:0}',
    '.chat-scan-btn{border:1px solid color-mix(in srgb,#9146ff 34%,var(--border));background:color-mix(in srgb,#9146ff 9%,var(--surface));color:#7a45db;font:inherit;font-size:10.5px;font-weight:850;padding:7px 9px;border-radius:10px;cursor:pointer}',
    '.chat-scan-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.chat-heatmap{height:62px;display:flex;align-items:flex-end;gap:2px;padding:8px 7px 5px;border:1px solid var(--border);border-radius:12px;background:var(--bg);overflow:hidden}',
    '.chat-heat-bar{flex:1;min-width:2px;height:4%;border:0;border-radius:3px 3px 1px 1px;background:#9146ff;opacity:.48;cursor:pointer;transition:opacity .12s ease,transform .12s ease}',
    '.chat-heat-bar:hover{opacity:1;transform:scaleY(1.05);transform-origin:bottom}',
    '.chat-heat-empty{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:10.5px;color:var(--ink-faint);text-align:center;padding:6px}',
    '.chat-heat-note{font-size:9.8px;line-height:1.4;color:var(--ink-faint);margin:7px 1px 0}',
    '.chat-peak-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
    '.chat-peak-chip{border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);font:inherit;font-size:9.5px;font-weight:800;border-radius:999px;padding:5px 8px;cursor:pointer}',
    '.chat-peak-chip:hover{border-color:#9146ff;color:#7a45db}',
    '.chat-insights-divider{height:1px;background:var(--border);margin:14px 0}',
    '.chat-search-wrap{display:grid;grid-template-columns:1fr auto;gap:7px}',
    '.chat-search-wrap input{min-width:0;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit;font-size:11px;padding:9px 10px;outline:0}',
    '.chat-search-wrap input:focus{border-color:#9146ff;box-shadow:0 0 0 3px color-mix(in srgb,#9146ff 10%,transparent)}',
    '.chat-search-clear{border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);font:inherit;font-size:10px;font-weight:800;border-radius:10px;padding:0 9px;cursor:pointer}',
    '.chat-search-results{display:grid;gap:5px;margin-top:7px;max-height:180px;overflow:auto}',
    '.chat-search-result{width:100%;display:grid;grid-template-columns:auto 1fr;gap:8px;text-align:left;border:1px solid var(--border);background:var(--bg);color:var(--ink);border-radius:10px;padding:7px 8px;cursor:pointer}',
    '.chat-search-result:hover{border-color:color-mix(in srgb,#9146ff 45%,var(--border))}',
    '.chat-search-time{font-size:9.5px;font-weight:850;color:#7a45db;font-variant-numeric:tabular-nums}',
    '.chat-search-copy{min-width:0;font-size:10.5px;line-height:1.35;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.chat-search-copy strong{color:var(--ink);margin-right:4px}',
    '.chat-search-empty{font-size:10px;color:var(--ink-faint);padding:4px 2px}',
    '.chat-insights-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.chat-insights-field{display:grid;gap:5px}',
    '.chat-insights-field>span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:var(--ink-faint)}',
    '.chat-insights-field select{width:100%;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit;font-size:10.5px;padding:8px 9px;outline:0}',
    '.chat-insights-check{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:10.5px;color:var(--ink-soft);cursor:pointer}',
    '.chat-insights-check input{accent-color:#9146ff}',
    '.chat-msg-search-title{font-size:10.5px;font-weight:850;color:var(--ink);margin-bottom:7px}',
    '@media(max-width:680px){.chat-insights-grid{grid-template-columns:1fr}}'
  ].join('\n');
  document.head.appendChild(css);

  var card = document.createElement('div');
  card.className = 'chat-card chat-insights-card';
  card.innerHTML = [
    '<div class="chat-insights-head"><div><span class="chat-insights-kicker">clip finder</span><h2>find the moment</h2></div><button class="chat-scan-btn" id="chat-activity-scan" type="button">scan VOD</button></div>',
    '<div class="chat-heatmap" id="chat-activity-map"><div class="chat-heat-empty">scan the VOD to see where chat gets loud</div></div>',
    '<div class="chat-peak-row" id="chat-peak-row"></div>',
    '<p class="chat-heat-note" id="chat-activity-note">Heatmap is an approximate activity scan, not a full download of every message. Click a peak to seek the VOD and move the trim range around it.</p>',
    '<div class="chat-insights-divider"></div>',
    '<div class="chat-msg-search-title">search loaded chat</div>',
    '<div class="chat-search-wrap"><input id="chat-message-search" type="search" placeholder="KEKW, username, phrase…"><button class="chat-search-clear" id="chat-search-clear" type="button">clear</button></div>',
    '<div class="chat-search-results" id="chat-search-results"><div class="chat-search-empty">load a chat section first</div></div>',
    '<div class="chat-insights-divider"></div>',
    '<div class="chat-insights-grid">',
      '<label class="chat-insights-field"><span>message timing</span><select id="chat-timing-mode"><option value="readable">Readable · spread bursts</option><option value="original">Original Twitch timing</option></select></label>',
      '<label class="chat-insights-field"><span>max visible</span><select id="chat-max-visible"><option>3</option><option>4</option><option>5</option><option>6</option><option value="7" selected>7</option></select></label>',
      '<label class="chat-insights-field"><span>message lifetime</span><select id="chat-message-lifetime"><option value="4">4 sec</option><option value="6">6 sec</option><option value="8">8 sec</option><option value="10">10 sec</option><option value="12" selected>12 sec</option></select></label>',
    '</div>',
    '<label class="chat-insights-check"><input id="chat-hide-bots" type="checkbox">hide common bot messages (Nightbot, StreamElements, Streamlabs…)</label>'
  ].join('');

  var styleCard = side.querySelector('.chat-custom-card');
  var exportCard = side.querySelector('.chat-export-card');
  side.insertBefore(card, styleCard || exportCard || side.firstChild);

  var scanBtn = document.getElementById('chat-activity-scan');
  var heatmap = document.getElementById('chat-activity-map');
  var peakRow = document.getElementById('chat-peak-row');
  var activityNote = document.getElementById('chat-activity-note');
  var searchInput = document.getElementById('chat-message-search');
  var searchClear = document.getElementById('chat-search-clear');
  var searchResults = document.getElementById('chat-search-results');
  var timingMode = document.getElementById('chat-timing-mode');
  var maxVisible = document.getElementById('chat-max-visible');
  var lifetime = document.getElementById('chat-message-lifetime');
  var hideBots = document.getElementById('chat-hide-bots');

  var loadedPayload = null;
  var scanBusy = false;
  var timers = new WeakMap();

  function fmt(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }

  function currentVideo() {
    return trimMount.querySelector('.trim-video');
  }

  function vodDuration() {
    var video = currentVideo();
    if (video && isFinite(video.duration) && video.duration > 1) return video.duration;
    var label = trimMount.querySelector('.trim-dur');
    if (!label) return 0;
    var parts = String(label.textContent || '').split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    var total = 0;
    parts.forEach(function (n) { total = total * 60 + n; });
    return total;
  }

  function selectAround(seconds) {
    var duration = vodDuration();
    if (!duration) return;
    seconds = Math.max(0, Math.min(duration, Number(seconds) || 0));
    var video = currentVideo();
    if (video) {
      try { video.currentTime = seconds; } catch (e) {}
    }
    var start = trimMount.querySelector('.trim-in-start');
    var end = trimMount.querySelector('.trim-in-end');
    if (start && end) {
      start.value = fmt(Math.max(0, seconds - 10));
      start.dispatchEvent(new Event('change', { bubbles: true }));
      end.value = fmt(Math.min(duration, seconds + 20));
      end.dispatchEvent(new Event('change', { bubbles: true }));
      if (video) {
        try { video.currentTime = seconds; } catch (e) {}
      }
    }
    trimMount.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setScanBusy(on) {
    scanBusy = !!on;
    scanBtn.disabled = on;
    scanBtn.textContent = on ? 'scanning…' : 'scan VOD';
  }

  function renderActivity(body) {
    var samples = body && Array.isArray(body.samples) ? body.samples : [];
    heatmap.innerHTML = '';
    peakRow.innerHTML = '';
    if (!samples.length) {
      heatmap.innerHTML = '<div class="chat-heat-empty">no activity samples came back</div>';
      return;
    }
    var peak = Math.max(1, Number(body.peakRate || 0));
    samples.forEach(function (sample) {
      var rate = Math.max(0, Number(sample.rate || 0));
      var bar = document.createElement('button');
      bar.type = 'button';
      bar.className = 'chat-heat-bar';
      var normalized = Math.sqrt(rate / peak);
      bar.style.height = Math.max(4, Math.round(normalized * 100)) + '%';
      bar.style.opacity = String(0.34 + normalized * 0.66);
      bar.title = fmt(sample.time) + ' · ~' + Math.round(rate) + ' messages/min';
      bar.addEventListener('click', function () { selectAround(sample.time); });
      heatmap.appendChild(bar);
    });

    samples.slice().sort(function (a, b) { return Number(b.rate || 0) - Number(a.rate || 0); }).slice(0, 4).forEach(function (sample, index) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chat-peak-chip';
      chip.textContent = '#' + (index + 1) + ' · ' + fmt(sample.time) + ' · ~' + Math.round(Number(sample.rate || 0)) + '/min';
      chip.addEventListener('click', function () { selectAround(sample.time); });
      peakRow.appendChild(chip);
    });
    activityNote.textContent = 'Approximate full-VOD activity · ' + samples.length + ' samples' + (body.cached ? ' · cached' : '') + '. Click a bar or peak to seek and create a 30-second trim around it.';
  }

  scanBtn.addEventListener('click', function () {
    if (scanBusy) return;
    var url = urlInput.value.trim();
    var duration = vodDuration();
    if (!url || !duration) {
      activityNote.textContent = 'Wait for the Twitch VOD preview to finish loading, then scan again.';
      return;
    }
    setScanBusy(true);
    activityNote.textContent = 'Sampling chat activity across the VOD…';
    fetch('/api/chat/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, duration: duration, samples: 48 })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body }; });
    }).then(function (result) {
      setScanBusy(false);
      if (!result.ok) {
        activityNote.textContent = result.body && result.body.error && result.body.error.message || 'Couldn’t scan that VOD right now.';
        return;
      }
      renderActivity(result.body);
    }).catch(function () {
      setScanBusy(false);
      activityNote.textContent = 'Couldn’t reach the chat activity scanner — try again.';
    });
  });

  function seekMessage(message) {
    var video = currentVideo();
    if (video) {
      try { video.currentTime = Number(message.offset || 0); } catch (e) {}
      trimMount.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function renderSearch() {
    var query = String(searchInput.value || '').trim().toLowerCase();
    searchResults.innerHTML = '';
    if (!loadedPayload || !Array.isArray(loadedPayload.messages)) {
      searchResults.innerHTML = '<div class="chat-search-empty">load a chat section first</div>';
      return;
    }
    if (!query) {
      searchResults.innerHTML = '<div class="chat-search-empty">search the loaded section by message, emote code or username</div>';
      return;
    }
    var matches = loadedPayload.messages.filter(function (message) {
      var user = message.user || {};
      var haystack = [message.text || '', user.displayName || '', user.login || ''].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    }).slice(0, 20);
    if (!matches.length) {
      searchResults.innerHTML = '<div class="chat-search-empty">nothing matched in this loaded section</div>';
      return;
    }
    matches.forEach(function (message) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-search-result';
      button.innerHTML = '<span class="chat-search-time">' + fmt(message.offset || 0) + '</span><span class="chat-search-copy"><strong></strong><span></span></span>';
      button.querySelector('strong').textContent = (message.user && message.user.displayName) || (message.user && message.user.login) || 'viewer';
      button.querySelector('.chat-search-copy span').textContent = message.text || '(emote)';
      button.addEventListener('click', function () { seekMessage(message); });
      searchResults.appendChild(button);
    });
  }

  searchInput.addEventListener('input', renderSearch);
  searchClear.addEventListener('click', function () { searchInput.value = ''; renderSearch(); searchInput.focus(); });

  function enforcePreviewLimits() {
    var limit = Math.max(3, Math.min(7, Number(maxVisible.value || 7)));
    var nodes = Array.prototype.filter.call(stack.querySelectorAll('.chat-message'), function (node) {
      return !node.classList.contains('leaving') && node.isConnected;
    });
    while (nodes.length > limit) {
      var node = nodes.shift();
      node.classList.add('leaving');
      window.setTimeout(function (target) { if (target && target.parentNode) target.remove(); }, 190, node);
    }
  }

  function scheduleLifetime(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var seconds = Math.max(4, Math.min(12, Number(lifetime.value || 12)));
    if (seconds >= 11.95) return;
    var old = timers.get(node);
    if (old) clearTimeout(old);
    var timer = setTimeout(function () {
      if (!node.isConnected) return;
      node.classList.add('leaving');
      setTimeout(function () { if (node.parentNode) node.remove(); }, 190);
    }, Math.max(0, seconds * 1000 - 180));
    timers.set(node, timer);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], scheduleLifetime);
    });
    enforcePreviewLimits();
  }).observe(stack, { childList: true });

  maxVisible.addEventListener('change', enforcePreviewLimits);

  function reloadCurrentChat() {
    if (loadedPayload && !loadBtn.disabled) loadBtn.click();
  }
  timingMode.addEventListener('change', reloadCurrentChat);
  hideBots.addEventListener('change', reloadCurrentChat);

  // Chain after the existing style/sound fetch wrapper. Capture settings apply to
  // both preview and export so what the user sees remains WYSIWYG.
  var upstreamFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    var isCapture = url.indexOf('/api/chat/twitch') !== -1;
    var isExport = url.indexOf('/api/chat/export') !== -1;
    if ((isCapture || isExport) && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.timingMode = timingMode.value === 'original' ? 'original' : 'readable';
        body.hideBots = !!hideBots.checked;
        if (isExport) {
          body.maxVisible = Math.max(3, Math.min(7, Number(maxVisible.value || 7)));
          body.messageLifetime = Math.max(4, Math.min(12, Number(lifetime.value || 12)));
        }
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    var responsePromise = upstreamFetch.call(window, resource, init);
    if (isCapture) {
      responsePromise.then(function (response) {
        if (!response || !response.ok) return;
        response.clone().json().then(function (body) {
          if (!body || !Array.isArray(body.messages)) return;
          loadedPayload = body;
          renderSearch();
        }).catch(function () {});
      }).catch(function () {});
    }
    return responsePromise;
  };

  renderSearch();
})();
