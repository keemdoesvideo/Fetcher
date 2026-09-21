/* Branch-only Style Lab UI arranger.
   Reintroduces a compact tabbed sidebar and moves motion/editor controls out of
   the look-card column so the preview + look carousel can breathe on laptops. */
(function () {
  'use strict';

  var styleStage = document.querySelector('.chat-flow-stage[data-stage="style"]');
  var styleRight = document.querySelector('.chat-style-right');
  var switcher = styleRight && styleRight.querySelector('.chat-style-switch');
  var host = styleRight && styleRight.querySelector('.chat-style-options');
  var oldEditorMount = styleRight && styleRight.querySelector('.chat-message-editor-mount');
  var customCard = document.querySelector('.chat-custom-card');
  var motionCard = document.querySelector('.chat-motion-card');
  var editorCard = document.querySelector('.chat-editor-card');
  if (!styleStage || !styleRight || !switcher || !host || !customCard || !motionCard || !editorCard) return;

  var parking = document.createDocumentFragment();
  var activePane = 'style';

  var oldButtons = Array.prototype.slice.call(switcher.querySelectorAll('.chat-style-switch-item'));
  var styleButton = oldButtons.find(function (button) { return button.dataset.stylePane === 'spacing'; }) || oldButtons[0];
  var soundButton = oldButtons.find(function (button) { return button.dataset.stylePane === 'sound'; }) || oldButtons[1];

  if (styleButton) {
    styleButton.dataset.stylePane = 'style';
    styleButton.textContent = 'style';
  }

  function makeDivider() {
    var divider = document.createElement('span');
    divider.className = 'chat-style-switch-divider';
    divider.setAttribute('aria-hidden', 'true');
    return divider;
  }

  function makeTab(value, label) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-style-switch-item';
    button.dataset.stylePane = value;
    button.textContent = label;
    return button;
  }

  var motionButton = makeTab('motion', 'motion');
  var messagesButton = makeTab('messages', 'messages');

  /* Rebuild the compact tab row in a stable order. Existing buttons keep their
     styling but the old stages.js click handler is intercepted below. */
  switcher.innerHTML = '';
  if (styleButton) switcher.appendChild(styleButton);
  switcher.appendChild(makeDivider());
  switcher.appendChild(motionButton);
  switcher.appendChild(makeDivider());
  if (soundButton) switcher.appendChild(soundButton);
  switcher.appendChild(makeDivider());
  switcher.appendChild(messagesButton);

  function moveOut(node) {
    if (node && node.parentNode === host) parking.appendChild(node);
  }

  function customGrids() {
    return Array.prototype.slice.call(customCard.querySelectorAll('.chat-custom-grid'));
  }

  function setCustomPane(which) {
    var grids = customGrids();
    grids.forEach(function (grid, index) {
      grid.hidden = which === 'style' ? index !== 0 : index !== 1;
    });
    var divider = customCard.querySelector('.chat-custom-divider');
    if (divider) divider.hidden = true;
    var head = customCard.querySelector('.chat-custom-head');
    if (head) head.hidden = true;
    Array.prototype.forEach.call(customCard.querySelectorAll('.chat-custom-note'), function (note) {
      note.hidden = true;
    });
  }

  function setTabs() {
    Array.prototype.forEach.call(switcher.querySelectorAll('.chat-style-switch-item'), function (button) {
      var on = button.dataset.stylePane === activePane;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function showPane(pane) {
    if (['style', 'motion', 'sound', 'messages'].indexOf(pane) === -1) pane = 'style';
    activePane = pane;

    moveOut(customCard);
    moveOut(motionCard);
    moveOut(editorCard);

    if (pane === 'style' || pane === 'sound') {
      setCustomPane(pane);
      host.appendChild(customCard);
    } else if (pane === 'motion') {
      host.appendChild(motionCard);
    } else {
      host.appendChild(editorCard);
    }

    setTabs();
    host.classList.remove('chat-tool-swap');
    requestAnimationFrame(function () { host.classList.add('chat-tool-swap'); });
  }

  /* The original staged flow still owns source/style/export navigation. We only
     own this inner tab row, so stop its old spacing/sound handler before it sees
     these clicks. */
  switcher.addEventListener('click', function (event) {
    var button = event.target.closest('[data-style-pane]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    showPane(button.dataset.stylePane);
  }, true);

  /* stages.js may move the custom/editor cards back into its old mounts whenever
     Stage 2 is re-entered. Re-apply our pane after that synchronous work settles. */
  new MutationObserver(function () {
    if (!styleStage.classList.contains('active')) return;
    requestAnimationFrame(function () { showPane(activePane); });
  }).observe(styleStage, { attributes: true, attributeFilter: ['class'] });

  if (oldEditorMount) oldEditorMount.setAttribute('aria-hidden', 'true');
  showPane('style');
})();