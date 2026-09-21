/* First-visit Chat explainer. Keeps the working Chat surface visually quiet by
   putting the instructions into one dismissible welcome moment instead. */
(function () {
  'use strict';

  if (!document.querySelector('.chat-main')) return;

  var root = document.documentElement;
  var SEEN_KEY = 'fetcher.chatIntroSeen.v1';
  var forced = /(?:^|[?&])chatintro(?:=|&|$)/.test(location.search) || location.hash === '#chat-intro';
  var seen = false;

  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
  if (seen && !forced) return;

  var intro = document.createElement('div');
  intro.className = 'chat-intro';
  intro.hidden = true;
  intro.innerHTML = [
    '<div class="chat-intro-scrim" aria-hidden="true"></div>',
    '<section class="chat-intro-card" role="dialog" aria-modal="true" aria-labelledby="chat-intro-title" aria-describedby="chat-intro-copy">',
      '<div class="chat-intro-mark" aria-hidden="true">',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">',
          '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
        '</svg>',
      '</div>',
      '<span class="chat-intro-eyebrow">project fetcher · chat · twitch beta</span>',
      '<h1 class="chat-intro-title" id="chat-intro-title">turn VOD chat into an editing overlay.</h1>',
      '<p class="chat-intro-copy" id="chat-intro-copy">Fetcher reads replay chat from a finished Twitch VOD and rebuilds the moment as a customizable overlay you can take into your edit.</p>',
      '<ol class="chat-intro-steps">',
        '<li class="chat-intro-step"><span class="chat-intro-step-num">1</span><span>paste a finished Twitch VOD and choose the moment with the scrubber</span></li>',
        '<li class="chat-intro-step"><span class="chat-intro-step-num">2</span><span>load the real replay chat, then choose its look, layout, motion, size and sound</span></li>',
        '<li class="chat-intro-step"><span class="chat-intro-step-num">3</span><span>export the finished chat overlay for your editor, with transparency when the format supports it</span></li>',
      '</ol>',
      '<p class="chat-intro-note">Twitch VODs only for now · chat exports can be up to 20 minutes</p>',
      '<button class="chat-intro-btn" id="chat-intro-dismiss" type="button">got it · show me chat</button>',
    '</section>'
  ].join('');
  document.body.appendChild(intro);

  var card = intro.querySelector('.chat-intro-card');
  var button = intro.querySelector('#chat-intro-dismiss');
  var dismissed = false;
  var previousFocus = document.activeElement;

  function afterTwoFrames(fn) {
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }

  function focusables() {
    return Array.prototype.filter.call(card.querySelectorAll(
      'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'
    ), function (node) { return node.getClientRects().length > 0; });
  }

  function rememberSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    rememberSeen();
    intro.classList.remove('in');
    intro.style.pointerEvents = 'none';
    root.classList.remove('chat-intro-open');
    window.setTimeout(function () {
      if (intro.parentNode) intro.remove();
      var target = previousFocus && previousFocus.isConnected ? previousFocus : document.getElementById('chat-url');
      if (target && typeof target.focus === 'function') {
        try { target.focus(); } catch (e) {}
      }
    }, 320);
  }

  button.addEventListener('click', dismiss);
  intro.addEventListener('click', function (event) {
    if (!event.target.closest('.chat-intro-card')) dismiss();
  });

  document.addEventListener('keydown', function (event) {
    if (dismissed || intro.hidden || !intro.classList.contains('in')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss();
      return;
    }
    if (event.key !== 'Tab') return;
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.addEventListener('focusin', function (event) {
    if (dismissed || intro.hidden || !intro.classList.contains('in') || card.contains(event.target)) return;
    try { button.focus(); } catch (e) {}
  }, true);

  intro.hidden = false;
  root.classList.add('chat-intro-open');
  afterTwoFrames(function () {
    if (!intro.isConnected) return;
    intro.classList.add('in');
    try { button.focus(); } catch (e) {}
  });
})();
