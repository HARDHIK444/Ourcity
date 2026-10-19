/* ==========================================================
   OurCity: home page (index.html)
   - Cities / States cards with search
   - Latest reports (read from the same saved reports as the feed)
   ========================================================== */
(function () {
  var esc = OC.esc;

  // Simple line drawings of a famous landmark per place (64x64 grid)
  var ICON = {
    lighthouse: 'M26 58 L29 20 H35 L38 58 M22 58 H42 M28 20 V14 H36 V20 M32 14 V8 M20 10 L26 12 M44 10 L38 12 M6 58 C12 54 18 54 24 58 M40 58 C46 54 52 54 58 58',
    arch: 'M10 58 V20 H54 V58 M4 58 H60 M24 58 V38 A8 8 0 0 1 40 38 V58 M10 20 V14 H54 V20 M16 26 H22 M42 26 H48 M8 62 H56',
    gateway: 'M8 58 V26 H56 V58 M4 58 H60 M26 58 V40 A6 6 0 0 1 38 40 V58 M20 26 V16 H44 V26 M24 16 V12 H40 V16 M32 12 V6 M12 34 H18 M46 34 H52',
    dome: 'M8 58 V34 H56 V58 M4 58 H60 M24 34 V26 H40 V34 M28 26 V18 A4 4 0 0 1 36 18 V26 M32 14 V8 M16 42 V54 M24 42 V54 M32 42 V54 M40 42 V54 M48 42 V54',
    bridge: 'M4 50 H60 M4 56 H60 M10 50 V30 M54 50 V30 M10 30 L32 14 L54 30 M10 30 H54 M20 50 L32 14 M44 50 L32 14 M32 14 V8',
    charminar: 'M10 58 V30 H54 V58 M4 58 H60 M10 30 V12 M54 30 V12 M18 30 V18 M46 30 V18 M24 58 V40 A8 8 0 0 1 40 40 V58 M6 12 H14 M50 12 H58 M10 12 V8 M54 12 V8'
  };

  var DATA = {
    cities: [
      { name: 'Mangaluru', landmark: 'Lighthouse Hill', n: 4218, icon: 'lighthouse', hot: true },
      { name: 'Delhi', landmark: 'India Gate', n: 48312, icon: 'arch' },
      { name: 'Mumbai', landmark: 'Gateway of India', n: 61874, icon: 'gateway' },
      { name: 'Bengaluru', landmark: 'Vidhana Soudha', n: 52046, icon: 'dome' },
      { name: 'Kolkata', landmark: 'Howrah Bridge', n: 29517, icon: 'bridge' },
      { name: 'Hyderabad', landmark: 'Charminar', n: 33902, icon: 'charminar' }
    ],
    states: [
      { name: 'Karnataka', landmark: 'Vidhana Soudha, Bengaluru', n: 98420, icon: 'dome', hot: true },
      { name: 'Maharashtra', landmark: 'Gateway of India, Mumbai', n: 112305, icon: 'gateway' },
      { name: 'Delhi (NCT)', landmark: 'India Gate', n: 48312, icon: 'arch' },
      { name: 'West Bengal', landmark: 'Howrah Bridge, Kolkata', n: 63118, icon: 'bridge' },
      { name: 'Telangana', landmark: 'Charminar, Hyderabad', n: 71664, icon: 'charminar' },
      { name: 'Kerala', landmark: 'Kovalam Lighthouse', n: 41207, icon: 'lighthouse' }
    ]
  };

  var mode = 'cities', q = '';
  var grid = document.getElementById('cityGrid');
  var arrow = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 L17 7 M9 7 H17 V15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderPlaces() {
    var list = DATA[mode].filter(function (c) {
      return (c.name + ' ' + c.landmark).toLowerCase().indexOf(q) !== -1;
    });
    if (!list.length) { grid.innerHTML = '<div class="empty">No match. Try another name.</div>'; return; }
    grid.innerHTML = list.map(function (c) {
      return '<article class="city' + (c.hot ? ' city--hot' : '') + '">' +
        '<div class="city__main">' +
          '<div class="city__icon"><svg viewBox="0 0 64 64" role="img" aria-label="' + esc(c.landmark) + '"><path d="' + ICON[c.icon] + '"/></svg></div>' +
          '<div class="city__name"><strong>' + esc(c.name) + '</strong><span>' + esc(c.landmark) + '</span></div>' +
          '<div class="city__rule"></div>' +
          '<div class="city__stat"><small>TOTAL CIVIC ISSUES REPORTED</small><b>' + c.n.toLocaleString('en-IN') + '</b></div>' +
          '<a class="city__go" href="feed.html" aria-label="Open ' + esc(c.name) + '">' + arrow + '</a>' +
        '</div>' +
        '<div class="city__links"><a href="feed.html">Issues</a><a href="#who">Authority</a><a href="feed.html">Resolution</a></div>' +
      '</article>';
    }).join('');
  }

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      renderPlaces();
    });
  });
  document.getElementById('cityQ').addEventListener('input', function (e) {
    q = e.target.value.trim().toLowerCase();
    renderPlaces();
  });

  // Latest reports: the 3 newest from the database
  function renderLatest() {
    var box = document.getElementById('latest');
    if (!window.sb) { box.innerHTML = '<p class="empty">Connect Supabase to see live reports.</p>'; return; }
    sb.from('posts').select(OC.POST_SELECT).order('created_at', { ascending: false }).limit(3).then(function (r) {
      var list = r.data || [];
      if (r.error || !list.length) { box.innerHTML = '<p class="empty">No reports yet. <a href="feed.html" style="text-decoration:underline">Be the first to post one.</a></p>'; return; }
      box.innerHTML = list.map(function (p) {
        var stage = OC.stageOf(p);
        return '<article class="card rep">' +
          '<div class="rep__body">' +
            '<div class="rep__tags"><span class="chip">' + esc(p.category) + '</span><span class="status status--' + stage + '">' + OC.STAGES[stage - 1] + '</span></div>' +
            '<div class="rep__title">' + esc(p.title) + '</div>' +
            '<div class="rep__meta">' + esc(p.location) + ' · ' + OC.ago(p.created_at) + '</div>' +
            '<div class="rep__dept"><b>' + esc(OC.deptOf(p.category)) + '</b><br>' + OC.STAGES[stage - 1] + '</div>' +
          '</div>' +
          '<div class="rep__foot"><a href="issue.html?id=' + esc(p.id) + '">Open</a><a href="issue.html?id=' + esc(p.id) + '">Track</a></div>' +
        '</article>';
      }).join('');
    });
  }

  renderPlaces();
  renderLatest();
})();
