/* Video lightbox — click a .vid-thumb and the player flies from the card
 * to the centre of the screen. Shared by the homepage, /watch and the
 * song pages. Requires the .lb styles in css/site.css. */
// ---- Video lightbox: play front-and-centre instead of inline ----
(function(){
  var lb, panel, lastTrigger, scrollLock = 0;

  function sizeFor(vertical){
    var vw = window.innerWidth, vh = window.innerHeight;
    var padW = vw < 700 ? 24 : 96, padH = vw < 700 ? 120 : 130;
    var maxW = vw - padW, maxH = vh - padH, w, h;
    if(vertical){                       // 9:16
      h = Math.min(maxH, 860); w = h * 9/16;
      if(w > maxW){ w = maxW; h = w * 16/9; }
    } else {                            // 16:9
      w = Math.min(maxW, 1180); h = w * 9/16;
      if(h > maxH){ h = maxH; w = h * 16/9; }
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

  function open(id, vertical, label, fromRect){
    lastTrigger = document.activeElement;

    var node = document.createElement('div');
    lb = node;
    node.className = 'lb';
    lb.setAttribute('role','dialog');
    lb.setAttribute('aria-modal','true');
    lb.setAttribute('aria-label', label || 'Video');

    var size = sizeFor(vertical);
    panel = document.createElement('div');
    panel.className = 'lb-panel';
    panel.style.width = size.w + 'px';
    panel.style.height = size.h + 'px';

    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1';
    f.title = label || 'WHOSRILA video';
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen = true;
    panel.appendChild(f);

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
      var titleEl = card.querySelector('.vid-title');
      open(id, vertical, titleEl ? titleEl.textContent.trim() : '', btn.getBoundingClientRect());
    });
  });
})();
