/*
 * fetcher-trimmer.js
 * A centered modal video viewer with a two-handle timeline for picking a start
 * and end point on a long-form source (Twitch VODs). It plays a preview via
 * hls.js through Fetcher's same-origin HLS proxy (/api/preview/...), so only the
 * segments the user scrubs to are ever loaded — never the whole VOD.
 *
 *   FetcherTrimmer.open(url, function(startSeconds, endSeconds){ ... });
 *
 * The callback fires when the user confirms a section. hls.js is fetched lazily
 * on first open (it's large and only VODs need it).
 */
(function (global) {
  'use strict';

  var dom = null;         // cached modal DOM
  var hls = null;         // active hls.js instance
  var duration = 0;
  var startT = 0, endT = 0, curT = 0;
  var dragging = null;    // 'start' | 'end' | null
  var seekPending = false;
  var onApply = null;

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = (h ? String(m).padStart(2, '0') : String(m));
    var ss = String(sec).padStart(2, '0');
    return (h ? h + ':' : '') + mm + ':' + ss;
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
    if (dom) return dom;
    var el = document.createElement('div');
    el.className = 'trim-modal';
    el.hidden = true;
    el.innerHTML =
      '<div class="trim-scrim" data-close></div>' +
      '<div class="trim-dialog" role="dialog" aria-modal="true" aria-label="Trim a section">' +
        '<div class="trim-head">' +
          '<span class="trim-title"></span>' +
          '<button class="trim-close" data-close aria-label="Close">×</button>' +
        '</div>' +
        '<div class="trim-video-wrap">' +
          '<video class="trim-video" playsinline preload="auto"></video>' +
          '<div class="trim-loading"><span class="spin-ring"></span><span class="trim-loading-text">loading preview…</span></div>' +
        '</div>' +
        '<div class="trim-controls">' +
          '<button class="trim-play" aria-label="Play/pause">' +
            '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' +
          '</button>' +
          '<span class="trim-time"><span class="trim-cur">0:00</span> / <span class="trim-dur">0:00</span></span>' +
        '</div>' +
        '<div class="trim-timeline">' +
          '<div class="trim-track">' +
            '<div class="trim-range"></div>' +
            '<div class="trim-playhead"></div>' +
            '<div class="trim-handle trim-handle-start" data-handle="start" role="slider" aria-label="Start"></div>' +
            '<div class="trim-handle trim-handle-end" data-handle="end" role="slider" aria-label="End"></div>' +
          '</div>' +
        '</div>' +
        '<div class="trim-foot">' +
          '<div class="trim-readout">' +
            '<span>start <b class="trim-start-label">0:00</b></span>' +
            '<span>end <b class="trim-end-label">0:00</b></span>' +
            '<span class="trim-sel-dur"></span>' +
          '</div>' +
          '<div class="trim-actions">' +
            '<button class="trim-btn" data-close>cancel</button>' +
            '<button class="trim-btn primary" data-apply>use section</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    dom = {
      root: el,
      title: el.querySelector('.trim-title'),
      video: el.querySelector('.trim-video'),
      loading: el.querySelector('.trim-loading'),
      loadingText: el.querySelector('.trim-loading-text'),
      play: el.querySelector('.trim-play'),
      cur: el.querySelector('.trim-cur'),
      dur: el.querySelector('.trim-dur'),
      track: el.querySelector('.trim-track'),
      range: el.querySelector('.trim-range'),
      playhead: el.querySelector('.trim-playhead'),
      hStart: el.querySelector('.trim-handle-start'),
      hEnd: el.querySelector('.trim-handle-end'),
      startLabel: el.querySelector('.trim-start-label'),
      endLabel: el.querySelector('.trim-end-label'),
      selDur: el.querySelector('.trim-sel-dur')
    };

    // Close / cancel
    el.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) close();
      if (e.target.hasAttribute('data-apply')) apply();
    });
    document.addEventListener('keydown', function (e) {
      if (!el.hidden && e.key === 'Escape') close();
    });

    // Play/pause (swallow the benign AbortError when a play() is interrupted
    // by a quick pause/seek — Chrome rejects the promise otherwise).
    dom.play.addEventListener('click', function () {
      if (dom.video.paused) {
        var p = dom.video.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        dom.video.pause();
      }
    });
    dom.video.addEventListener('play', function () { dom.play.classList.add('playing'); });
    dom.video.addEventListener('pause', function () { dom.play.classList.remove('playing'); });
    dom.video.addEventListener('timeupdate', function () {
      curT = dom.video.currentTime;
      dom.cur.textContent = fmt(curT);
      position();
    });

    // Track click -> seek playhead (ignore clicks on a handle)
    dom.track.addEventListener('pointerdown', function (e) {
      if (e.target.hasAttribute('data-handle')) return;
      seekTo(timeAt(e.clientX));
    });

    // Handle drag
    [dom.hStart, dom.hEnd].forEach(function (h) {
      h.addEventListener('pointerdown', function (e) {
        dragging = h.getAttribute('data-handle');
        h.classList.add('dragging');
        h.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      h.addEventListener('pointermove', function (e) {
        if (dragging !== h.getAttribute('data-handle')) return;
        var t = timeAt(e.clientX);
        var gap = Math.min(1, duration * 0.001);
        if (dragging === 'start') startT = Math.min(t, endT - gap);
        else endT = Math.max(t, startT + gap);
        startT = Math.max(0, startT); endT = Math.min(duration, endT);
        previewSeek(dragging === 'start' ? startT : endT);
        position();
      });
      var end = function (e) {
        if (dragging === h.getAttribute('data-handle')) {
          dragging = null; h.classList.remove('dragging');
          try { h.releasePointerCapture(e.pointerId); } catch (x) {}
        }
      };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    });

    global.addEventListener('resize', function () { if (!el.hidden) position(); });
    return dom;
  }

  function trackWidth() { return dom.track.clientWidth; }
  function xForTime(t) { return duration > 0 ? (t / duration) * trackWidth() : 0; }
  function timeAt(clientX) {
    var r = dom.track.getBoundingClientRect();
    var frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return frac * duration;
  }

  function position() {
    var xs = xForTime(startT), xe = xForTime(endT);
    dom.hStart.style.left = xs + 'px';
    dom.hEnd.style.left = xe + 'px';
    dom.range.style.left = xs + 'px';
    dom.range.style.width = Math.max(0, xe - xs) + 'px';
    dom.playhead.style.left = xForTime(Math.max(startT, Math.min(endT, curT))) + 'px';
    dom.startLabel.textContent = fmt(startT);
    dom.endLabel.textContent = fmt(endT);
    dom.selDur.textContent = '(' + fmt(Math.max(0, endT - startT)) + ')';
  }

  // Seek the preview to show a frame, coalesced to one seek per frame.
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
    dom.loading.hidden = false;
    dom.loading.classList.add('err');
    dom.loadingText.textContent = msg;
  }

  function teardown() {
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (dom) { try { dom.video.pause(); } catch (e) {} dom.video.removeAttribute('src'); dom.video.load(); }
  }

  function close() {
    teardown();
    if (dom) dom.root.hidden = true;
    onApply = null;
  }

  function apply() {
    var cb = onApply;
    var s = startT, e = endT;
    close();
    if (cb) cb(s, e);
  }

  function open(url, cb) {
    build();
    onApply = cb;
    duration = 0; startT = 0; endT = 0; curT = 0; dragging = null;
    dom.root.hidden = false;
    dom.loading.hidden = false;
    dom.loading.classList.remove('err');
    dom.loadingText.textContent = 'loading preview…';
    dom.title.textContent = '';
    dom.play.classList.remove('playing');

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
        dom.title.textContent = info.title || 'preview';
        duration = info.duration || 0;
        endT = duration;
        dom.dur.textContent = fmt(duration);
        position();
        ensureHls(function () { startPlayback(info.playlist); });
      })
      .catch(function (err) { showError((err && err.message) || 'couldn’t load the preview'); });
  }

  function startPlayback(playlist) {
    var v = dom.video;
    if (global.Hls && global.Hls.isSupported()) {
      hls = new global.Hls({ maxBufferLength: 20 });
      hls.on(global.Hls.Events.MANIFEST_PARSED, function () { dom.loading.hidden = true; });
      hls.on(global.Hls.Events.ERROR, function (e, data) {
        if (data && data.fatal) showError('preview stream error — you can still set times below');
      });
      hls.loadSource(playlist);
      hls.attachMedia(v);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = playlist;                       // Safari native HLS
      v.addEventListener('loadedmetadata', function () { dom.loading.hidden = true; });
    } else {
      showError('this browser can’t preview HLS');
    }
  }

  global.FetcherTrimmer = { open: open };
})(window);
