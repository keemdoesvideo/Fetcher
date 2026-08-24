/*
 * fetcher-main.js
 * Fetch-page controller: service disclosure, mode selection, provider detection,
 * fetch lifecycle, download history, first-fetch delight, first-visit welcome and
 * keyboard shortcuts. Primary rail/navigation state belongs to fetcher-nav.js.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  function afterTwoFrames(fn) {
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }

  function restartClass(el, className, cleanupMs) {
    if (!el) return;
    el.classList.remove(className);
    afterTwoFrames(function () {
      if (!el.isConnected) return;
      el.classList.add(className);
      if (cleanupMs) {
        window.setTimeout(function () { if (el.isConnected) el.classList.remove(className); }, cleanupMs);
      }
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  /* -----------------------------------------------------------------------
     Supported services disclosure
  ----------------------------------------------------------------------- */
  var svcToggle = document.getElementById('services-toggle');
  var svcPanel = document.getElementById('services-panel');
  if (svcToggle && svcPanel) {
    svcToggle.addEventListener('click', function () {
      var open = svcPanel.getAttribute('data-open') === 'true';
      svcPanel.setAttribute('data-open', String(!open));
      svcToggle.setAttribute('aria-expanded', String(!open));
    });
  }

  /* -----------------------------------------------------------------------
     Download mode segmented control
  ----------------------------------------------------------------------- */
  var segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg-btn'));
  var thumb = document.getElementById('seg-thumb');
  var modeColors = { video: 'var(--accent)', audio: 'var(--audio)' };

  function moveThumb(btn, animate) {
    if (!btn || !thumb) return;
    thumb.style.transition = animate === false ? 'none' : '';
    thumb.style.width = btn.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (btn.offsetLeft - 4) + 'px)';
    thumb.style.background = modeColors[btn.dataset.mode] || 'var(--ink)';
    if (animate === false) {
      requestAnimationFrame(function () { if (thumb) thumb.style.transition = ''; });
    }
  }

  function segBtnFor(mode) {
    return segBtns.filter(function (btn) { return btn.dataset.mode === mode; })[0];
  }

  function selectMode(mode, animate) {
    var btn = segBtnFor(mode) || segBtns[0];
    if (!btn) return;
    segBtns.forEach(function (candidate) {
      candidate.setAttribute('aria-pressed', candidate === btn ? 'true' : 'false');
    });
    moveThumb(btn, animate);
  }

  segBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!btn.disabled) selectMode(btn.dataset.mode, true);
    });
  });

  window.addEventListener('resize', function () {
    var active = document.querySelector('.seg-btn[aria-pressed="true"]');
    if (active) moveThumb(active, false);
  });
  requestAnimationFrame(function () { if (segBtns[0]) moveThumb(segBtns[0], false); });

  /* -----------------------------------------------------------------------
     URL input, clipboard and provider detection
  ----------------------------------------------------------------------- */
  var pasteBtn = document.getElementById('paste-btn');
  var pasteLabel = document.getElementById('paste-label');
  var input = document.getElementById('url-input');
  var fetchWrap = document.getElementById('fetch-wrap');
  var fetchBtn = document.getElementById('fetch-btn');
  var fetchProgress = document.getElementById('fetch-progress');
  var progressBar = document.getElementById('fetch-progress-bar');
  var progressPct = document.getElementById('fetch-progress-pct');
  var cancelBtn = document.getElementById('fetch-cancel');
  var statusEl = document.getElementById('fetch-status');
  var statusText = document.getElementById('status-text');

  var busy = false;
  var lastModes = null;
  var detectTimer = null;
  var detectSeq = 0;

  var trimMount = document.getElementById('trim-mount');
  if (window.FetcherTrimmer && trimMount) window.FetcherTrimmer.mount(trimMount);

  function updateFetchVisibility() {
    if (fetchWrap && input) fetchWrap.classList.toggle('show', input.value.trim().length > 0);
  }

  function fmtSecs(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
  }

  function applyLongForm(on) {
    if (!window.FetcherTrimmer) return;
    if (on) window.FetcherTrimmer.open(input.value.trim());
    else window.FetcherTrimmer.close();
  }

  function applyModes(modes) {
    var hasList = modes && modes.length;
    var videoOk = !hasList || modes.indexOf('video') !== -1;
    var audioOk = !hasList || modes.indexOf('audio') !== -1;
    var video = segBtnFor('video'), audio = segBtnFor('audio');
    if (video) video.disabled = !videoOk;
    if (audio) audio.disabled = !audioOk;
    var active = document.querySelector('.seg-btn[aria-pressed="true"]');
    if (active && active.disabled) selectMode(videoOk ? 'video' : 'audio', true);
  }

  function detectProvider() {
    var url = input.value.trim();
    if (!url) {
      lastModes = null;
      applyModes(null);
      applyLongForm(false);
      return;
    }
    var seq = ++detectSeq;
    fetch('/api/detect?url=' + encodeURIComponent(url))
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (seq !== detectSeq) return;
        lastModes = data && data.supported ? data.modes : null;
        if (!busy) {
          applyModes(lastModes);
          applyLongForm(!!(data && data.longForm));
        }
      })
      .catch(function () {});
  }

  function scheduleDetect() {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(detectProvider, 400);
  }

  function restoreModes() {
    if (!input.value.trim()) lastModes = null;
    applyModes(lastModes);
  }

  if (input) {
    input.addEventListener('input', function () {
      updateFetchVisibility();
      scheduleDetect();
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', function () {
      if (!(navigator.clipboard && navigator.clipboard.readText)) {
        input.focus();
        return;
      }
      navigator.clipboard.readText().then(function (text) {
        if (!text) {
          input.focus();
          return;
        }
        input.value = text.trim();
        updateFetchVisibility();
        detectProvider();
        pasteBtn.classList.add('done');
        pasteLabel.textContent = 'pasted';
        setTimeout(function () {
          pasteBtn.classList.remove('done');
          pasteLabel.textContent = 'paste';
        }, 1400);
      }).catch(function () { input.focus(); });
    });
  }

  document.addEventListener('paste', function (event) {
    if (busy) return;
    var active = document.activeElement;
    var tag = active && active.tagName;
    if (active === input || tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return;
    var clipboard = event.clipboardData || window.clipboardData;
    var text = clipboard && clipboard.getData('text');
    if (!text) return;
    event.preventDefault();
    input.value = text.trim();
    input.focus();
    updateFetchVisibility();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* -----------------------------------------------------------------------
     Fetch lifecycle
  ----------------------------------------------------------------------- */
  var POLL_INTERVAL = 350;
  var pollTimer = null;
  var currentJobId = null;
  var cancelled = false;
  var lastFetch = null;

  function buildPreferences(mode) {
    var prefs = { filenameStyle: FetcherPrefs.get('fetcher.filenameStyle') };
    if (mode === 'video') {
      prefs.videoQuality = FetcherPrefs.get('fetcher.videoQuality');
      prefs.videoFormat = FetcherPrefs.get('fetcher.videoFormat');
    } else {
      prefs.audioQuality = FetcherPrefs.get('fetcher.audioQuality');
      prefs.audioFormat = FetcherPrefs.get('fetcher.audioFormat');
    }
    return prefs;
  }

  function getMode() {
    var active = document.querySelector('.seg-btn[aria-pressed="true"]');
    return active ? active.dataset.mode : 'video';
  }

  function setStatus(kind, text) {
    statusEl.classList.add('open');
    statusEl.classList.toggle('success', kind === 'success');
    statusEl.classList.toggle('error', kind === 'error');
    statusText.textContent = text;
  }

  function clearStatus() {
    statusEl.classList.remove('open', 'success', 'error');
    statusText.textContent = '';
  }

  function setBusy(isBusy) {
    busy = isBusy;
    input.disabled = isBusy;
    pasteBtn.disabled = isBusy;
    segBtns.forEach(function (btn) { btn.disabled = isBusy; });
    fetchBtn.disabled = isBusy;
    fetchBtn.classList.toggle('busy', isBusy);
  }

  function showProgress() {
    fetchProgress.classList.add('open');
    fetchProgress.setAttribute('aria-hidden', 'false');
  }

  function hideProgress() {
    fetchProgress.classList.remove('open', 'indeterminate');
    fetchProgress.setAttribute('aria-hidden', 'true');
    progressBar.style.removeProperty('--fetch-progress');
    progressPct.textContent = '';
  }

  function setProgress(pct, indeterminate) {
    fetchProgress.classList.toggle('indeterminate', !!indeterminate);
    if (indeterminate) {
      progressBar.style.removeProperty('--fetch-progress');
      progressPct.textContent = '';
      return;
    }
    pct = Math.max(0, Math.min(100, pct || 0));
    progressBar.style.setProperty('--fetch-progress', String(pct / 100));
    progressPct.textContent = Math.round(pct) + '%';
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function startDownload(jobId, filename) {
    var link = document.createElement('a');
    link.href = '/api/download/' + encodeURIComponent(jobId);
    if (filename) link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function finishSuccess(filename) {
    stopPolling();
    setProgress(100, false);
    setStatus('success', 'fetched!');
    startDownload(currentJobId, filename);
    if (lastFetch) recordHistory(lastFetch.url, filename, lastFetch.mode);
    maybeCelebrateFirstFetch();
    wait(1400).then(function () {
      clearStatus();
      hideProgress();
      setBusy(false);
      input.value = '';
      updateFetchVisibility();
      restoreModes();
      applyLongForm(false);
      input.focus();
    });
  }

  function failFlow(message) {
    stopPolling();
    setProgress(0, false);
    fetchProgress.classList.remove('open');
    setStatus('error', message || 'hmm, couldn’t fetch that — try again');
    wait(2600).then(function () {
      clearStatus();
      hideProgress();
      setBusy(false);
      restoreModes();
    });
  }

  function pollProgress() {
    if (cancelled) return;
    fetch('/api/progress/' + encodeURIComponent(currentJobId))
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (cancelled) return;
        var data = result.data || {};
        if (!result.ok || !data.status) return failFlow(data.error && data.error.message);
        switch (data.status) {
          case 'preparing':
            setStatus('fetching', 'sniffing it out…');
            setProgress(0, true);
            break;
          case 'downloading':
            setStatus('fetching', 'bringing it back…');
            setProgress(data.progress || 0, false);
            break;
          case 'processing':
            setStatus('fetching', 'almost there…');
            setProgress(100, true);
            break;
          case 'ready': return finishSuccess(data.filename);
          case 'error': return failFlow(data.error && data.error.message);
          case 'cancelled': return;
        }
        pollTimer = setTimeout(pollProgress, POLL_INTERVAL);
      })
      .catch(function () {
        if (!cancelled) pollTimer = setTimeout(pollProgress, POLL_INTERVAL);
      });
  }

  function runFetchFlow() {
    if (busy) return;
    var url = input.value.trim();
    if (!url) return;
    var mode = getMode();
    lastFetch = { url: url, mode: mode };
    cancelled = false;
    currentJobId = null;
    setBusy(true);
    showProgress();
    setProgress(0, true);
    setStatus('fetching', 'sniffing it out…');

    var body = { url: url, mode: mode, preferences: buildPreferences(mode) };
    if (window.FetcherTrimmer && window.FetcherTrimmer.isOpen()) {
      var selection = window.FetcherTrimmer.getSelection();
      if (selection) {
        body.start = fmtSecs(selection.start);
        body.end = fmtSecs(selection.end);
      }
      window.FetcherTrimmer.close();
    }

    fetch('/api/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (cancelled) {
          if (result.ok && result.data && result.data.jobId) {
            fetch('/api/cancel/' + encodeURIComponent(result.data.jobId), { method: 'POST' }).catch(function () {});
          }
          return;
        }
        if (!result.ok) return failFlow(result.data && result.data.error && result.data.error.message);
        currentJobId = result.data.jobId;
        pollProgress();
      })
      .catch(function () { if (!cancelled) failFlow(null); });
  }

  function cancelFetch() {
    if (!busy) return;
    cancelled = true;
    stopPolling();
    if (currentJobId) {
      fetch('/api/cancel/' + encodeURIComponent(currentJobId), { method: 'POST' }).catch(function () {});
    }
    setStatus('', 'cancelled');
    setProgress(0, false);
    fetchProgress.classList.remove('open');
    wait(700).then(function () {
      clearStatus();
      hideProgress();
      setBusy(false);
      restoreModes();
      input.focus();
    });
  }

  fetchBtn.addEventListener('click', runFetchFlow);
  cancelBtn.addEventListener('click', cancelFetch);
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') runFetchFlow();
  });

  /* -----------------------------------------------------------------------
     Recent downloads
  ----------------------------------------------------------------------- */
  var HISTORY_KEY = 'fetcher.history';
  var HISTORY_MAX = 25;
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  var dlBubble = document.getElementById('dl-bubble');
  var dlToggle = document.getElementById('dl-bubble-toggle');
  var dlCount = document.getElementById('dl-count');
  var recentList = document.getElementById('recent-list');
  var recentClear = document.getElementById('recent-clear');

  var ICON_VIDEO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="14" height="14" rx="2.5"/><path d="m21 8-4.5 3.2v1.6L21 16V8Z"/></svg>';
  var ICON_AUDIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  var ICON_REDO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  var ICON_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveHistory(items) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch (e) {}
  }

  function recordHistory(url, filename, mode) {
    if (!url) return;
    mode = mode === 'audio' ? 'audio' : 'video';
    var items = loadHistory().filter(function (item) { return !(item.url === url && item.mode === mode); });
    items.unshift({ url: url, filename: filename || '', mode: mode, ts: Date.now() });
    saveHistory(items.slice(0, HISTORY_MAX));
    renderHistory(true);
  }

  function removeHistory(entry) {
    saveHistory(loadHistory().filter(function (item) {
      return !(item.url === entry.url && item.mode === entry.mode && item.ts === entry.ts);
    }));
    renderHistory();
  }

  function prettyHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, '').replace(/^m\./, ''); }
    catch (e) { return 'link'; }
  }

  function stripExt(name) { return name ? name.replace(/\.[a-z0-9]{1,5}$/i, '') : ''; }

  function timeAgo(ts) {
    var seconds = Math.max(0, (Date.now() - ts) / 1000);
    if (seconds < 45) return 'just now';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.round(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.round(seconds / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function burstAt(cx, cy) {
    if (root.getAttribute('data-motion') === 'reduced') return;
    var count = 11;
    for (var i = 0; i < count; i++) {
      var particle = document.createElement('div');
      particle.className = 'dl-particle';
      particle.style.left = cx + 'px';
      particle.style.top = cy + 'px';
      if (i % 4 === 0) particle.style.background = 'var(--ink-soft)';
      var size = (5 + Math.random() * 5).toFixed(1);
      particle.style.width = particle.style.height = size + 'px';
      document.body.appendChild(particle);
      var angle = Math.PI * 2 * (i / count) + (Math.random() - 0.5) * 0.6;
      var distance = 32 + Math.random() * 42;
      var dx = (Math.cos(angle) * distance).toFixed(1);
      var dy = (Math.sin(angle) * distance - 6).toFixed(1);
      particle.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity: 0 }
      ], { duration: 430 + Math.random() * 170, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      (function (el) { setTimeout(function () { el.remove(); }, 660); })(particle);
    }
  }

  function popBubble() {
    var reduce = root.getAttribute('data-motion') === 'reduced';
    if (dlBubble.hidden || reduce) {
      dlBubble.classList.remove('open', 'popping');
      dlToggle.setAttribute('aria-expanded', 'false');
      dlBubble.hidden = true;
      recentList.innerHTML = '';
      return;
    }
    if (dlBubble.classList.contains('popping')) return;
    var rect = dlBubble.getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    dlBubble.classList.add('popping');
    setTimeout(function () {
      dlBubble.classList.remove('popping', 'open');
      dlToggle.setAttribute('aria-expanded', 'false');
      dlBubble.hidden = true;
      recentList.innerHTML = '';
    }, 340);
  }

  function playPopIn() {
    if (root.getAttribute('data-motion') === 'reduced') return;
    restartClass(dlBubble, 'popping-in', root.getAttribute('data-motion') === 'reserved' ? 220 : 480);
  }

  function bounceCount() {
    if (root.getAttribute('data-motion') !== 'full') return;
    restartClass(dlCount, 'bump', 520);
  }

  function renderHistory(animateIn) {
    var items = loadHistory();
    var cutoff = Date.now() - WEEK_MS;
    var active = items.filter(function (item) { return item.ts > cutoff; });
    if (active.length !== items.length) saveHistory(active);
    if (!active.length) {
      popBubble();
      return;
    }

    var wasHidden = dlBubble.hidden;
    dlBubble.hidden = false;
    dlCount.textContent = active.length;
    recentList.innerHTML = '';
    if (animateIn) {
      if (wasHidden) playPopIn();
      else bounceCount();
    }

    active.forEach(function (item) {
      var isAudio = item.mode === 'audio';
      var li = document.createElement('li');
      li.className = 'recent-item';
      li.innerHTML =
        '<button class="recent-refetch" type="button">' +
          '<span class="recent-icon ' + (isAudio ? 'audio' : 'video') + '">' + (isAudio ? ICON_AUDIO : ICON_VIDEO) + '</span>' +
          '<span class="recent-text"><span class="recent-name"></span><span class="recent-meta"></span></span>' +
          '<span class="recent-redo">' + ICON_REDO + '</span>' +
        '</button>' +
        '<button class="recent-remove" type="button" aria-label="Remove from history" title="Remove">' + ICON_X + '</button>';
      var refetchBtn = li.querySelector('.recent-refetch');
      refetchBtn.querySelector('.recent-name').textContent = stripExt(item.filename) || prettyHost(item.url);
      refetchBtn.querySelector('.recent-meta').textContent = prettyHost(item.url) + ' · ' + (isAudio ? 'audio' : 'video') + ' · ' + timeAgo(item.ts);
      refetchBtn.title = 'Re-fetch ' + item.url;
      refetchBtn.addEventListener('click', function () { refetch(item); });
      li.querySelector('.recent-remove').addEventListener('click', function () { removeHistory(item); });
      recentList.appendChild(li);
    });
  }

  function refetch(entry) {
    if (busy) return;
    input.value = entry.url;
    updateFetchVisibility();
    selectMode(entry.mode === 'audio' ? 'audio' : 'video', true);
    detectProvider();
    runFetchFlow();
    input.blur();
  }

  function setDl(open) {
    dlBubble.classList.toggle('open', open);
    dlToggle.setAttribute('aria-expanded', String(open));
  }
  function dlOpen() { return dlBubble.classList.contains('open'); }

  if (recentClear) recentClear.addEventListener('click', function () { saveHistory([]); renderHistory(); });
  dlToggle.addEventListener('click', function (event) { event.stopPropagation(); setDl(!dlOpen()); });
  document.addEventListener('click', function (event) { if (dlOpen() && !dlBubble.contains(event.target)) setDl(false); });
  renderHistory();

  /* -----------------------------------------------------------------------
     First successful fetch delight
  ----------------------------------------------------------------------- */
  function maybeCelebrateFirstFetch() {
    try {
      if (localStorage.getItem('fetcher.firstFetchDone')) return;
      localStorage.setItem('fetcher.firstFetchDone', '1');
    } catch (e) {}
    celebrateFirstFetch();
  }

  function celebrateFirstFetch() {
    var reduce = root.getAttribute('data-motion') === 'reduced';
    var stage = document.querySelector('.stage') || document.querySelector('.main');
    var rect = stage ? stage.getBoundingClientRect() : { left: 0, width: window.innerWidth };
    var cx = rect.left + rect.width / 2;
    var cy = window.innerHeight * 0.32;
    var msg = document.createElement('div');
    msg.className = 'celebrate-msg';
    msg.style.left = cx + 'px';
    msg.innerHTML = '<div class="celebrate-title">your first fetch! 🎉</div><div class="celebrate-sub">nicely done. welcome aboard.</div>';
    document.body.appendChild(msg);
    requestAnimationFrame(function () { msg.classList.add('show'); });
    setTimeout(function () {
      msg.classList.remove('show');
      setTimeout(function () { msg.remove(); }, 420);
    }, 2400);
    if (reduce) return;

    var colors = ['var(--accent)', 'var(--audio)', 'var(--success)', 'var(--accent-ink)', 'var(--ink-soft)'];
    for (var i = 0; i < 30; i++) {
      var confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = cx + 'px';
      confetti.style.top = cy + 'px';
      confetti.style.background = colors[i % colors.length];
      var width = 6 + Math.random() * 6;
      confetti.style.width = width.toFixed(1) + 'px';
      confetti.style.height = (width * 0.6).toFixed(1) + 'px';
      confetti.style.borderRadius = Math.random() < 0.5 ? '2px' : '50%';
      document.body.appendChild(confetti);
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      var speed = 130 + Math.random() * 190;
      var dx = Math.cos(angle) * speed;
      var peakY = Math.sin(angle) * speed;
      var fall = window.innerHeight * 0.7 + Math.random() * 220;
      var rotation = (Math.random() * 720 - 360).toFixed(0) + 'deg';
      (function (el, x, y, drop, rot) {
        el.animate([
          { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(-50%,-50%) translate(' + (x * 0.5).toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot + ')', opacity: 1, offset: 0.35 },
          { transform: 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + drop.toFixed(1) + 'px) rotate(' + rot + ')', opacity: 0 }
        ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.5,.5,1)', fill: 'forwards' });
        setTimeout(function () { el.remove(); }, 2400);
      })(confetti, dx, peakY, fall, rotation);
    }
  }

  /* -----------------------------------------------------------------------
     First-visit welcome
  ----------------------------------------------------------------------- */
  (function initWelcome() {
    var welcome = document.getElementById('welcome');
    var card = welcome && welcome.querySelector('.welcome-card');
    var button = welcome && welcome.querySelector('#welcome-btn');
    if (!welcome || !card || !button) return;

    var K_SEEN = 'fetcher.welcomed';
    var K_TOKEN = 'fetcher.visitorToken';
    var K_NUM = 'fetcher.visitorNumber';

    card.setAttribute('aria-describedby', 'welcome-copy');

    /* Repair the one old failure mode: previous builds could set the seen flag
       even when the claim request failed, leaving no visitor number behind. */
    try {
      if (localStorage.getItem(K_SEEN) && !localStorage.getItem(K_NUM)) localStorage.removeItem(K_SEEN);
    } catch (e) {}

    function ordinal(n) {
      var suffixes = ['th', 'st', 'nd', 'rd'], v = n % 100;
      return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    }

    var dismissed = false;
    function focusFetchFieldSoon() {
      setTimeout(function () { if (input && !input.disabled) input.focus(); }, 330);
    }

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      welcome.classList.remove('in');
      welcome.style.pointerEvents = 'none';
      focusFetchFieldSoon();
      setTimeout(function () { if (welcome.parentNode) welcome.remove(); }, 320);
    }

    function focusables() {
      return Array.prototype.filter.call(card.querySelectorAll(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'
      ), function (node) { return node.getClientRects().length > 0; });
    }

    function showWelcome(num, cap) {
      document.getElementById('welcome-num').textContent = '#' + num;
      document.getElementById('welcome-title').textContent = num === 1 ? "you're the very first here" : "you're the " + ordinal(num) + ' person here';
      document.getElementById('welcome-copy').textContent = "thanks so much for using my tool. you're one of the first " + cap + ' people to ever open fetcher.';
      welcome.hidden = false;
      afterTwoFrames(function () {
        if (!welcome.isConnected) return;
        welcome.classList.add('in');
        try { button.focus(); } catch (e) {}
      });
    }

    button.addEventListener('click', dismiss);
    welcome.addEventListener('click', function (event) {
      if (!event.target.closest('.welcome-card')) dismiss();
    });

    document.addEventListener('keydown', function (event) {
      if (welcome.hidden || !welcome.classList.contains('in')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
        return;
      }
      if (event.key !== 'Tab') return;
      var list = focusables();
      if (!list.length) {
        event.preventDefault();
        button.focus();
        return;
      }
      var first = list[0], last = list[list.length - 1], active = document.activeElement;
      if (event.shiftKey && (active === first || !card.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !card.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }, true);

    document.addEventListener('focusin', function (event) {
      if (welcome.hidden || !welcome.classList.contains('in') || card.contains(event.target)) return;
      button.focus();
    }, true);

    if (/(?:^|[?&])welcome(?:=|&|$)/.test(location.search) || location.hash === '#welcome') {
      var previewNumber = 1;
      try { previewNumber = parseInt(localStorage.getItem(K_NUM), 10) || 1; } catch (e) {}
      showWelcome(previewNumber, 100);
      return;
    }

    var seen;
    try { seen = localStorage.getItem(K_SEEN); } catch (e) { seen = '1'; }
    if (seen) return;

    var token = '';
    try {
      token = localStorage.getItem(K_TOKEN);
      if (!token) {
        token = self.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem(K_TOKEN, token);
      }
    } catch (e) { token = ''; }

    fetch('/api/visits/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    })
      .then(function (response) {
        if (!response.ok) throw new Error('visitor claim failed');
        return response.json();
      })
      .then(function (data) {
        try {
          localStorage.setItem(K_SEEN, '1');
          if (data && data.number) localStorage.setItem(K_NUM, String(data.number));
        } catch (e) {}
        if (data && data.withinFirst) showWelcome(data.number, data.capacity || 100);
      })
      .catch(function () {
        /* Deliberately leave K_SEEN unset: a transient server failure retries next visit. */
      });
  })();

  /* -----------------------------------------------------------------------
     Keyboard shortcuts + shortcuts glass
  ----------------------------------------------------------------------- */
  var kbdBubble = document.getElementById('kbd-bubble');
  var kbdToggle = document.getElementById('kbd-bubble-toggle');

  function setHelp(open) {
    kbdBubble.classList.toggle('open', open);
    kbdToggle.setAttribute('aria-expanded', String(open));
  }
  function helpOpen() { return kbdBubble.classList.contains('open'); }
  function toggleHelp(show) { setHelp(show === undefined ? !helpOpen() : show); }

  kbdToggle.addEventListener('click', function (event) { event.stopPropagation(); toggleHelp(); });
  document.addEventListener('click', function (event) { if (helpOpen() && !kbdBubble.contains(event.target)) setHelp(false); });

  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var tag = target.tagName;
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;

    if (event.key === '?' && !typing) {
      event.preventDefault();
      toggleHelp();
      return;
    }

    if (event.key === 'Escape') {
      if (dlOpen()) { setDl(false); return; }
      if (helpOpen()) { setHelp(false); return; }
      if (busy) { cancelFetch(); return; }
      if (input.value) {
        input.value = '';
        updateFetchVisibility();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    if (event.key === '/' && !typing) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });

  updateFetchVisibility();
})();
