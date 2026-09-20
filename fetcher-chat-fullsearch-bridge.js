/* Keep whole-VOD search visible beside the Twitch scrubber, even before a chat section is loaded. */
(function () {
  'use strict';

  var mount = document.getElementById('chat-trim-mount');
  var source = document.querySelector('.chat-source');
  if (!mount || !source) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-source>.chat-fullsearch{margin:14px 0 0;padding:14px 15px;border:1px solid color-mix(in srgb,#9146ff 20%,var(--border));border-radius:15px;background:color-mix(in srgb,#9146ff 4%,var(--surface));}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-head{margin-bottom:10px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-title strong{font-size:12px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-title span{font-size:10px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-index{font-size:10.5px;padding:8px 11px;border-radius:10px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-wrap input{font-size:11.5px;padding:10px 11px}',
    '.chat-source>.chat-fullsearch .chat-fullsearch-results{max-height:260px}',
    '@media(max-width:640px){.chat-source>.chat-fullsearch .chat-fullsearch-head{align-items:flex-start;flex-direction:column}.chat-source>.chat-fullsearch .chat-fullsearch-index{width:100%}}'
  ].join('\n');
  document.head.appendChild(css);

  function place() {
    var section = document.querySelector('.chat-fullsearch');
    if (!section) return false;
    if (section.parentNode !== source || section.previousElementSibling !== mount) {
      mount.insertAdjacentElement('afterend', section);
    }
    return true;
  }

  if (place()) return;

  var observer = new MutationObserver(function () {
    if (place()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(function () {
    place();
    observer.disconnect();
  }, 5000);
})();
