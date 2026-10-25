/* Single EPKs: previews, copy buttons and lyrics.
   Lyrics are not duplicated into the EPK pages: they are read from the
   release's own song page (data-lyrics="/gratitude/"), so a lyric fix on
   the song page shows up here too. If that fetch fails the section stays
   hidden. */
(function(){
  /* ---------- previews ----------
     One <audio> per playable track. Starting one stops the rest; the cover's
     big button drives the first track. The bar under the row shows progress. */
  var rows = [].slice.call(document.querySelectorAll('.track[data-src]'));
  var current = null;
  function stop(row){
    if(!row || !row._a) return;
    row._a.pause(); try { row._a.currentTime = 0; } catch(e){}
    setState(row, false);
  }
  function setState(row, on){
    var label = row.getAttribute('data-title');
    [row.querySelector('.play')].concat(row === rows[0] ? [document.querySelector('.cover .play')] : []).forEach(function(b){
      if(!b) return;
      b.classList.toggle('is-playing', on);
      b.setAttribute('aria-label', (on ? 'Stop the preview of ' : 'Play a preview of ') + label);
    });
    if(!on){ var bar = row.querySelector('.bar'); if(bar) bar.style.width = '0'; }
  }
  function toggle(row){
    if(!row._a){
      row._a = new Audio(row.getAttribute('data-src'));
      row._a.preload = 'none';
      row._a.addEventListener('timeupdate', function(){
        var bar = row.querySelector('.bar');
        if(bar && row._a.duration) bar.style.width = (row._a.currentTime / row._a.duration * 100) + '%';
      });
      row._a.addEventListener('ended', function(){ setState(row, false); current = null; });
    }
    if(current === row && !row._a.paused){ stop(row); current = null; return; }
    if(current) stop(current);
    current = row;
    var p = row._a.play(); if(p && p.catch) p.catch(function(){ setState(row, false); current = null; });
    setState(row, true);
    try { if(window.wrTrack) window.wrTrack('PreviewPlay', { song: row.getAttribute('data-title'), page: 'epk' }); } catch(e){}
  }
  rows.forEach(function(row){
    var b = row.querySelector('.play');
    if(b) b.addEventListener('click', function(){ toggle(row); });
  });
  var big = document.querySelector('.cover .play');
  if(big && rows[0]) big.addEventListener('click', function(){ toggle(rows[0]); });

  /* ---------- copy ---------- */
  function copy(text, el, done){
    function flash(){ var old = el.textContent; el.textContent = done; setTimeout(function(){ el.textContent = old; }, 1600); }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(flash, function(){});
    }
  }
  var share = document.getElementById('copyLink');
  if(share) share.addEventListener('click', function(){ copy(location.href.split('#')[0], share, 'Link copied'); });
  [].slice.call(document.querySelectorAll('.copyable')).forEach(function(b){
    b.addEventListener('click', function(){ copy(b.getAttribute('data-copy') || b.textContent, b, 'Copied'); });
  });

  /* ---------- lyrics from the song page ---------- */
  var box = document.querySelector('.lyrics[data-lyrics]');
  if(box && window.fetch && window.DOMParser){
    fetch(box.getAttribute('data-lyrics'), { credentials:'same-origin' })
      .then(function(r){ return r.ok ? r.text() : Promise.reject(); })
      .then(function(html){
        var src = new DOMParser().parseFromString(html, 'text/html').querySelector('.lyrics-body');
        if(!src || !src.textContent.trim()) return;
        var body = box.querySelector('.lyrics-body');
        body.innerHTML = src.innerHTML;
        box.closest('section').hidden = false;
        var more = box.querySelector('.more');
        if(body.scrollHeight > 460){
          box.classList.add('is-clipped');
          more.hidden = false;
          more.addEventListener('click', function(){
            var open = box.classList.toggle('is-clipped') === false;
            more.textContent = open ? 'Show less' : 'Read full lyrics';
            more.setAttribute('aria-expanded', String(open));
          });
        }
      })
      .catch(function(){});
  }
})();
