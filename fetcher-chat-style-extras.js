/* Branch-only Stage 2 interaction fixes and small style extras.
   - Distinguish a normal Look-card click from an intentional drag.
   - Add a preview/export bubble-size control.
   - Keep Advanced expanded now that the sidebar itself scrolls. */
(function () {
  'use strict';

  var stack = document.getElementById('chat-stack');
  var viewport = document.querySelector('.chat-look-viewport');
  var track = document.querySelector('.chat-look-track');
  var dots = Array.prototype.slice.call(document.querySelectorAll('.chat-look-dot'));
  var customCard = document.querySelector('.chat-custom-card');
  var advanced = document.querySelector('.chat-advanced');
  if (!stack) return;

  var style = document.createElement('style');
  style.textContent = [
    '#chat-stack .chat-message{zoom:var(--fetcher-bubble-size,1)}',
    '.chat-advanced.chat-sidebar-advanced>summary{cursor:default!important;pointer-events:none!important}',
    '.chat-advanced.chat-sidebar-advanced .chat-advanced-chevron{display:none!important}',
    '.chat-advanced.chat-sidebar-advanced .chat-advanced-body{display:block!important}',
    '.chat-look-viewport.dragging .chat-look-option{cursor:grabbing!important}',
    '.chat-look-viewport:not(.dragging) .chat-look-option{cursor:pointer!important}'
  ].join('\n');
  document.head.appendChild(style);

  /* ---------------------------------------------------------------------
     Look-card input: a simple press/release stays a click. Drag mode only
     activates after a deliberate move/hold threshold, so selecting a Look is
     never swallowed by the carousel gesture recogniser. */
  if (viewport && track && dots.length) {
    var gesture = null;
    var blockClickUntil = 0;

    function currentPage() {
      var active = dots.findIndex(function (dot) { return dot.classList.contains('active'); });
      return active < 0 ? 0 : active;
    }

    function snapTo(page) {
      page = Math.max(0, Math.min(dots.length - 1, page));
      if (dots[page]) dots[page].click();
    }

    viewport.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      gesture = {
        id: event.pointerId,
        startX: event.clientX,
        lastX: event.clientX,
        started: performance.now(),
        width: viewport.clientWidth || 1,
        page: currentPage(),
        dragging: false
      };

      /* This capture listener intentionally blocks the older immediate-drag
         handler on the same viewport. It does NOT prevent the browser's default,
         so a normal button click is still synthesized and reaches the Look card. */
      event.stopImmediatePropagation();
    }, true);

    window.addEventListener('pointermove', function (event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      gesture.lastX = event.clientX;
      var dx = event.clientX - gesture.startX;
      var elapsed = performance.now() - gesture.started;

      if (!gesture.dragging) {
        /* A tiny hand movement while clicking should never become a drag.
           Deliberate drag: ~110 ms hold + 7 px move, or an unmistakable 20 px swipe. */
        if (!((elapsed >= 110 && Math.abs(dx) >= 7) || Math.abs(dx) >= 20)) return;
        gesture.dragging = true;
        viewport.classList.add('dragging');
        track.style.transition = 'none';
        try { viewport.setPointerCapture(event.pointerId); } catch (e) {}
      }

      event.preventDefault();
      var edgeResistance = (gesture.page === 0 && dx > 0) ||
        (gesture.page === dots.length - 1 && dx < 0) ? .22 : 1;
      var x = -gesture.page * gesture.width + dx * edgeResistance;
      track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    }, true);

    function finishGesture(event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      var ended = gesture;
      gesture = null;

      if (!ended.dragging) return;

      event.preventDefault();
      event.stopPropagation();
      viewport.classList.remove('dragging');
      try { viewport.releasePointerCapture(event.pointerId); } catch (e) {}

      var dx = ended.lastX - ended.startX;
      var elapsed = Math.max(1, performance.now() - ended.started);
      var velocity = dx / elapsed;
      var threshold = Math.min(90, ended.width * .14);
      var page = ended.page;
      if ((dx < -threshold || velocity < -.55) && page < dots.length - 1) page += 1;
      else if ((dx > threshold || velocity > .55) && page > 0) page -= 1;

      blockClickUntil = performance.now() + 180;
      snapTo(page);
    }

    window.addEventListener('pointerup', finishGesture, true);
    window.addEventListener('pointercancel', finishGesture, true);

    viewport.addEventListener('click', function (event) {
      if (performance.now() >= blockClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  /* ---------------------------------------------------------------------
     Bubble size: independent from width and gap. Uses CSS zoom so the message's
     layout box actually changes size while the stack gap remains controlled by
     the existing Bubble Gap setting. */
  var sizeEl = document.getElementById('chat-bubble-size');
  if (!sizeEl && customCard) {
    var styleGrid = customCard.querySelector('.chat-custom-grid');
    if (styleGrid) {
      var field = document.createElement('div');
      field.className = 'chat-custom-field';
      field.innerHTML = [
        '<div class="chat-custom-line"><span>bubble size</span><output id="chat-size-out">100%</output></div>',
        '<input id="chat-bubble-size" type="range" min="60" max="140" step="5" value="100">'
      ].join('');
      styleGrid.appendChild(field);
      sizeEl = field.querySelector('#chat-bubble-size');
    }
  }

  var sizeOut = document.getElementById('chat-size-out');
  function applyBubbleSize() {
    if (!sizeEl) return;
    var value = Math.max(60, Math.min(140, Number(sizeEl.value || 100)));
    stack.style.setProperty('--fetcher-bubble-size', (value / 100).toFixed(2));
    if (sizeOut) sizeOut.textContent = Math.round(value) + '%';
  }

  if (sizeEl) {
    sizeEl.addEventListener('input', applyBubbleSize);
    sizeEl.addEventListener('change', applyBubbleSize);
    applyBubbleSize();
  }

  /* Export parity for the new control. Loaded last so all earlier fetch wrappers
     continue to add their own fields before the request reaches the network. */
  var nextFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    if (sizeEl && url.indexOf('/api/chat/export') !== -1 && init && typeof init.body === 'string') {
      try {
        var body = JSON.parse(init.body);
        body.bubbleScale = Math.max(60, Math.min(140, Number(sizeEl.value || 100)));
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return nextFetch.call(window, resource, init);
  };

  /* Advanced is now just another section in the scrolling settings rail. */
  if (advanced) {
    advanced.open = true;
    advanced.addEventListener('toggle', function () {
      if (!advanced.open) advanced.open = true;
    });
  }
})();
