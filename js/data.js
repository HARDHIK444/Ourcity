/* ==========================================================
   OurCity: shared helpers (used by every page)
   ========================================================== */
(function () {
  var H = 3600e3, D = 24 * H;

  // database value -> label shown to people (position = stage number - 1)
  var STATUS_KEYS = ['reported', 'under_review', 'in_progress', 'resolved'];
  var STAGES = ['Reported', 'Under review', 'In progress', 'Resolved'];

  var CATEGORIES = ['Potholes', 'Garbage', 'Illegal dumping', 'Damaged roads', 'Unfinished highway or flyover',
    'Dangerous construction site', 'Unsafe diversion', 'Accident-prone spot', 'Streetlights', 'Drainage',
    'Water pollution', 'Water leakage', 'Other'];

  // Sample "handled by" names (placeholder until real departments are added)
  var DEPT = {
    'Potholes': 'Roads Department', 'Damaged roads': 'Roads Department',
    'Unfinished highway or flyover': 'Highways Authority', 'Unsafe diversion': 'Traffic and Roads Department',
    'Garbage': 'Solid Waste Management', 'Illegal dumping': 'Solid Waste Management',
    'Streetlights': 'Electrical Department', 'Drainage': 'Drainage Department',
    'Water leakage': 'Water Board', 'Water pollution': 'Pollution Control Board',
    'Dangerous construction site': 'Building and Safety Department', 'Accident-prone spot': 'Traffic Police and Roads Department'
  };

  function stageOf(post) { return Math.max(1, STATUS_KEYS.indexOf(post.status) + 1); }
  function deptOf(cat) { return DEPT[cat] || 'The responsible local department'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ago(ts) {
    var d = Date.now() - new Date(ts).getTime();
    if (d < 60e3) return 'just now';
    if (d < H) return Math.floor(d / 60e3) + 'm ago';
    if (d < D) return Math.floor(d / H) + 'h ago';
    return Math.floor(d / D) + 'd ago';
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function authorOf(post) { return (post.profiles && post.profiles.display_name) || 'Citizen'; }

  // Picture or video for a post (a stand-in picture if there is no media)
  function placeholder(cat) {
    return '<svg viewBox="0 0 600 300" role="img" aria-label="No photo for ' + esc(cat) + '">' +
      '<rect width="600" height="300" fill="#E6E6E1"/><rect y="110" width="600" height="30" fill="#CFCFCA"/><rect y="140" width="600" height="160" fill="#333"/>' +
      '<path d="M0 205 H80 M150 205 H230 M300 205 H380 M450 205 H530" stroke="#fff" stroke-width="9"/>' +
      '<polygon points="470,245 500,175 530,245" fill="#FF6A00" stroke="#111" stroke-width="5" stroke-linejoin="round"/><rect x="456" y="245" width="88" height="13" rx="3" fill="#111"/>' +
      '<text x="24" y="52" font-family="Montserrat,Arial,sans-serif" font-size="26" font-weight="800" fill="#111">' + esc(cat) + '</text></svg>';
  }
  // All photos/videos of a post (new posts use post_media; older posts have one media_url)
  function mediaItems(post) {
    var m = (post.post_media || []).slice().sort(function (a, b) { return a.position - b.position; })
      .map(function (x) { return { url: x.url, kind: x.kind }; });
    if (!m.length && post.media_url) m = [{ url: post.media_url, kind: post.media_type }];
    return m;
  }
  function oneMedia(m, post) {
    return m.kind === 'video'
      ? '<video controls preload="metadata" playsinline src="' + esc(m.url) + '"></video>'
      : '<img src="' + esc(m.url) + '" alt="Photo: ' + esc(post.title) + '" loading="lazy">';
  }
  function media(post) {
    var items = mediaItems(post);
    if (!items.length) return placeholder(post.category);
    if (items.length === 1) return oneMedia(items[0], post);
    return '<div class="gallery">' + items.map(function (m) { return '<div class="gallery__item">' + oneMedia(m, post) + '</div>'; }).join('') +
      '</div><div class="gallery__n">' + items.length + ' photos and videos. Swipe to see all.</div>';
  }
  function audio(post) {
    return post.audio_url ? '<div class="audio"><span>&#9835; Music</span><audio controls preload="none" src="' + esc(post.audio_url) + '"></audio></div>' : '';
  }

  // The title is the first sentence of what the person wrote (about 80 characters)
  function titleFrom(text) {
    var t = String(text).trim().split(/\n/)[0];
    var m = t.match(/^(.{5,80}?[.!?])(\s|$)/);
    if (m) t = m[1];
    else if (t.length > 80) { t = t.slice(0, 80); var i = t.lastIndexOf(' '); if (i > 40) t = t.slice(0, i); }
    return t.trim();
  }
  // What is left of the description once the title (its beginning) is shown as the heading
  function bodyAfterTitle(post) {
    var d = String(post.description || '');
    if (d.indexOf(post.title) === 0) return d.slice(post.title.length).replace(/^[\s.!?,:;-]+/, '').trim();
    return d;
  }
  function mapLink(post) {
    return post.lat != null && post.lng != null
      ? 'https://www.openstreetmap.org/?mlat=' + post.lat + '&mlon=' + post.lng + '#map=17/' + post.lat + '/' + post.lng : '';
  }
  // Status history of a post, oldest first
  function updatesOf(post) {
    return (post.post_updates || []).slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  }
  // For stage n (1-4): the latest update that set that status: time, note, proof photos, geotag
  function stageInfo(post, n) {
    var none = { at: null, note: '', evidence: [], lat: null, lng: null };
    if (n === 1) return { at: post.created_at, note: '', evidence: [], lat: null, lng: null };
    var key = STATUS_KEYS[n - 1], hit = null;
    updatesOf(post).forEach(function (u) { if (u.status === key) hit = u; });
    if (!hit) return none;
    var ev = (hit.evidence_urls && hit.evidence_urls.length) ? hit.evidence_urls : (hit.evidence_url ? [hit.evidence_url] : []);
    return { at: hit.created_at, note: hit.note || '', evidence: ev, lat: hit.lat, lng: hit.lng };
  }
  // distance in metres between two points
  function metres(a, b) {
    var R = 6371000, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function mapUrl(lat, lng) { return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=18/' + lat + '/' + lng; }
  function stamp(ts) {
    return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
  // The newest admin note on a post (for the feed)
  function latestNote(post) {
    var list = updatesOf(post).filter(function (u) { return u.note; });
    return list.length ? list[list.length - 1] : null;
  }
  // true when the logged-in person is an admin (the database enforces this too)
  function isAdmin(user) {
    if (!user || !window.sb) return Promise.resolve(false);
    return sb.from('profiles').select('role').eq('id', user.id).maybeSingle().then(function (r) { return !!(r.data && r.data.role === 'admin'); });
  }

  // posts joined with the author's name and their photos/videos
  var POST_SELECT = '*, profiles!posts_user_id_fkey(display_name), post_media(url,kind,position), post_updates(status,note,evidence_url,evidence_urls,lat,lng,created_at)';

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  window.OC = { STAGES: STAGES, STATUS_KEYS: STATUS_KEYS, CATEGORIES: CATEGORIES, stageOf: stageOf, deptOf: deptOf,
    esc: esc, ago: ago, initials: initials, authorOf: authorOf, media: media, mediaItems: mediaItems, audio: audio, titleFrom: titleFrom, bodyAfterTitle: bodyAfterTitle, mapLink: mapLink, POST_SELECT: POST_SELECT, updatesOf: updatesOf, stageInfo: stageInfo, metres: metres, mapUrl: mapUrl, stamp: stamp, latestNote: latestNote, isAdmin: isAdmin, toast: toast };
})();
