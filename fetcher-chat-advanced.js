/* Surface the existing timing / bot-cleanup controls inside Stage 2 without duplicating logic. */
(function () {
  'use strict';

  var styleRight = document.querySelector('.chat-style-right');
  var insights = document.querySelector('.chat-insights-card');
  if (!styleRight || !insights || document.querySelector('.chat-advanced')) return;

  var grid = insights.querySelector('.chat-insights-grid');
  var hideBots = insights.querySelector('.chat-insights-check');
  if (!grid && !hideBots) return;

  var panel = document.createElement('details');
  panel.className = 'chat-advanced';
  panel.innerHTML = [
    '<summary>',
      '<span class="chat-advanced-title">advanced</span>',
      '<span class="chat-advanced-hint">timing + message behaviour</span>',
      '<span class="chat-advanced-chevron" aria-hidden="true">⌄</span>',
    '</summary>',
    '<div class="chat-advanced-body"></div>'
  ].join('');

  var body = panel.querySelector('.chat-advanced-body');
  if (grid) body.appendChild(grid);
  if (hideBots) body.appendChild(hideBots);

  var next = styleRight.querySelector('.chat-flow-next');
  styleRight.insertBefore(panel, next || null);
})();
