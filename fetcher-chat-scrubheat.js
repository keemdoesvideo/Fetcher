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

    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-track{height:62px;overflow:hidden;border:1px solid color-mix(in srgb,#9146ff 18%,var(--border));background:color-mix(in srgb,#9146ff 4%,var(--rail))}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-track::before{top:auto;bottom:8px;height:1px;transform:none;z-index:1;background:color-mix(in srgb,#9146ff 25%,var(--ink));opacity:.28}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-range{top:0;height:100%;transform:none;border-radius:7px;background:color-mix(in srgb,#9146ff 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#9146ff 24%,transparent);opacity:1;z-index:2}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-playhead{top:5px;bottom:5px;z-index:4;background:#f4ecff;box-shadow:0 0 0 1px rgba(45,20,78,.22),0 0 8px rgba(145,70,255,.34)}',
    '#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-handle{height:46px;z-index:5;border-color:color-mix(in srgb,#9146ff 58%,var(--ink));background:color-mix(in srgb,var(--bg) 92%,#9146ff 8%)}',
    '.chat-scrub-heat-svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0}',
    '.chat-scrub-heat-fill{fill:url(#fetcher-chat-heat-gradient)}',
    '.chat-scrub-heat-line{fill:none;stroke:#9146ff;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.94}',
    '.chat-scrub-heat-glow{fill:none;stroke:#9146ff;stroke-width:7;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.09}',
    '.chat-scrub-heat-status{position:absolute;right:7px;top:6px;z-index:6;pointer-events:none;display:inline-flex;align-items:center;gap:5px;padding:3px 6px;border-radius:999px;background:color-mix(in srgb,var(--surface) 86%,transparent);border:1px solid color-mix(in srgb,#9146ff 18%,var(--border));color:var(--ink-faint);font-size:8px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;box-shadow:0 2px 8px rgba(0,0,0,.06)}',
    '.chat-scrub-heat-status::before{content:"";width:4px;height:4px;border-radius:50%;background:#9146ff;opacity:.8}',
    '.chat-scrub-heat-status.scanning::before{animation:chat-heat-pulse .8s ease-in-out infinite alternate}',
    '.chat-scrub-heat-status.error{color:var(--danger,#b34545);border-color:color-mix(in srgb,var(--danger,#b34545) 22%,var(--border))}',
    '.chat-scrub-heat-status.error::before{background:var(--danger,#b34545)}',
    '@keyframes chat-heat-pulse{from{opacity:.25;transform:scale(.8)}to{opacity:1;transform:scale(1.25)}}',
    '@media(max-width:640px){#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-track{height:54px}#chat-trim-mount[data-provider="twitch"][data-kind="video"] .trim-handle{height:40px}.chat-scrub-heat-status{top:4px;right:5px}}',
    '@media(prefers-reduced-motion:reduce){.chat-scrub-heat-status.scanning::before{animation:none}}'
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
    var track = mount.querySelector('.trim-track');
    if (!track) return null;

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

    var status = track.querySelector('.chat-scrub-heat-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'chat-scrub-heat-status';
      status.textContent = 'chat heatmap';
      track.appendChild(status);
    }
    return { track: track, svg: svg, status: status };
  }

  function setStatus(text, state) {
    var layer = ensureLayer();
    if (!layer) return;
    layer.status.textContent = text || 'chat heatmap';
    layer.status.classList.toggle('scanning', state === 'scanning');
    layer.status.classList.toggle('error', state === 'error');
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
    setStatus(samples.length ? 'chat activity' : 'no chat activity', samples.length ? 'ready' : 'error');

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
      setStatus('chat heatmap', 'ready');
      return;
    }

    var duration = durationNow();
    if (!(duration > 1)) {
      setStatus('waiting for VOD…', 'scanning');
      schedule(250);
      return;
    }

    var key = url + '|' + Math.round(duration);
    if (key === activeKey || key === pendingKey) return;

    pendingKey = key;
    var seq = ++requestSeq;
    clearPaths();
    setStatus('scanning chat…', 'scanning');

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
    setStatus('chat heatmap', 'ready');
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
