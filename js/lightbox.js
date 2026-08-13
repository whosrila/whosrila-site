/* Video lightbox — click a .vid-thumb and the player flies from the card
 * to the centre of the screen. Shared by the homepage, /watch and the
 * song pages. Requires the .lb styles in css/site.css. */
// ---- Video lightbox: play front-and-centre instead of inline ----
(function(){
  /* Captions off. The IFrame API is the only thing that can do this; it is
     fetched once, on the first play, so nothing loads for visitors who never
     press play. Any existing onYouTubeIframeAPIReady is chained rather than
     overwritten, in case a page defines its own. */
  var apiReady = false, apiAsked = false, waiting = [];
  function loadApi(){
    if(apiAsked) return;
    apiAsked = true;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function(){
      if(typeof prev === 'function'){ try{ prev(); }catch(e){} }
      apiReady = true;
      waiting.splice(0).forEach(function(fn){ fn(); });
    };
    var t = document.createElement('script');
    t.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(t);
  }
  function killCaptions(p){
    ['captions','cc'].forEach(function(m){ try{ p.unloadModule(m); }catch(e){} });
  }
  function suppressCaptions(iframe){
    function attach(){
      if(!iframe.isConnected || typeof YT === 'undefined' || !YT.Player) return;
      try{
        new YT.Player(iframe, { events:{
          onReady: function(e){ killCaptions(e.target); },
          // the caption track can attach just after ready, so clear it again
          onStateChange: function(e){ if(e.data === YT.PlayerState.PLAYING) killCaptions(e.target); }
        }});
      }catch(e){}
    }
    apiReady ? attach() : (waiting.push(attach), loadApi());
  }

  var lb, panel, lastTrigger, scrollLock = 0;

  /* ratio is width/height. The panel matches the video's own shape so the
     frame is filled edge to edge — a 4:3 video in a 16:9 panel sits between
     black bars. Cards declare it with data-ratio="4:3"; anything without one
     is 16:9, and vertical cards stay 9:16. */
  function parseRatio(str){
    if(!str) return 0;
    var m = String(str).split(':');
    if(m.length !== 2) return 0;
    var w = parseFloat(m[0]), h = parseFloat(m[1]);
    return (w > 0 && h > 0) ? w / h : 0;
  }

  function sizeFor(ratio){
    var vw = window.innerWidth, vh = window.innerHeight;
    var padW = vw < 700 ? 24 : 96, padH = vw < 700 ? 120 : 130;
    var maxW = vw - padW, maxH = vh - padH, w, h;
    if(ratio < 1){                      // portrait, e.g. 9:16
      h = Math.min(maxH, 860); w = h * ratio;
      if(w > maxW){ w = maxW; h = w / ratio; }
    } else {
      w = Math.min(maxW, 1180); h = w / ratio;
      if(h > maxH){ h = maxH; w = h * ratio; }
    }
    return { w: Math.round(w), h: Math.round(h) };
  }

  function close(){
    if(!lb) return;
    var el = lb; lb = null;
    el.classList.remove('open');
    document.documentElement.style.overflow = '';
    document.documentElement.style.paddingRight = '';
    window.removeEventListener('keydown', onKey);
    setTimeout(function(){ el.remove(); }, 300);
    if(lastTrigger) lastTrigger.focus();
  }

  function onKey(e){ if(e.key === 'Escape') close(); }

  function open(id, ratio, label, fromRect){
    lastTrigger = document.activeElement;

    var node = document.createElement('div');
    lb = node;
    node.className = 'lb';
    lb.setAttribute('role','dialog');
    lb.setAttribute('aria-modal','true');
    lb.setAttribute('aria-label', label || 'Video');

    var size = sizeFor(ratio);
    panel = document.createElement('div');
    panel.className = 'lb-panel';
    panel.style.width = size.w + 'px';
    panel.style.height = size.h + 'px';

    var f = document.createElement('iframe');
    // enablejsapi so the captions module can be unloaded once the player is
    // ready. No URL parameter can force captions off — cc_load_policy=0 is a
    // no-op, and viewers with captions enabled on their account get them on
    // every embed unless the module is actually unloaded.
    f.src = 'https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=' +
      encodeURIComponent(location.origin);
    f.title = label || 'WHOSRILA video';
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen = true;
    panel.appendChild(f);
    suppressCaptions(f);

    var btn = document.createElement('button');
    btn.className = 'lb-close';
    btn.setAttribute('aria-label','Close video');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">'
      + '<path d="M1 1 L15 15 M15 1 L1 15" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>';
    btn.addEventListener('click', close);

    lb.appendChild(panel);
    lb.appendChild(btn);
    if(label){
      var cap = document.createElement('div');
      cap.className = 'lb-cap';
      cap.textContent = label;
      lb.appendChild(cap);
    }
    lb.addEventListener('click', function(e){ if(e.target === lb) close(); });

    // keep the page from jumping when the scrollbar disappears
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    if(sbw > 0) document.documentElement.style.paddingRight = sbw + 'px';

    document.body.appendChild(lb);

    // FLIP — start at the card's exact position/size, then animate to centre
    var to = panel.getBoundingClientRect();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(fromRect && !reduce){
      var sx = fromRect.width / to.width, sy = fromRect.height / to.height;
      panel.style.transform = 'translate(' + (fromRect.left - to.left) + 'px,'
        + (fromRect.top - to.top) + 'px) scale(' + sx + ',' + sy + ')';
      panel.getBoundingClientRect();  // force the start frame
      panel.style.transition = 'transform .42s cubic-bezier(.22,1,.36,1)';
      panel.style.transform = 'none';
    }
    requestAnimationFrame(function(){ if(node.isConnected) node.classList.add('open'); });
    window.addEventListener('keydown', onKey);
    btn.focus();
  }

  document.querySelectorAll('.vid-thumb').forEach(function(btn){
    btn.addEventListener('click', function(){
      var card = btn.closest('.vid-card');
      var id = card.dataset.yt;
      if(!id) return;
      var vertical = !!card.closest('.video-grid--vertical') || card.classList.contains('vid-card--v');
      var ratio = vertical ? 9/16 : (parseRatio(card.dataset.ratio) || 16/9);
      var titleEl = card.querySelector('.vid-title');
      open(id, ratio, titleEl ? titleEl.textContent.trim() : '', btn.getBoundingClientRect());
    });
  });
})();
