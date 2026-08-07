/* Cookie consent for WHOSRILA.
 *
 * The Meta Pixel sets cookies, so under UK/EU rules it must not run until the
 * visitor opts in. This file is the only thing that starts it — the pixel
 * snippet is deliberately NOT in the page markup.
 *
 * Outside the UK/EEA the pixel starts immediately and no banner is shown.
 * Region is inferred from the browser's own timezone, which needs no network
 * call and no IP lookup. If that can't be read, we assume consent IS required.
 *
 * Cloudflare Analytics is cookieless and runs regardless.
 */
(function () {
  'use strict';

  var PIXEL = '1475977817606217';
  var KEY   = 'wr-consent';

  // UK + EEA, including the bits that aren't under Europe/*
  var EEA_EXTRA = ['Atlantic/Canary','Atlantic/Madeira','Atlantic/Azores',
                   'Atlantic/Reykjavik','Asia/Nicosia','Asia/Famagusta'];
  function consentRequired() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^Europe\//.test(tz) || EEA_EXTRA.indexOf(tz) !== -1;
    } catch (e) {
      return true;             // can't tell — assume it's required
    }
  }

  function startPixel() {
    if (window.fbq) return;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL);
    window.fbq('track', 'PageView');
  }

  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function stored()    { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  function banner() {
    var el = document.createElement('div');
    el.className = 'cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Cookie choices');
    el.innerHTML =
      '<p class="cc-text">We use cookies to measure how our ads perform. ' +
      'You can say no — the site works exactly the same either way. ' +
      '<a href="/privacy">How we use your data</a>.</p>' +
      '<div class="cc-actions">' +
        '<button class="cc-btn cc-no" type="button">Reject</button>' +
        '<button class="cc-btn cc-yes" type="button">Accept</button>' +
      '</div>';

    function close() { el.classList.remove('cc-open'); setTimeout(function(){ el.remove(); }, 260); }
    el.querySelector('.cc-yes').addEventListener('click', function () { remember('granted'); startPixel(); close(); });
    el.querySelector('.cc-no').addEventListener('click',  function () { remember('denied');  close(); });

    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('cc-open'); });
    el.querySelector('.cc-no').focus();
  }

  function init() {
    var choice = stored();
    if (!consentRequired() || choice === 'granted') { startPixel(); return; }
    if (choice === 'denied') return;
    banner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
