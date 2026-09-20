/* Twitch chat-activity graph embedded directly into Fetcher's video scrubber. */
(function () {
  'use strict';

  var mount = document.getElementById('chat-trim-mount');
  var urlInput = document.getElementById('chat-url');
  if (!mount || !urlInput) return;

  var css = document.createElement('style');
  css.textContent = [
    /* The standalone first-pass heatmap is replaced by the scrubber graph. */
    '.chat-insights-card .chat-scan-btn,.chat-insights-card .chat-heatmap,.chat-insights-card .chat-peak-row,.chat-insights-card .chat-heat-note{display:none!important}',
    '.chat-insights-card .chat-insights-head{margin-bottom:8px}',

    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-timeline{position:relative}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-track{height:62px;overflow:hidden;border:1px solid color-mix(in srgb,#9146ff 18%,var(--border));background:color-mix(in srgb,#9146ff 4%,var(--rail))}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-track::before{top:auto;bottom:8px;height:1px;transform:none;z-index:1;background:color-mix(in srgb,#9146ff 25%,var(--ink));opacity:.28}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-range{top:0;height:100%;transform:none;border-radius:7px;background:color-mix(in srgb,#9146ff 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#9146ff 24%,transparent);opacity:1;z-index:2}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-playhead{top:5px;bottom:5px;z-index:4;background:#f4ecff;box-shadow:0 0 0 1px rgba(45,20,78,.22),0 0 8px rgba(145,70,255,.34)}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-handle{height:46px;z-index:5;border-color:color-mix(in srgb,#9146ff 58%,var(--ink));background:color-mix(in srgb,var(--bg) 92%,#9146ff 8%)}',

    '.chat-scrub-heat-svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0}',
    '.chat-scrub-heat-fill{fill:url(#fetcher-chat-heat-gradient)}',
    '.chat-scrub-heat-line{fill:none;stroke:#9146ff;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.94}',
    '.chat-scrub-heat-glow{fill:none;stroke:#9146ff;stroke-width:7;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.09}',

    /* Status now lives above the graph so it never gets lost inside the scrubber. */
    '.chat-scrub-heat-status{display:none;align-items:center;gap:7px;width:max-content;margin:0 0 7px 2px;padding:6px 10px;border-radius:999px;background:color-mix(in srgb,#9146ff 8%,var(--surface));border:1px solid color-mix(in srgb,#9146ff 24%,var(--border));color:var(--ink-soft);font-size:9.5px;font-weight:850;letter-spacing:.055em;text-transform:uppercase;box-shadow:0 4px 12px rgba(0,0,0,.05);pointer-events:none}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .chat-scrub-heat-status{display:inline-flex}',
    '.chat-scrub-heat-status::before{content:"";width:7px;height:7px;border-radius:50%;background:#9146ff;box-shadow:0 0 0 4px color-mix(in srgb,#9146ff 12%,transparent);opacity:.86}',
    '.chat-scrub-heat-status.scanning{color:#7540ce;background:color-mix(in srgb,#9146ff 11%,var(--surface));border-color:color-mix(in srgb,#9146ff 38%,var(--border))}',
    '.chat-scrub-heat-status.scanning::before{animation:chat-heat-pulse .72s ease-in-out infinite alternate}',
    '.chat-scrub-heat-status.error{color:var(--danger,#b34545);background:color-mix(in srgb,var(--danger,#b34545) 6%,var(--surface));border-color:color-mix(in srgb,var(--danger,#b34545) 24%,var(--border))}',
    '.chat-scrub-heat-status.error::before{background:var(--danger,#b34545);box-shadow:0 0 0 4px color-mix(in srgb,var(--danger,#b34545) 10%,transparent)}',

    /* Large centre-state while Fetcher is actively reading Twitch chat. */
    '.chat-scrub-scan-overlay{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:7px;background:linear-gradient(90deg,color-mix(in srgb,#9146ff 7%,var(--surface)),color-mix(in srgb,#9146ff 17%,var(--surface)),color-mix(in srgb,#9146ff 7%,var(--surface)));opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility .18s ease}',
    '.chat-scrub-scan-overlay.active{opacity:.96;visibility:visible}',
    '.chat-scrub-scan-overlay::before{content:"";position:absolute;top:-30%;bottom:-30%;width:28%;left:-34%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.52),transparent);filter:blur(2px);transform:skewX(-10deg);animation:chat-heat-sweep 1.15s cubic-bezier(.45,0,.2,1) infinite}',
    '.chat-scrub-scan-overlay::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,#9146ff 45%,white),transparent);opacity:.55}',
    '.chat-scrub-scan-copy{position:relative;z-index:2;display:flex;align-items:center;gap:10px;padding:8px 13px;border-radius:13px;background:color-mix(in srgb,var(--surface) 88%,transparent);border:1px solid color-mix(in srgb,#9146ff 28%,var(--border));box-shadow:0 7px 22px rgba(45,20,78,.11);color:var(--ink);font-size:12px;font-weight:850;letter-spacing:-.01em;white-space:nowrap}',
    '.chat-scrub-scan-spinner{width:17px;height:17px;flex:0 0 auto;border:2px solid color-mix(in srgb,#9146ff 24%,transparent);border-top-color:#9146ff;border-radius:50%;animation:chat-heat-spin .72s linear infinite}',
    '.chat-scrub-scan-copy small{display:block;margin-top:1px;color:var(--ink-faint);font-size:8.5px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}',

    '@keyframes chat-heat-pulse{from{opacity:.3;transform:scale(.78)}to{opacity:1;transform:scale(1.18)}}',
    '@keyframes chat-heat-spin{to{transform:rotate(360deg)}}',
    '@keyframes chat-heat-sweep{0%{left:-34%}72%,100%{left:112%}}',
    '@media(max-width:640px){#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-track{height:54px}#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-handle{height:40px}.chat-scrub-heat-status{padding:5px 8px;font-size:9px}.chat-scrub-scan-copy{font-size:11px;padding:7px 10px}.chat-scrub-scan-copy small{display:none}}',
    '@media(prefers-reduced-motion:reduce){.chat-scrub-heat-status.scanning::before,.chat-scrub-scan-spinner,.chat-scrub-scan-overlay::before{animation:none}}'
  ].join('\n');
  document.head.appendChild(css);

  var requestSeq = 0;
  var activeKey = '';
  var pendingKey = '';
  var retryTimer = 0;
  var boundVideo = null;

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
    var video = mount.querySelector('.trim-video');
    if (video && isFinite(video.duration) && video.duration > 1) return Number(video.duration);
    var label = mount.querySelector('.trim-dur');
    return label ? parseTime(label.textContent) : 0;
  }

  function isTwitchVod(url) {
    return /(?:^|\.)twitch\.tv\/videos\/\d+/i.test(String(url || '').replace(/^https?:\/\//i, ''));
  }

  function ensureLayer() {
    var timeline = mount.querySelector('.trim-timeline');
    var track = mount.querySelector('.trim-track');
    if (!timeline || !track) return null;

    var svg = track.querySelector('.chat-scrub-heat-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'chat-scrub-heat-svg');
      svg.setAttribute('viewBox', '0 0 1000 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = [
        '<defs><linearGradient id="fetcher-chat-heat-gradient" x1="0" y1="0" x2="0" y2="1">',
          '<stop offset="0%" stop-color="#9146ff" stop-opacity="0.34"></stop>',
          '<stop offset="68%" stop-color="#9146ff" stop-opacity="0.13"></stop>',
          '<stop offset="100%" stop-color="#9146ff" stop-opacity="0.035"></stop>',
        '</linearGradient></defs>',
        '<path class="chat-scrub-heat-fill" d="M0 100 L1000 100 Z"></path>',
        '<path class="chat-scrub-heat-glow" d=""></path>',
        '<path class="chat-scrub-heat-line" d=""></path>'
      ].join('');
      track.insertBefore(svg, track.firstChild);
    }

    var status = timeline.querySelector('.chat-scrub-heat-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'chat-scrub-heat-status';
      status.textContent = 'chat activity';
      timeline.insertBefore(status, track);
    }

    var overlay = track.querySelector('.chat-scrub-scan-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chat-scrub-scan-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<div class="chat-scrub-scan-copy"><span class="chat-scrub-scan-spinner"></span><span>Scanning chat activity<small>finding the loud parts</small></span></div>';
      track.appendChild(overlay);
    }

    return { timeline: timeline, track: track, svg: svg, status: status, overlay: overlay };
  }

  function setStatus(text, state) {
    var layer = ensureLayer();
    if (!layer) return;
    layer.status.textContent = text || 'chat activity';
    layer.status.classList.toggle('scanning', state === 'scanning');
    layer.status.classList.toggle('error', state === 'error');
    layer.overlay.classList.toggle('active', state === 'scanning');
  }

  function clearPaths() {
    var layer = ensureLayer();
    if (!layer) return;
    var fill = layer.svg.querySelector('.chat-scrub-heat-fill');
    var glow = layer.svg.querySelector('.chat-scrub-heat-glow');
    var line = layer.svg.querySelector('.chat-scrub-heat-line');
    if (fill) fill.setAttribute('d', 'M0 100 L1000 100 Z');
    if (glow) glow.setAttribute('d', '');
    if (line) line.setAttribute('d', '');
  }

  function pathForSamples(samples, duration, peak) {
    if (!samples.length || !duration || !peak) return { line: '', fill: 'M0 100 L1000 100 Z' };

    var points = samples.map(function (sample) {
      var x = Math.max(0, Math.min(1000, Number(sample.time || 0) / duration * 1000));
      var ratio = Math.max(0, Math.min(1, Number(sample.rate || 0) / peak));
      /* Square-root compression keeps smaller spikes visible beside one huge raid/reaction peak. */
      var y = 96 - Math.sqrt(ratio) * 82;
      return [x, y];
    });

    if (points[0][0] > 0) points.unshift([0, points[0][1]]);
    if (points[points.length - 1][0] < 1000) points.push([1000, points[points.length - 1][1]]);

    var line = 'M' + points.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join(' L');
    var fill = 'M0 100 L' + points.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join(' L') + ' L1000 100 Z';
    return { line: line, fill: fill };
  }

  function draw(body, duration) {
    var layer = ensureLayer();
    if (!layer) return;
    var samples = body && Array.isArray(body.samples) ? body.samples : [];
    var peak = Math.max(0, Number(body && body.peakRate || 0));
    var paths = pathForSamples(samples, duration, peak);
    var fill = layer.svg.querySelector('.chat-scrub-heat-fill');
    var glow = layer.svg.querySelector('.chat-scrub-heat-glow');
    var line = layer.svg.querySelector('.chat-scrub-heat-line');
    if (fill) fill.setAttribute('d', paths.fill);
    if (glow) glow.setAttribute('d', paths.line);
    if (line) line.setAttribute('d', paths.line);
    setStatus(samples.length ? 'chat activity ready' : 'no chat activity', samples.length ? 'ready' : 'error');

    /* Give the existing click-to-seek track a useful hover readout without intercepting it. */
    if (samples.length) {
      layer.track.title = 'Chat activity heatmap — taller peaks mean busier chat. Click anywhere to seek.';
    }
  }

  function schedule(delay) {
    clearTimeout(retryTimer);
    retryTimer = window.setTimeout(maybeScan, delay == null ? 120 : delay);
  }

  function bindVideo() {
    var video = mount.querySelector('.trim-video');
    if (!video || video === boundVideo) return;
    boundVideo = video;
    video.addEventListener('loadedmetadata', function () { schedule(80); });
    video.addEventListener('durationchange', function () { schedule(80); });
  }

  function maybeScan() {
    bindVideo();
    var layer = ensureLayer();
    if (!layer) {
      schedule(180);
      return;
    }

    var url = String(urlInput.value || '').trim();
    if (!isTwitchVod(url) || mount.dataset.provider !== 'twitch') {
      clearPaths();
      setStatus('chat activity', 'ready');
      return;
    }

    var duration = durationNow();
    if (!(duration > 1)) {
      setStatus('waiting for VOD metadata…', 'scanning');
      schedule(250);
      return;
    }

    var key = url + '|' + Math.round(duration);
    if (key === activeKey || key === pendingKey) return;

    pendingKey = key;
    var seq = ++requestSeq;
    clearPaths();
    setStatus('scanning chat activity…', 'scanning');

    var sampleCount = duration >= 2 * 60 * 60 ? 64 : (duration >= 60 * 60 ? 56 : 48);
    fetch('/api/chat/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, duration: duration, samples: sampleCount })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        return { ok: response.ok, body: body };
      });
    }).then(function (result) {
      if (seq !== requestSeq) return;
      pendingKey = '';
      if (!result.ok) {
        var message = result.body && result.body.error && result.body.error.message;
        setStatus(message && /minute/i.test(message) ? 'scan cooling down' : 'heatmap unavailable', 'error');
        return;
      }
      activeKey = key;
      draw(result.body || {}, duration);
    }).catch(function () {
      if (seq !== requestSeq) return;
      pendingKey = '';
      setStatus('heatmap unavailable', 'error');
    });
  }

  urlInput.addEventListener('input', function () {
    requestSeq++;
    activeKey = '';
    pendingKey = '';
    clearPaths();
    setStatus('chat activity', 'ready');
    schedule(500);
  });

  var observer = new MutationObserver(function () {
    bindVideo();
    schedule(100);
  });
  observer.observe(mount, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-provider', 'data-kind'] });

  bindVideo();
  schedule(100);
})();
