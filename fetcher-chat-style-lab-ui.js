/* Branch-only Style Lab Stage 2 arranger.
   Keeps the approved look carousel on the left and turns the right panel into
   one continuous, internally-scrollable settings surface. No source/search
   observers are touched here. */
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
  var advanced = styleRight && styleRight.querySelector('.chat-advanced');
  var next = styleRight && styleRight.querySelector('.chat-flow-next');
  if (!styleStage || !styleRight || !host || !customCard || !motionCard || !editorCard) return;

  var grids = Array.prototype.slice.call(customCard.querySelectorAll('.chat-custom-grid'));
  if (grids.length < 2) return;
  var styleGrid = grids[0];
  var soundGrid = grids[1];

  function makeSection(className, title, note) {
    var section = document.createElement('section');
    section.className = 'chat-sidebar-section ' + className;
    var head = document.createElement('div');
    head.className = 'chat-sidebar-section-head';
    head.innerHTML = '<div><span class="chat-sidebar-kicker">settings</span><h3>' + title + '</h3></div>' +
      (note ? '<p>' + note + '</p>' : '');
    section.appendChild(head);
    return section;
  }

  var styleSection = makeSection('chat-sidebar-style-section', 'style', 'bubble shape + type');
  var soundSection = makeSection('chat-sidebar-sound-section', 'sound', 'message cues');

  styleSection.appendChild(styleGrid);
  soundSection.appendChild(soundGrid);

  motionCard.classList.add('chat-sidebar-section', 'chat-sidebar-motion-section');
  editorCard.classList.add('chat-sidebar-section', 'chat-sidebar-message-section');
  if (advanced) advanced.classList.add('chat-sidebar-advanced');

  if (switcher) {
    switcher.hidden = true;
    switcher.setAttribute('aria-hidden', 'true');
  }
  if (oldEditorMount) {
    oldEditorMount.hidden = true;
    oldEditorMount.setAttribute('aria-hidden', 'true');
  }

  styleRight.classList.add('chat-style-scroll-layout');
  host.classList.add('chat-style-scrollbody');

  function hideLegacyChrome() {
    var head = customCard.querySelector('.chat-custom-head');
    var divider = customCard.querySelector('.chat-custom-divider');
    if (head) head.hidden = true;
    if (divider) divider.hidden = true;
    Array.prototype.forEach.call(customCard.querySelectorAll('.chat-custom-note'), function (note) {
      note.hidden = true;
    });
    styleGrid.hidden = false;
    soundGrid.hidden = false;
  }

  function restoreLayout() {
    hideLegacyChrome();

    /* stages.js can re-home the wired cards whenever Stage 2 is shown again.
       Move the original nodes back rather than cloning them so every existing
       listener and setting value is preserved. */
    customCard.appendChild(styleSection);
    customCard.appendChild(motionCard);
    customCard.appendChild(soundSection);
    customCard.appendChild(editorCard);
    if (advanced) customCard.appendChild(advanced);

    if (customCard.parentNode !== host) host.appendChild(customCard);
    if (next && next.parentNode !== styleRight) styleRight.appendChild(next);
  }

  restoreLayout();

  /* Class-only stage observation is intentionally narrow. It cannot see the
     descendant class changes that caused the old source/search feedback loop. */
  new MutationObserver(function () {
    if (!styleStage.classList.contains('active')) return;
    requestAnimationFrame(restoreLayout);
  }).observe(styleStage, { attributes: true, attributeFilter: ['class'] });

  /* If the original stage helper pulls the editor back into its legacy mount
     during an in-place chat reload, quietly reclaim it. Child insertion only. */
  if (oldEditorMount) {
    new MutationObserver(function () {
      if (!styleStage.classList.contains('active')) return;
      if (editorCard.parentNode === oldEditorMount) requestAnimationFrame(restoreLayout);
    }).observe(oldEditorMount, { childList: true });
  }
})();