/*
 * fetcher-about.js
 * About-page visitor statistic. Reduced motion resolves immediately; Reserved
 * keeps the same count-up idea but reaches the final value faster than Full.
 */
(function () {
  'use strict';

  var countEl = document.getElementById('visit-count');
  var labelEl = document.getElementById('visit-label');
  var statBlock = document.querySelector('.about-stat');
  if (!countEl || !labelEl || !statBlock) return;

  var motion = document.documentElement.getAttribute('data-motion') || 'full';

  fetch('/api/visits')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      var count = data && typeof data.count === 'number' ? data.count : 0;
      labelEl.textContent = (count === 1 ? 'person has' : 'people have') + ' opened fetcher';

      if (motion === 'reduced' || count <= 0 || document.hidden) {
        countEl.textContent = count.toLocaleString();
        return;
      }

      var duration = motion === 'reserved' ? 520 : 900;
      var start = performance.now();

      function tick(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        countEl.textContent = Math.round(eased * count).toLocaleString();
        if (t < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
      setTimeout(function () {
        countEl.textContent = count.toLocaleString();
      }, duration + 150);
    })
    .catch(function () {
      statBlock.style.display = 'none';
    });
})();
