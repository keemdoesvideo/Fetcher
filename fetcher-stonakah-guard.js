/* Temporary hard-disable for the broken Stonakah groove experiment.
 * Loaded after fetcher-launch.js so it always wins until the effect is rebuilt.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  function killStonakahGroove() {
    root.classList.remove('fetcher-stonakah-carve-active');

    document.querySelectorAll('.fetcher-stonakah-groove').forEach(function (node) {
      try { node.remove(); } catch (e) {}
    });

    document.querySelectorAll('.app,.main,.fetcher-content-host,.fetcher-page-frame').forEach(function (node) {
      node.style.removeProperty('background');
      node.style.removeProperty('background-color');
      node.style.removeProperty('position');
      node.style.removeProperty('z-index');
    });
  }

  killStonakahGroove();

  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (root.classList.contains('fetcher-stonakah-carve-active') || document.querySelector('.fetcher-stonakah-groove')) {
        killStonakahGroove();
      }
    }).observe(root, { attributes: true, attributeFilter: ['class'] });

    new MutationObserver(function () {
      if (document.querySelector('.fetcher-stonakah-groove')) killStonakahGroove();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener('fetcher:easter-change', killStonakahGroove, true);
  document.addEventListener('DOMContentLoaded', killStonakahGroove, { once: true });
})();
