/* Put whole-VOD search beside the scrubber without cluttering the page by default. */
(function () {
  'use strict';

  var mount = document.getElementById('chat-trim-mount');
  var source = document.querySelector('.chat-source');
  var urlInput = document.getElementById('chat-url');
  if (!mount || !source || !urlInput) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-fullsearch-launch{display:none;width:100%;margin:10px 0 0;border:1px solid color-mix(in srgb,#9146ff 24%,var(--border));border-radius:13px;background:color-mix(in srgb,#9146ff 5%,var(--surface));color:var(--ink);font:inherit;padding:10px 12px;cursor:pointer;align-items:center;justify-content:space-between;gap:12px;text-align:left;transition:border-color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease),transform var(--dur-fast) var(--ease)}',
    '.chat-fullsearch-launch.ready{display:flex}',
    '.chat-fullsearch-launch:hover{border-color:color-mix(in srgb,#9146ff 48%,var(--border));background:color-mix(in srgb,#9146ff 8%,var(--surface));transform:translateY(-1px)}',
    '.chat-fullsearch-launch-copy{display:flex;align-items:center;gap:9px;min-width:0}',
    '.chat-fullsearch-launch-icon{width:25px;height:25px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;background:color-mix(in srgb,#9146ff 13%,var(--surface));color:#7a45db}',
    '.chat-fullsearch-launch-icon svg{width:13px;height:13px}',
    '.chat-fullsearch-launch-text{display:grid;gap:1px;min-width:0}',
    '.chat-fullsearch-launch-text strong{font-size:11.5px;color:var(--ink)}',
    '.chat-fullsearch-launch-text span{font-size:9.5px;color:var(--ink-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-fullsearch-launch-chevron{width:15px;height:15px;color:var(--ink-faint);transition:transform var(--dur-fast) var(--ease)}',
    '.chat-fullsearch-launch[aria-expanded="true"] .chat-fullsearch-launch-chevron{transform:rotate(180deg)}',
    '.chat-source>.chat-fullsearch{display:none;margin:8px 0 0;padding:14px 15px;border:1px solid color-mix(in srgb,#9146ff 20%,var(--border));border-radius:15px;background:color-mix(in srgb,#9146ff 4%,var(--surface));}',
    '.chat-source>.chat-fullsearch.open{display:block}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-head{margin-bottom:10px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-title strong{font-size:12px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-title span{font-size:10px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-index{font-size:10.5px;padding:8px 11px;border-radius:10px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-wrap input{font-size:11.5px;padding:10px 11px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-results{max-height:260px}',
    '@media(max-width:640px){.chat-source>.chat-fullsearch .chat-fullsearch-head{align-items:flex-start;flex-direction:column}.chat-source>.chat-fullsearch .chat-fullsearch-index{width:100%}.chat-fullsearch-launch-text span{white-space:normal}}'
  ].join('\n');
  document.head.appendChild(css);

  var launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'chat-fullsearch-launch';
  launch.setAttribute('aria-expanded', 'false');
  launch.innerHTML = [
    '<span class="chat-fullsearch-launch-copy">',
      '<span class="chat-fullsearch-launch-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg></span>',
      '<span class="chat-fullsearch-launch-text"><strong>search whole VOD</strong><span>index replay chat and jump straight to any message</span></span>',
    '</span>',
    '<svg class="chat-fullsearch-launch-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>'
  ].join('');

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

  function durationReady() {
    var video = mount.querySelector('.trim-video');
    if (video && isFinite(video.duration) && video.duration > 1) return true;
    var label = mount.querySelector('.trim-dur');
    return !!(label && parseTime(label.textContent) > 1);
  }

  function isTwitchVod() {
    return /(?:^|\.)twitch\.tv\/videos\/\d+/i.test(String(urlInput.value || '').replace(/^https?:\/\//i, ''));
  }

  function previewReady() {
    return isTwitchVod() &&
      mount.dataset.provider === 'twitch' &&
      mount.classList.contains('open') &&
      durationReady();
  }

  function collapse(section) {
    if (section) section.classList.remove('open');
    launch.setAttribute('aria-expanded', 'false');
  }

  function syncVisibility() {
    var section = document.querySelector('.chat-fullsearch');
    var ready = previewReady();
    launch.classList.toggle('ready', ready);
    if (!ready) collapse(section);
  }

  function place() {
    var section = document.querySelector('.chat-fullsearch');
    if (!section) return false;

    if (launch.parentNode !== source || launch.previousElementSibling !== mount) {
      mount.insertAdjacentElement('afterend', launch);
    }
    if (section.parentNode !== source || section.previousElementSibling !== launch) {
      launch.insertAdjacentElement('afterend', section);
    }
    section.classList.remove('open');
    launch.setAttribute('aria-expanded', 'false');
    syncVisibility();
    return true;
  }

  launch.addEventListener('click', function () {
    var section = document.querySelector('.chat-fullsearch');
    if (!section || !launch.classList.contains('ready')) return;
    var opening = !section.classList.contains('open');
    section.classList.toggle('open', opening);
    launch.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) {
      window.setTimeout(function () {
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }
  });

  urlInput.addEventListener('input', function () {
    collapse(document.querySelector('.chat-fullsearch'));
    syncVisibility();
  });

  var boundVideo = null;
  function bindVideo() {
    var video = mount.querySelector('.trim-video');
    if (!video || video === boundVideo) return;
    boundVideo = video;
    video.addEventListener('loadedmetadata', syncVisibility);
    video.addEventListener('durationchange', syncVisibility);
  }

  var observer = new MutationObserver(function () {
    bindVideo();
    syncVisibility();
  });
  observer.observe(mount, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-provider', 'data-kind']
  });

  if (!place()) {
    var bodyObserver = new MutationObserver(function () {
      if (place()) bodyObserver.disconnect();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () {
      place();
      bodyObserver.disconnect();
    }, 5000);
  }

  bindVideo();
  syncVisibility();
})();
