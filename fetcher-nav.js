/*
 * fetcher-nav.js  (loaded on every page, in <head>)
 * Shared shell helpers: the paw cursor fix plus distance-aware timing for the
 * sidebar highlight pill.
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Paw cursor

     The first cursor pass rasterised the supplied paw artwork at about 40x34,
     which made it feel oversized, and it preserved faint source-alpha pixels
     that made the paw look washed out on some backgrounds. These replacements
     are rebuilt from the supplied SVG at 30x26 / 31x26, with fully opaque paw
     pixels and a one-pixel contrast edge baked into each theme variant.

     This script is shared by every Fetcher page. The selectors deliberately use
     enough specificity + !important to beat older page-level cursor:pointer
     declarations (including the Twitch trimmer), while keeping specialist
     cursors where they communicate useful behaviour.
  ----------------------------------------------------------------------- */
  var PAW_LIGHT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAaCAYAAACgoey0AAAEj0lEQVR4nOWVW29UZRSGn/XtvafHaYeh7fSEVEBLRUskMfFCDD/AKwxCIgq0CqmiogECxkRMkEggaQUtBFsBgaBRQa+89geYcCeEYDRgx9LjdGb2nj378Hkx7ZQptCV46ZdMZjJrzft8a613r4H/25GHSUokmvXc74aHh2Sx2COD7xXd+/YOTAKcnMfng5dL8npe30g8VoVWZRzpG3ioCywK3t+zlXiVSeeKBIaC8ckMN4bTHOr9BoAP39tFe72iqT6K1opbQ1Ncv+tw4vTZBcFqITCADjVtTXWseyLB2pUNdK6qJ7Ekxr43XwMgXlNGe2s9nauaWLuqgZa6KBLkF5PFXCwhCGEq45LL+ygJcFwfO+1y7KsLAGTSKXJuJX4+gFDj5BwU/n8HW6bCiigipqDEoMy0UKZVjBumiTIE0xIINaZlIA/h2RLwgxzqE+AHHtmsj4jGdkNyvjMb930cD6ayeUQLbk5AG/Pqzcy9eLWZpE/2dOEHPhk7T+/gt8Uf9H60GyUwMjbB4f5LJWIHdm6mtakOEYPk3UkO9xeMt3/XViorTRSQHElz6uKPRXDRXD1dWzi6bxsvdNSzobOVF59u4eP3u4vi/0w5JMenyHizN58R+ezMdyRHswylMkXo3p2beXZFjPVrmlm/ppmnlsfYve3l+1sdEU0iFqOjrR6lhOHJNH+O5nhn+yZOnvueoycGS6qc28ZPvzxXEq+tqaG5sYb2pqUgwkg6SzI1O6IiWEQQCVBoQBAtaBF04DH3HNrTjet74HtEq6Mkx9KcPHu52IlEolkbKPA1KAFUwXAya6niJzvncGNohOrqCkSHjKdsRuyQLy78VEzu2baRx5ZGeX51I6EK0YGmzIpw7Sa8tWML/WdnPTFuZ7j+l2Yi6yHK4FZygrTt3g8+c/FnAA6+243WELh5jp25UFJpY7yS1W0JOlYsBQkhFDBMnLzHRC5fMoLj/Zf4YNer/DHuErFM/h5N8fU9RZQ8cA+yf0/XKzTHa0ilJnnpuZWsbmvA8TwMKTy3GlAmjEzm+OHX37HKK0g5AX2nL8yVKo7iPvDcSxzYvpnOZ5pY3lBLPpenMV5BtKqcMNQoBK01WgDRuPmA5N0MlmWSsj2u3RzhQO9gCezes+Curq2rpa0uysqmGtpb41SVR/D9ALQuQKdfoa8pNwyeXFbH4y1LWJ6oJhatZM/2TfNqL7gybdfB9wNCL8D1fJSSQqXTcQ1oPds3J+9hmIIT+Ew5DmEYPBpYaUELaAUoISy8YZkKjaAJEQQ/CAhCjYjCQFAioAqjeCSwGAoRAQ1aa0QE3wsYm3DQ08Kh1kQrLarKI8wUqKZ3gKnm/7NYEFxZUYllmhiWiRUKlimM2i6//HYHwxREg5332bBuGR211Xiuh2EJyhCiFRFu6/lbvaCrAfoOdtMQq8bJ5SizLEbTNjeGJjh1/ip739jI8YErHNvfRUu8FtuxKYuYpB2PO6NTHDldWCgPcvW8Fc+svpvDDuNZn3zOITQtnLzPqfNXATg+cAWA22MZMq6PbbtEIiZZN6BvYH7o//P8CwTVDJRED1GWAAAAAElFTkSuQmCC';
  var PAW_DARK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAaCAYAAABPY4eKAAAE5UlEQVR4nOWWW2xVRRSGv5m9zz7ntAc4pbWV0hbSipVLUwkBq0IiBjXEWzQmoD4QjBENIZoYUUKi8CAaMVEUNfpQNSpeoolRgYgXQGswNLZyVaEt2GovtFx7O2fvPbN8KD1SgRbx0fU0e9Za/78uM2s2/F9FXYiRiMhZjkqp8+nO1P8n8kHw/Z++QFH+aES7jKlaNMTm/bUruOX6ydgg4LfDx5i18LELCmBY5SDxnk3rKbmsklFjchAUHc17Odl1hMnzl9G8rRoVS1BcVoEgdLV30N/VSMnc+0cMQI+Uec07z1Ixo5zs4kpswTRs3lQKS4vRoQHAE0NxWQlB7mSCS6aQO6GckkmFbK5eNRL0yOS+CbAnurFBGmsM2BT2ZB/GDLRaiWB6+1FYHGOxYYA5dgw/HYxI7o5kkBWPoD0X5UbAcdCOg467ZGd5p/VRHC+Cr/UAmCM4kShKR/4d+blObnfK58SpXuLJHhztIcqQ6gvAGSDv7E1Bd5pYqgdQ+H5AujvFbUtWnRPznGdATsvhb16WYNc7Euz+SJ5cunhwW9pq3hU59IVIy2b54LnlcqZse2+tSOs3Is2bZP/nr2T2P3lphcgvn4js+UAObH41s58JZHCx5a1nZNKEfAomVhLNzkJwadi1g6bGRuYvWc3WDWuJEqK1Q9XC5ZksBsF2fr6OZNyjfm8LCx5ZQ8PG18jKG0fhZRUAnDzaSsPuHcy4a3km+0zZPQ8mlubj55Vh4klEoHxqK65/EoC59zx2zmoNrmfd+jAAl88b+I5HLYWlBaRzy9BAthNhRmUX1WsfPbvnuckkKAVisAqUWNAaK/qsLFu2VlM8Poewrw83HuPHukaq7h5aDbEWRKFOl1fhgOMQz4plyDNXbdr8B9nx4y/0Haon2lqH117HT7V72NfSOSTLhm1v0utH2P97P7+2G/oT5UyZNYdfP3txiN3BQ53s3X0A78jPuG11tDfU8f13+7h76dMZ8kzPB50aN64nmYiCdsmds3hImWs/XcfMK8upqT/KqRC0wDXz7yDh9qKP72XLlzu5cfHjGfsP1z/FDTPLMKkUDX90cvW9KzPVGUL+zx4OylfVa7jhxhlw/Dgdp6CuOSTuuVgsQehTNe9mRufkYazBHNiC7mkjMiaXtz+uYdHK5/8JN+SqnXfuiojs+mwdUSeBcRMIhv4ATqQVod9Hbn4hE8orSOaNJeJ5gCbobsMJA4jAkYO1NDU0MnvBE+ed78NOuPHJbLzYGLYfTBFxFVqBdiB7VJKcgnEUFBVhbIgxFq0UevR4FGAVFJa0kerqGA5+eHJrIR0GOBFwHYWyghXF9GuvI5HMIQx8lAKFBhQ6DAGLUg709GOC8OLJlTJYpRFjEA2hGKwxGLGI0gMjVgFWsHbgldNKIyhQCmeEZ2v4h0VpHKtwtUIhRGNZZCWyIdWD9ABisRhEx9CxUSAAGqX0gK92Lp5cOxovHiUMffy0T1FRCdOr5sChb+HPE+C4EPRDYiJh8VUYA46ABciOkQ7txZNvr2sif2wXc6ZdQbq7Hy96FP78gZ31+5h15zKavn6D0nkP0PTtBkpdUN2n0BrciMfWH2ppP9LB5cPgD3vVAL7csJqqyin4x7tJpX0iUY9LZ983xPb1VUu5/aYqIsYnLWnCQFFy/UN/k1zAz+T/S/4Cp4RR6pHEf0cAAAAASUVORK5CYII=';

  var cursorStyle = document.createElement('style');
  cursorStyle.id = 'fetcher-paw-cursor-fix';
  cursorStyle.textContent =
    'html[data-theme="light"]{--cursor-paw-fixed:url("' + PAW_LIGHT + '") 15 2;}' +
    'html[data-theme="dark"]{--cursor-paw-fixed:url("' + PAW_DARK + '") 15 2;}' +
    'html[data-theme]{cursor:var(--cursor-paw-fixed),auto!important;}' +
    'html[data-theme] body,html[data-theme] .app{cursor:inherit!important;}' +
    'html[data-theme] a,html[data-theme] button:not(:disabled),' +
    'html[data-theme] [role="button"]:not([aria-disabled="true"]),' +
    'html[data-theme] summary,html[data-theme] label[for],' +
    'html[data-theme] .trim-play,html[data-theme] .trim-track{' +
      'cursor:var(--cursor-paw-fixed),pointer!important;' +
    '}' +
    'html[data-theme] input:not([type="button"]):not([type="submit"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]),' +
    'html[data-theme] textarea,html[data-theme] [contenteditable="true"]{cursor:text!important;}' +
    'html[data-theme] button:disabled,html[data-theme] .seg-btn:disabled,' +
    'html[data-theme] .settings-seg-btn:disabled,html[data-theme] [aria-disabled="true"]{cursor:not-allowed!important;}' +
    'html[data-theme] .trim-handle{cursor:ew-resize!important;}';
  (document.head || document.documentElement).appendChild(cursorStyle);

  /* -----------------------------------------------------------------------
     Distance-aware sidebar highlight timing
  ----------------------------------------------------------------------- */

  // Tuned to keep adjacent hops feeling the same (~255ms) while capping the long
  // save<->bottom-icon hops lower (~380ms, was ~520ms). The shorter ceiling
  // narrows the window in which a rapid second click can supersede — and skip —
  // an in-flight cross-document transition (the "blink" under fast back-and-forth).
  var MIN = 240, MAX = 380, BASE = 230, PER_PX = 0.42;

  // 1) Apply the duration the previous page's click computed — before first paint.
  try {
    var pending = sessionStorage.getItem('nav.dur');
    if (pending) {
      document.documentElement.style.setProperty('--nav-dur', pending);
      sessionStorage.removeItem('nav.dur');   // one-shot: consume it for this hop
    }
  } catch (e) {}

  // 2) On a rail nav click, size the upcoming slide by the pill's travel distance.
  document.addEventListener('click', function (ev) {
    var link = ev.target.closest ? ev.target.closest('a.rail-btn[href]') : null;
    if (!link) return;
    var active = document.querySelector('.rail-btn.active');
    if (!active || link === active) return;
    var travel = Math.abs(
      link.getBoundingClientRect().top - active.getBoundingClientRect().top
    );
    var dur = Math.round(Math.min(MAX, Math.max(MIN, BASE + PER_PX * travel)));
    try { sessionStorage.setItem('nav.dur', dur + 'ms'); } catch (e) {}
  }, true);
})();
