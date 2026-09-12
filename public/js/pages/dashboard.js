/* JanSetu - user dashboard */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);
  const ALLOW = ['citizen', 'evaluator', 'institution', 'industry'];

  function dashCards(problems) {
    const total = problems.length;
    const sent = problems.filter((p) => ['submitted', 'under_review', 'info_needed'].includes(p.status)).length;
    const approved = problems.filter((p) => p.status === 'approved').length;
    const solved = problems.filter((p) => ['closed', 'deployed'].includes(p.status)).length;
    return [
      { n: total, l: 'Total Submissions' },
      { n: sent, l: 'Under Review' },
      { n: solved, l: 'Solved / Deployed' },
    ].map((c) => '<div class="card stat-card"><div class="num">' + c.n + '</div><div class="lbl">' + c.l + '</div></div>').join('');
  }

  function problemTable(problems) {
    if (!problems.length) return '<p class="muted">You have not submitted any problems yet. <a href="/report.html">Report one now →</a></p>';
    return '<div class="table-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Votes</th><th>Severity</th><th>Date</th><th></th></tr></thead><tbody>' +
      problems.map((p) => '<tr><td><b>' + J.esc(p.public_id) + '</b></td><td>' + J.catIcon(p.category) + ' ' + J.esc(p.title.slice(0, 60)) + '</td><td>' + J.statusBadge(p.status) + '</td><td>' + (p.votes || 0) + '</td><td>' + (p.severity || 0) + '/100</td><td>' + J.fmtDate(p.created_at) + '</td><td><a class="btn sm ghost" href="/track.html?id=' + encodeURIComponent(p.public_id) + '">View</a></td></tr>').join('') +
      '</tbody></table></div>';
  }

  function profileHtml(user, extra) {
    const p = (extra && extra.profile) || {};
    return '<p><b>Name:</b> ' + J.esc(user.name) + '</p>' +
      '<p><b>Role:</b> ' + J.esc(user.role) + '</p>' +
      '<p><b>Email:</b> ' + J.esc(user.email || '—') + '</p>' +
      '<p><b>Phone:</b> ' + J.esc(user.phone || '—') + '</p>' +
      '<p><b>District:</b> ' + J.esc(user.district || '—') + '</p>' +
      (user.org_name ? '<p><b>Organisation:</b> ' + J.esc(user.org_name) + '</p>' : '') +
      (p.domain_tags && p.domain_tags.length ? '<p><b>Domains:</b> ' + p.domain_tags.map(J.esc).join(', ') + '</p>' : '') +
      (p.capabilities && p.capabilities.length ? '<p><b>Capabilities:</b> ' + p.capabilities.map(J.esc).join(', ') + '</p>' : '');
  }

  async function init() {
    let user;
    try { user = await J.requireAuth(ALLOW); }
    catch (e) { return; }
    J.renderHeader('nav.dashboard'); J.renderFooter();
    try {
      const [problems, me] = await Promise.all([ J.api('/dashboard/my-problems'), J.api('/dashboard/me') ]);
      $('dash-cards').innerHTML = dashCards(problems);
      $('dash-sub-count').textContent = problems.length + ' total';
      $('dash-problems').innerHTML = problemTable(problems);
      $('dash-profile').innerHTML = profileHtml(me.user, me);
    } catch (e) { J.toast(e.message, true); }

    $('pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await J.api('/dashboard/password', { method: 'PATCH', body: JSON.stringify({ old_password: $('pw-old').value, new_password: $('pw-new').value }) });
        J.toast('Password updated!');
        $('pw-old').value = ''; $('pw-new').value = '';
      } catch (err) { J.toast(err.message, true); }
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
