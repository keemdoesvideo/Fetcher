/* Centered, page-scroll-free stage flow for the chat workspace. */
(function () {
  'use strict';

  var shell = document.querySelector('.chat-shell');
  var source = document.querySelector('.chat-source');
  var workspace = document.getElementById('chat-workspace');
  var preview = document.querySelector('.chat-preview-card');
  var side = document.querySelector('.chat-side');
  if (!shell || !source || !workspace || !preview || !side) return;

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
    '<div class="chat-flow-top">',
      '<div class="chat-flow-brand">',
        '<span class="chat-flow-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M8 8h8M8 11h5"/></svg></span>',
        '<span class="chat-flow-copy"><strong>chat overlay studio</strong><span>pick the moment · make it yours · export it cleanly</span></span>',
      '</div>',
      '<nav class="chat-flow-nav" aria-label="Chat overlay stages">',
        stageButton('source', '1 · source', false),
        stageButton('look', '2 · look', true),
        stageButton('edit', '3 · edit', true),
        stageButton('export', '4 · export', true),
      '</nav>',
    '</div>',
    '<section class="chat-flow-stage chat-flow-source active" data-stage="source">',
      '<div class="chat-flow-stage-inner">',
        stageHead('01 · source', 'choose the moment', 'Paste a Twitch VOD, use the heatmap/scrubber, then load the slice you actually want.'),
        '<div class="chat-flow-source-mount"></div>',
      '</div>',
    '</section>',
    '<section class="chat-flow-stage" data-stage="look">',
      '<div class="chat-flow-stage-inner">',
        stageHead('02 · look', 'make the chat feel right', 'Pick the layout and entry motion first. Everything here is reflected in the finished overlay.', 'source', 'edit'),
        '<div class="chat-flow-split">',
          '<div class="chat-flow-preview-slot" data-preview-slot="look"></div>',
          '<div class="chat-flow-toolbox">',
            '<div class="chat-flow-tabs" data-tabs="look">',
              tabButton('look', 'looks', true),
              tabButton('custom', 'spacing + sound', false),
            '</div>',
            '<div class="chat-flow-toolhost" data-toolhost="look"></div>',
          '</div>',
        '</div>',
        '<div class="chat-flow-summary"><span class="chat-flow-summary-dot"></span><span id="chat-flow-look-summary">bubble cards · slide up</span></div>',
      '</div>',
    '</section>',
    '<section class="chat-flow-stage" data-stage="edit">',
      '<div class="chat-flow-stage-inner">',
        stageHead('03 · edit', 'clean up the moment', 'Hide distractions, highlight the line that matters, or search the loaded chat without leaving the preview.', 'look', 'export'),
        '<div class="chat-flow-split">',
          '<div class="chat-flow-preview-slot" data-preview-slot="edit"></div>',
          '<div class="chat-flow-toolbox">',
            '<div class="chat-flow-tabs" data-tabs="edit">',
              tabButton('editor', 'messages', true),
              tabButton('insights', 'find + timing', false),
            '</div>',
            '<div class="chat-flow-toolhost" data-toolhost="edit"></div>',
          '</div>',
        '</div>',
      '</div>',
    '</section>',
    '<section class="chat-flow-stage" data-stage="export">',
      '<div class="chat-flow-stage-inner">',
        stageHead('04 · export', 'bake the overlay', 'Choose the delivery settings, save a reusable setup, and send the transparent result straight to your editor.', 'edit', null),
        '<div class="chat-flow-split">',
          '<div class="chat-flow-preview-slot" data-preview-slot="export"></div>',
          '<div class="chat-flow-toolbox">',
            '<div class="chat-flow-tabs" data-tabs="export">',
              tabButton('export', 'export', true),
              tabButton('presets', 'presets', false),
              tabButton('custom', 'canvas + sound', false),
            '</div>',
            '<div class="chat-flow-toolhost" data-toolhost="export"></div>',
          '</div>',
        '</div>',
      '</div>',
    '</section>'
  ].join('');

  function stageButton(stage, label, disabled) {
    return '<button class="chat-flow-step' + (stage === 'source' ? ' active' : '') + '" type="button" data-go-stage="' + stage + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }

  function stageHead(kicker, title, desc, back, next) {
    var actions = '';
    if (back || next) {
      actions = '<div class="chat-flow-actions">' +
        (back ? '<button class="chat-flow-action" type="button" data-go-stage="' + back + '">back</button>' : '') +
        (next ? '<button class="chat-flow-action primary" type="button" data-go-stage="' + next + '">continue →</button>' : '') +
        '</div>';
    }
    return '<div class="chat-flow-stage-head"><div class="chat-flow-stage-title"><span>' + kicker + '</span><h1>' + title + '</h1><p>' + desc + '</p></div>' + actions + '</div>';
  }

  function tabButton(tool, label, active) {
    return '<button class="chat-flow-tab' + (active ? ' active' : '') + '" type="button" data-tool="' + tool + '">' + label + '</button>';
  }

  shell.appendChild(flow);
  var sourceMount = flow.querySelector('.chat-flow-source-mount');
  sourceMount.appendChild(source);

  var activeStage = 'source';
  var unlocked = !workspace.hidden;
  var activeTools = { look: 'look', edit: 'editor', export: 'export' };

  function stageNode(stage) {
    return flow.querySelector('.chat-flow-stage[data-stage="' + stage + '"]');
  }

  function previewSlot(stage) {
    return flow.querySelector('[data-preview-slot="' + stage + '"]');
  }

  function toolHost(stage) {
    return flow.querySelector('[data-toolhost="' + stage + '"]');
  }

  function canVisit(stage) {
    return stage === 'source' || unlocked;
  }

  function setUnlocked(on) {
    unlocked = !!on;
    Array.prototype.forEach.call(flow.querySelectorAll('.chat-flow-step[data-go-stage]'), function (button) {
      if (button.dataset.goStage !== 'source') button.disabled = !unlocked;
    });
  }

  function placePreview(stage) {
    if (stage === 'source') return;
    var slot = previewSlot(stage);
    if (slot && preview.parentNode !== slot) slot.appendChild(preview);
  }

  function placeTool(stage, tool) {
    var host = toolHost(stage);
    var card = cards[tool];
    if (!host || !card) return;
    if (card.parentNode !== host) host.appendChild(card);
    Array.prototype.forEach.call(host.children, function (child) {
      if (child.classList && child.classList.contains('chat-card')) child.hidden = child !== card;
    });
    card.hidden = false;

    var tabs = flow.querySelector('[data-tabs="' + stage + '"]');
    if (tabs) {
      Array.prototype.forEach.call(tabs.querySelectorAll('.chat-flow-tab'), function (button) {
        button.classList.toggle('active', button.dataset.tool === tool);
      });
    }
  }

  function showStage(stage) {
    if (!canVisit(stage)) return;
    activeStage = stage;
    Array.prototype.forEach.call(flow.querySelectorAll('.chat-flow-stage'), function (node) {
      node.classList.toggle('active', node.dataset.stage === stage);
    });
    Array.prototype.forEach.call(flow.querySelectorAll('.chat-flow-step'), function (button) {
      button.classList.toggle('active', button.dataset.goStage === stage);
    });
    if (stage !== 'source') {
      placePreview(stage);
      placeTool(stage, activeTools[stage]);
    }
  }

  flow.addEventListener('click', function (event) {
    var go = event.target.closest('[data-go-stage]');
    if (go) {
      showStage(go.dataset.goStage);
      return;
    }
    var tab = event.target.closest('.chat-flow-tab[data-tool]');
    if (tab) {
      var tabs = tab.closest('[data-tabs]');
      if (!tabs) return;
      var stage = tabs.dataset.tabs;
      activeTools[stage] = tab.dataset.tool;
      placeTool(stage, tab.dataset.tool);
    }
  });

  // Loading a chat section is the natural completion of stage one. The core
  // controller reveals #chat-workspace at that point; use it purely as a signal
  // and move the user into the look stage automatically.
  new MutationObserver(function () {
    if (!workspace.hidden && !unlocked) {
      setUnlocked(true);
      showStage('look');
    }
  }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });

  var lookLabels = {
    bubble: 'bubble cards',
    'fade-stack': 'fade stack',
    ticker: 'ticker',
    staggered: 'staggered stack',
    'emote-cloud': 'emote cloud'
  };
  var entryLabels = {
    slide: 'slide up',
    fade: 'fade',
    pop: 'pop',
    float: 'float',
    instant: 'instant'
  };
  var summary = document.getElementById('chat-flow-look-summary');
  function updateLookSummary(detail) {
    if (!summary) return;
    var look = detail && detail.look || (window.FetcherChatLooks && window.FetcherChatLooks.getLook()) || 'bubble';
    var entry = detail && detail.entry || (window.FetcherChatLooks && window.FetcherChatLooks.getEntry()) || 'slide';
    summary.textContent = (lookLabels[look] || look) + ' · ' + (entryLabels[entry] || entry);
  }
  window.addEventListener('fetcher:chat-look', function (event) { updateLookSummary(event.detail || {}); });

  // The old workspace and side are only implementation anchors now. Keep them in
  // the DOM for existing helper references, but out of layout.
  workspace.hidden = workspace.hidden;
  side.hidden = true;
  setUnlocked(unlocked);
  updateLookSummary();
  showStage(unlocked ? 'look' : 'source');
})();
