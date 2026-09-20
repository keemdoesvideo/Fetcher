/* Keep the live chat gap tied to the same 1080p reference used by export. */
(function () {
  'use strict';
  var stage = document.getElementById('chat-stage');
  var stack = document.getElementById('chat-stack');
  var workspace = document.getElementById('chat-workspace');
  var gap = document.getElementById('chat-bubble-gap');
  if (!stage || !stack || !workspace || !gap) return;

  function sync() {
    var height = stage.clientHeight;
    if (height < 80) return;
    stack.style.gap = (Number(gap.value || 20) * height / 1080).toFixed(2) + 'px';
  }
  gap.addEventListener('input', sync);
  window.addEventListener('resize', sync);
  if (window.ResizeObserver) new ResizeObserver(sync).observe(stage);
  new MutationObserver(sync).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
  requestAnimationFrame(sync);
})();
