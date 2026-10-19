/* ==========================================================
   OurCity: profile page (profile.html)
   profile.html         -> my own profile
   profile.html?u=<id>  -> someone else's profile
   Shows the person's posts in a grid, or "No posts yet".
   ========================================================== */
(function () {
  var esc = OC.esc;
  var root = document.getElementById('profile');
  function msg(html) { root.innerHTML = '<div class="card pf__empty">' + html + '</div>'; }

  if (!window.sb) return msg('<h2>Not connected</h2><p>Paste your publishable key into js/supabase.js.</p>');

  var wanted = new URLSearchParams(location.search).get('u');

  sb.auth.getSession().then(function (s) {
    var me = s.data.session && s.data.session.user;
    var uid = wanted || (me && me.id);
    if (!uid) return msg('<h2>Log in to see your profile</h2><p>Your posts will appear here.</p><a class="btn btn--orange" href="login.html">Login</a> <a class="btn btn--line" href="signup.html">Sign up</a>');
    var mine = !!me && me.id === uid;

    return Promise.all([
      sb.from('profiles').select('id,display_name,created_at').eq('id', uid).maybeSingle(),
      sb.from('posts').select('id,title,category,status,created_at,media_url,media_type,post_media(url,kind,position)').eq('user_id', uid).order('created_at', { ascending: false })
    ]).then(function (res) {
      var prof = res[0].data, posts = res[1].data || [];
      if (res[0].error || res[1].error) return msg('<h2>Could not load this profile</h2><p>' + esc((res[0].error || res[1].error).message) + '</p>');
      var name = (prof && prof.display_name) || (mine && me.user_metadata && me.user_metadata.display_name) || 'Citizen';
      document.title = 'OurCity | ' + name;
      var resolved = posts.filter(function (p) { return p.status === 'resolved'; }).length;
      var inprog = posts.filter(function (p) { return p.status === 'in_progress' || p.status === 'under_review'; }).length;

      var head = '<div class="card pf__head"><div class="pf__avatar">' + esc(OC.initials(name)) + '</div><div class="pf__info">' +
        '<h1 class="pf__name">' + esc(name) + '</h1>' +
        '<ul class="pf__stats"><li><b>' + posts.length + '</b><small>' + (posts.length === 1 ? 'post' : 'posts') + '</small></li>' +
        '<li><b>' + inprog + '</b><small>in progress</small></li><li><b>' + resolved + '</b><small>resolved</small></li></ul>' +
        (mine ? '<div class="pf__act"><a class="btn btn--orange" href="create.html">New post</a></div>' : '') +
        '</div></div><div class="pf__tab">Posts</div>';

      var body;
      if (!posts.length) {
        body = '<div class="pf__empty"><div class="ring"><svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></div>' +
          '<h2>No posts yet</h2>' +
          (mine ? '<p>When you share a problem, it will show up here.</p><a class="btn btn--orange" href="create.html">Share your first problem</a>'
                : '<p>This person has not shared anything yet.</p>') + '</div>';
      } else {
        body = '<div class="grid3">' + posts.map(function (p) {
          var items = OC.mediaItems(p), first = items[0], stage = OC.stageOf(p);
          var inner = !first ? '<div class="tile__ph">' + esc(p.category) + '</div>'
            : (first.kind === 'video' ? '<video src="' + esc(first.url) + '#t=0.1" muted preload="metadata"></video>' : '<img src="' + esc(first.url) + '" alt="' + esc(p.title) + '" loading="lazy">');
          return '<a class="tile" href="issue.html?id=' + esc(p.id) + '" title="' + esc(p.title) + '">' + inner +
            (items.length > 1 ? '<span class="tile__badge">' + items.length + '</span>' : '') +
            '<span class="status status--' + stage + ' tile__st">' + OC.STAGES[stage - 1] + '</span></a>';
        }).join('') + '</div>';
      }
      root.innerHTML = head + body;
    });
  }).catch(function (err) { msg('<h2>Something went wrong</h2><p>' + esc(err.message || String(err)) + '</p>'); });
})();
