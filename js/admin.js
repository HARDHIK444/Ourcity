/* ==========================================================
   OurCity: admin dashboard (admin.html)
   Only admins see this page. It lists every report in one table.
   Changing a status still happens on the report page, because every step
   needs proof photos and a geotag.
   ========================================================== */
(function () {
  var esc = OC.esc;
  var root = document.getElementById('admin');
  var posts = [], flags = [], quick = '';   // quick = '' | status key | 'late'
  var LATE_DAYS = 7;

  function deny(title, text, link) {
    root.innerHTML = '<div class="card ad__deny"><h2>' + title + '</h2><p>' + text + '</p>' + (link || '') + '</div>';
  }
  if (!window.sb) return deny('Not connected', 'Paste your publishable key into js/supabase.js.');

  sb.auth.getSession().then(function (s) {
    var user = s.data.session && s.data.session.user;
    if (!user) return deny('Please log in', 'This page is for admins.', '<a class="btn btn--orange" href="login.html">Login</a>');
    return OC.isAdmin(user).then(function (yes) {
      if (!yes) return deny('Admins only', 'Your account is not an admin account.', '<a class="btn btn--line" href="feed.html">Back to the feed</a>');
      return sb.from('posts').select('id,title,category,location,status,created_at,user_id,profiles!posts_user_id_fkey(display_name)')
        .order('created_at', { ascending: true }).limit(1000).then(function (r) {
          if (r.error) return deny('Could not load reports', esc(r.error.message));
          posts = r.data || [];
          return sb.from('flags').select('id,reason,details,created_at,post_id,comment_id,posts(id,title),comments(id,body,post_id),profiles!flags_user_id_fkey(display_name)')
            .order('created_at', { ascending: true }).limit(200).then(function (f) {
              flags = f.error ? [] : (f.data || []);
              draw(f.error ? f.error.message : '');
            });
        });
    });
  }).catch(function (err) { deny('Something went wrong', esc(err.message || String(err))); });

  function daysOpen(p) { return Math.floor((Date.now() - new Date(p.created_at).getTime()) / 864e5); }
  function isLate(p) { return p.status !== 'resolved' && daysOpen(p) >= LATE_DAYS; }

  function draw(flagErr) {
    var counts = { reported: 0, under_review: 0, in_progress: 0, resolved: 0, late: 0 };
    posts.forEach(function (p) { counts[p.status] = (counts[p.status] || 0) + 1; if (isLate(p)) counts.late++; });

    function stat(key, label, cls) {
      return '<button type="button" class="ad__stat ' + (cls || '') + (quick === key ? ' is-on' : '') + '" data-q="' + key + '"><b>' + (key === '' ? posts.length : counts[key]) + '</b><small>' + label + '</small></button>';
    }
    root.innerHTML = '<h1>Admin dashboard</h1><p class="ad__sub">Every report in one place. Oldest unresolved first. Open a report to move it to its next step with proof photos and a geotag.</p>' +
      '<div class="ad__stats">' + stat('', 'All reports') + stat('reported', 'Reported') + stat('under_review', 'Under review') + stat('in_progress', 'In progress') +
      stat('resolved', 'Resolved') + stat('late', 'Open ' + LATE_DAYS + '+ days', 'warn') +
      '<button type="button" class="ad__stat warn" data-scroll="flags"><b>' + flags.length + '</b><small>Flagged</small></button></div>' +
      '<div class="card ad__bar"><input type="search" id="adQ" placeholder="Search title, place or reporter" aria-label="Search">' +
      '<select id="adCat" aria-label="Category"><option value="">All categories</option>' + OC.CATEGORIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<span class="ad__count" id="adCount"></span></div>' +
      '<div class="ad__wrap"><table><thead><tr><th>Report</th><th>Category</th><th>Place</th><th>Reporter</th><th>Open for</th><th>Status</th><th></th></tr></thead><tbody id="adRows"></tbody></table></div>' +
      '<h2 class="ad__h2" id="flags">Flagged by the community</h2>' + (flagErr ? '<p class="ad__sub">Could not load flags: ' + esc(flagErr) + ' (did you run supabase/07_safety_notifications.sql?)</p>' : '') +
      '<div class="ad__wrap"><table><thead><tr><th>What</th><th>Reason</th><th>Reported by</th><th>When</th><th></th></tr></thead><tbody id="flagRows"></tbody></table></div>';

    document.getElementById('adQ').addEventListener('input', rows);
    document.getElementById('adCat').addEventListener('change', rows);
    root.querySelector('.ad__stats').addEventListener('click', function (e) {
      var sc = e.target.closest('[data-scroll]');
      if (sc) { document.getElementById('flags').scrollIntoView({ behavior: 'smooth' }); return; }
      var b = e.target.closest('[data-q]');
      if (!b) return;
      quick = b.getAttribute('data-q');
      root.querySelectorAll('.ad__stat').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      rows();
    });
    document.getElementById('flagRows').addEventListener('click', flagClick);
    rows(); flagRows();
  }

  function flagRows() {
    document.getElementById('flagRows').innerHTML = flags.length ? flags.map(function (f) {
      var isPost = !!f.post_id, pid = isPost ? f.post_id : (f.comments && f.comments.post_id);
      var what = isPost ? 'Post: ' + esc((f.posts && f.posts.title) || '(removed)') : 'Comment: &ldquo;' + esc(((f.comments && f.comments.body) || '(removed)').slice(0, 120)) + '&rdquo;';
      return '<tr><td class="t">' + what + '</td><td>' + esc(f.reason) + (f.details ? '<small style="display:block;color:#555">' + esc(f.details) + '</small>' : '') + '</td>' +
        '<td>' + esc((f.profiles && f.profiles.display_name) || 'Citizen') + '</td><td>' + OC.ago(f.created_at) + '</td>' +
        '<td style="white-space:nowrap"><a class="go" href="issue.html?id=' + esc(pid || '') + '">Open</a> ' +
        '<button type="button" class="ad__btn" data-dismiss="' + esc(f.id) + '">Dismiss</button> ' +
        '<button type="button" class="ad__btn ad__btn--red" data-remove="' + esc(f.id) + '">Remove ' + (isPost ? 'post' : 'comment') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="none">Nothing flagged. Good.</td></tr>';
  }

  function flagClick(e) {
    var dis = e.target.closest('[data-dismiss]'), rem = e.target.closest('[data-remove]');
    if (!dis && !rem) return;
    var id = (dis || rem).getAttribute(dis ? 'data-dismiss' : 'data-remove');
    var f = flags.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    var job;
    if (dis) job = sb.from('flags').delete().eq('id', id);
    else {
      if (!confirm('Remove this ' + (f.post_id ? 'post' : 'comment') + ' for everyone? This cannot be undone.')) return;
      job = f.post_id ? sb.from('posts').delete().eq('id', f.post_id) : sb.from('comments').delete().eq('id', f.comment_id);
    }
    job.then(function (r) {
      if (r.error) return OC.toast('Could not do that: ' + r.error.message);
      if (rem) {
        flags = flags.filter(function (x) { return f.post_id ? x.post_id !== f.post_id : x.comment_id !== f.comment_id; });
        if (f.post_id) posts = posts.filter(function (p) { return p.id !== f.post_id; });
      } else flags = flags.filter(function (x) { return x.id !== id; });
      draw(); OC.toast(dis ? 'Dismissed' : 'Removed');
    });
  }

  function rows() {
    var q = document.getElementById('adQ').value.trim().toLowerCase(), cat = document.getElementById('adCat').value;
    var list = posts.filter(function (p) {
      if (quick === 'late' ? !isLate(p) : (quick && p.status !== quick)) return false;
      if (cat && p.category !== cat) return false;
      if (q && (p.title + ' ' + p.location + ' ' + OC.authorOf(p)).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    // unresolved first (oldest on top), resolved at the bottom
    list.sort(function (a, b) {
      var ra = a.status === 'resolved' ? 1 : 0, rb = b.status === 'resolved' ? 1 : 0;
      return ra - rb || new Date(a.created_at) - new Date(b.created_at);
    });
    document.getElementById('adCount').textContent = list.length + (list.length === 1 ? ' report' : ' reports');
    document.getElementById('adRows').innerHTML = list.length ? list.map(function (p) {
      var stage = OC.stageOf(p), d = daysOpen(p);
      var next = stage < 4 ? 'Next: ' + OC.STAGES[stage] : 'View';
      return '<tr><td class="t">' + esc(p.title) + '</td><td>' + esc(p.category) + '</td><td>' + esc(p.location) + '</td><td>' + esc(OC.authorOf(p)) + '</td>' +
        '<td class="' + (isLate(p) ? 'late' : '') + '">' + (d === 0 ? 'Today' : d + (d === 1 ? ' day' : ' days')) + '</td>' +
        '<td><span class="status status--' + stage + '">' + OC.STAGES[stage - 1] + '</span></td>' +
        '<td><a class="go" href="issue.html?id=' + esc(p.id) + '">' + next + ' &rarr;</a></td></tr>';
    }).join('') : '<tr><td colspan="7" class="none">No reports match.</td></tr>';
  }
})();
