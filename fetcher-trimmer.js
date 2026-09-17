/*
 * fetcher-trimmer.js
 * Smart inline scrub-to-trim viewer.
 *
 * Fetcher still calls open() whenever a video-capable provider is detected, but
 * this module first asks the backend whether a trimmer is useful. Short/light
 * video stays out of the way. Audio only gets a trimmer at 10+ minutes, where
 * the panel becomes an audio player with a real source-derived waveform.
 */
(function (global) {
  'use strict';

  var mountEl = null, dom = null, hls = null;
  var duration = 0, startT = 0, endT = 0, curT = 0;
  var dragging = null, seekPending = false;
  var candidateUrl = null, candidateProvider = '', activeUrl = null;
  var activeMode = null, ready = false, inspectSeq = 0, waveform = [];

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

  function currentMode() {
    var active = document.querySelector('.seg-btn[aria-pressed="true"]');
    return active && active.dataset.mode === 'audio' ? 'audio' : 'video';
  }

  function currentVideoQuality() {
    try {
      if (global.FetcherPrefs && global.FetcherPrefs.get) {
        return global.FetcherPrefs.get('fetcher.videoQuality') || 'best';
      }
    } catch (e) {}
    return 'best';
  }

  function markedUrl(url, mode) {
    var sep = url.indexOf('#') === -1 ? '#' : '&';
    return url + sep +
      '__fetcher_mode=' + encodeURIComponent(mode) +
      '&__fetcher_vq=' + encodeURIComponent(currentVideoQuality());
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
          '<span class="trim-badge"></span>' +
        '</div>' +
        '<div class="trim-video-wrap">' +
          '<video class="trim-video" playsinline preload="metadata"></video>' +
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
          '<canvas class="trim-waveform" aria-hidden="true"></canvas>' +
          '<div class="trim-range"></div><div class="trim-playhead"></div>' +
          '<div class="trim-handle trim-handle-start" data-handle="start" role="slider" tabindex="0" aria-label="Start point"></div>' +
          '<div class="trim-handle trim-handle-end" data-handle="end" role="slider" tabindex="0" aria-label="End point"></div>' +
        '</div></div>' +
        '<div class="trim-foot">' +
          '<div class="trim-readout">' +
            '<input class="trim-time-input trim-in-start" type="text" aria-label="start time" inputmode="numeric" value="0:00">' +
            '<span class="trim-dash">–</span>' +
            '<input class="trim-time-input trim-in-end" type="text" aria-label="end time" inputmode="numeric" value="0:00">' +
            '<span class="trim-sel-dur"></span>' +
          '</div>' +
          '<span class="trim-hint">space play · ←/→ seek (⇧ = 5s) · I / O set start/end · or drag &amp; type</span>' +
        '</div>' +
      '</div>';

    dom = {
      media: inner.querySelector('.trim-video'),
      videoWrap: inner.querySelector('.trim-video-wrap'),
      loading: inner.querySelector('.trim-loading'),
      loadingText: inner.querySelector('.trim-loading-text'),
      title: inner.querySelector('.trim-title'),
      badge: inner.querySelector('.trim-badge'),
      play: inner.querySelector('.trim-play'),
      cur: inner.querySelector('.trim-cur'),
      dur: inner.querySelector('.trim-dur'),
      track: inner.querySelector('.trim-track'),
      waveform: inner.querySelector('.trim-waveform'),
      range: inner.querySelector('.trim-range'),
      playhead: inner.querySelector('.trim-playhead'),
      hStart: inner.querySelector('.trim-handle-start'),
      hEnd: inner.querySelector('.trim-handle-end'),
      inStart: inner.querySelector('.trim-in-start'),
      inEnd: inner.querySelector('.trim-in-end'),
      selDur: inner.querySelector('.trim-sel-dur')
    };

    dom.play.addEventListener('click', function () {
      if (dom.media.paused) {
        var p = dom.media.play();
        if (p && p.catch) p.catch(function () {});
      } else dom.media.pause();
    });
    dom.media.addEventListener('play', function () { dom.play.classList.add('playing'); });
    dom.media.addEventListener('pause', function () { dom.play.classList.remove('playing'); });
    dom.media.addEventListener('timeupdate', function () {
      curT = dom.media.currentTime;
      dom.cur.textContent = fmt(curT);
      position();
    });

    dom.track.addEventListener('pointerdown', function (e) {
      if (e.target.hasAttribute('data-handle')) return;
      seekTo(timeAt(e.clientX));
    });

    [dom.hStart, dom.hEnd].forEach(function (h) {
      var which = h.getAttribute('data-handle');
      h.addEventListener('pointerdown', function (e) {
        dragging = which;
        h.classList.add('dragging');
        try { h.setPointerCapture(e.pointerId); } catch (x) {}
        e.preventDefault();
      });
      h.addEventListener('pointermove', function (e) {
        if (dragging !== which) return;
        setEdge(which, timeAt(e.clientX));
        previewSeek(which === 'start' ? startT : endT);
      });
      var stop = function (e) {
        if (dragging === which) {
          dragging = null;
          h.classList.remove('dragging');
          try { h.releasePointerCapture(e.pointerId); } catch (x) {}
        }
      };
      h.addEventListener('pointerup', stop);
      h.addEventListener('pointercancel', stop);
    });

    function commit(input, which) {
      input.addEventListener('change', function () {
        var t = parse(input.value);
        if (t == null) {
          input.value = fmt(which === 'start' ? startT : endT);
          return;
        }
        setEdge(which, t);
        previewSeek(which === 'start' ? startT : endT);
      });
    }
    commit(dom.inStart, 'start');
    commit(dom.inEnd, 'end');

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      var t = e.target, tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      var onHandle = t === dom.hStart ? 'start' : (t === dom.hEnd ? 'end' : null);
      var step = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case ' ': case 'Spacebar':
          if (tag === 'BUTTON') return;
          e.preventDefault();
          if (dom.media.paused) {
            var p = dom.media.play();
            if (p && p.catch) p.catch(function () {});
          } else dom.media.pause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (onHandle) {
            setEdge(onHandle, (onHandle === 'start' ? startT : endT) + step);
            previewSeek(onHandle === 'start' ? startT : endT);
          } else seekTo(Math.min(duration, curT + step));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (onHandle) {
            setEdge(onHandle, (onHandle === 'start' ? startT : endT) - step);
            previewSeek(onHandle === 'start' ? startT : endT);
          } else seekTo(Math.max(0, curT - step));
          break;
        case 'i': case 'I': e.preventDefault(); setEdge('start', curT); break;
        case 'o': case 'O': e.preventDefault(); setEdge('end', curT); break;
        case 'Home': e.preventDefault(); seekTo(startT); break;
        case 'End': e.preventDefault(); seekTo(endT); break;
      }
    });

    // Changing Video/Audio should immediately re-evaluate the same pasted URL.
    Array.prototype.slice.call(document.querySelectorAll('.seg-btn')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!candidateUrl) return;
        window.setTimeout(function () {
          if (candidateUrl) inspectAndMaybeOpen(candidateUrl, candidateProvider, true);
        }, 0);
      });
    });

    global.addEventListener('resize', function () {
      if (isOpen()) {
        position();
        drawWaveform();
      }
    });
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
    if (!dom) return;
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
    if (seekPending) {
      previewSeek._next = t;
      return;
    }
    seekPending = true;
    requestAnimationFrame(function () {
      seekPending = false;
      try { dom.media.currentTime = t; } catch (e) {}
      if (previewSeek._next != null) {
        var n = previewSeek._next;
        previewSeek._next = null;
        previewSeek(n);
      }
    });
  }

  function seekTo(t) {
    curT = t;
    try { dom.media.currentTime = t; } catch (e) {}
    position();
  }

  function syncNativeDuration() {
    var nativeDuration = dom && dom.media ? Number(dom.media.duration) : 0;
    if ((!duration || duration <= 0) && isFinite(nativeDuration) && nativeDuration > 0) {
      duration = nativeDuration;
      endT = duration;
      dom.dur.textContent = fmt(duration);
      ready = true;
      position();
    }
  }

  function showError(msg) {
    if (!dom) return;
    if (activeMode === 'audio') return; // keep the waveform/timestamps useful
    dom.loading.hidden = false;
    dom.loading.classList.add('err');
    dom.loadingText.textContent = msg;
  }

  function teardown() {
    if (hls) {
      try { hls.destroy(); } catch (e) {}
      hls = null;
    }
    if (dom) {
      try { dom.media.pause(); } catch (e) {}
      dom.media.removeAttribute('src');
      dom.media.load();
      dom.play.classList.remove('playing');
    }
  }

  function hidePanel(keepCandidate) {
    if (!mountEl) return;
    mountEl.classList.remove('open');
    mountEl.removeAttribute('data-kind');
    if (!keepCandidate) {
      mountEl.removeAttribute('data-provider');
      candidateUrl = null;
      candidateProvider = '';
    }
    activeUrl = null;
    activeMode = null;
    ready = false;
    waveform = [];
    teardown();
  }

  function drawWaveform() {
    if (!dom || !dom.waveform || activeMode !== 'audio') return;
    var canvas = dom.waveform;
    var rect = canvas.getBoundingClientRect();
    var ratio = global.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(rect.width * ratio));
    var h = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!waveform || !waveform.length) return;

    var style = getComputedStyle(mountEl);
    var color = style.getPropertyValue('--trim-provider-rim').trim() || style.getPropertyValue('--accent').trim() || '#777';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.58;
    var mid = h / 2;
    var step = w / waveform.length;
    var barW = Math.max(1 * ratio, step * 0.58);
    for (var i = 0; i < waveform.length; i++) {
      var amp = Math.max(0.04, Number(waveform[i]) || 0);
      var barH = Math.max(2 * ratio, amp * h * 0.82);
      ctx.fillRect(i * step + (step - barW) / 2, mid - barH / 2, barW, barH);
    }
  }

  function resetForInfo(info, mode, provider) {
    activeMode = mode;
    duration = Number(info.duration) || 0;
    startT = 0;
    endT = duration;
    curT = 0;
    dragging = null;
    ready = duration > 0;
    waveform = Array.isArray(info.waveform) ? info.waveform : [];

    mountEl.setAttribute('data-kind', mode);
    if (provider) mountEl.setAttribute('data-provider', provider);
    else mountEl.removeAttribute('data-provider');

    dom.loading.hidden = false;
    dom.loading.classList.remove('err');
    dom.loadingText.textContent = mode === 'audio' ? 'drawing waveform…' : 'loading preview…';
    dom.title.textContent = info.title || (mode === 'audio' ? 'audio trim' : 'preview');
    dom.badge.textContent = mode === 'audio' ? 'audio trim' : 'long video';
    dom.selDur.textContent = '';
    dom.cur.textContent = '0:00';
    dom.dur.textContent = fmt(duration);
    mountEl.classList.add('open');
    position();
    requestAnimationFrame(drawWaveform);
  }

  function inspectAndMaybeOpen(url, provider, force) {
    if (!mountEl || !url) return;
    var mode = currentMode();
    if (!force && activeUrl === url && activeMode === mode && isOpen()) return;

    var seq = ++inspectSeq;
    candidateUrl = url;
    candidateProvider = String(provider || '').toLowerCase();

    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: markedUrl(url, mode) })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (result) {
        if (seq !== inspectSeq || candidateUrl !== url) return;
        var info = result.data || {};
        // Previewing is optional. Unsupported, short, or inspection-failed media
        // should simply behave like classic Fetcher with no error card.
        if (!result.ok || !info.show) {
          hidePanel(true);
          return;
        }

        teardown();
        activeUrl = url;
        resetForInfo(info, mode, candidateProvider);

        if (mode === 'audio') {
          playDirect(info.source, true);
          dom.loading.hidden = true;
          return;
        }
        if (info.kind === 'hls') {
          ensureHls(function () {
            if (activeUrl === url) playHls(info.source);
          });
        } else {
          playDirect(info.source, false);
        }
      })
      .catch(function () {
        if (seq === inspectSeq) hidePanel(true);
      });
  }

  function playHls(playlist) {
    var v = dom.media;
    if (global.Hls && global.Hls.isSupported()) {
      hls = new global.Hls({ maxBufferLength: 20 });
      hls.on(global.Hls.Events.MANIFEST_PARSED, function () { dom.loading.hidden = true; });
      hls.on(global.Hls.Events.ERROR, function (e, data) {
        if (data && data.fatal) showError('preview stream unavailable — you can still trim by time below');
      });
      v.addEventListener('loadedmetadata', syncNativeDuration, { once: true });
      hls.loadSource(playlist);
      hls.attachMedia(v);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = playlist;
      v.addEventListener('loadedmetadata', function () {
        syncNativeDuration();
        dom.loading.hidden = true;
      }, { once: true });
      v.load();
    } else {
      showError('this browser can’t preview HLS — you can still trim by time below');
    }
  }

  function playDirect(source, audioOnly) {
    var v = dom.media;
    if (!source) {
      if (!audioOnly) showError('preview unavailable — you can still trim by time below');
      return;
    }
    v.src = source;
    v.addEventListener('loadedmetadata', function () {
      syncNativeDuration();
      if (!audioOnly) dom.loading.hidden = true;
    }, { once: true });
    v.addEventListener('error', function () {
      if (!audioOnly) showError('preview stream unavailable — you can still trim by time below');
    }, { once: true });
    v.load();
  }

  // --- public API --------------------------------------------------------
  function mount(el) {
    mountEl = el;
    build();
  }

  function open(url, provider) {
    inspectAndMaybeOpen(url, provider, false);
  }

  function close() {
    inspectSeq++;
    hidePanel(false);
  }

  function isOpen() {
    return !!(mountEl && mountEl.classList.contains('open'));
  }

  function getSelection() {
    if (!ready || !duration) return null;
    if (startT <= 1 && endT >= duration - 1) return null;
    return { start: startT, end: endT };
  }

  global.FetcherTrimmer = {
    mount: mount,
    open: open,
    close: close,
    isOpen: isOpen,
    getSelection: getSelection
  };
})(window);
