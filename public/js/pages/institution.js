/* JanSetu - HEI (institution) desk */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  function bankCard(p) {
    return '<div class="problem-item">' +
      '<div class="pi-top"><div><div class="pi-title">' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</div>' +
      '<div class="pi-id">' + J.esc(p.public_id) + '</div></div>' + J.statusBadge(p.status) + '</div>' +
      '<p class="pi-desc">' + J.esc((p.description || '').slice(0, 240)) + '…</p>' +
      '<div class="pi-meta"><span>📍 ' + J.esc(p.district || '—') + '</span><span>👍 ' + (p.votes || 0) + '</span><span>Severity ' + (p.severity || 0) + '/100</span></div>' +
      '<div class="flex mt-1">' +
        '<button class="btn sm" data-adopt="' + p.id + '">🤝 Adopt this Problem</button>' +
        '<a class="btn sm ghost" href="/track.html?id=' + encodeURIComponent(p.public_id) + '">Details</a>' +
      '</div></div>';
  }

  async function loadProfile() {
    try {
      const data = await J.api('/institution/me');
      const p = data.profile || {};
      $('inst-profile').innerHTML = '<p><b>Institute:</b> ' + J.esc(data.user.org_name || data.user.name) + ' · <b>District:</b> ' + J.esc(data.user.district || '—') + '</p><p><b>Domains:</b> ' + (p.domain_tags && p.domain_tags.length ? p.domain_tags.map(J.esc).join(', ') : '<span class="muted">not set</span>') + '</p>';
      $('ip-domains').value = (p.domain_tags || []).join(', ');
      $('ip-reg').value = p.reg_no || '';
    } catch (e) { J.toast(e.message, true); }
  }

  async function saveProfile() {
    try {
      await J.api('/institution/me', { method: 'PUT', body: JSON.stringify({ domain_tags: $('ip-domains').value, reg_no: $('ip-reg').value }) });
      loadProfile(); J.toast('Profile saved.');
    } catch (e) { J.toast(e.message, true); }
  }

  async function loadBank() {
    const box = $('inst-bank');
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const list = await J.api('/institution/bank');
      if (!list.length) { box.innerHTML = '<p class="muted">No approved problems available for adoption right now.</p>'; return; }
      box.innerHTML = list.map(bankCard).join('');
      box.querySelectorAll('[data-adopt]').forEach((b) => b.addEventListener('click', adopt));
    } catch (e) { box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>'; }
  }

  async function adopt(e) {
    const btn = e.currentTarget;
    btn.disabled = true;
    const team = prompt('Name student team members (comma separated):', '');
    try {
      const data = await J.api('/institution/adopt/' + encodeURIComponent(btn.dataset.adopt), { method: 'POST', body: JSON.stringify({ team: team || '' }) });
      J.toast(data.message || 'Adopted!');
      loadBank(); loadProjects();
    } catch (err) { btn.disabled = false; J.toast(err.message, true); }
  }

  async function loadProjects() {
    const box = $('inst-projects');
    try {
      const list = await J.api('/institution/projects');
      if (!list.length) { box.innerHTML = '<p class="muted">No projects yet — adopt a problem to start.</p>'; return; }
      box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th>Project</th><th>Problem</th><th>Status</th><th>Milestones</th><th>Due</th><th></th></tr></thead><tbody>' +
        list.map((p) => '<tr><td><b>' + J.esc(p.public_id) + '</b></td><td>' + J.esc((p.problem || {}).title || p.title) + '</td><td>' + J.statusBadge(p.status) + '</td><td>' + (p.milestones || []).length + '</td><td>' + J.fmtDate(p.due_date) + '</td><td><a class="btn sm ghost" href="/projects.html?id=' + p.id + '">Open</a></td></tr>').join('') +
        '</tbody></table></div>';
    } catch (e) { box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>'; }
  }

  async function init() {
    try { await J.requireAuth(['institution', 'admin']); }
    catch (e) { return; }
    J.renderHeader('nav.institution'); J.renderFooter();
    loadProfile(); loadBank(); loadProjects();
    $('ip-save').addEventListener('click', saveProfile);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
