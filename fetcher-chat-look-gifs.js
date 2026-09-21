/* Literal animated GIF previews for the Style Lab look cards.
   The GIFs are generated server-side from the same look vocabulary as the live
   overlay preview, so the cards show chat bubbles rather than abstract bars. */
(function () {
  'use strict';

  var cards = Array.prototype.slice.call(document.querySelectorAll('.chat-look-option[data-look]'));
  if (!cards.length) return;

  var style = document.createElement('style');
  style.textContent = [
    '.chat-look-mini{isolation:isolate!important;}',
    /* Keep a little breathing room around the literal GIF so the 16:9 render is
       never visually clipped by the thumbnail's rounded shell. */
    '.chat-look-gif{position:absolute!important;inset:8px!important;width:calc(100% - 16px)!important;height:calc(100% - 16px)!important;object-fit:contain!important;display:block!important;z-index:4!important;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-user-drag:none!important;border-radius:10px!important;transform:translateZ(0)!important;backface-visibility:hidden!important;-webkit-backface-visibility:hidden!important;}',
    '.chat-look-option[aria-pressed="true"] .chat-look-gif{filter:saturate(1.03) contrast(1.01);}',
    /* Once the GIF has loaded, the old CSS thumbnail is no longer a fallback.
       Hiding/removing it prevents Chromium/WebKit from briefly compositing the
       static preview above the GIF while the carousel track is being dragged. */
    '.chat-look-mini.chat-look-gif-ready>.chat-demo-msg{display:none!important;visibility:hidden!important;opacity:0!important;}'
  ].join('\n');
  document.head.appendChild(style);

  cards.forEach(function (card) {
    var look = String(card.dataset.look || 'classic').trim().toLowerCase();
    var mini = card.querySelector('.chat-look-mini');
    if (!mini || mini.querySelector('.chat-look-gif')) return;

    var image = document.createElement('img');
    image.className = 'chat-look-gif';
    /* v=3 busts the previous full-bleed thumbnail styling. */
    image.src = '/api/chat/style-preview/' + encodeURIComponent(look) + '.gif?v=3';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.setAttribute('draggable', 'false');
    image.decoding = 'async';

    image.addEventListener('load', function () {
      mini.classList.add('chat-look-gif-ready');

      /* The GIF is now the real preview. Remove the old generated bars entirely
         rather than leaving a competing layer under the carousel transform. */
      Array.prototype.slice.call(mini.querySelectorAll('.chat-demo-msg')).forEach(function (node) {
        node.remove();
      });
    }, { once: true });

    /* Until the GIF succeeds, the old CSS mini-preview remains available as the
       fallback. Failed images remove themselves and leave that fallback intact. */
    image.addEventListener('error', function () {
      image.remove();
    }, { once: true });

    mini.appendChild(image);
  });
})();
