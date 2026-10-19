/* ==========================================================
   OurCity: sign up, login, logout (loaded on every page)
   1. Header: shows "Sign up | Login" or "Hi, Name | Logout"
   2. signup.html: creates the account
   3. login.html: signs the user in
   ========================================================== */
(function () {
  var box = document.getElementById('authBox');

  function say(el, text, bad) {
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-msg' + (bad ? ' is-bad' : ' is-ok');
  }

  function needKey() {
    return 'Supabase is not connected yet. Paste your publishable key into js/supabase.js.';
  }

  /* ---------- 1. header ---------- */
  function drawHeader(user) {
    if (!box) return;
    if (user) {
      var name = (user.user_metadata && user.user_metadata.display_name) || user.email.split('@')[0];
      box.innerHTML = '<a class="auth__hi" href="profile.html" title="My profile">Hi, ' + OC.esc(name) + '</a>' +
        '<a href="#" class="fill" id="logout">Logout</a>';
      OC.isAdmin(user).then(function (yes) {
        var old = document.getElementById('adminLink');
        if (old) old.remove();
        if (yes && box.parentNode) {
          var l = document.createElement('a');
          l.id = 'adminLink'; l.className = 'link'; l.href = 'admin.html'; l.textContent = 'Admin';
          if (/admin\.html$/.test(location.pathname)) l.className += ' is-active';
          box.parentNode.insertBefore(l, box);
        }
      });
      document.getElementById('logout').addEventListener('click', function (e) {
        e.preventDefault();
        sb.auth.signOut().then(function () { location.href = 'index.html'; });
      });
    } else {
      var gone = document.getElementById('adminLink'); if (gone) gone.remove();
      box.innerHTML = '<a href="signup.html">Sign up</a><a href="login.html" class="fill">Login</a>';
    }
  }


  /* ---------- notification bell (logged-in people) ---------- */
  var bellTimer = null;
  function drawBell(user) {
    var old = document.getElementById('bellWrap'); if (old) old.remove();
    clearInterval(bellTimer);
    if (!user || !box || !box.parentNode || !window.sb) return;
    var w = document.createElement('div');
    w.id = 'bellWrap'; w.className = 'bell';
    w.innerHTML = '<button type="button" class="bell__btn" id="bellBtn" aria-label="Notifications" aria-expanded="false">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17 V11 A6 6 0 0 1 18 11 V17 L20 19 H4 Z M10 21 H14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>' +
      '<span class="bell__n" id="bellN" hidden></span></button><div class="bell__panel" id="bellPanel" hidden></div>';
    box.parentNode.insertBefore(w, box);
    var items = [];
    function paint() {
      var unread = items.filter(function (n) { return !n.read; }).length;
      var badge = document.getElementById('bellN');
      badge.hidden = !unread; badge.textContent = unread > 9 ? '9+' : unread;
      document.getElementById('bellPanel').innerHTML = '<div class="bell__head">Notifications</div>' + (items.length ? items.map(function (n) {
        return '<a class="bell__item' + (n.read ? '' : ' is-new') + '" href="issue.html?id=' + OC.esc(n.post_id || '') + '">' + OC.esc(n.message) + '<small>' + OC.ago(n.created_at) + '</small></a>';
      }).join('') : '<p class="bell__none">Nothing yet. You will see updates on your reports here.</p>');
    }
    function load() {
      sb.from('notifications').select('id,post_id,message,read,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15)
        .then(function (r) { if (!r.error) { items = r.data || []; paint(); } });
    }
    document.getElementById('bellBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      var p = document.getElementById('bellPanel'), open = p.hidden;
      p.hidden = !open; this.setAttribute('aria-expanded', open);
      if (open && items.some(function (n) { return !n.read; })) {
        sb.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false).then(function () {
          setTimeout(function () { items.forEach(function (n) { n.read = true; }); paint(); }, 1500);
        });
        document.getElementById('bellN').hidden = true;
      }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#bellWrap')) { var p = document.getElementById('bellPanel'); if (p) p.hidden = true; } });
    load(); bellTimer = setInterval(load, 60000);
  }

  if (window.sb) {
    sb.auth.getSession().then(function (r) { var u = r.data.session && r.data.session.user; drawHeader(u); drawBell(u); });
    sb.auth.onAuthStateChange(function (event, session) { var u = session && session.user; drawHeader(u); drawBell(u); });
  } else {
    drawHeader(null);
  }

  /* ---------- 2. sign-up page ---------- */
  // Password rule (like Instagram): at least 6 characters, and not an obvious one.
  // Your name or email MAY be part of the password.
  var COMMON = ['password', 'password1', 'password123', 'qwerty123', 'qwertyuiop', '12345678', '123456789', '1234567890',
    'iloveyou', 'admin123', 'welcome1', 'letmein123', 'abc12345', 'india123', 'passw0rd', 'qwerty@123', 'password@123', 'p@ssw0rd'];

  // returns '' when fine, otherwise a short message
  function passwordProblem(pw) {
    var low = pw.toLowerCase();
    if (pw.length < 6) return 'Password must be at least 6 characters.';
    if (COMMON.indexOf(low) !== -1 || /^(.)\1+$/.test(pw) || /^(0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/.test(low))
      return 'That password is too easy to guess. Please choose another.';
    return '';
  }

  var signup = document.getElementById('signupForm');
  if (signup) {
    var smsg = document.getElementById('authMsg');
    var pwBox = document.getElementById('pw');

    document.getElementById('pwShow').addEventListener('click', function () {
      var hidden = pwBox.type === 'password';
      pwBox.type = hidden ? 'text' : 'password';
      signup.password2.type = pwBox.type;
      this.textContent = hidden ? 'Hide' : 'Show';
      this.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    });

    signup.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!window.sb) return say(smsg, needKey(), true);

      var name = signup.name.value.trim();
      var email = signup.email.value.trim();
      var pass = pwBox.value;
      if (name.length < 2) return say(smsg, 'Please enter your name.', true);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say(smsg, 'Please enter a valid email address.', true);

      var problem = passwordProblem(pass);
      if (problem) return say(smsg, problem, true);
      if (pass !== signup.password2.value) return say(smsg, 'The two passwords do not match.', true);

      signup.querySelector('button[type=submit]').disabled = true;
      say(smsg, 'Creating your account...', false);

      sb.auth.signUp({ email: email, password: pass, options: { data: { display_name: name } } })
        .then(function (res) {
          signup.querySelector('button[type=submit]').disabled = false;
          if (res.error) return say(smsg, res.error.message, true);
          if (res.data.session) { location.href = 'feed.html'; }
          else { say(smsg, 'Account created. Check your email and click the link, then log in.', false); }
        });
    });
  }

  /* ---------- 3. login page ---------- */
  var login = document.getElementById('loginForm');
  if (login) {
    var lmsg = document.getElementById('authMsg');
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!window.sb) return say(lmsg, needKey(), true);

      login.querySelector('button').disabled = true;
      say(lmsg, 'Logging in...', false);

      sb.auth.signInWithPassword({ email: login.email.value.trim(), password: login.password.value })
        .then(function (r) {
          login.querySelector('button').disabled = false;
          if (r.error) return say(lmsg, r.error.message, true);
          location.href = 'feed.html';
        });
    });
  }
})();
