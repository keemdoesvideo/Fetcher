/* Three-stage, centered chat workflow: source -> style -> export. */
(function () {
  'use strict';

  var shell = document.querySelector('.chat-shell');
  var source = document.querySelector('.chat-source');
  var workspace = document.getElementById('chat-workspace');
  var preview = document.querySelector('.chat-preview-card');
  var side = document.querySelector('.chat-side');
  var trimMount = document.getElementById('chat-trim-mount');
  var sourceNote = document.getElementById('chat-source-note');
  var previewMeta = document.getElementById('chat-preview-meta');
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
      '<div class="chat-flow-stage-inner chat-flow-source-inner"><div class="chat-flow-source-mount"></div></div>',
    '</section>',

    '<section class="chat-flow-stage" data-stage="style">',
      '<div class="chat-flow-stage-inner">',
        '<div class="chat-style-grid">',
          '<div class="chat-style-left">',
            '<div class="chat-flow-preview-slot" data-preview-slot="style"></div>',
            '<div class="chat-look-mount"></div>',
          '</div>',
          '<div class="chat-style-right">',
            '<div class="chat-style-switch" role="tablist" aria-label="Style controls">',
              '<button type="button" class="chat-style-switch-item active" data-style-pane="spacing">spacing</button>',
              '<span class="chat-style-switch-divider" aria-hidden="true"></span>',
              '<button type="button" class="chat-style-switch-item" data-style-pane="sound">sound</button>',
            '</div>',
            '<div class="chat-style-options"></div>',
            '<div class="chat-message-editor-mount"></div>',
            '<button class="chat-flow-next" type="button" data-unlock-stage="export">on to export <span>→</span></button>',
          '</div>',
        '</div>',
      '</div>',
    '</section>',

    '<section class="chat-flow-stage" data-stage="export">',
      '<div class="chat-flow-stage-inner">',
        '<div class="chat-export-grid">',
          '<div class="chat-flow-preview-slot" data-preview-slot="export"></div>',
          '<div class="chat-export-long">',
            '<div class="chat-export-main-mount"></div>',
            '<div class="chat-export-presets-mount"></div>',
            '<div class="chat-export-canvas-section">',
              '<div class="chat-export-section-title">canvas</div>',
              '<div class="chat-export-canvas-grid"></div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',
    '</section>'
  ].join('');

  shell.appendChild(flow);
  flow.querySelector('.chat-flow-source-mount').appendChild(source);

  var stages = ['source', 'style', 'export'];
  var activeStage = 'source';
  var maxUnlocked = workspace.hidden ? 0 : 1;
  var leftArrow = flow.querySelector('.chat-page-arrow-left');
  var rightArrow = flow.querySelector('.chat-page-arrow-right');
  var searchLaunch = document.querySelector('.chat-fullsearch-launch');
  var activeStylePane = 'spacing';

  function indexOfStage(stage) { return stages.indexOf(stage); }
  function canVisit(stage) {
    var index = indexOfStage(stage);
    return index >= 0 && index <= maxUnlocked;
  }

  function fieldFor(id) {
    var el = document.getElementById(id);
    return el ? el.closest('.chat-custom-field') : null;
  }

  function appendIf(parent, node) {
    if (parent && node && node.parentNode !== parent) parent.appendChild(node);
  }

  function decorateLookPreviews() {
    if (!cards.look) return;
    Array.prototype.forEach.call(cards.look.querySelectorAll('.chat-look-option'), function (option) {
      var mini = option.querySelector('.chat-look-mini');
      if (!mini || mini.dataset.fetcherPreview === '1') return;
      mini.dataset.fetcherPreview = '1';
      if (option.dataset.look === 'emote-cloud') {
        mini.innerHTML = '<span class="chat-demo-emote e1">✦</span><span class="chat-demo-emote e2">●</span><span class="chat-demo-emote e3">◆</span><span class="chat-demo-emote e4">★</span>';
      } else {
        mini.innerHTML = '<span class="chat-demo-msg m1"><i></i><b></b></span><span class="chat-demo-msg m2"><i></i><b></b></span><span class="chat-demo-msg m3"><i></i><b></b></span>';
      }
    });
  }

  function placeStaticTools() {
    var lookMount = flow.querySelector('.chat-look-mount');
    var editorMount = flow.querySelector('.chat-message-editor-mount');
    var exportMount = flow.querySelector('.chat-export-main-mount');
    var presetsMount = flow.querySelector('.chat-export-presets-mount');
    var canvasGrid = flow.querySelector('.chat-export-canvas-grid');

    appendIf(lookMount, cards.look);
    appendIf(editorMount, cards.editor);
    appendIf(exportMount, cards.export);
    appendIf(presetsMount, cards.presets);

    ['chat-canvas-mode', 'chat-canvas-aspect', 'chat-canvas-padding'].forEach(function (id) {
      appendIf(canvasGrid, fieldFor(id));
    });

    if (cards.insights) cards.insights.hidden = true;
    decorateLookPreviews();
  }

  function styleGridParts() {
    if (!cards.custom) return { visual: null, sound: null };
    var grids = cards.custom.querySelectorAll('.chat-custom-grid');
    return { visual: grids[0] || null, sound: grids[1] || null };
  }

  function showStylePane(pane) {
    pane = pane === 'sound' ? 'sound' : 'spacing';
    activeStylePane = pane;
    var host = flow.querySelector('.chat-style-options');
    if (!host || !cards.custom) return;
    appendIf(host, cards.custom);

    var parts = styleGridParts();
    if (parts.visual) parts.visual.hidden = pane !== 'spacing';
    if (parts.sound) parts.sound.hidden = pane !== 'sound';

    var divider = cards.custom.querySelector('.chat-custom-divider');
    if (divider) divider.hidden = true;
    var head = cards.custom.querySelector('.chat-custom-head');
    if (head) head.hidden = true;

    Array.prototype.forEach.call(cards.custom.querySelectorAll('.chat-custom-note'), function (note) {
      note.hidden = true;
    });

    Array.prototype.forEach.call(flow.querySelectorAll('.chat-style-switch-item'), function (button) {
      button.classList.toggle('active', button.dataset.stylePane === pane);
      button.setAttribute('aria-selected', button.dataset.stylePane === pane ? 'true' : 'false');
    });

    cards.custom.classList.remove('chat-tool-swap');
    requestAnimationFrame(function () { cards.custom.classList.add('chat-tool-swap'); });
  }

  function placePreview(stage) {
    if (stage === 'source') return;
    var slot = flow.querySelector('[data-preview-slot="' + stage + '"]');
    if (slot && preview.parentNode !== slot) slot.appendChild(preview);
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
    if (stage === 'style') {
      placePreview('style');
      placeStaticTools();
      showStylePane(activeStylePane);
    } else if (stage === 'export') {
      placePreview('export');
      placeStaticTools();
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
    var target = indexOfStage(activeStage) + delta;
    if (target < 0 || target > maxUnlocked || target >= stages.length) return;
    showStage(stages[target]);
  }

  leftArrow.addEventListener('click', function () { moveBy(-1); });
  rightArrow.addEventListener('click', function () { moveBy(1); });

  flow.addEventListener('click', function (event) {
    var unlock = event.target.closest('[data-unlock-stage]');
    if (unlock) {
      unlockAndShow(unlock.dataset.unlockStage);
      return;
    }
    var stylePane = event.target.closest('[data-style-pane]');
    if (stylePane) showStylePane(stylePane.dataset.stylePane);
  });

  function previewReady() {
    return trimMount.classList.contains('open') &&
      trimMount.dataset.provider === 'twitch' &&
      !!trimMount.querySelector('.trim-video');
  }

  function moveSearchIntoPlayer() {
    if (!searchLaunch || !searchLaunch.isConnected) {
      searchLaunch = document.querySelector('.chat-fullsearch-launch') || searchLaunch;
    }
    var wrap = trimMount.querySelector('.trim-video-wrap');
    if (!searchLaunch || !wrap) return;

    // Mark/decorate once, then move it. The full-search helper alone owns the
    // .ready state because it waits for real duration metadata. Having both
    // helpers toggle .ready caused an observer feedback loop while the VOD was
    // still loading and could freeze the entire page.
    if (searchLaunch.dataset.fetcherPlayerSearch !== '1') {
      searchLaunch.dataset.fetcherPlayerSearch = '1';
      searchLaunch.innerHTML = '<span class="chat-player-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg></span><span>search whole VOD</span>';
    }
    if (searchLaunch.parentNode !== wrap) wrap.appendChild(searchLaunch);
    searchLaunch.classList.add('chat-player-search');
  }

  function syncSourceUi() {
    var ready = previewReady();
    source.classList.toggle('fetcher-source-ready', ready);
    if (ready) moveSearchIntoPlayer();
    if (sourceNote) sourceNote.hidden = !sourceNote.classList.contains('error');
  }

  // The trimmer already constructs its video/player DOM at mount time. We only
  // need to react when the mount itself opens or changes provider/kind. Do not
  // observe descendant class changes: the Search VOD button lives inside the
  // player, and observing its .ready class would create a self-triggering loop.
  new MutationObserver(syncSourceUi).observe(trimMount, {
    attributes: true,
    attributeFilter: ['class', 'data-provider', 'data-kind']
  });

  if (sourceNote) {
    new MutationObserver(syncSourceUi).observe(sourceNote, {
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function chatLoaded() {
    if (workspace.hidden) return;
    maxUnlocked = Math.max(maxUnlocked, 1);
    showStage('style');
  }

  // First load toggles workspace.hidden; later re-loads update the preview meta.
  // Watching both means Load chat remains a meaningful action after navigating back.
  new MutationObserver(chatLoaded).observe(workspace, {
    attributes: true,
    attributeFilter: ['hidden']
  });
  if (previewMeta) {
    new MutationObserver(chatLoaded).observe(previewMeta, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  window.addEventListener('fetcher:chat-loaded', chatLoaded);

  side.hidden = true;
  placeStaticTools();
  syncSourceUi();
  showStage(maxUnlocked >= 1 ? 'style' : 'source');
})();