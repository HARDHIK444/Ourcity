/* ==========================================================
   OurCity: Create post (create.html)
   Step 1  take a photo with the camera, or choose photos/videos
   Step 2  edit: filters, text + colour, music
   Step 3  describe the problem, pick the place, share
   Photos are edited in the browser (the filter and text are baked into the
   picture before upload). Videos and music are uploaded as they are.
   ========================================================== */
(function () {
  var esc = OC.esc;
  var MAX_ITEMS = 6, MAX_VIDEO_MB = 40, MAX_AUDIO_MB = 10;
  var $ = function (id) { return document.getElementById(id); };

  var FILTERS = [
    { id: 'none', name: 'Normal', css: 'none' },
    { id: 'vivid', name: 'Vivid', css: 'saturate(1.5) contrast(1.1)' },
    { id: 'warm', name: 'Warm', css: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
    { id: 'cool', name: 'Cool', css: 'hue-rotate(12deg) saturate(1.15) brightness(1.03)' },
    { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.1)' },
    { id: 'fade', name: 'Fade', css: 'contrast(0.85) brightness(1.1) saturate(0.8)' },
    { id: 'drama', name: 'Drama', css: 'contrast(1.35) brightness(0.92) saturate(1.1)' },
    { id: 'sepia', name: 'Vintage', css: 'sepia(0.75) contrast(0.95)' }
  ];
  var COLORS = ['#FFFFFF', '#111111', '#FF6A00', '#FFD60A', '#FF3B30', '#34C759', '#0A84FF'];

  var user = null;
  var items = [];             // { file, kind, url, filter, text, color, size, x, y, hl }
  var cur = 0;
  var audioFile = null;
  var place = { lat: null, lng: null };
  var stream = null;

  var steps = ['crGate', 's1', 'camPanel', 's2', 's3'];
  function show(id) { steps.forEach(function (s) { $(s).hidden = s !== id; }); window.scrollTo(0, 0); }

  if (!window.sb) { show('crGate'); $('crGate').querySelector('h1').textContent = 'Not connected'; $('crGate').querySelector('p').textContent = 'Paste your publishable key into js/supabase.js.'; return; }
  sb.auth.getSession().then(function (r) {
    user = r.data.session && r.data.session.user;
    show(user ? 's1' : 'crGate');
  });

  /* ---------- step 1: camera and gallery ---------- */
  function say(id, t) { $(id).textContent = t || ''; }

  function addFiles(files, msgId) {
    say(msgId, '');
    Array.prototype.forEach.call(files, function (f) {
      var isVideo = f.type.indexOf('video/') === 0, isImage = f.type.indexOf('image/') === 0;
      if (!isVideo && !isImage) return say(msgId, 'Only photos and videos can be added here.');
      if (items.length >= MAX_ITEMS) return say(msgId, 'You can add up to ' + MAX_ITEMS + ' photos or videos.');
      if (isVideo && f.size > MAX_VIDEO_MB * 1024 * 1024) return say(msgId, 'A video is too large. Please keep each video under ' + MAX_VIDEO_MB + ' MB.');
      items.push({ file: f, kind: isVideo ? 'video' : 'image', url: URL.createObjectURL(f), filter: 'none', text: '', color: '#FFFFFF', size: 8, x: 0.5, y: 0.5, hl: false });
    });
  }
  function toEditor() { if (!items.length) return; cur = Math.min(cur, items.length - 1); renderEditor(); show('s2'); }

  $('gallery').addEventListener('change', function (e) { addFiles(e.target.files, 'msg1'); e.target.value = ''; toEditor(); });
  $('phoneCam').addEventListener('change', function (e) { addFiles(e.target.files, 'msg1'); e.target.value = ''; toEditor(); });

  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } $('camVideo').srcObject = null; }
  $('camBtn').addEventListener('click', function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return $('phoneCam').click();
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
      stream = s; $('camVideo').srcObject = s; show('camPanel');
    }).catch(function () {
      say('msg1', 'The camera is not available here. Opening your photo picker instead.');
      $('phoneCam').click();
    });
  });
  $('camClose').addEventListener('click', function () { stopCam(); show(items.length ? 's2' : 's1'); });
  $('shutter').addEventListener('click', function () {
    var v = $('camVideo');
    if (!v.videoWidth) return;
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(function (b) {
      var f = new File([b], 'camera-' + Date.now() + '.jpg', { type: 'image/jpeg' });
      stopCam(); addFiles([f], 'msg1'); toEditor();
    }, 'image/jpeg', 0.92);
  });

  /* ---------- step 2: editor ---------- */
  var tab = 'filters';
  function filterCss(it) { var f = FILTERS.filter(function (x) { return x.id === it.filter; })[0]; return f ? f.css : 'none'; }
  var canFilter = (function () { var c = document.createElement('canvas').getContext('2d'); return !!c && 'filter' in c; })();

  function renderEditor() {
    var it = items[cur];
    // preview
    if (it.kind === 'video') {
      $('stage').innerHTML = '<video controls playsinline src="' + it.url + '"></video>';
    } else {
      $('stage').innerHTML = '<img id="stImg" src="' + it.url + '" alt="Your photo" style="filter:' + filterCss(it) + '">' +
        '<div class="stext' + (it.hl ? ' hl' : '') + '" id="stText" hidden></div>';
      var img = $('stImg');
      var ready = function () { drawText(); };
      if (img.complete) ready(); else img.addEventListener('load', ready);
    }
    // strip of items
    $('strip').innerHTML = items.map(function (m, i) {
      return '<button type="button" data-i="' + i + '" class="' + (i === cur ? 'is-on' : '') + '" aria-label="Item ' + (i + 1) + '">' +
        (m.kind === 'video' ? '<video src="' + m.url + '" muted></video>' : '<img src="' + m.url + '" alt="" style="filter:' + filterCss(m) + '">') +
        '<span class="x" data-rm="' + i + '" role="button" aria-label="Remove">&times;</span></button>';
    }).join('') + (items.length < MAX_ITEMS ? '<button type="button" class="addmore" id="addMore" aria-label="Add more">+</button>' : '');
    drawFilters(); syncTextPanel();
  }

  function drawText() {
    var t = $('stText'), img = $('stImg'), it = items[cur];
    if (!t || !img) return;
    if (!it.text) { t.hidden = true; return; }
    t.hidden = false; t.textContent = it.text;
    var w = img.clientWidth || img.naturalWidth;
    t.style.fontSize = Math.max(10, w * it.size / 100) + 'px';
    t.style.left = (it.x * 100) + '%'; t.style.top = (it.y * 100) + '%';
    if (it.hl) { t.style.background = it.color; t.style.color = lum(it.color) > 0.6 ? '#111' : '#fff'; }
    else { t.style.background = 'transparent'; t.style.color = it.color; }
    t.className = 'stext' + (it.hl ? ' hl' : '');
  }
  function lum(hex) { var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

  function drawFilters() {
    var it = items[cur];
    if (it.kind === 'video') { $('p-filters').innerHTML = '<div class="nofilter">Filters and text work on photos. Editing videos comes in a later step.</div>'; return; }
    if (!canFilter) { $('p-filters').innerHTML = '<div class="nofilter">Your browser cannot apply filters. Try Chrome or Edge.</div>'; return; }
    $('p-filters').innerHTML = '<div class="filters">' + FILTERS.map(function (f) {
      return '<button type="button" class="fil' + (f.id === it.filter ? ' is-on' : '') + '" data-f="' + f.id + '"><img src="' + it.url + '" alt="" style="filter:' + f.css + '">' + f.name + '</button>';
    }).join('') + '</div>';
  }

  function syncTextPanel() {
    var it = items[cur], isImg = it.kind === 'image';
    $('textIn').disabled = !isImg; $('textIn').value = isImg ? it.text : '';
    $('textIn').placeholder = isImg ? 'Type something to write on the photo' : 'Text works on photos only';
    $('textSize').value = it.size; $('textHl').checked = it.hl;
    $('swatches').innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="sw' + (c.toUpperCase() === it.color.toUpperCase() ? ' is-on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="Colour ' + c + '"></button>';
    }).join('');
  }

  $('strip').addEventListener('click', function (e) {
    var rm = e.target.closest('[data-rm]');
    if (rm) {
      var i = Number(rm.getAttribute('data-rm'));
      URL.revokeObjectURL(items[i].url); items.splice(i, 1);
      if (!items.length) { cur = 0; return show('s1'); }
      cur = Math.min(cur, items.length - 1); return renderEditor();
    }
    if (e.target.closest('#addMore')) return $('gallery').click();
    var b = e.target.closest('[data-i]');
    if (b) { cur = Number(b.getAttribute('data-i')); renderEditor(); }
  });
  // "+" in the strip adds more from the gallery (the gallery input lives on step 1 but works here too)
  $('gallery').addEventListener('change', function () { if (!$('s2').hidden) renderEditor(); });

  $('p-filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]');
    if (!b) return;
    items[cur].filter = b.getAttribute('data-f'); renderEditor();
  });

  document.querySelectorAll('.ctab').forEach(function (b) {
    b.addEventListener('click', function () {
      tab = b.getAttribute('data-tab');
      document.querySelectorAll('.ctab').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      ['filters', 'text', 'music'].forEach(function (t) { $('p-' + t).hidden = t !== tab; });
    });
  });

  $('textIn').addEventListener('input', function () { items[cur].text = this.value; drawText(); });
  $('textSize').addEventListener('input', function () { items[cur].size = Number(this.value); drawText(); });
  $('textHl').addEventListener('change', function () { items[cur].hl = this.checked; drawText(); });
  $('textClear').addEventListener('click', function () { items[cur].text = ''; $('textIn').value = ''; drawText(); });
  $('swatches').addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]');
    if (!b) return;
    items[cur].color = b.getAttribute('data-c'); syncTextPanel(); drawText();
  });

  // drag the text on the photo
  (function () {
    var dragging = false;
    $('stage').addEventListener('pointerdown', function (e) {
      if (e.target.id !== 'stText') return;
      dragging = true; e.target.setPointerCapture(e.pointerId); e.preventDefault();
    });
    $('stage').addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var r = $('stImg').getBoundingClientRect(), it = items[cur];
      it.x = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
      it.y = Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height));
      drawText();
    });
    $('stage').addEventListener('pointerup', function () { dragging = false; });
  })();

  // music
  function clearAudio() { audioFile = null; $('audio').value = ''; $('audioBox').hidden = true; $('audioPlayer').removeAttribute('src'); $('audioOwn').checked = false; }
  $('audio').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.type.indexOf('audio/') !== 0) { say('msg2', 'Please choose an audio file.'); return clearAudio(); }
    if (f.size > MAX_AUDIO_MB * 1024 * 1024) { say('msg2', 'Audio is too large. Please keep it under ' + MAX_AUDIO_MB + ' MB.'); return clearAudio(); }
    say('msg2', ''); audioFile = f;
    $('audioName').textContent = f.name; $('audioPlayer').src = URL.createObjectURL(f); $('audioBox').hidden = false;
  });
  $('audioRemove').addEventListener('click', clearAudio);

  $('back2').addEventListener('click', function () { show('s1'); });
  $('next2').addEventListener('click', function () {
    if (audioFile && !$('audioOwn').checked) { say('msg2', 'Please confirm you have the right to use the audio, or remove it.'); return; }
    say('msg2', '');
    $('miniPrev').innerHTML = items.map(function (m) {
      return m.kind === 'video' ? '<video src="' + m.url + '" muted></video>' : '<img src="' + m.url + '" alt="" style="filter:' + filterCss(m) + '">';
    }).join('');
    show('s3');
  });

  /* ---------- step 3: details, place, share ---------- */
  $('cat').innerHTML = OC.CATEGORIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('text').addEventListener('input', function () { $('count').textContent = this.value.length + ' / 1000'; });
  $('back3').addEventListener('click', function () { show('s2'); });

  var sugTimer = null, sugSeq = 0;
  function shortName(r) { return String(r.display_name || '').split(',').slice(0, 3).join(',').trim(); }
  function setPlace(name, lat, lng) {
    $('place').value = name; place.lat = lat; place.lng = lng;
    $('placeNote').textContent = lat != null ? 'Pinned on the map.' : 'Pick a suggestion so people can open it on a map.';
    $('suggest').hidden = true;
  }
  $('place').addEventListener('input', function () {
    place.lat = place.lng = null; $('placeNote').textContent = 'Pick a suggestion so people can open it on a map.';
    clearTimeout(sugTimer);
    var q = this.value.trim();
    if (q.length < 3) { $('suggest').hidden = true; return; }
    sugTimer = setTimeout(function () {
      var seq = ++sugSeq;
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); }).then(function (list) {
          if (seq !== sugSeq || !list.length) { $('suggest').hidden = true; return; }
          $('suggest').innerHTML = list.map(function (r, i) {
            return '<li><button type="button" data-i="' + i + '">' + esc(shortName(r)) + '<small>' + esc(r.display_name) + '</small></button></li>';
          }).join('');
          $('suggest')._list = list; $('suggest').hidden = false;
        }).catch(function () { $('suggest').hidden = true; });
    }, 450);
  });
  $('suggest').addEventListener('click', function (e) {
    var b = e.target.closest('[data-i]');
    if (!b) return;
    var r = $('suggest')._list[Number(b.getAttribute('data-i'))];
    setPlace(shortName(r), parseFloat(r.lat), parseFloat(r.lon));
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.locwrap')) $('suggest').hidden = true; });
  $('gpsBtn').addEventListener('click', function () {
    if (!navigator.geolocation) return OC.toast('Your browser cannot share your location.');
    $('placeNote').textContent = 'Finding your location...';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng)
        .then(function (r) { return r.json(); })
        .then(function (r) { setPlace(shortName(r) || 'My current location', lat, lng); })
        .catch(function () { setPlace('My current location', lat, lng); });
    }, function () { $('placeNote').textContent = 'Location was blocked. Type the place instead.'; }, { timeout: 10000 });
  });

  /* ---------- bake the edits into the photo, upload, publish ---------- */
  function bakePhoto(it) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1400 / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var g = c.getContext('2d');
        if (canFilter) g.filter = filterCss(it);
        g.drawImage(img, 0, 0, c.width, c.height);
        if (canFilter) g.filter = 'none';
        if (it.text) {
          var px = Math.max(12, c.width * it.size / 100);
          g.font = '800 ' + px + 'px Montserrat, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          var x = it.x * c.width, y = it.y * c.height, w = g.measureText(it.text).width, pad = px * 0.35;
          if (it.hl) {
            g.fillStyle = it.color; g.beginPath();
            if (g.roundRect) g.roundRect(x - w / 2 - pad, y - px * 0.62, w + pad * 2, px * 1.24, px * 0.25); else g.rect(x - w / 2 - pad, y - px * 0.62, w + pad * 2, px * 1.24);
            g.fill(); g.fillStyle = lum(it.color) > 0.6 ? '#111' : '#fff';
          } else { g.fillStyle = it.color; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = px * 0.18; g.shadowOffsetY = px * 0.05; }
          g.fillText(it.text, x, y);
        }
        c.toBlob(function (b) { resolve(b || it.file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { resolve(it.file); };
      img.src = it.url;
    });
  }
  function uploadOne(blob, ext, type) {
    var path = user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    return sb.storage.from('post-media').upload(path, blob, { contentType: type }).then(function (r) {
      if (r.error) throw r.error;
      return sb.storage.from('post-media').getPublicUrl(path).data.publicUrl;
    });
  }

  $('shareBtn').addEventListener('click', function () {
    var text = $('text').value.trim(), where = $('place').value.trim(), btn = this;
    if (text.length < 10) return say('msg3', 'Please describe the problem (at least 10 characters).');
    if (where.length < 2) return say('msg3', 'Please add the location.');
    say('msg3', ''); btn.disabled = true; btn.textContent = 'Sharing...';

    var done = [], audioUrl = null;
    var chain = items.reduce(function (p, it) {
      return p.then(function () {
        var job = it.kind === 'image'
          ? bakePhoto(it).then(function (b) { return uploadOne(b, 'jpg', 'image/jpeg'); })
          : uploadOne(it.file, (it.file.name.split('.').pop() || 'mp4').toLowerCase(), it.file.type);
        return job.then(function (url) { done.push({ url: url, kind: it.kind }); });
      });
    }, Promise.resolve());

    chain.then(function () {
      if (!audioFile) return;
      return uploadOne(audioFile, (audioFile.name.split('.').pop() || 'mp3').toLowerCase(), audioFile.type).then(function (u) { audioUrl = u; });
    }).then(function () {
      return sb.from('posts').insert({
        title: OC.titleFrom(text), description: text, category: $('cat').value, location: where,
        lat: place.lat, lng: place.lng, audio_url: audioUrl,
        media_url: done[0] ? done[0].url : null, media_type: done[0] ? done[0].kind : null
      }).select('id').single();
    }).then(function (r) {
      if (r.error) throw r.error;
      return sb.from('post_media').insert(done.map(function (d, i) { return { post_id: r.data.id, url: d.url, kind: d.kind, position: i }; }))
        .then(function (r2) { if (r2.error) throw r2.error; });
    }).then(function () {
      location.href = 'feed.html?posted=1';
    }).catch(function (err) {
      say('msg3', 'Could not post: ' + (err.message || err));
      btn.disabled = false; btn.textContent = 'Share';
    });
  });
})();
