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
    '.chat-look-gif{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;z-index:4!important;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-user-drag:none!important;border-radius:inherit!important;}',
    '.chat-look-option[aria-pressed="true"] .chat-look-gif{filter:saturate(1.03) contrast(1.01);}',
    '@media(prefers-reduced-motion:reduce){.chat-look-gif{display:none!important;}}'
  ].join('\n');
  document.head.appendChild(style);

  cards.forEach(function (card) {
    var look = String(card.dataset.look || 'classic').trim().toLowerCase();
    var mini = card.querySelector('.chat-look-mini');
    if (!mini || mini.querySelector('.chat-look-gif')) return;

    var image = document.createElement('img');
    image.className = 'chat-look-gif';
    image.src = '/api/chat/style-preview/' + encodeURIComponent(look) + '.gif?v=1';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.setAttribute('draggable', 'false');
    image.decoding = 'async';

    /* Keep the existing CSS mini-preview underneath as a zero-cost fallback if
       Pillow is unavailable or the GIF route ever fails. */
    image.addEventListener('error', function () {
      image.remove();
    }, { once: true });

    mini.appendChild(image);
  });
})();
