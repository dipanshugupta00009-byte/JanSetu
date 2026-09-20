/* JanSetu - track status page */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  const FLOW = ['submitted', 'under_review', 'info_needed', 'approved', 'assigned', 'in_progress', 'piloted', 'deployed', 'closed'];

  function timeline(problem) {
    const idx = FLOW.indexOf(problem.status);
    const active = idx >= 0 ? idx : (problem.status === 'rejected' ? 3 : (problem.status === 'escalated' ? 2 : 0));
    const steps = [
      { s: 'submitted', l: 'Citizen Submits Issue' },
      { s: 'under_review', l: 'Not Assigned Yet (Under Review)' },
      { s: 'approved', l: 'Wait for Selection (Approved)' },
      { s: 'assigned', l: 'Assigned (Department Assigned)' },
      { s: 'in_progress', l: 'Propose Solution (Plan Action)' },
      { s: 'piloted', l: 'Student Build & Implement (Pilot)' },
      { s: 'deployed', l: 'Assign Completed (Deployed)' },
      { s: 'closed', l: 'Completed (Mark as Resolved)' },
    ];
    return '<h3>🏁 SIH Workflow Lifecycle Status</h3><ul class="timeline">' + steps.map((st, i) =>
      '<li class="' + (i <= active && problem.status !== 'rejected' ? 'done' : '') + '"><b>' + J.esc(st.l) + '</b><div class="tl-time">' + (i <= active ? 'Reached ✓' : 'Pending') + '</div></li>'
    ).join('') + '</ul>';
  }

  function render(data) {
    const p = data.problem;
    const box = $('track-result');
    let html = '<div class="card">';
    html += '<div class="spread"><h2>' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</h2>' + J.statusBadge(p.status) + '</div>';
    html += '<div class="muted">ID: <b>' + J.esc(p.public_id) + '</b> · Category: ' + J.esc(p.category) + ' · Reported ' + J.fmtDate(p.created_at) + '</div>';
    if (p.user_name) html += '<div class="muted">' + J.esc(p.user_name) + '</div>';
    html += '<div class="mt-2"><b>Description</b><p>' + J.esc(p.description) + '</p></div>';
    if (p.media && p.media.length) {
      html += '<div class="flex mt-1">' + p.media.map((m) => '<a class="pill" href="' + J.esc(m) + '" target="_blank">📎 Evidence ' + (p.media.indexOf(m) + 1) + '</a>').join('') + '</div>';
    }
    html += '<div class="grid cols-2 mt-2">';
    html += '<div>';
    html += '<h3>📍 Location</h3><p class="muted">' + [p.village, p.block, p.district].filter(Boolean).join(', ') + '</p>';
    if (p.location_lat && p.location_lng) html += '<p class="muted">' + p.location_lat.toFixed(5) + ', ' + p.location_lng.toFixed(5) + '</p>';
    html += '<div class="mt-1"><button class="vote-btn" id="trk-vote" data-id="' + J.esc(p.public_id) + '">👍 Endorse (' + (p.votes || 0) + ')</button></div>';
    html += '</div>';
    html += '<div>' + timeline(p) + '</div>';
    html += '</div>';

    if (data.reviews && data.reviews.length) {
      html += '<h3 class="mt-2">📋 Expert Review</h3>';
      data.reviews.forEach((r) => {
        html += '<div class="card tint mb-1"><b>' + J.esc(r.reviewer_name || 'Expert') + '</b> — ' + J.esc(r.decision) + ' (score ' + r.total + '/20)';
        html += '<div class="muted">Impact ' + r.impact + ' · Feasibility ' + r.feasibility + ' · Innovation ' + r.innovation + ' · Resources ' + r.resources + '</div>';
        if (r.comments) html += '<p class="mt-1">' + J.esc(r.comments) + '</p>';
        html += '</div>';
      });
    }

    if (data.project) {
      const pr = data.project;
      html += '<h3 class="mt-2">🚀 Assigned Solution Project</h3><div class="card tint">';
      html += '<b>Project: ' + J.esc(pr.public_id) + '</b> · ' + J.statusBadge(pr.status);
      html += '<p class="mt-1">Institution: <b>' + J.esc(pr.institution_name || 'HEI') + '</b></p>';
      if (pr.team && pr.team.length) html += '<p>Team: ' + pr.team.map(J.esc).join(', ') + '</p>';
      if (pr.milestones && pr.milestones.length) {
        html += '<p><b>Milestones:</b></p><ul>' + pr.milestones.slice(0, 5).map((m) => '<li>' + J.esc(m.title) + ' <span class="badge approved">' + J.esc(m.status) + '</span><div class="muted">' + J.fmtDate(m.submitted_at) + '</div></li>').join('') + '</ul>';
      }
      html += '</div>';
    }
    if (data.similar) {
      html += '<div class="alert info mt-2">⚠️ Linked similar report: <a href="/track.html?id=' + encodeURIComponent(data.similar.id) + '"><b>' + J.esc(data.similar.title) + '</b></a></div>';
    }
    html += '</div>';
    box.innerHTML = html;
    const vb = document.getElementById('trk-vote');
    if (vb) vb.addEventListener('click', vote);
  }

  async function vote(e) {
    const btn = e.currentTarget;
    try {
      const me = await J.fetchMe();
      if (!me.authed) { window.location.href = '/login.html?next=' + encodeURIComponent('/track.html?id=' + btn.dataset.id); return; }
      const r = await J.api('/problems/' + encodeURIComponent(btn.dataset.id) + '/vote', { method: 'POST' });
      btn.textContent = '👍 Endorsed (' + r.votes + ')'; btn.classList.add('done'); J.toast(r.message);
    } catch (err) { if (err.status === 401) window.location.href = '/login.html?next=/'; else J.toast(err.message, true); }
  }

  async function track(id) {
    const box = $('track-result');
    box.innerHTML = '<div class="card center muted">Loading…</div>';
    try {
      const data = await J.api('/problems/' + encodeURIComponent(id));
      render(data);
    } catch (e) { box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>'; }
  }

  function init() {
    J.renderHeader('nav.track'); J.renderFooter();
    const auto = new URLSearchParams(window.location.search).get('id');
    if (auto) { $('trk-id').value = auto; track(auto); }
    $('trk-go').addEventListener('click', () => { const v = $('trk-id').value.trim(); if (v) track(v); });
    $('trk-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = $('trk-id').value.trim(); if (v) track(v); } });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
