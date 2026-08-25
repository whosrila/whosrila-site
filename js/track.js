/* WHOSRILA — click / engagement tracking.
 *
 * Fires events into whichever ad pixels are present. Nothing here runs
 * unless a pixel is actually installed, so the site behaves identically
 * with or without them.
 *
 * Detection-based: it fires into Meta (fbq), TikTok (ttq) and Google
 * (gtag) if they're present and stays silent if they aren't. Turning a
 * platform on is done in consent.js — this file needs no edits.
 *
 * Events sent:
 *   PlatformClick  — someone left for Spotify/Apple/etc  (+ platform, song)
 *   PreSaveClick   — clicked through to a pre-save link
 *   VideoPlay      — opened a video
 *   PreviewPlay    — played an audio preview
 *   Purchase       — a sale completed (fired from /download/, via wrPurchase)
 * PlatformClick and PreSaveClick also fire Meta's standard `Lead` event,
 * which is the one worth optimising ad delivery against. On Google the
 * same events land in GA4, where they can be marked as key events and
 * imported into Google Ads — or mapped straight to an Ads conversion
 * label via WR_ADS_CONVERSIONS in consent.js.
 */
(function () {
  'use strict';

  // Google Ads counts a conversion only when the event carries a
  // send_to naming the conversion. Anything not mapped still reaches
  // GA4 as a normal event.
  function googleConversion(event) {
    var map = window.WR_ADS_CONVERSIONS;
    return map && map[event] ? map[event] : null;
  }

  function send(event, data) {
    data = data || {};
    try { if (window.fbq) window.fbq('trackCustom', event, data); } catch (e) {}
    try { if (window.ttq) window.ttq.track(event, data); } catch (e) {}
    // GA4 takes every event as-is; `song` and `platform` come through as
    // event parameters, so one event type still breaks down per song.
    try { if (window.gtag) window.gtag('event', event, data); } catch (e) {}

    // standard conversion events, for ad-platform optimisation
    if (event === 'PlatformClick' || event === 'PreSaveClick') {
      try { if (window.fbq) window.fbq('track', 'Lead', data); } catch (e) {}
    }
    // Buying is purchase intent, not just a stream — worth its own standard
    // event so campaigns optimise for sales rather than plays. 'Direct' is a
    // Stripe checkout, which is the strongest signal of the two: it earns
    // roughly $2.60 against about $0.70 from an iTunes sale.
    if (event === 'PlatformClick' && (data.platform === 'Direct' || data.platform === 'iTunes')) {
      try { if (window.fbq) window.fbq('track', 'InitiateCheckout', data); } catch (e) {}
      try { if (window.ttq) window.ttq.track('InitiateCheckout', data); } catch (e) {}
    }

    try {
      var conv = googleConversion(event);
      if (window.gtag && conv) window.gtag('event', 'conversion', { send_to: conv });
    } catch (e) {}

    if (window.__TRACK_DEBUG) console.log('[track]', event, data);
  }
  window.wrTrack = send;

  /* A completed sale.
   *
   * Everything above this records intent — a click into Stripe. This is the
   * first signal that says money actually changed hands, which is the event
   * ad platforms optimise hardest against: it teaches a campaign to find
   * buyers rather than browsers. Fired from /download/, the only page that
   * knows the payment went through.
   *
   * Deduped on the Stripe session id. That page is an ordinary URL the buyer
   * can refresh, bookmark or reopen, and a refresh must never count a second
   * sale. If localStorage is unavailable the event still fires — a possible
   * double-count is a smaller problem than silence.
   */
  function purchase(o) {
    o = o || {};
    var id = o.id || '';
    if (id) {
      try {
        var seen = 'wr_purchase_' + id;
        if (localStorage.getItem(seen)) return;
        localStorage.setItem(seen, '1');
      } catch (e) {}
    }

    var currency = (o.currency || 'USD').toUpperCase();
    var value    = typeof o.value === 'number' ? o.value : undefined;
    var name     = o.name || '';

    // value is deliberately optional: the Worker only returns the amount
    // once it has been redeployed. An event with no value is still worth
    // far more than no event at all.
    var payload = { content_name: name, content_type: 'product', currency: currency };
    if (value !== undefined) payload.value = value;

    try { if (window.fbq) window.fbq('track', 'Purchase', payload); } catch (e) {}
    try { if (window.ttq) window.ttq.track('CompletePayment', payload); } catch (e) {}
    try {
      if (window.gtag) window.gtag('event', 'purchase', {
        transaction_id: id,
        value: value,
        currency: currency,
        items: name ? [{ item_name: name }] : undefined
      });
    } catch (e) {}
    try {
      var conv = googleConversion('Purchase');
      if (window.gtag && conv) window.gtag('event', 'conversion', {
        send_to: conv, value: value, currency: currency, transaction_id: id
      });
    } catch (e) {}

    if (window.__TRACK_DEBUG) console.log('[track] Purchase', payload);
  }
  window.wrPurchase = purchase;

  // .title-line contains a badge span (E / UPCOMING); take only the text nodes
  function cleanTitle(el) {
    var out = '';
    el.childNodes.forEach(function (n) { if (n.nodeType === 3) out += n.textContent; });
    return (out || el.textContent).trim();
  }

  // Which song/page is this? Falls back to the path.
  function pageId() {
    var h1 = document.querySelector('h1.title, h1.page-title');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    var p = location.pathname.replace(/\/+$/, '').split('/').pop();
    return p || 'home';
  }

  // Work out which service a URL points at.
  var HOSTS = [
    // A click into Stripe checkout is the most valuable signal on the site —
    // it is someone buying directly rather than streaming. Listed first so it
    // can never be shadowed by a later pattern.
    [/buy\.stripe\.com|checkout\.stripe\.com/, 'Direct'],
    [/open\.spotify\.com/,        'Spotify'],
    // iTunes Store and Apple Music share music.apple.com — the app= param
    // is what separates them, so this has to be tested first.
    [/apple\.com.*[?&]app=itunes/, 'iTunes'],
    [/music\.apple\.com|itunes\.apple\.com/, 'Apple Music'],
    [/music\.amazon\./,           'Amazon Music'],
    [/(^|\.)deezer\.com/,         'Deezer'],
    [/(^|\.)tidal\.com/,          'Tidal'],
    [/soundcloud\.com/,           'SoundCloud'],
    [/audiomack\.com/,            'Audiomack'],
    [/music\.youtube\.com/,       'YouTube Music'],
    [/(^|\.)youtube\.com|youtu\.be/, 'YouTube'],
    [/(^|\.)pandora\.com/,        'Pandora'],
    [/music\.yandex\./,           'Yandex Music'],
    [/even\.biz/,                 'EVEN'],
    [/instagram\.com/,            'Instagram'],
    [/tiktok\.com/,               'TikTok'],
    [/ffm\.to|too\.fm|feature\.fm/, 'Pre-Save']
  ];
  function serviceFor(href) {
    for (var i = 0; i < HOSTS.length; i++) if (HOSTS[i][0].test(href)) return HOSTS[i][1];
    return null;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:/i.test(href)) return;          // internal link
    if (href.indexOf(location.host) !== -1) return;

    var svc = serviceFor(href);
    if (!svc) return;
    var payload = { platform: svc, song: pageId(), url: href };
    send(svc === 'Pre-Save' ? 'PreSaveClick' : 'PlatformClick', payload);
  }, true);   // capture phase: fires before the browser starts navigating

  // Video + audio engagement
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.vid-thumb, .play-btn, .preview-btn');
    if (!t) return;
    if (t.classList.contains('vid-thumb')) {
      var card = t.closest('.vid-card');
      var title = card && card.querySelector('.vid-title');
      send('VideoPlay', { title: title ? title.textContent.trim() : '', song: pageId() });
    } else {
      // audio preview — only count the start, not the pause
      if (t.classList.contains('playing')) return;
      var item = t.closest('.track-item');
      var name = item && item.querySelector('.title-line');
      send('PreviewPlay', { track: name ? cleanTitle(name) : pageId(), song: pageId() });
    }
  }, true);
})();
