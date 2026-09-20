/* On-demand full-VOD Twitch chat indexing + search. */
(function () {
  'use strict';

  var insights = document.querySelector('.chat-insights-card');
  var loadedResults = document.getElementById('chat-search-results');
  var urlInput = document.getElementById('chat-url');
  var trimMount = document.getElementById('chat-trim-mount');
  if (!insights || !loadedResults || !urlInput || !trimMount) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-fullsearch{margin-top:12px;padding-top:13px;border-top:1px dashed var(--border)}',
    '.chat-fullsearch-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}',
    '.chat-fullsearch-title{display:grid;gap:2px}',
    '.chat-fullsearch-title strong{font-size:10.5px;color:var(--ink)}',
    '.chat-fullsearch-title span{font-size:9.5px;color:var(--ink-faint)}',
    '.chat-fullsearch-index{border:1px solid color-mix(in srgb,#9146ff 36%,var(--border));background:color-mix(in srgb,#9146ff 9%,var(--surface));color:#7a45db;font:inherit;font-size:9.5px;font-weight:850;border-radius:9px;padding:7px 9px;cursor:pointer;white-space:nowrap}',
    '.chat-fullsearch-index:disabled{opacity:.55;cursor:default}',
    '.chat-fullsearch-progress{display:none;margin:7px 0 9px}',
    '.chat-fullsearch-progress.show{display:block}',
    '.chat-fullsearch-status{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;font-size:9.5px;color:var(--ink-faint)}',
    '.chat-fullsearch-status strong{font-size:9px;color:var(--ink-soft);font-variant-numeric:tabular-nums}',
    '.chat-fullsearch-track{height:5px;border-radius:999px;background:var(--border);overflow:hidden}',
    '.chat-fullsearch-fill{height:100%;width:0;border-radius:inherit;background:#9146ff;transition:width .2s ease}',
    '.chat-fullsearch-wrap{display:grid;grid-template-columns:1fr auto;gap:7px}',
    '.chat-fullsearch-wrap input{min-width:0;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit;font-size:11px;padding:9px 10px;outline:0}',
    '.chat-fullsearch-wrap input:focus{border-color:#9146ff;box-shadow:0 0 0 3px color-mix(in srgb,#9146ff 10%,transparent)}',
    '.chat-fullsearch-wrap input:disabled{opacity:.55;cursor:not-allowed}',
    '.chat-fullsearch-clear{border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);font:inherit;font-size:10px;font-weight:800;border-radius:10px;padding:0 9px;cursor:pointer}',
    '.chat-fullsearch-results{display:grid;gap:5px;margin-top:7px;max-height:220px;overflow:auto}',
    '.chat-fullsearch-result{width:100%;display:grid;grid-template-columns:auto 1fr;gap:8px;text-align:left;border:1px solid var(--border);background:var(--bg);color:var(--ink);border-radius:10px;padding:7px 8px;cursor:pointer}',
    '.chat-fullsearch-result:hover{border-color:color-mix(in srgb,#9146ff 45%,var(--border))}',
    '.chat-fullsearch-time{font-size:9.5px;font-weight:850;color:#7a45db;font-variant-numeric:tabular-nums}',
    '.chat-fullsearch-copy{min-width:0;font-size:10.5px;line-height:1.35;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.chat-fullsearch-copy strong{color:var(--ink);margin-right:4px}',
    '.chat-fullsearch-empty{font-size:10px;line-height:1.45;color:var(--ink-faint);padding:4px 2px}',
    '.chat-fullsearch-summary{font-size:9.5px;color:var(--ink-faint);margin:6px 1px 0}',
    '.chat-fullsearch-summary.warn{color:#a36a19}',
    '@media(prefers-reduced-motion:reduce){.chat-fullsearch-fill{transition:none}}'
  ].join('\n');
  document.head.appendChild(css);

  var section = document.createElement('div');
  section.className = 'chat-fullsearch';
  section.innerHTML = [
    '<div class="chat-fullsearch-head">',
      '<div class="chat-fullsearch-title"><strong>search whole VOD</strong><span>message · username · emote code</span></div>',
      '<button class="chat-fullsearch-index" id="chat-fullsearch-index" type="button">index whole VOD</button>',
    '</div>',
    '<div class="chat-fullsearch-progress" id="chat-fullsearch-progress">',
      '<div class="chat-fullsearch-status"><span id="chat-fullsearch-status">waiting…</span><strong id="chat-fullsearch-pct">0%</strong></div>',
      '<div class="chat-fullsearch-track"><div class="chat-fullsearch-fill" id="chat-fullsearch-fill"></div></div>',
    '</div>',
    '<div class="chat-fullsearch-wrap">',
      '<input id="chat-fullsearch-input" type="search" placeholder="index the VOD first…" disabled>',
      '<button class="chat-fullsearch-clear" id="chat-fullsearch-clear" type="button">clear</button>',
    '</div>',
    '<div class="chat-fullsearch-results" id="chat-fullsearch-results"><div class="chat-fullsearch-empty">Index once, then searches across the whole VOD are instant.</div></div>',
    '<div class="chat-fullsearch-summary" id="chat-fullsearch-summary"></div>'
  ].join('');

  loadedResults.insertAdjacentElement('afterend', section);

  var indexBtn = document.getElementById('chat-fullsearch-index');
  var progress = document.getElementById('chat-fullsearch-progress');
  var statusLabel = document.getElementById('chat-fullsearch-status');
  var pctLabel = document.getElementById('chat-fullsearch-pct');
  var fill = document.getElementById('chat-fullsearch-fill');
  var input = document.getElementById('chat-fullsearch-input');
  var clearBtn = document.getElementById('chat-fullsearch-clear');
  var results = document.getElementById('chat-fullsearch-results');
  var summary = document.getElementById('chat-fullsearch-summary');

  var activeVodId = '';
  var ready = false;
  var pollTimer = 0;
  var searchTimer = 0;
  var searchSeq = 0;

  function fmt(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }

  function parseTime(text) {
    var parts = String(text || '').trim().split(':');
    if (!parts.length || parts.length > 3) return 0;
    var total = 0;
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (!isFinite(n) || n < 0) return 0;
      total = total * 60 + n;
    }
    return total;
  }

  function durationNow() {
    var video = trimMount.querySelector('.trim-video');
    if (video && isFinite(video.duration) && video.duration > 1) return Number(video.duration);
    var label = trimMount.querySelector('.trim-dur');
    return label ? parseTime(label.textContent) : 0;
  }

  function vodIdNow() {
    var match = String(urlInput.value || '').match(/twitch\.tv\/videos\/(\d+)/i);
    return match ? match[1] : '';
  }

  function seekAndTrim(seconds) {
    var duration = durationNow();
    seconds = Math.max(0, Number(seconds) || 0);
    var video = trimMount.querySelector('.trim-video');
    if (video) {
      try { video.currentTime = seconds; } catch (e) {}
    }
    var start = trimMount.querySelector('.trim-in-start');
    var end = trimMount.querySelector('.trim-in-end');
    if (start && end && duration > 0) {
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

  function setIndexState(state) {
    var status = state && state.status || 'queued';
    var pct = Math.max(0, Math.min(100, Number(state && state.progress || 0)));
    var count = Number(state && state.indexedMessages || 0);
    progress.classList.add('show');
    pctLabel.textContent = Math.round(pct) + '%';
    fill.style.width = pct + '%';
    ready = status === 'ready';
    input.disabled = !ready;

    if (status === 'ready') {
      activeVodId = state.vodId || activeVodId;
      indexBtn.disabled = true;
      indexBtn.textContent = 'indexed ✓';
      input.placeholder = 'KEKW, username, phrase…';
      statusLabel.textContent = count.toLocaleString() + ' messages indexed';
      pctLabel.textContent = '100%';
      fill.style.width = '100%';
      summary.classList.toggle('warn', !!state.truncated);
      summary.textContent = state.truncated
        ? 'Index reached Fetcher’s 150,000-message safety cap. Search covers everything indexed up to that point.'
        : 'Full-VOD index ready for this session. It stays cached on Fetcher for about an hour.';
      results.innerHTML = '<div class="chat-fullsearch-empty">Type something above to search the entire VOD.</div>';
      return;
    }

    indexBtn.disabled = true;
    indexBtn.textContent = status === 'queued' ? 'queued…' : 'indexing…';
    input.placeholder = 'indexing chat…';
    statusLabel.textContent = status === 'queued'
      ? 'waiting for the chat indexer…'
      : 'reading whole-VOD chat · ' + count.toLocaleString() + ' messages';
    summary.classList.remove('warn');
    summary.textContent = 'You can keep using Fetcher while this runs.';
  }

  function reset() {
    clearTimeout(pollTimer);
    clearTimeout(searchTimer);
    searchSeq++;
    activeVodId = '';
    ready = false;
    indexBtn.disabled = false;
    indexBtn.textContent = 'index whole VOD';
    progress.classList.remove('show');
    statusLabel.textContent = 'waiting…';
    pctLabel.textContent = '0%';
    fill.style.width = '0%';
    input.disabled = true;
    input.value = '';
    input.placeholder = 'index the VOD first…';
    results.innerHTML = '<div class="chat-fullsearch-empty">Index once, then searches across the whole VOD are instant.</div>';
    summary.classList.remove('warn');
    summary.textContent = '';
  }

  function poll() {
    if (!activeVodId) return;
    fetch('/api/chat/index/status/' + encodeURIComponent(activeVodId))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body }; });
      })
      .then(function (result) {
        if (!activeVodId) return;
        if (!result.ok) {
          indexBtn.disabled = false;
          indexBtn.textContent = 'try indexing again';
          statusLabel.textContent = 'index status was lost';
          summary.textContent = 'The temporary index disappeared. Start it again.';
          return;
        }
        var state = result.body || {};
        if (state.status === 'error') {
          indexBtn.disabled = false;
          indexBtn.textContent = 'try indexing again';
          input.disabled = true;
          statusLabel.textContent = state.error || 'indexing failed';
          pctLabel.textContent = '';
          summary.textContent = 'Try again in a moment.';
          return;
        }
        setIndexState(state);
        if (state.status !== 'ready') pollTimer = window.setTimeout(poll, 850);
      })
      .catch(function () {
        if (activeVodId) pollTimer = window.setTimeout(poll, 1200);
      });
  }

  function startIndex() {
    var url = String(urlInput.value || '').trim();
    var vodId = vodIdNow();
    var duration = durationNow();
    if (!vodId) {
      summary.textContent = 'Paste a finished Twitch VOD first.';
      return;
    }
    if (!(duration > 1)) {
      summary.textContent = 'Wait for the VOD preview duration to load, then index it.';
      return;
    }

    activeVodId = vodId;
    ready = false;
    indexBtn.disabled = true;
    indexBtn.textContent = 'starting…';
    progress.classList.add('show');
    statusLabel.textContent = 'starting full-chat index…';
    pctLabel.textContent = '0%';
    fill.style.width = '0%';
    results.innerHTML = '<div class="chat-fullsearch-empty">Fetcher is reading the replay chat once so future searches are instant.</div>';

    fetch('/api/chat/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, duration: duration })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body }; });
    }).then(function (result) {
      if (!result.ok) {
        indexBtn.disabled = false;
        indexBtn.textContent = 'try indexing again';
        statusLabel.textContent = result.body && result.body.error && result.body.error.message || 'couldn’t start indexing';
        pctLabel.textContent = '';
        return;
      }
      var state = result.body || {};
      activeVodId = state.vodId || vodId;
      setIndexState(state);
      if (state.status !== 'ready') pollTimer = window.setTimeout(poll, 600);
    }).catch(function () {
      indexBtn.disabled = false;
      indexBtn.textContent = 'try indexing again';
      statusLabel.textContent = 'couldn’t reach the indexer';
      pctLabel.textContent = '';
    });
  }

  function renderMatches(body) {
    results.innerHTML = '';
    var matches = body && Array.isArray(body.matches) ? body.matches : [];
    var total = Number(body && body.totalMatches || 0);
    if (!matches.length) {
      results.innerHTML = '<div class="chat-fullsearch-empty">No matches anywhere in the indexed VOD.</div>';
    } else {
      matches.forEach(function (message) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-fullsearch-result';
        button.innerHTML = '<span class="chat-fullsearch-time"></span><span class="chat-fullsearch-copy"><strong></strong><span></span></span>';
        button.querySelector('.chat-fullsearch-time').textContent = fmt(message.offset || 0);
        button.querySelector('strong').textContent = message.user && (message.user.displayName || message.user.login) || 'viewer';
        button.querySelector('.chat-fullsearch-copy span').textContent = message.text || '(emote)';
        button.addEventListener('click', function () { seekAndTrim(message.offset || 0); });
        results.appendChild(button);
      });
    }
    summary.classList.toggle('warn', !!(body && body.truncated));
    var shown = matches.length;
    summary.textContent = total.toLocaleString() + ' match' + (total === 1 ? '' : 'es') +
      (total > shown ? ' · showing first ' + shown : '') +
      ' · ' + Number(body && body.indexedMessages || 0).toLocaleString() + ' messages indexed' +
      (body && body.truncated ? ' · safety cap reached' : '');
  }

  function runSearch() {
    var query = String(input.value || '').trim();
    if (!ready) return;
    if (query.length < 2) {
      results.innerHTML = '<div class="chat-fullsearch-empty">Type at least 2 characters to search the whole VOD.</div>';
      return;
    }
    var seq = ++searchSeq;
    results.innerHTML = '<div class="chat-fullsearch-empty">searching whole VOD…</div>';
    fetch('/api/chat/search/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: String(urlInput.value || '').trim(), query: query, limit: 40 })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body }; });
    }).then(function (result) {
      if (seq !== searchSeq) return;
      if (!result.ok) {
        results.innerHTML = '<div class="chat-fullsearch-empty">' +
          String(result.body && result.body.error && result.body.error.message || 'Search failed — try again.') +
          '</div>';
        return;
      }
      renderMatches(result.body || {});
    }).catch(function () {
      if (seq !== searchSeq) return;
      results.innerHTML = '<div class="chat-fullsearch-empty">Couldn’t reach full-chat search — try again.</div>';
    });
  }

  indexBtn.addEventListener('click', startIndex);
  input.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 240);
  });
  clearBtn.addEventListener('click', function () {
    clearTimeout(searchTimer);
    searchSeq++;
    input.value = '';
    results.innerHTML = ready
      ? '<div class="chat-fullsearch-empty">Type something above to search the entire VOD.</div>'
      : '<div class="chat-fullsearch-empty">Index once, then searches across the whole VOD are instant.</div>';
    input.focus();
  });
  urlInput.addEventListener('input', reset);

  reset();
})();
