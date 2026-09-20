/* Keep whole-VOD indexing attached through brief proxy/status hiccups. */
(function () {
  'use strict';

  var nativeFetch = window.fetch.bind(window);
  var statusPattern = /^\/api\/chat\/index\/status\/(\d+)(?:$|[?#])/;
  var transientStatuses = { 404: true, 429: true, 502: true, 503: true, 504: true };
  var retryDelays = [350, 650, 950, 1300, 1700, 2200, 2800, 3400];

  function sleep(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function requestPath(resource) {
    try {
      var raw = typeof resource === 'string' ? resource : (resource && resource.url) || '';
      var parsed = new URL(raw, window.location.href);
      return parsed.pathname + parsed.search + parsed.hash;
    } catch (e) {
      return '';
    }
  }

  function requestMethod(resource, init) {
    return String((init && init.method) || (resource && resource.method) || 'GET').toUpperCase();
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

  function vodDuration() {
    var mount = document.getElementById('chat-trim-mount');
    if (!mount) return 0;
    var video = mount.querySelector('.trim-video');
    if (video && isFinite(video.duration) && video.duration > 1) return Number(video.duration);
    var label = mount.querySelector('.trim-dur');
    return label ? parseTime(label.textContent) : 0;
  }

  function vodUrl() {
    var input = document.getElementById('chat-url');
    return input ? String(input.value || '').trim() : '';
  }

  function showReconnect(on) {
    var status = document.getElementById('chat-fullsearch-status');
    var summary = document.getElementById('chat-fullsearch-summary');
    if (on) {
      if (status) status.textContent = 'keeping the index connected…';
      if (summary) summary.textContent = 'Fetcher is still indexing. A status check hiccupped, so it is reconnecting automatically.';
    }
  }

  async function reattachIndex() {
    var url = vodUrl();
    var duration = vodDuration();
    if (!url || !(duration > 1)) return null;

    try {
      var response = await nativeFetch('/api/chat/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, duration: duration })
      });
      if (!response.ok) return null;
      var state = await response.clone().json().catch(function () { return null; });
      if (!state || !state.vodId) return null;
      return new Response(JSON.stringify(state), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return null;
    }
  }

  async function resilientStatusFetch(resource, init) {
    var lastResponse = null;
    var lastError = null;

    for (var attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        var response = await nativeFetch(resource, init);
        if (response.ok || !transientStatuses[response.status]) {
          return response;
        }
        lastResponse = response;
        if (attempt >= 1) showReconnect(true);
      } catch (err) {
        lastError = err;
        if (attempt >= 1) showReconnect(true);
      }

      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
      }
    }

    /* If the in-memory status really did disappear (for example after a tiny
       service/proxy interruption), transparently call the existing start route.
       That route returns the still-building index when it exists, or starts a
       fresh one when it genuinely vanished. The original full-search UI receives
       the returned state as though the status poll succeeded, so the user never
       has to press "try indexing again" just to resume polling. */
    var recovered = await reattachIndex();
    if (recovered) return recovered;
    if (lastResponse) return lastResponse;
    if (lastError) throw lastError;
    return nativeFetch(resource, init);
  }

  window.fetch = function (resource, init) {
    var path = requestPath(resource);
    if (requestMethod(resource, init) === 'GET' && statusPattern.test(path)) {
      return resilientStatusFetch(resource, init);
    }
    return nativeFetch(resource, init);
  };
})();
