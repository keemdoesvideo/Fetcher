/* Animate the rebuilt URL pill into the Twitch preview card.
   Uses only trimMount's own readiness attributes + child insertion. It never
   watches descendant class mutations, so it cannot recreate the old observer loop. */
(function () {
  'use strict';

  var source = document.querySelector('.chat-source');
  var urlWrap = source && source.querySelector('.chat-url-wrap');
  var urlInput = document.getElementById('chat-url');
  var trimMount = document.getElementById('chat-trim-mount');
  if (!source || !urlWrap || !urlInput || !trimMount) return;

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var compact = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  var running = false;
  var lastAnimatedUrl = '';
  var frame = 0;
  var timers = [];
  var shell = null;

  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    while (timers.length) window.clearTimeout(timers.pop());
  }

  function removeShell() {
    if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
    shell = null;
  }

  function sourceReady() {
    return trimMount.classList.contains('open') &&
      trimMount.dataset.provider === 'twitch' &&
      !!trimMount.querySelector('.trim-panel');
  }

  function resetWhenClosed() {
    if (sourceReady()) return;
    if (running) {
      running = false;
      clearTimers();
      removeShell();
    }
    source.classList.remove('fetcher-source-morphing', 'fetcher-source-reveal', 'fetcher-source-morph-complete');
  }

  function makeShell(rect, text) {
    var node = document.createElement('div');
    node.className = 'fetcher-url-morph-shell';
    node.setAttribute('aria-hidden', 'true');
    node.style.left = rect.left + 'px';
    node.style.top = rect.top + 'px';
    node.style.width = rect.width + 'px';
    node.style.height = rect.height + 'px';

    var content = document.createElement('div');
    content.className = 'fetcher-url-morph-content';
    content.innerHTML = [
      '<svg class="fetcher-url-morph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"></path></svg>',
      '<span class="fetcher-url-morph-text"></span>',
      '<span class="fetcher-url-morph-paste">paste</span>'
    ].join('');
    content.querySelector('.fetcher-url-morph-text').textContent = text;
    node.appendChild(content);
    document.body.appendChild(node);
    return node;
  }

  function finish(url) {
    running = false;
    lastAnimatedUrl = url;
    source.classList.remove('fetcher-source-morphing', 'fetcher-source-reveal');
    source.classList.add('fetcher-source-morph-complete');
    removeShell();
  }

  function startMorph(url) {
    var panel = trimMount.querySelector('.trim-panel');
    if (!panel || running) return;

    if (reducedMotion || compact) {
      lastAnimatedUrl = url;
      source.classList.add('fetcher-source-morph-complete');
      return;
    }

    var startRect = urlWrap.getBoundingClientRect();
    if (!startRect.width || !startRect.height) return;

    running = true;
    clearTimers();
    removeShell();
    source.classList.remove('fetcher-source-morph-complete', 'fetcher-source-reveal');

    shell = makeShell(startRect, url || urlInput.placeholder || '');

    /* Collapse the real row only after the clone has captured it. This lets the
       Twitch panel move into its final layout position underneath the shell. */
    source.classList.add('fetcher-source-morphing');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!shell || !sourceReady()) {
          finish(url);
          return;
        }

        var target = panel.getBoundingClientRect();
        if (!target.width || !target.height) {
          finish(url);
          return;
        }

        shell.classList.add('is-expanding');
        shell.style.left = target.left + 'px';
        shell.style.top = target.top + 'px';
        shell.style.width = target.width + 'px';
        shell.style.height = target.height + 'px';

        /* Let the empty shell finish most of its stretch before the actual Twitch
           preview materialises underneath it. */
        later(function () {
          source.classList.add('fetcher-source-reveal');
        }, 285);

        later(function () {
          if (shell) shell.classList.add('is-revealing');
        }, 335);

        later(function () {
          finish(url);
        }, 535);
      });
    });
  }

  function check() {
    frame = 0;
    if (!sourceReady()) {
      resetWhenClosed();
      return;
    }

    var url = String(urlInput.value || '').trim();
    if (!url || running || url === lastAnimatedUrl) return;
    startMorph(url);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(check);
  }

  /* Only observe the trimmer's own readiness attributes. */
  new MutationObserver(schedule).observe(trimMount, {
    attributes: true,
    attributeFilter: ['class', 'data-provider', 'data-kind']
  });

  /* The panel itself can be inserted after those attributes change. ChildList is
     safe here because this helper never mutates the trimMount subtree. */
  new MutationObserver(schedule).observe(trimMount, {
    childList: true,
    subtree: true
  });

  /* A new pasted/typed URL gets its own morph once the trimmer closes and opens
     for that source. Do not animate merely because the input text changed. */
  urlInput.addEventListener('input', function () {
    if (!sourceReady()) {
      lastAnimatedUrl = '';
      resetWhenClosed();
    }
  });

  window.addEventListener('resize', function () {
    if (running) {
      clearTimers();
      finish(String(urlInput.value || '').trim());
    }
  });

  schedule();
})();
