/* ==========================================================
   OurCity: likes, dislikes and comments (shared by Feed + Issue pages)
   Needs: js/supabase.js, js/data.js
   ========================================================== */
(function () {
  var esc = OC.esc;

  // Add like / dislike / comment numbers to every post in the list
  function loadStats(posts, user) {
    posts.forEach(function (p) { p.likes = 0; p.dislikes = 0; p.nComments = 0; p.myVote = 0; });
    if (!window.sb || !posts.length) return Promise.resolve();
    var ids = posts.map(function (p) { return p.id; });
    function byId(id) { return posts.filter(function (p) { return p.id === id; })[0]; }

    window.OCSocial.problem = '';
    function note(r, what) { if (r.error) window.OCSocial.problem = what + ': ' + r.error.message; }
    var jobs = [
      sb.from('post_stats').select('post_id,likes,dislikes,comments').in('post_id', ids).then(function (r) {
        note(r, 'Like counts could not load (did you run supabase/03_reactions_comments.sql?)');
        (r.data || []).forEach(function (s) {
          var p = byId(s.post_id);
          if (p) { p.likes = Number(s.likes); p.dislikes = Number(s.dislikes); p.nComments = Number(s.comments); }
        });
      })
    ];
    if (user) {
      jobs.push(sb.from('reactions').select('post_id,value').eq('user_id', user.id).in('post_id', ids).then(function (r) {
        note(r, 'Your votes could not load');
        (r.data || []).forEach(function (x) { var p = byId(x.post_id); if (p) p.myVote = Number(x.value); });
      }));
    }
    return Promise.all(jobs);
  }

  // kind: 1 = like, -1 = dislike. Clicking the same button again removes your vote.
  function vote(post, user, kind) {
    var cur = post.myVote, next = cur === kind ? 0 : kind;
    var req = next === 0
      ? sb.from('reactions').delete().eq('post_id', post.id).eq('user_id', user.id)
      : sb.from('reactions').upsert({ post_id: post.id, user_id: user.id, value: next }, { onConflict: 'post_id,user_id' });
    return req.then(function (r) {
      if (r.error) throw r.error;
      if (cur === 1) post.likes--;
      if (cur === -1) post.dislikes--;
      if (next === 1) post.likes++;
      if (next === -1) post.dislikes++;
      post.myVote = next;
    });
  }

  function loadComments(postId) {
    return sb.from('comments').select('id,user_id,body,created_at,profiles!comments_user_id_fkey(display_name)')
      .eq('post_id', postId).order('created_at', { ascending: true }).then(function (r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
  }

  function addComment(post, body) {
    return sb.from('comments').insert({ post_id: post.id, body: body }).then(function (r) {
      if (r.error) throw r.error;
      post.nComments++;
    });
  }

  function deleteComment(post, id) {
    return sb.from('comments').delete().eq('id', id).then(function (r) {
      if (r.error) throw r.error;
      post.nComments = Math.max(0, post.nComments - 1);
    });
  }

  // The comment list + the write-a-comment box, as HTML
  function commentsHTML(list, user, post, admin) {
    var rows = list.map(function (c) {
      var name = (c.profiles && c.profiles.display_name) || 'Citizen';
      var mine = user && c.user_id === user.id;
      return '<div class="comment"><div class="avatar">' + esc(OC.initials(name)) + '</div><div><div><b>' + esc(name) + '</b><p>' + esc(c.body) + '</p></div>' +
        '<small>' + OC.ago(c.created_at) + '</small>' +
        ((mine || admin) ? ' <button type="button" class="linklike" data-del-comment="' + esc(c.id) + '" data-post="' + esc(post.id) + '">Delete</button>' : '') +
        ((user && !mine) ? ' <button type="button" class="linklike" data-report-comment="' + esc(c.id) + '">Report</button>' : '') +
        '</div></div>';
    }).join('') || '<p class="nocomments">No comments yet. Be the first.</p>';

    var form = user
      ? '<form class="cform" data-comment-form="' + esc(post.id) + '"><label class="sr-only" for="c-' + esc(post.id) + '">Write a comment</label>' +
        '<input id="c-' + esc(post.id) + '" type="text" maxlength="500" placeholder="Write a comment..."><button type="submit">Send</button></form>'
      : '<p class="nocomments"><a href="login.html" style="text-decoration:underline">Log in</a> to comment.</p>';
    return '<div class="comments">' + rows + form + '</div>';
  }


  // ---- "Report this" window: asks for a reason, then saves a flag
  var REASONS = ['Blames or names a person', 'Fake or misleading', 'Abusive or hateful', 'Spam', 'Private information', 'Something else'];
  // target = { post_id: '...' }  or  { comment_id: '...' }
  function reportDialog(target) {
    var old = document.getElementById('reportModal'); if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'reportModal'; m.className = 'modal';
    m.innerHTML = '<form class="modal__box" role="dialog" aria-modal="true" aria-label="Report"><h2>Report this ' + (target.post_id ? 'post' : 'comment') + '</h2>' +
      '<p>Why should an admin look at it? OurCity is for describing problems, not blaming people.</p>' +
      REASONS.map(function (r, i) { return '<label class="modal__opt"><input type="radio" name="reason" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(r) + '</label>'; }).join('') +
      '<textarea name="details" maxlength="200" placeholder="Anything else the admin should know? (optional)"></textarea>' +
      '<div class="form-msg" role="alert"></div>' +
      '<div class="modal__btns"><button type="button" class="btn btn--line" data-close>Cancel</button><button type="submit" class="btn btn--orange">Send report</button></div></form>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
    m.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('[type=submit]'), msg = f.querySelector('.form-msg');
      var row = { reason: f.reason.value, details: f.details.value.trim() || null };
      if (target.post_id) row.post_id = target.post_id; else row.comment_id = target.comment_id;
      btn.disabled = true; btn.textContent = 'Sending...';
      sb.from('flags').insert(row).then(function (r) {
        if (r.error) {
          btn.disabled = false; btn.textContent = 'Send report';
          msg.textContent = (r.error.code === '23505' || /duplicate/i.test(r.error.message)) ? 'You have already reported this.' : 'Could not send: ' + r.error.message;
          return;
        }
        m.remove(); OC.toast('Thanks. An admin will look at it.');
      });
    });
  }

  window.OCSocial = { reportDialog: reportDialog, problem: '', loadStats: loadStats, vote: vote, loadComments: loadComments, addComment: addComment,
    deleteComment: deleteComment, commentsHTML: commentsHTML };
})();
