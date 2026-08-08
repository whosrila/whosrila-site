/* Cookie consent for WHOSRILA.
 *
 * The Meta Pixel and Google's tag both set cookies, so under UK/EU rules
 * neither may run until the visitor opts in. This file is the only thing
 * that starts them — no tag snippet is in the page markup.
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

  /* ---------------------------------------------------------------
     Google. Both are off until an ID is filled in — an empty string
     loads nothing and costs nothing, so it is safe to ship like this.

       GA4  'G-XXXXXXXXXX'   Analytics. Events show up here, and can be
                             marked as key events and imported into Ads.
       ADS  'AW-XXXXXXXXXX'  Google Ads, for conversion tracking.

     Filling either in switches Google on across every page at once.
     Two things to do at the same time:
       1. add Google to /privacy — it currently names only Meta and
          Cloudflare, and would be out of date the moment this is live
       2. to count a click as an Ads conversion rather than just a GA4
          event, create the conversion in Ads and paste its send-to
          string into WR_ADS_CONVERSIONS below
  --------------------------------------------------------------- */
  var GA4 = '';
  var ADS = '';

  // event name -> Google Ads 'AW-XXXXXXXXXX/AbCdEfGhIj' conversion string
  window.WR_ADS_CONVERSIONS = {
    // PlatformClick: 'AW-XXXXXXXXXX/xxxxxxxxxxxxxxxx',
    // PreSaveClick:  'AW-XXXXXXXXXX/xxxxxxxxxxxxxxxx'
  };

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

  function startGoogle(granted) {
    if (!GA4 && !ADS) return;                    // not configured — do nothing
    if (window.gtag) { gtagConsent(granted); return; }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };

    // Consent Mode: state has to be set before the tag loads, or the
    // first hit goes out under the wrong assumption.
    gtagConsent(granted);
    window.gtag('js', new Date());

    var id = GA4 || ADS;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(s);

    if (GA4) window.gtag('config', GA4);
    if (ADS) window.gtag('config', ADS);
  }

  function gtagConsent(granted) {
    if (!window.gtag) return;
    var v = granted ? 'granted' : 'denied';
    window.gtag('consent', 'default', {
      ad_storage: v, analytics_storage: v,
      ad_user_data: v, ad_personalization: v
    });
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
    el.querySelector('.cc-yes').addEventListener('click', function () {
      remember('granted'); startPixel(); startGoogle(true); close();
    });
    el.querySelector('.cc-no').addEventListener('click',  function () { remember('denied');  close(); });

    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('cc-open'); });
    el.querySelector('.cc-no').focus();
  }

  function init() {
    var choice = stored();
    if (!consentRequired() || choice === 'granted') { startPixel(); startGoogle(true); return; }
    if (choice === 'denied') return;
    banner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
