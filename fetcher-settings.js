/*
 * fetcher-settings.js
 * Settings category navigation and generic preference segmented controls.
 * Preference storage/resolution stays in fetcher-prefs.js.
 */
(function () {
  'use strict';

  var PANEL_ORDER = ['appearance', 'video', 'audio', 'files', 'accessibility'];
  var navItems = Array.prototype.slice.call(document.querySelectorAll('.settings-nav-item'));
  var panels = {};
  PANEL_ORDER.forEach(function (name) { panels[name] = document.getElementById('panel-' + name); });
  var currentPanel = 'appearance';
  var navThumb = document.querySelector('.settings-nav-thumb');

  function restoreTransitionSoon(el) {
    requestAnimationFrame(function () { if (el) el.style.transition = ''; });
  }

  function moveNavThumb(item, animate) {
    if (!item || !navThumb) return;
    navThumb.style.transition = animate === false ? 'none' : '';
    navThumb.style.width = item.offsetWidth + 'px';
    navThumb.style.height = item.offsetHeight + 'px';
    navThumb.style.transform = 'translate(' + item.offsetLeft + 'px,' + item.offsetTop + 'px)';
    if (animate === false) restoreTransitionSoon(navThumb);
  }

  function moveSegThumb(group, btn, animate) {
    var thumb = group.querySelector('.thumb');
    if (!thumb || !btn) return;
    thumb.style.transition = animate === false ? 'none' : '';
    thumb.style.width = btn.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (btn.offsetLeft - 4) + 'px)';
    if (animate === false) restoreTransitionSoon(thumb);
  }

  function placePanelThumbs(panel) {
    Array.prototype.slice.call(panel.querySelectorAll('.settings-seg[data-pref]')).forEach(function (group) {
      var active = group.querySelector('.settings-seg-btn[aria-pressed="true"]');
      moveSegThumb(group, active, false);
    });
  }

  function showPanel(name) {
    if (!panels[name] || name === currentPanel) return;

    var fromIndex = PANEL_ORDER.indexOf(currentPanel);
    var toIndex = PANEL_ORDER.indexOf(name);
    var goingBack = toIndex < fromIndex;

    panels[currentPanel].classList.remove('active', 'back');
    var next = panels[name];
    next.classList.remove('active', 'back');

    /* No forced layout flush. The panel was display:none, so adding active on a
       fresh animation frame naturally creates a new entrance animation. */
    requestAnimationFrame(function () {
      next.classList.add('active');
      if (goingBack) next.classList.add('back');
      placePanelThumbs(next);
    });

    navItems.forEach(function (item) {
      item.setAttribute('aria-current', String(item.dataset.panel === name));
    });
    moveNavThumb(document.querySelector('.settings-nav-item[data-panel="' + name + '"]'), true);

    currentPanel = name;
    history.replaceState(null, '', '#' + name);
  }

  navItems.forEach(function (item) {
    item.addEventListener('click', function () { showPanel(item.dataset.panel); });
  });

  var initial = (location.hash || '').replace('#', '');
  if (PANEL_ORDER.indexOf(initial) !== -1 && initial !== 'appearance') {
    panels.appearance.classList.remove('active');
    panels[initial].classList.add('active');
    navItems.forEach(function (item) {
      item.setAttribute('aria-current', String(item.dataset.panel === initial));
    });
    currentPanel = initial;
  }

  requestAnimationFrame(function () {
    moveNavThumb(document.querySelector('.settings-nav-item[aria-current="true"]'), false);
    placePanelThumbs(panels[currentPanel]);
  });

  window.addEventListener('resize', function () {
    moveNavThumb(document.querySelector('.settings-nav-item[aria-current="true"]'), false);
    placePanelThumbs(panels[currentPanel]);
  });

  var savedFlash = document.getElementById('saved-flash');
  var savedTimer = null;
  function flashSaved() {
    if (!savedFlash) return;
    savedFlash.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { savedFlash.classList.remove('show'); }, 1300);
  }

  var previewVideo = document.getElementById('preview-video-name');
  var previewAudio = document.getElementById('preview-audio-name');
  function updateFilenamePreview() {
    if (!previewVideo || !previewAudio) return;
    var style = FetcherPrefs.get('fetcher.filenameStyle');
    if (style === 'original') {
      previewVideo.textContent = 'original_source_file.mp4';
      previewAudio.textContent = 'original_source_file.mp3';
    } else {
      previewVideo.textContent = 'Video Title - Creator.mp4';
      previewAudio.textContent = 'Audio Title - Creator.mp3';
    }
  }

  function onPrefChanged(key) {
    if (key === 'fetcher.filenameStyle') updateFilenamePreview();
  }

  Array.prototype.slice.call(document.querySelectorAll('.settings-seg[data-pref]')).forEach(function (group) {
    var prefKey = group.dataset.pref;
    var buttons = Array.prototype.slice.call(group.querySelectorAll('.settings-seg-btn'));
    var current = FetcherPrefs.get(prefKey);

    function select(value, animate, fireSave) {
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.value === value));
      });
      var active = buttons.filter(function (button) { return button.dataset.value === value; })[0] || buttons[0];
      moveSegThumb(group, active, animate);
      if (fireSave) {
        FetcherPrefs.set(prefKey, value);
        flashSaved();
        onPrefChanged(prefKey);
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () { select(button.dataset.value, true, true); });
    });

    requestAnimationFrame(function () { select(current, false, false); });
  });

  updateFilenamePreview();
})();
