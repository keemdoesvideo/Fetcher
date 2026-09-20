/* Minimal, centered, page-scroll-free stage flow for the chat workspace. */
(function () {
  'use strict';

  var shell = document.querySelector('.chat-shell');
  var source = document.querySelector('.chat-source');
  var workspace = document.getElementById('chat-workspace');
  var preview = document.querySelector('.chat-preview-card');
  var side = document.querySelector('.chat-side');
  var trimMount = document.getElementById('chat-trim-mount');
  var sourceNote = document.getElementById('chat-source-note');
  if (!shell || !source || !workspace || !preview || !side || !trimMount) return;

  workspace.classList.add('chat-stage-signal');

  var cards = {
    look: side.querySelector('.chat-look-card'),
    custom: side.querySelector('.chat-custom-card'),
    editor: side.querySelector('.chat-editor-card'),
    insights: side.querySelector('.chat-insights-card'),
    presets: side.querySelector('.chat-presets-card'),
    export: side.querySelector('.chat-export-card')
  };

  var flow = document.createElement('div');
  flow.className = 'chat-flow';
  flow.innerHTML = [
    '<button class="chat-page-arrow chat-page-arrow-left" type="button" aria-label="Previous page" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>',
    '<button class="chat-page-arrow chat-page-arrow-right" type="button" aria-label="Next page" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>',

    '<section class="chat-flow-stage chat-flow-source active" data-stage="source">',
      '<div class="chat-flow-stage-inner chat-flow-source-inner">',
        '<div class="chat-flow-source-mount"></div>',
      '</div>',
    '</section>',

    '<section class="chat-flow-stage" data-stage="look">',
      '<div class="chat-flow-stage-inner">',
        '<div class="chat-flow-split">',
          '<div class="chat-flow-preview-slot" data-preview-slot="look"></div>',
          '<div class="chat-flow-toolbox">',
            '<div class="chat-flow-tabs chat-flow-tabs-large" data-tabs="look">',
              tabButton('look', 'looks', true),
              tabButton('spacing', 'spacing', false),
              tabButton('sound', 'sound', false),
            '</div>',
            '<div class="chat-flow-toolhost" data-toolhost="look"></div>',
            '<button class="chat-flow-next" type="button" data-unlock-stage="edit">on to edit <span>→</span></button>',
          '</div>',
        '</div>',
      '</div>',
    '</section>',

    '<section class="chat-flow-stage" data-stage="edit">',
      '<div class="chat-flow-stage-inner">',
        '<div class="chat-flow-split">',
          '<div class="chat-flow-preview-slot" data-preview-slot="edit"></div>',
          '<div class="chat-flow-toolbox">',
            '<div class="chat-flow-tabs chat-flow-tabs-large" data-tabs="edit">',
              tabButton('editor', 'messages', true),
              tabButton('insights', 'find + timing', false),
            '</div>',
            '<div class="chat-flow-toolhost" data-toolhost="edit"></div>',
            '<button class="chat-flow-next" type="button" data-unlock-stage="export">on to export <span>→</span></button>',
          '</div>',
        '</div>',
      '</div>',
    '</section>',

    '<section class="chat-flow-stage" data-stage="export">',
      '<div class="chat-flow-stage-inner">',
        '<div class="chat-flow-split">',
          '<div class="chat-flow-preview-slot" data-preview-slot="export"></div>',
          '<div class="chat-flow-toolbox">',
            '<div class="chat-flow-tabs chat-flow-tabs-large" data-tabs="export">',
              tabButton('export', 'export', true),
              tabButton('presets', 'presets', false),
              tabButton('canvas', 'canvas + sound', false),
            '</div>',
            '<div class="chat-flow-toolhost" data-toolhost="export"></div>',
          '</div>',
        '</div>',
      '</div>',
    '</section>'
  ].join('');

  function tabButton(tool, label, active) {
    return '<button class="chat-flow-tab' + (active ? ' active' : '') + '" type="button" data-tool="' + tool + '">' + label + '</button>';
  }

  shell.appendChild(flow);
  flow.querySelector('.chat-flow-source-mount').appendChild(source);

  var stages = ['source', 'look', 'edit', 'export'];
  var activeStage = 'source';
  var maxUnlocked = workspace.hidden ? 0 : 1;
  var activeTools = { look: 'look', edit: 'editor', export: 'export' };
  var leftArrow = flow.querySelector('.chat-page-arrow-left');
  var rightArrow = flow.querySelector('.chat-page-arrow-right');
  var searchLaunch = document.querySelector('.chat-fullsearch-launch');

  function indexOfStage(stage) {
    return stages.indexOf(stage);
  }

  function previewSlot(stage) {
    return flow.querySelector('[data-preview-slot="' + stage + '"]');
  }

  function toolHost(stage) {
    return flow.querySelector('[data-toolhost="' + stage + '"]');
  }

  function canVisit(stage) {
    var index = indexOfStage(stage);
    return index >= 0 && index <= maxUnlocked;
  }

  function placePreview(stage) {
    if (stage === 'source') return;
    var slot = previewSlot(stage);
    if (slot && preview.parentNode !== slot) slot.appendChild(preview);
  }

  function fieldFor(id) {
    var el = document.getElementById(id);
    return el ? el.closest('.chat-custom-field') : null;
  }

  function setVisible(node, visible) {
    if (node) node.hidden = !visible;
  }

  function setCustomMode(mode) {
    var card = cards.custom;
    if (!card) return;
    var grids = card.querySelectorAll('.chat-custom-grid');
    var visualGrid = grids[0] || null;
    var soundGrid = grids[1] || null;
    var divider = card.querySelector('.chat-custom-divider');
    var notes = card.querySelectorAll('.chat-custom-note');

    var bubbleWidth = fieldFor('chat-bubble-width');
    var bubbleGap = fieldFor('chat-bubble-gap');
    var canvasMode = fieldFor('chat-canvas-mode');
    var canvasAspect = fieldFor('chat-canvas-aspect');
    var canvasPadding = fieldFor('chat-canvas-padding');

    if (visualGrid) visualGrid.hidden = mode === 'sound';
    if (soundGrid) soundGrid.hidden = mode === 'spacing';
    if (divider) divider.hidden = true;

    if (mode === 'spacing') {
      setVisible(bubbleWidth, true);
      setVisible(bubbleGap, true);
      setVisible(canvasMode, false);
      setVisible(canvasAspect, false);
      setVisible(canvasPadding, false);
    } else if (mode === 'canvas') {
      if (visualGrid) visualGrid.hidden = false;
      if (soundGrid) soundGrid.hidden = false;
      setVisible(bubbleWidth, false);
      setVisible(bubbleGap, false);
      setVisible(canvasMode, true);
      setVisible(canvasAspect, true);
      setVisible(canvasPadding, true);
    } else {
      setVisible(bubbleWidth, false);
      setVisible(bubbleGap, false);
      setVisible(canvasMode, false);
      setVisible(canvasAspect, false);
      setVisible(canvasPadding, false);
    }

    Array.prototype.forEach.call(notes, function (note) {
      if (mode === 'spacing') {
        note.hidden = note.id === 'chat-sound-note' || note.id === 'chat-canvas-note';
      } else if (mode === 'sound') {
        note.hidden = note.id !== 'chat-sound-note';
      } else {
        note.hidden = false;
      }
    });

    card.dataset.stageView = mode;
    card.classList.remove('chat-tool-swap');
    requestAnimationFrame(function () { card.classList.add('chat-tool-swap'); });
  }

  function actualTool(tool) {
    if (tool === 'spacing' || tool === 'sound' || tool === 'canvas') return 'custom';
    return tool;
  }

  function placeTool(stage, tool) {
    var host = toolHost(stage);
    var card = cards[actualTool(tool)];
    if (!host || !card) return;
    if (card.parentNode !== host) host.appendChild(card);
    Array.prototype.forEach.call(host.children, function (child) {
      if (child.classList && child.classList.contains('chat-card')) child.hidden = child !== card;
    });
    card.hidden = false;
    if (actualTool(tool) === 'custom') setCustomMode(tool);

    var tabs = flow.querySelector('[data-tabs="' + stage + '"]');
    if (tabs) {
      Array.prototype.forEach.call(tabs.querySelectorAll('.chat-flow-tab'), function (button) {
        button.classList.toggle('active', button.dataset.tool === tool);
      });
    }

    card.classList.remove('chat-tool-swap');
    requestAnimationFrame(function () { card.classList.add('chat-tool-swap'); });
  }

  function updateArrows() {
    var index = indexOfStage(activeStage);
    leftArrow.hidden = index <= 0;
    rightArrow.hidden = index < 0 || index >= stages.length - 1 || index + 1 > maxUnlocked;
  }

  function showStage(stage) {
    if (!canVisit(stage)) return;
    activeStage = stage;
    Array.prototype.forEach.call(flow.querySelectorAll('.chat-flow-stage'), function (node) {
      node.classList.toggle('active', node.dataset.stage === stage);
    });
    if (stage !== 'source') {
      placePreview(stage);
      placeTool(stage, activeTools[stage]);
    }
    updateArrows();
  }

  function unlockAndShow(stage) {
    var index = indexOfStage(stage);
    if (index < 0) return;
    maxUnlocked = Math.max(maxUnlocked, index);
    showStage(stage);
  }

  function moveBy(delta) {
    var targetIndex = indexOfStage(activeStage) + delta;
    if (targetIndex < 0 || targetIndex > maxUnlocked || targetIndex >= stages.length) return;
    showStage(stages[targetIndex]);
  }

  leftArrow.addEventListener('click', function () { moveBy(-1); });
  rightArrow.addEventListener('click', function () { moveBy(1); });

  flow.addEventListener('click', function (event) {
    var unlock = event.target.closest('[data-unlock-stage]');
    if (unlock) {
      unlockAndShow(unlock.dataset.unlockStage);
      return;
    }
    var tab = event.target.closest('.chat-flow-tab[data-tool]');
    if (!tab) return;
    var tabs = tab.closest('[data-tabs]');
    if (!tabs) return;
    var stage = tabs.dataset.tabs;
    activeTools[stage] = tab.dataset.tool;
    placeTool(stage, tab.dataset.tool);
  });

  function previewReady() {
    var video = trimMount.querySelector('.trim-video');
    var open = trimMount.classList.contains('open');
    var provider = trimMount.dataset.provider === 'twitch';
    return !!(open && provider && video);
  }

  function moveSearchIntoPlayer() {
    if (!searchLaunch || !searchLaunch.isConnected) {
      searchLaunch = document.querySelector('.chat-fullsearch-launch') || searchLaunch;
    }
    var wrap = trimMount.querySelector('.trim-video-wrap');
    if (!searchLaunch || !wrap) return;

    // This function is called from a MutationObserver watching the trimmer. Keep
    // every DOM write idempotent. Replacing innerHTML on every callback creates
    // another child-list mutation, which calls this function again forever and
    // locks the browser as soon as a VOD preview opens.
    if (searchLaunch.parentNode !== wrap) {
      wrap.appendChild(searchLaunch);
    }
    if (!searchLaunch.classList.contains('chat-player-search')) {
      searchLaunch.classList.add('chat-player-search');
      searchLaunch.innerHTML = '<span class="chat-player-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg></span><span>search VOD</span>';
    }
  }

  function syncSourceUi() {
    var ready = previewReady();
    source.classList.toggle('fetcher-source-ready', ready);
    if (ready) moveSearchIntoPlayer();
    if (sourceNote) sourceNote.hidden = !sourceNote.classList.contains('error');
  }

  new MutationObserver(function () {
    syncSourceUi();
  }).observe(trimMount, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-provider', 'data-kind'] });

  if (sourceNote) {
    new MutationObserver(syncSourceUi).observe(sourceNote, { childList: true, attributes: true, attributeFilter: ['class'] });
  }

  // Loading a chat section completes the source page and unlocks only the look
  // page. Later pages remain locked until their explicit large CTA is used.
  new MutationObserver(function () {
    if (!workspace.hidden && maxUnlocked < 1) {
      maxUnlocked = 1;
      showStage('look');
    }
  }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });

  // The old workspace and side remain implementation anchors for the existing
  // helper modules, but the staged shell owns visible layout from here on.
  side.hidden = true;
  syncSourceUi();
  showStage(maxUnlocked >= 1 ? 'look' : 'source');
})();