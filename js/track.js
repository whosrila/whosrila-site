/* WHOSRILA — click / engagement tracking.
 *
 * Fires events into whichever ad pixels are present. Nothing here runs
 * unless a pixel is actually installed, so the site behaves identically
 * with or without them.
 *
 * To switch pixels on, add the Meta and/or TikTok base snippet to the
 * page <head>. This file needs no edits — it detects them.
 *
 * Events sent:
 *   PlatformClick  — someone left for Spotify/Apple/etc  (+ platform, song)
 *   PreSaveClick   — clicked through to a pre-save link
 *   VideoPlay      — opened a video
 *   PreviewPlay    — played an audio preview
 * PlatformClick and PreSaveClick also fire Meta's standard `Lead` event,
 * which is the one worth optimising ad delivery against.
 */
(function () {
  'use strict';

  function send(event, data) {
    data = data || {};
    try { if (window.fbq) window.fbq('trackCustom', event, data); } catch (e) {}
    try { if (window.ttq) window.ttq.track(event, data); } catch (e) {}
    // standard conversion events, for ad-platform optimisation
    if (event === 'PlatformClick' || event === 'PreSaveClick') {
      try { if (window.fbq) window.fbq('track', 'Lead', data); } catch (e) {}
    }
    // a click on the iTunes buy link is purchase intent, not just a stream —
    // worth its own standard event so campaigns can optimise for sales
    if (event === 'PlatformClick' && data.platform === 'iTunes') {
      try { if (window.fbq) window.fbq('track', 'InitiateCheckout', data); } catch (e) {}
      try { if (window.ttq) window.ttq.track('InitiateCheckout', data); } catch (e) {}
    }
    if (window.__TRACK_DEBUG) console.log('[track]', event, data);
  }
  window.wrTrack = send;

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
