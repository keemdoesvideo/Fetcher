/* Pet-the-paw visit helper: click sound on every pet + refresh reset. */
(function () {
  'use strict';

  var isTopWindow = true;
  try { isTopWindow = window.self === window.top; }
  catch (e) { isTopWindow = false; }
  if (!isTopWindow) return;

  var DONE_KEY = 'fetcher.petPawDone';
  var AUDIO_SRC = '/pet-paw-click.mp3';
  var audioPool = [];
  var audioIndex = 0;

  function resetForVisit() {
    try { sessionStorage.removeItem(DONE_KEY); } catch (e) {}
  }

  function ensureAudioPool() {
    if (audioPool.length) return;
    for (var i = 0; i < 5; i += 1) {
      var audio = new Audio(AUDIO_SRC);
      audio.preload = 'auto';
      audio.volume = 0.55;
      audioPool.push(audio);
    }
  }

  function playPetClick() {
    ensureAudioPool();
    var audio = audioPool[audioIndex % audioPool.length];
    audioIndex += 1;
    try {
      audio.pause();
      audio.currentTime = 0;
      var promise = audio.play();
      if (promise && typeof promise.catch === 'function') promise.catch(function () {});
    } catch (e) {}
  }

  resetForVisit();

  document.addEventListener('click', function (event) {
    var mark = event.target && event.target.closest ? event.target.closest('.rail .mark') : null;
    if (!mark) return;
    playPetClick();
  }, true);

  window.addEventListener('pageshow', function (event) {
    if (event && event.persisted) resetForVisit();
  });
})();
