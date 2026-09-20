/* 7TV username paints for Fetcher's Twitch replay preview. */
(function () {
  'use strict';

  var stack = document.getElementById('chat-stack');
  if (!stack) return;

  var css = document.createElement('style');
  css.textContent = [
    '.chat-user.fetcher-7tv-paint{display:inline-block;color:inherit}',
    '.chat-user.fetcher-7tv-paint.fetcher-7tv-gradient{background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent}'
  ].join('\n');
  document.head.appendChild(css);

  var paintByMessage = Object.create(null);

  function cssColor(color, alpha) {
    color = String(color || '').trim();
    var match = /^#([0-9a-fA-F]{6})$/.exec(color);
    if (!match) return color || '#ffffff';
    var raw = match[1];
    var r = parseInt(raw.slice(0, 2), 16);
    var g = parseInt(raw.slice(2, 4), 16);
    var b = parseInt(raw.slice(4, 6), 16);
    var a = Number(alpha);
    if (!isFinite(a)) a = 1;
    a = Math.max(0, Math.min(1, a));
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function gradientCss(paint) {
    var stops = Array.isArray(paint.stops) ? paint.stops.slice() : [];
    stops = stops.filter(function (stop) {
      return stop && isFinite(Number(stop.at));
    }).sort(function (a, b) {
      return Number(a.at) - Number(b.at);
    });
    if (!stops.length) return '';

    var stopText = stops.map(function (stop) {
      return cssColor(stop.color, stop.alpha) + ' ' + (Math.max(0, Math.min(1, Number(stop.at))) * 100).toFixed(2) + '%';
    }).join(', ');

    if (paint.kind === 'radial') {
      return (paint.repeat ? 'repeating-radial-gradient' : 'radial-gradient') + '(circle, ' + stopText + ')';
    }
    return (paint.repeat ? 'repeating-linear-gradient' : 'linear-gradient') + '(' + (Number(paint.angle || 0) || 0) + 'deg, ' + stopText + ')';
  }

  function shadowCss(paint) {
    var shadows = Array.isArray(paint.shadows) ? paint.shadows : [];
    return shadows.map(function (shadow) {
      if (!shadow) return '';
      var x = Number(shadow.x || 0) || 0;
      var y = Number(shadow.y || 0) || 0;
      var radius = Math.max(0, Number(shadow.radius || 0) || 0);
      return 'drop-shadow(' + x + 'px ' + y + 'px ' + radius + 'px ' + cssColor(shadow.color, shadow.alpha) + ')';
    }).filter(Boolean).join(' ');
  }

  function resetUser(user) {
    user.classList.remove('fetcher-7tv-paint', 'fetcher-7tv-gradient');
    user.style.backgroundImage = '';
    user.style.backgroundClip = '';
    user.style.webkitBackgroundClip = '';
    user.style.webkitTextFillColor = '';
    user.style.filter = '';
    user.style.color = '';
    user.removeAttribute('data-7tv-paint');
  }

  function decorate(node) {
    if (!node || node.nodeType !== 1 || !node.classList.contains('chat-message')) return;
    var id = String(node.dataset.chatId || '');
    var paint = id && paintByMessage[id];
    if (!paint) return;

    var user = node.querySelector('.chat-user');
    if (!user) return;
    resetUser(user);
    user.classList.add('fetcher-7tv-paint');
    user.dataset.sevenTvPaint = String(paint.name || '7TV paint');
    user.title = paint.name ? '7TV paint · ' + paint.name : '7TV username paint';

    var gradient = gradientCss(paint);
    if ((paint.kind === 'linear' || paint.kind === 'radial') && gradient) {
      user.classList.add('fetcher-7tv-gradient');
      user.style.backgroundImage = gradient;
    } else {
      user.style.color = cssColor(paint.color, paint.alpha);
    }

    var shadow = shadowCss(paint);
    if (shadow) user.style.filter = shadow;
  }

  function decorateAll() {
    Array.prototype.forEach.call(stack.querySelectorAll('.chat-message'), decorate);
  }

  function rememberPayload(body) {
    paintByMessage = Object.create(null);
    var messages = body && Array.isArray(body.messages) ? body.messages : [];
    messages.forEach(function (message) {
      if (!message || !message.id || !message.user || !message.user.paint) return;
      paintByMessage[String(message.id)] = message.user.paint;
    });
    decorateAll();
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
        if (!node || node.nodeType !== 1) return;
        decorate(node);
        Array.prototype.forEach.call(node.querySelectorAll ? node.querySelectorAll('.chat-message') : [], decorate);
      });
    });
  }).observe(stack, { childList: true, subtree: true });

  var upstreamFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
    var responsePromise = upstreamFetch.call(window, resource, init);
    if (url.indexOf('/api/chat/twitch') !== -1) {
      responsePromise.then(function (response) {
        if (!response || !response.ok) return;
        response.clone().json().then(function (body) {
          if (body && Array.isArray(body.messages)) rememberPayload(body);
        }).catch(function () {});
      }).catch(function () {});
    }
    return responsePromise;
  };
})();
