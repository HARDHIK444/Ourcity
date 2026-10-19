/* ==========================================================
   OurCity: feed page (feed.html), using Supabase
   - A simple Instagram-style feed: camera bar, search, posts
   - Posting happens on create.html (js/create.js)
   - Likes, dislikes and comments come from js/social.js
   ========================================================== */
(function () {
  var esc = OC.esc;
  var posts = [];
  var user = null;
  var myPos = null;           // {lat,lng} after "Near me"
  var openComments = {};
  var isAdm = false;          // true for admins (they can remove any post or comment)

  var $ = function (id) { return document.getElementById(id); };
  var el = { posts: $('posts'), q: $('q'), fcat: $('fcat'), near: $('nearBtn'), info: $('searchInfo'), bar: $('shareBar') };

  el.fcat.innerHTML = '<option value="">All categories</option>' + OC.CATEGORIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  if (!window.sb) {
    el.posts.innerHTML = '<div class="card loading">Supabase is not connected. Paste your publishable key into js/supabase.js.</div>';
    return;
  }

  var ICONS = {
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11 V21 H4 V11 Z M7 11 L11 3 C13 3 14 4.5 13.5 7 L13 9 H19 C20.5 9 21.5 10.3 21 11.8 L19 19 C18.7 20.2 17.7 21 16.5 21 H7"/></svg>',
    dislike: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 13 V3 H4 V13 Z M7 13 L11 21 C13 21 14 19.5 13.5 17 L13 15 H19 C20.5 15 21.5 13.7 21 12.2 L19 5 C18.7 3.8 17.7 3 16.5 3 H7"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 H20 V16 H11 L6 21 V16 H4 Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 V20 H20 V12 M12 15 V3 M7 8 L12 3 L17 8"/></svg>'
  };

  /* ---------- who is logged in? ---------- */
  function setBar() { el.bar.setAttribute('href', user ? 'create.html' : 'login.html'); }
  sb.auth.getSession().then(function (r) { user = r.data.session && r.data.session.user; setBar(); checkAdmin(); load(); });
  sb.auth.onAuthStateChange(function (e, session) {
    var was = user && user.id; user = session && session.user; setBar();
    if ((user && user.id) !== was) { checkAdmin(); load(); }
  });

  function checkAdmin() { OC.isAdmin(user).then(function (v) { if (v !== isAdm) { isAdm = v; renderPosts(); } }); }

  /* ---------- load posts ---------- */
  function load() {
    return sb.from('posts').select(OC.POST_SELECT).order('created_at', { ascending: false }).limit(60)
      .then(function (r) {
        if (r.error) { el.posts.innerHTML = '<div class="card loading">Could not load reports: ' + esc(r.error.message) + '</div>'; return; }
        posts = r.data || [];
        return OCSocial.loadStats(posts, user).then(function () {
          renderPosts();
          if (OCSocial.problem) OC.toast(OCSocial.problem);
        });
      }).catch(function (err) {
        el.posts.innerHTML = '<div class="card loading">Something went wrong: ' + esc(err.message || String(err)) + '</div>';
      });
  }

  function distanceKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* ---------- one post ---------- */
  function postHTML(p) {
    var stage = OC.stageOf(p);
    var mine = user && p.user_id === user.id;
    var author = OC.authorOf(p);
    var rest = OC.bodyAfterTitle(p);
    var map = OC.mapLink(p);
    var id = esc(p.id), who = esc(p.user_id);
    return '<article class="pc">' +
      '<header class="pc__head"><a class="avatar" href="profile.html?u=' + who + '">' + esc(OC.initials(author)) + '</a>' +
        '<div class="pc__who"><a class="pc__name" href="profile.html?u=' + who + '">' + esc(author) + '</a>' +
        '<small>' + (map ? '<a href="' + map + '" target="_blank" rel="noopener">' + esc(p.location) + '</a>' : esc(p.location)) + (p._km != null ? ' &middot; ' + p._km.toFixed(1) + ' km away' : '') + '</small></div>' +
        '<span class="status status--' + stage + '">' + OC.STAGES[stage - 1] + '</span></header>' +
      '<a class="pc__media" href="issue.html?id=' + id + '" aria-label="Open this report">' + OC.media(p) + '</a>' +
      OC.audio(p) +
      '<div class="pc__bar">' +
        '<button type="button" data-act="like" data-id="' + id + '" class="' + (p.myVote === 1 ? 'is-on' : '') + '" aria-label="Like">' + ICONS.like + '<span>' + p.likes + '</span></button>' +
        '<button type="button" data-act="dislike" data-id="' + id + '" class="' + (p.myVote === -1 ? 'is-on' : '') + '" aria-label="Dislike">' + ICONS.dislike + '<span>' + p.dislikes + '</span></button>' +
        '<button type="button" data-act="comment" data-id="' + id + '" aria-label="Comments">' + ICONS.comment + '<span>' + p.nComments + '</span></button>' +
        '<button type="button" data-act="share" data-id="' + id + '" aria-label="Share" class="pc__share">' + ICONS.share + '</button>' +
      '</div>' +
      '<p class="pc__cap"><b>' + esc(author) + '</b> ' + esc(p.title) + (rest ? ' <span>' + esc(rest) + '</span>' : '') + '</p>' +
      '<div class="pc__track"><div class="pc__line"><i style="width:' + (stage * 25) + '%"></i></div>' +
        '<small>' + OC.STAGES[stage - 1] + ' &middot; Handled by ' + esc(OC.deptOf(p.category)) + '</small>' +
        (OC.latestNote(p) ? '<p class="pc__note"><b>Update:</b> ' + esc(OC.latestNote(p).note) + '</p>' : '') + '</div>' +
      '<div class="pc__foot"><span class="chip">' + esc(p.category) + '</span><small>' + OC.ago(p.created_at) + '</small>' +
        '<a href="issue.html?id=' + id + '">View details</a>' +
        (user && !mine ? '<button type="button" data-act="report" data-id="' + id + '">Report</button>' : '') +
        ((mine || isAdm) ? '<button type="button" data-act="delete" data-id="' + id + '">' + (mine ? 'Delete' : 'Remove (admin)') + '</button>' : '') + '</div>' +
      (openComments[p.id] ? OCSocial.commentsHTML(openComments[p.id], user, p, isAdm) : '') +
    '</article>';
  }

  /* ---------- search + category + near me ---------- */
  function visiblePosts() {
    var q = el.q.value.trim().toLowerCase(), cat = el.fcat.value;
    var list = posts.filter(function (p) {
      p._km = null;
      if (cat && p.category !== cat) return false;
      if (q && (p.location + ' ' + p.title + ' ' + p.description + ' ' + p.category).toLowerCase().indexOf(q) === -1) return false;
      if (myPos) {
        if (p.lat == null || p.lng == null) return false;
        p._km = distanceKm(myPos, { lat: p.lat, lng: p.lng });
        if (p._km > 10) return false;
      }
      return true;
    });
    if (myPos) list.sort(function (a, b) { return a._km - b._km; });
    return list;
  }

  function renderPosts() {
    var list = visiblePosts();
    var filtering = el.q.value.trim() || el.fcat.value || myPos;
    el.info.hidden = !filtering;
    if (filtering) el.info.textContent = list.length + (list.length === 1 ? ' report' : ' reports') + (myPos ? ' within 10 km of you' : ' found');
    el.posts.innerHTML = list.length ? list.map(postHTML).join('')
      : '<div class="card noposts">' + (filtering ? 'No reports match your search.' : 'No posts yet. Tap the camera above to share the first one.') + '</div>';
  }

  el.q.addEventListener('input', renderPosts);
  el.fcat.addEventListener('change', renderPosts);
  $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); renderPosts(); });
  el.near.addEventListener('click', function () {
    if (myPos) { myPos = null; el.near.classList.remove('is-on'); return renderPosts(); }
    if (!navigator.geolocation) return OC.toast('Your browser cannot share your location.');
    el.near.textContent = 'Finding you...';
    navigator.geolocation.getCurrentPosition(function (pos) {
      myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      el.near.textContent = 'Near me'; el.near.classList.add('is-on'); renderPosts();
    }, function () { el.near.textContent = 'Near me'; OC.toast('Location was blocked. Allow it in your browser, or search by place name.'); }, { timeout: 10000 });
  });

  /* ---------- clicks on posts ---------- */
  el.posts.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-comment]');
    if (del) {
      var pid = del.getAttribute('data-post'), post = posts.filter(function (x) { return x.id === pid; })[0];
      OCSocial.deleteComment(post, del.getAttribute('data-del-comment')).then(function () { return refreshComments(post); })
        .catch(function (err) { OC.toast('Could not delete: ' + err.message); });
      return;
    }
    var rc = e.target.closest('[data-report-comment]');
    if (rc) return OCSocial.reportDialog({ comment_id: rc.getAttribute('data-report-comment') });
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
    var p = posts.filter(function (x) { return x.id === id; })[0];
    if (!p) return;

    if (act === 'like' || act === 'dislike') {
      if (!user) return OC.toast('Please log in to ' + act + ' a report.');
      OCSocial.vote(p, user, act === 'like' ? 1 : -1).then(renderPosts).catch(function (err) { OC.toast('Could not save: ' + err.message); });
    } else if (act === 'comment') {
      if (openComments[id]) { delete openComments[id]; renderPosts(); }
      else refreshComments(p);
    } else if (act === 'share') {
      var url = new URL('issue.html?id=' + encodeURIComponent(id), location.href).href;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(url).then(function () { OC.toast('Link copied'); }, function () { OC.toast(url); });
      else OC.toast(url);
    } else if (act === 'report') {
      OCSocial.reportDialog({ post_id: id });
    } else if (act === 'delete') {
      if (!confirm('Delete this post?')) return;
      sb.from('posts').delete().eq('id', id).then(function (r) {
        if (r.error) return OC.toast('Could not delete: ' + r.error.message);
        OC.toast('Deleted'); load();
      });
    }
  });

  function refreshComments(post) {
    return OCSocial.loadComments(post.id).then(function (list) { openComments[post.id] = list; renderPosts(); })
      .catch(function (err) { OC.toast('Could not load comments: ' + err.message); });
  }

  el.posts.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-comment-form]');
    if (!f) return;
    e.preventDefault();
    var input = f.querySelector('input'), text = input.value.trim();
    if (!text) return;
    var post = posts.filter(function (x) { return x.id === f.getAttribute('data-comment-form'); })[0];
    input.disabled = true;
    OCSocial.addComment(post, text).then(function () { return refreshComments(post); })
      .catch(function (err) { input.disabled = false; OC.toast('Could not comment: ' + err.message); });
  });

  // coming back from the Create page
  if (/[?&]posted=1/.test(location.search)) {
    history.replaceState(null, '', 'feed.html');
    OC.toast('Posted. The department has been told.');
  }
})();
