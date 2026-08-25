/* Pet-the-paw visit helper: instant click sound on every pet + refresh reset. */
(function () {
  'use strict';

  var isTopWindow = true;
  try { isTopWindow = window.self === window.top; }
  catch (e) { isTopWindow = false; }
  if (!isTopWindow) return;

  var DONE_KEY = 'fetcher.petPawDone';
  var AUDIO_SRC = '/pet-paw-click.mp3';
  var AUDIO_OFFSET = 0.018;
  var audioPool = [];
  var audioIndex = 0;
  var audioContext = null;
  var audioBuffer = null;
  var gainNode = null;

  function resetForVisit() {
    try { sessionStorage.removeItem(DONE_KEY); } catch (e) {}
  }

  function ensureAudioPool() {
    if (audioPool.length) return;
    for (var i = 0; i < 5; i += 1) {
      var audio = new Audio(AUDIO_SRC);
      audio.preload = 'auto';
      audio.volume = 0.55;
      try { audio.load(); } catch (e) {}
      audioPool.push(audio);
    }
  }

  function preloadWebAudio() {
    var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor || !window.fetch) return;
    try {
      audioContext = new AudioContextCtor();
      gainNode = audioContext.createGain();
      gainNode.gain.value = 0.55;
      gainNode.connect(audioContext.destination);
      fetch(AUDIO_SRC, { cache: 'force-cache' })
        .then(function (response) { return response.arrayBuffer(); })
        .then(function (bytes) { return audioContext.decodeAudioData(bytes); })
        .then(function (decoded) { audioBuffer = decoded; })
        .catch(function () {
          audioBuffer = null;
        });
    } catch (e) {
      audioContext = null;
      gainNode = null;
    }
  }

  function playBufferedClick() {
    if (!audioContext || !audioBuffer || !gainNode) return false;

    function start() {
      try {
        var source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);
        source.start(0, Math.min(AUDIO_OFFSET, Math.max(0, audioBuffer.duration - 0.01)));
      } catch (e) {}
    }

    try {
      if (audioContext.state === 'suspended') {
        var resumed = audioContext.resume();
        if (resumed && typeof resumed.then === 'function') resumed.then(start).catch(function () {});
        else start();
      } else {
        start();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function playFallbackClick() {
    ensureAudioPool();
    var audio = audioPool[audioIndex % audioPool.length];
    audioIndex += 1;
    try {
      audio.pause();
      audio.currentTime = AUDIO_OFFSET;
      var promise = audio.play();
      if (promise && typeof promise.catch === 'function') promise.catch(function () {});
    } catch (e) {}
  }

  function playPetClick() {
    if (!playBufferedClick()) playFallbackClick();
  }

  resetForVisit();
  ensureAudioPool();
  preloadWebAudio();

  document.addEventListener('click', function (event) {
    var mark = event.target && event.target.closest ? event.target.closest('.rail .mark') : null;
    if (!mark) return;
    playPetClick();
  }, true);

  window.addEventListener('pageshow', function (event) {
    if (event && event.persisted) resetForVisit();
  });
})();
