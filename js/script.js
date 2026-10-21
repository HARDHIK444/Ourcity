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

  // Each place: name words to look for in a post's location text, and map centres
  // (a post with a map pin inside the radius, in km, also counts). n = real number from the database.
  var DATA = {
    cities: [
      { name: 'Mangaluru', landmark: 'Lighthouse Hill', icon: 'lighthouse', hot: true, aliases: ['mangaluru', 'mangalore'], centres: [{ lat: 12.9141, lng: 74.8560, r: 40 }] },
      { name: 'Delhi', landmark: 'India Gate', icon: 'arch', aliases: ['delhi'], centres: [{ lat: 28.6139, lng: 77.2090, r: 50 }] },
      { name: 'Mumbai', landmark: 'Gateway of India', icon: 'gateway', aliases: ['mumbai', 'bombay'], centres: [{ lat: 19.0760, lng: 72.8777, r: 45 }] },
      { name: 'Bengaluru', landmark: 'Vidhana Soudha', icon: 'dome', aliases: ['bengaluru', 'bangalore'], centres: [{ lat: 12.9716, lng: 77.5946, r: 40 }] },
      { name: 'Kolkata', landmark: 'Howrah Bridge', icon: 'bridge', aliases: ['kolkata', 'calcutta', 'howrah'], centres: [{ lat: 22.5726, lng: 88.3639, r: 40 }] },
      { name: 'Hyderabad', landmark: 'Charminar', icon: 'charminar', aliases: ['hyderabad', 'secunderabad'], centres: [{ lat: 17.3850, lng: 78.4867, r: 40 }] }
    ],
    states: [
      { name: 'Karnataka', landmark: 'Vidhana Soudha, Bengaluru', icon: 'dome', hot: true,
        aliases: ['karnataka', 'mangaluru', 'mangalore', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'hubballi', 'hubli'],
        centres: [{ lat: 12.9141, lng: 74.8560, r: 40 }, { lat: 12.9716, lng: 77.5946, r: 40 }, { lat: 12.2958, lng: 76.6394, r: 30 }, { lat: 15.3647, lng: 75.1240, r: 30 }] },
      { name: 'Maharashtra', landmark: 'Gateway of India, Mumbai', icon: 'gateway',
        aliases: ['maharashtra', 'mumbai', 'bombay', 'pune', 'nagpur'],
        centres: [{ lat: 19.0760, lng: 72.8777, r: 45 }, { lat: 18.5204, lng: 73.8567, r: 35 }, { lat: 21.1458, lng: 79.0882, r: 35 }] },
      { name: 'Delhi (NCT)', landmark: 'India Gate', icon: 'arch', query: 'Delhi', aliases: ['delhi'], centres: [{ lat: 28.6139, lng: 77.2090, r: 50 }] },
      { name: 'West Bengal', landmark: 'Howrah Bridge, Kolkata', icon: 'bridge',
        aliases: ['west bengal', 'kolkata', 'calcutta', 'howrah'], centres: [{ lat: 22.5726, lng: 88.3639, r: 40 }] },
      { name: 'Telangana', landmark: 'Charminar, Hyderabad', icon: 'charminar',
        aliases: ['telangana', 'hyderabad', 'secunderabad'], centres: [{ lat: 17.3850, lng: 78.4867, r: 40 }] },
      { name: 'Kerala', landmark: 'Kovalam Lighthouse', icon: 'lighthouse',
        aliases: ['kerala', 'kochi', 'cochin', 'thiruvananthapuram', 'trivandrum', 'kozhikode', 'calicut'],
        centres: [{ lat: 9.9312, lng: 76.2673, r: 35 }, { lat: 8.5241, lng: 76.9366, r: 35 }, { lat: 11.2588, lng: 75.7804, r: 30 }] }
    ]
  };
  var loaded = false;   // true once the real numbers have arrived

  function km(a, b) {
    var R = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(x));
  }
  function inPlace(post, place) {
    var text = String(post.location || '').toLowerCase();
    if (place.aliases.some(function (w) { return text.indexOf(w) !== -1; })) return true;
    if (post.lat == null || post.lng == null) return false;
    return place.centres.some(function (c) { return km({ lat: post.lat, lng: post.lng }, c) <= c.r; });
  }
  // count every saved report for every city and state
  function countPlaces(posts) {
    ['cities', 'states'].forEach(function (k) {
      DATA[k].forEach(function (pl) {
        var mine = posts.filter(function (p) { return inPlace(p, pl); });
        pl.n = mine.length;
        pl.done = mine.filter(function (p) { return p.status === 'resolved'; }).length;
      });
    });
  }
  function loadCounts() {
    if (!window.sb) { loaded = true; renderPlaces(); return; }
    sb.from('posts').select('id,location,lat,lng,status').limit(5000).then(function (r) {
      if (!r.error) { countPlaces(r.data || []); }
      loaded = true; renderPlaces();
    });
  }

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
          '<div class="city__stat"><small>TOTAL CIVIC ISSUES REPORTED</small><b>' + (loaded ? (c.n || 0).toLocaleString('en-IN') : '...') + '</b>' +
            (loaded ? '<span class="city__sub">' + (c.done || 0).toLocaleString('en-IN') + ' resolved</span>' : '') + '</div>' +
          '<a class="city__go" href="feed.html?q=' + encodeURIComponent(c.query || c.name) + '" aria-label="Open ' + esc(c.name) + '">' + arrow + '</a>' +
        '</div>' +
        '<div class="city__links"><a href="feed.html?q=' + encodeURIComponent(c.query || c.name) + '">Issues</a><a href="#who">Authority</a><a href="feed.html?q=' + encodeURIComponent(c.query || c.name) + '&resolved=1">Resolution</a></div>' +
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
  loadCounts();
  setInterval(loadCounts, 30000);   // the numbers refresh by themselves every 30 seconds
  renderLatest();
})();
