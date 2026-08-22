/*
 * fetcher-trimmer.js
 * Inline scrub-to-trim viewer. Mounts above the URL bar and expands into view
 * when a long-form source (Twitch VOD) is recognised; collapses on fetch. Plays
 * a preview via hls.js through Fetcher's same-origin HLS proxy (/api/preview),
 * so only the segments the user scrubs to are ever loaded — never the whole VOD.
 *
 *   FetcherTrimmer.mount(mountEl);      // once, on load
 *   FetcherTrimmer.open(url);           // when a VOD is detected
 *   FetcherTrimmer.close();             // when it isn't / on fetch
 *   FetcherTrimmer.isOpen();            // bool
 *   FetcherTrimmer.getSelection();      // {start,end} seconds, or null (= whole)
 *
 * hls.js is fetched lazily on first open (it's large and only VODs need it).
 */
(function (global) {
  'use strict';

  var mountEl = null, dom = null, hls = null;
  var duration = 0, startT = 0, endT = 0, curT = 0;
  var dragging = null, seekPending = false;
  var currentUrl = null, ready = false;

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
  }
  function parse(v) {
    if (v == null) return null;
    v = String(v).trim();
    if (!v) return null;
    var parts = v.split(':');
    if (parts.length > 3) return null;
    var total = 0;
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (isNaN(n) || n < 0) return null;
      total = total * 60 + n;
    }
    return total;
  }

  function ensureHls(cb) {
    if (global.Hls) return cb();
    var s = document.createElement('script');
    s.src = '/hls.min.js';
    s.onload = function () { cb(); };
    s.onerror = function () { showError('couldn’t load the video player'); };
    document.head.appendChild(s);
  }

  function build() {
    var inner = mountEl.querySelector('.trim-mount-inner');
    inner.innerHTML =
      '<div class="trim-panel">' +
        '<div class="trim-head">' +
          '<span class="trim-head-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M17 4v16M3 8h4M17 8h4M3 16h4M17 16h4M4 4h16v16H4z"/></svg></span>' +
          '<span class="trim-title">preview</span>' +
        '</div>' +
        '<div class="trim-video-wrap">' +
          '<video class="trim-video" playsinline preload="auto"></video>' +
          '<div class="trim-loading"><span class="spin-ring"></span><span class="trim-loading-text">loading preview…</span></div>' +
        '</div>' +
        '<div class="trim-controls">' +
          '<button class="trim-play" type="button" aria-label="Play/pause">' +
            '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' +
          '</button>' +
          '<span class="trim-time"><span class="trim-cur">0:00</span> / <span class="trim-dur">0:00</span></span>' +
        '</div>' +
        '<div class="trim-timeline"><div class="trim-track">' +
          '<div class="trim-range"></div><div class="trim-playhead"></div>' +
          '<div class="trim-handle trim-handle-start" data-handle="start"></div>' +
          '<div class="trim-handle trim-handle-end" data-handle="end"></div>' +
        '</div></div>' +
        '<div class="trim-foot">' +
          '<div class="trim-readout">' +
            '<input class="trim-time-input trim-in-start" type="text" aria-label="start time" inputmode="numeric" value="0:00">' +
            '<span class="trim-dash">–</span>' +
            '<input class="trim-time-input trim-in-end" type="text" aria-label="end time" inputmode="numeric" value="0:00">' +
            '<span class="trim-sel-dur"></span>' +
          '</div>' +
          '<span class="trim-hint">drag the handles or type times · leave full for the whole vod</span>' +
        '</div>' +
      '</div>';

    dom = {
      video: inner.querySelector('.trim-video'),
      loading: inner.querySelector('.trim-loading'),
      loadingText: inner.querySelector('.trim-loading-text'),
      title: inner.querySelector('.trim-title'),
      play: inner.querySelector('.trim-play'),
      cur: inner.querySelector('.trim-cur'),
      dur: inner.querySelector('.trim-dur'),
      track: inner.querySelector('.trim-track'),
      range: inner.querySelector('.trim-range'),
      playhead: inner.querySelector('.trim-playhead'),
      hStart: inner.querySelector('.trim-handle-start'),
      hEnd: inner.querySelector('.trim-handle-end'),
      inStart: inner.querySelector('.trim-in-start'),
      inEnd: inner.querySelector('.trim-in-end'),
      selDur: inner.querySelector('.trim-sel-dur')
    };

    dom.play.addEventListener('click', function () {
      if (dom.video.paused) { var p = dom.video.play(); if (p && p.catch) p.catch(function () {}); }
      else dom.video.pause();
    });
    dom.video.addEventListener('play', function () { dom.play.classList.add('playing'); });
    dom.video.addEventListener('pause', function () { dom.play.classList.remove('playing'); });
    dom.video.addEventListener('timeupdate', function () {
      curT = dom.video.currentTime; dom.cur.textContent = fmt(curT); position();
    });

    dom.track.addEventListener('pointerdown', function (e) {
      if (e.target.hasAttribute('data-handle')) return;
      seekTo(timeAt(e.clientX));
    });
    [dom.hStart, dom.hEnd].forEach(function (h) {
      var which = h.getAttribute('data-handle');
      h.addEventListener('pointerdown', function (e) {
        dragging = which; h.classList.add('dragging');
        try { h.setPointerCapture(e.pointerId); } catch (x) {}
        e.preventDefault();
      });
      h.addEventListener('pointermove', function (e) {
        if (dragging !== which) return;
        setEdge(which, timeAt(e.clientX));
        previewSeek(which === 'start' ? startT : endT);
      });
      var stop = function (e) {
        if (dragging === which) { dragging = null; h.classList.remove('dragging'); try { h.releasePointerCapture(e.pointerId); } catch (x) {} }
      };
      h.addEventListener('pointerup', stop);
      h.addEventListener('pointercancel', stop);
    });

    function commit(input, which) {
      input.addEventListener('change', function () {
        var t = parse(input.value);
        if (t == null) { input.value = fmt(which === 'start' ? startT : endT); return; }
        setEdge(which, t); previewSeek(which === 'start' ? startT : endT);
      });
    }
    commit(dom.inStart, 'start');
    commit(dom.inEnd, 'end');

    global.addEventListener('resize', function () { if (isOpen()) position(); });
  }

  function setEdge(which, t) {
    var gap = Math.min(1, duration * 0.001);
    if (which === 'start') startT = Math.max(0, Math.min(t, endT - gap));
    else endT = Math.min(duration, Math.max(t, startT + gap));
    position();
  }

  function trackW() { return dom.track.clientWidth; }
  function xFor(t) { return duration > 0 ? (t / duration) * trackW() : 0; }
  function timeAt(clientX) {
    var r = dom.track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  }
  function position() {
    var xs = xFor(startT), xe = xFor(endT);
    dom.hStart.style.left = xs + 'px';
    dom.hEnd.style.left = xe + 'px';
    dom.range.style.left = xs + 'px';
    dom.range.style.width = Math.max(0, xe - xs) + 'px';
    dom.playhead.style.left = xFor(Math.max(startT, Math.min(endT, curT))) + 'px';
    if (document.activeElement !== dom.inStart) dom.inStart.value = fmt(startT);
    if (document.activeElement !== dom.inEnd) dom.inEnd.value = fmt(endT);
    dom.selDur.textContent = '(' + fmt(Math.max(0, endT - startT)) + ')';
  }
  function previewSeek(t) {
    if (seekPending) { previewSeek._next = t; return; }
    seekPending = true;
    requestAnimationFrame(function () {
      seekPending = false;
      try { dom.video.currentTime = t; } catch (e) {}
      if (previewSeek._next != null) { var n = previewSeek._next; previewSeek._next = null; previewSeek(n); }
    });
  }
  function seekTo(t) { curT = t; try { dom.video.currentTime = t; } catch (e) {} position(); }

  function showError(msg) {
    if (!dom) return;
    dom.loading.hidden = false; dom.loading.classList.add('err'); dom.loadingText.textContent = msg;
  }
  function teardown() {
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (dom) { try { dom.video.pause(); } catch (e) {} dom.video.removeAttribute('src'); dom.video.load(); }
  }

  // --- public API --------------------------------------------------------
  function mount(el) { mountEl = el; build(); }

  function open(url) {
    if (!mountEl) return;
    if (currentUrl === url && mountEl.classList.contains('open')) return;  // already showing this
    currentUrl = url; ready = false;
    duration = 0; startT = 0; endT = 0; curT = 0; dragging = null;
    teardown();
    dom.loading.hidden = false; dom.loading.classList.remove('err');
    dom.loadingText.textContent = 'loading preview…';
    dom.title.textContent = 'preview'; dom.play.classList.remove('playing');
    dom.selDur.textContent = ''; dom.dur.textContent = '0:00';
    mountEl.classList.add('open');

    fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error((d.error && d.error.message) || 'preview failed');
          return d;
        });
      })
      .then(function (info) {
        if (currentUrl !== url) return;                 // URL changed while loading
        dom.title.textContent = info.title || 'preview';
        duration = info.duration || 0; endT = duration;
        dom.dur.textContent = fmt(duration); ready = true; position();
        ensureHls(function () { if (currentUrl === url) play(info.playlist); });
      })
      .catch(function (err) { showError((err && err.message) || 'couldn’t load the preview'); });
  }

  function play(playlist) {
    var v = dom.video;
    if (global.Hls && global.Hls.isSupported()) {
      hls = new global.Hls({ maxBufferLength: 20 });
      hls.on(global.Hls.Events.MANIFEST_PARSED, function () { dom.loading.hidden = true; });
      hls.on(global.Hls.Events.ERROR, function (e, data) {
        if (data && data.fatal) showError('preview stream error — you can still set times below');
      });
      hls.loadSource(playlist); hls.attachMedia(v);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = playlist; v.addEventListener('loadedmetadata', function () { dom.loading.hidden = true; });
    } else {
      showError('this browser can’t preview HLS');
    }
  }

  function close() {
    if (!mountEl) return;
    mountEl.classList.remove('open');
    currentUrl = null; ready = false;
    teardown();
  }

  function isOpen() { return !!(mountEl && mountEl.classList.contains('open')); }

  function getSelection() {
    if (!ready || !duration) return null;
    // Treat "handles at the extremes" as the whole VOD (no trim).
    if (startT <= 1 && endT >= duration - 1) return null;
    return { start: startT, end: endT };
  }

  global.FetcherTrimmer = { mount: mount, open: open, close: close, isOpen: isOpen, getSelection: getSelection };
})(window);
