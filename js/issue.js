/* ==========================================================
   OurCity: issue details (issue.html?id=...), using Supabase
   ========================================================== */
(function () {
  var esc = OC.esc;
  var root = document.getElementById('issue');
  var id = new URLSearchParams(location.search).get('id');

  function message(text) {
    root.innerHTML = '<div class="issue"><div class="notfound" style="width:100%">' + text + ' <a href="feed.html">Back to the feed</a></div></div>';
  }
  if (!window.sb) return message('Supabase is not connected. Paste your key into js/supabase.js.');
  if (!id) return message('No report selected.');

  var NOTES = ['Reported by the community', 'The department is checking', 'Work has started', 'Neighbours confirm with a new photo'];

  var user = null, post = null, comments = [], isAdm = false;
  var ICONS = {
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11 V21 H4 V11 Z M7 11 L11 3 C13 3 14 4.5 13.5 7 L13 9 H19 C20.5 9 21.5 10.3 21 11.8 L19 19 C18.7 20.2 17.7 21 16.5 21 H7"/></svg>',
    dislike: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 13 V3 H4 V13 Z M7 13 L11 21 C13 21 14 19.5 13.5 17 L13 15 H19 C20.5 15 21.5 13.7 21 12.2 L19 5 C18.7 3.8 17.7 3 16.5 3 H7"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 V20 H20 V12 M12 15 V3 M7 8 L12 3 L17 8"/></svg>'
  };

  sb.auth.getSession().then(function (s) {
    user = s.data.session && s.data.session.user;
    return sb.from('posts').select(OC.POST_SELECT).eq('id', id).maybeSingle();
  }).then(function (r) {
    if (r.error) return message('Could not load this report: ' + esc(r.error.message));
    if (!r.data) return message('This report was not found. It may have been deleted.');
    post = r.data;
    return OCSocial.loadStats([post], user).then(function () { return OCSocial.loadComments(post.id); })
      .then(function (list) { comments = list; render(post); return OC.isAdmin(user); })
      .then(function (admin) { isAdm = admin; if (admin) { showAdmin(); redraw(); } });
  }).catch(function (err) { message('Could not load this report: ' + esc(err.message || err)); });

  function socialHTML() {
    return '<div class="counts"><span>' + post.likes + ' likes · ' + post.dislikes + ' dislikes</span><span>' + post.nComments + ' comments</span></div>' +
      '<div class="react">' +
        '<button type="button" data-act="like" class="' + (post.myVote === 1 ? 'is-on' : '') + '">' + ICONS.like + 'Like</button>' +
        '<button type="button" data-act="dislike" class="' + (post.myVote === -1 ? 'is-on' : '') + '">' + ICONS.dislike + 'Dislike</button>' +
        '<button type="button" data-act="share">' + ICONS.share + 'Share</button>' +
      '</div>' + (user && post.user_id !== user.id ? '<div class="owner-tools" style="padding:8px 0 0"><button type="button" data-act="report">Report this post</button></div>' : '') +
      OCSocial.commentsHTML(comments, user, post, isAdm);
  }

  function redraw() {
    var box = document.getElementById('social');
    if (box) box.innerHTML = socialHTML();
  }

  root.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-comment]');
    if (del) {
      OCSocial.deleteComment(post, del.getAttribute('data-del-comment'))
        .then(function () { return OCSocial.loadComments(post.id); })
        .then(function (list) { comments = list; redraw(); })
        .catch(function (err) { OC.toast('Could not delete: ' + err.message); });
      return;
    }
    var rc = e.target.closest('[data-report-comment]');
    if (rc) return OCSocial.reportDialog({ comment_id: rc.getAttribute('data-report-comment') });
    var b = e.target.closest('[data-act]');
    if (!b || !post) return;
    var act = b.getAttribute('data-act');
    if (act === 'like' || act === 'dislike') {
      if (!user) return OC.toast('Please log in to ' + act + ' a report.');
      OCSocial.vote(post, user, act === 'like' ? 1 : -1).then(redraw).catch(function (err) { OC.toast('Could not save: ' + err.message); });
    } else if (act === 'report') {
      OCSocial.reportDialog({ post_id: post.id });
    } else if (act === 'share') {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(url).then(function () { OC.toast('Link copied'); }, function () { OC.toast(url); });
      else OC.toast(url);
    }
  });

  root.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-comment-form]');
    if (!f) return;
    e.preventDefault();
    var input = f.querySelector('input'), text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    OCSocial.addComment(post, text).then(function () { return OCSocial.loadComments(post.id); })
      .then(function (list) { comments = list; redraw(); })
      .catch(function (err) { input.disabled = false; OC.toast('Could not comment: ' + err.message); });
  });

  /* ---------- admin only: move to the NEXT step, with proof ---------- */
  function showAdmin() {
    var box = document.getElementById('adminBox');
    if (!box) return;
    var stage = OC.stageOf(post);
    if (stage >= 4) { box.innerHTML = '<div class="admin admin--done">ADMIN &middot; This report is resolved. No more steps.</div>'; return; }
    var next = stage + 1, nextName = OC.STAGES[next - 1];
    box.innerHTML = '<form class="admin" id="adminForm"><div class="admin__tag">ADMIN &middot; NEXT STEP</div>' +
      '<div class="admin__step"><span>' + OC.STAGES[stage - 1] + '</span> &rarr; <b>' + nextName + '</b></div>' +
      '<label>Proof photos (1 to 3, required)<input type="file" id="adPhotos" accept="image/*" multiple></label>' +
      '<div class="admin__thumbs" id="adThumbs"></div>' +
      '<div class="admin__geo"><button type="button" class="btn btn--line" id="adGeo">Capture my location</button><span id="adGeoTxt">Required. Do this at the spot, so the update is geotagged.</span></div>' +
      '<label>Note (what is being done, or how it was fixed)<textarea id="adNote" maxlength="500" placeholder="Example: Crew visited the site and started repair."></textarea></label>' +
      '<div class="form-msg" id="adMsg" role="alert"></div>' +
      '<button class="btn btn--orange" type="submit" id="adBtn">Mark as ' + nextName + '</button></form>';

    var files = [], geo = null, msg = document.getElementById('adMsg');
    function drawThumbs() {
      document.getElementById('adThumbs').innerHTML = files.map(function (f, i) {
        return '<div class="athumb"><img src="' + URL.createObjectURL(f) + '" alt="Proof photo ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Remove">&times;</button></div>';
      }).join('');
    }
    document.getElementById('adPhotos').addEventListener('change', function (e) {
      msg.textContent = '';
      Array.prototype.forEach.call(e.target.files, function (f) {
        if (f.type.indexOf('image/') !== 0) { msg.textContent = 'Proof must be photos.'; return; }
        if (files.length >= 3) { msg.textContent = 'You can add at most 3 photos.'; return; }
        files.push(f);
      });
      e.target.value = ''; drawThumbs();
    });
    document.getElementById('adThumbs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (b) { files.splice(Number(b.getAttribute('data-rm')), 1); drawThumbs(); }
    });
    document.getElementById('adGeo').addEventListener('click', function () {
      var t = document.getElementById('adGeoTxt');
      if (!navigator.geolocation) { t.textContent = 'This browser cannot share a location.'; return; }
      t.textContent = 'Finding your location...';
      navigator.geolocation.getCurrentPosition(function (pos) {
        geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        var away = (post.lat != null && post.lng != null) ? OC.metres({ lat: post.lat, lng: post.lng }, geo) : null;
        t.textContent = 'Captured (' + geo.lat.toFixed(5) + ', ' + geo.lng.toFixed(5) + ')' +
          (away != null ? ' · ' + (away < 1000 ? Math.round(away) + ' m' : (away / 1000).toFixed(1) + ' km') + ' from the reported spot' : '');
      }, function () { t.textContent = 'Location was blocked. Allow location in your browser to continue.'; }, { enableHighAccuracy: true, timeout: 15000 });
    });

    document.getElementById('adminForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var note = document.getElementById('adNote').value.trim(), btn = document.getElementById('adBtn');
      if (files.length < 1) { msg.textContent = 'Add at least 1 proof photo.'; return; }
      if (!geo) { msg.textContent = 'Capture your location first. It is needed for the geotag.'; return; }
      msg.textContent = ''; btn.disabled = true; btn.textContent = 'Saving...';

      var urls = [];
      var chain = files.reduce(function (p, f) {
        return p.then(function () {
          return shrink(f).then(function (blob) {
            var path = user.id + '/proof-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
            return sb.storage.from('post-media').upload(path, blob, { contentType: 'image/jpeg' }).then(function (r) {
              if (r.error) throw r.error;
              urls.push(sb.storage.from('post-media').getPublicUrl(path).data.publicUrl);
            });
          });
        });
      }, Promise.resolve());

      chain.then(function () {
        return sb.from('post_updates').insert({ post_id: post.id, status: OC.STATUS_KEYS[next - 1], note: note || null, evidence_urls: urls, lat: geo.lat, lng: geo.lng });
      }).then(function (r) {
        if (r.error) throw r.error;
        return sb.from('posts').select(OC.POST_SELECT).eq('id', post.id).maybeSingle();
      }).then(function (r) {
        if (r.error || !r.data) throw (r.error || new Error('Could not reload'));
        var keep = { likes: post.likes, dislikes: post.dislikes, nComments: post.nComments, myVote: post.myVote };
        post = Object.assign(r.data, keep); render(post); showAdmin(); OC.toast('Status updated to ' + nextName);
      }).catch(function (err) {
        msg.textContent = 'Could not save: ' + (err.message || err); btn.disabled = false; btn.textContent = 'Mark as ' + nextName;
      });
    });
  }
  function shrink(f) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b || f); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { resolve(f); };
      img.src = URL.createObjectURL(f);
    });
  }

  function render(p) {
    var stage = OC.stageOf(p), author = OC.authorOf(p);
    document.title = 'OurCity | ' + p.title;

    var tl = OC.STAGES.map(function (name, i) {
      var n = i + 1, reached = n <= stage, done = n < stage || stage === 4;
      var info = OC.stageInfo(p, n);
      var dot = done ? '<span class="dot" style="background:#111;border:2px solid #111"></span>'
        : (n === stage ? '<span class="dot" style="background:#FF6A00;border:2px solid #111;box-shadow:0 0 0 4px rgba(255,106,0,.25)"></span>' : '<span class="dot"></span>');
      var line = i === 3 ? '' : '<u class="' + (n < stage ? 'on' : '') + '"></u>';
      var line2 = n === 1 ? 'By ' + esc(author) + ' &middot; ' + OC.stamp(p.created_at)
        : (info.at ? OC.stamp(info.at) : (reached ? 'Reached' : NOTES[i]));
      var extra = (info.note ? '<p class="vtl__note">' + esc(info.note) + '</p>' : '');
      if (info.evidence.length) {
        extra += '<div class="vtl__evs">' + info.evidence.map(function (u) {
          return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img class="vtl__ev" src="' + esc(u) + '" alt="Proof photo from the department" loading="lazy"></a>';
        }).join('') + '</div>';
      }
      if (info.lat != null && info.lng != null) {
        var away = (p.lat != null && p.lng != null) ? OC.metres({ lat: p.lat, lng: p.lng }, { lat: info.lat, lng: info.lng }) : null;
        extra += '<a class="vtl__geo" href="' + OC.mapUrl(info.lat, info.lng) + '" target="_blank" rel="noopener">Geotagged location' +
          (away != null ? ' &middot; ' + (away < 1000 ? Math.round(away) + ' m' : (away / 1000).toFixed(1) + ' km') + ' from the reported spot' : '') + '</a>';
      }
      return '<div class="vtl__row' + (reached ? '' : ' todo') + '"><div class="vtl__rail">' + dot + line + '</div><div class="vtl__txt"><b>' + name + '</b><small>' + line2 + '</small>' + extra + '</div></div>';
    }).join('');

    var live = ['Reported. Sent to the department.', 'Under review. The department is checking.', 'In progress. Work has started.', 'Resolved. Confirmed by neighbours.'][stage - 1];

    root.innerHTML = '<div class="issue">' +
      '<div class="issue__photo"><a class="back" href="feed.html">&larr; Back to feed</a><figure>' + OC.media(p) + '<figcaption>' + esc(p.location) + (OC.mapLink(p) ? ' · <a href="' + OC.mapLink(p) + '" target="_blank" rel="noopener" style="text-decoration:underline">View on map</a>' : '') + '</figcaption>' + OC.audio(p) + '</figure></div>' +
      '<div class="issue__side">' +
        '<div class="who"><div class="avatar" style="width:46px;height:46px;font-size:15px">' + esc(OC.initials(author)) + '</div>' +
          '<div><b>' + esc(author) + '</b><small>' + OC.ago(p.created_at) + ' · ' + esc(p.location) + '</small></div>' +
          '<span class="status status--' + stage + '">' + OC.STAGES[stage - 1] + '</span></div>' +
        '<h1 style="margin:16px 0 0;font-size:24px;line-height:1.25;font-weight:800">' + esc(p.title) + '</h1>' +
        (OC.bodyAfterTitle(p) ? '<p class="text">' + esc(OC.bodyAfterTitle(p)) + '</p>' : '') +
        '<div class="hashes"><span>#' + esc(p.category.replace(/\s+/g, '')) + '</span><span>#OurCity</span></div>' +
        '<div class="sec-label">STATUS TIMELINE</div><div class="vtl">' + tl + '</div>' +
        '<div id="adminBox"></div>' +
        '<div class="handled"><small>HANDLED BY</small><b>' + esc(OC.deptOf(p.category)) + '</b>' +
          '<p>OurCity has sent this report to them. You do not need to call or contact anyone. Updates appear here live.</p></div>' +
        '<div class="live"><span class="label">Live update</span><strong>' + live + '</strong><p>' + (stage > 1 ? 'Updated ' + OC.ago(OC.stageInfo(p, stage).at || p.created_at) : 'Reported ' + OC.ago(p.created_at)) + '</p></div>' +
        '<div id="social">' + socialHTML() + '</div>' +
      '</div></div>';
  }
})();
