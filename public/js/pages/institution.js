/* JanSetu - HEI (institution) desk */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);
  let bank = [];
  let picked = null;

  function bankCard(p) {
    return '<div class="problem-item">' +
      '<div class="pi-top"><div><div class="pi-title">' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</div>' +
      '<div class="pi-id">' + J.esc(p.public_id) + '</div></div>' + J.statusBadge(p.status) + '</div>' +
      '<p class="pi-desc">' + J.esc((p.description || '').slice(0, 240)) + '…</p>' +
      '<div class="pi-meta"><span>📍 ' + J.esc(p.district || '—') + '</span><span>👍 ' + (p.votes || 0) + '</span><span>Severity ' + (p.severity || 0) + '/100</span></div>' +
      '<div class="flex mt-1">' +
        '<button class="btn sm" data-adopt="' + p.id + '">📝 Pick &amp; Propose Solution</button>' +
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
    picked = null;
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const list = await J.api('/institution/bank');
      bank = list;
      if (!list.length) {
        box.innerHTML = '<p class="muted">No approved problem statements available right now. Once an evaluator approves a community problem it appears here.</p>';
        return;
      }
      box.innerHTML = list.map(bankCard).join('');
      box.querySelectorAll('[data-adopt]').forEach((b) => b.addEventListener('click', openProposal));
    } catch (e) { box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>'; }
  }

  /* ------------------------------------------------------------------
     Pick a problem statement AND propose the solution – one single step,
     rendered inside the same "Pick a Problem Statement" card.
  ------------------------------------------------------------------ */
  function proposalForm(p) {
    return '<div class="card tint">' +
      '<div class="spread"><h4>📝 Solution Proposal · समाधान प्रस्ताव</h4>' +
      '<button type="button" class="btn sm ghost" id="pp-back">← Back to problem list</button></div>' +
      '<div class="muted">Picked problem statement: <b>' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</b> · ID ' + J.esc(p.public_id) + ' · 📍 ' + J.esc(p.district || '—') + '</div>' +
      '<p class="muted mt-1">Filling this form picks the problem statement and submits your solution proposal in one go — your project is created automatically.</p>' +
      '<form id="proposal-form">' +
        '<div class="form-row">' +
          '<div class="field"><label class="req">Proposal Title</label><input type="text" id="pp-title" value="' + J.esc(p.title) + '" required /></div>' +
          '<div class="field"><label class="req">Student Team (comma separated)</label><input type="text" id="pp-team" placeholder="e.g. Rohan (B.Tech EE), Anjali (M.Tech Energy)" required /></div>' +
        '</div>' +
        '<div class="field"><label class="req">Proposed Solution (approach &amp; method)</label><textarea id="pp-approach" required placeholder="Explain the root cause you are addressing and the technical / social approach your student team will use…"></textarea></div>' +
        '<div class="form-row">' +
          '<div class="field"><label>Expected Impact &amp; Beneficiaries</label><textarea id="pp-impact" placeholder="How many families / villages benefit and how will it be measured?"></textarea></div>' +
          '<div class="field"><label>Resources, Budget &amp; Timeline</label><textarea id="pp-resources" placeholder="Materials, lab or field support, approximate cost, delivery schedule"></textarea></div>' +
        '</div>' +
        '<div class="field"><label>Risks / Permissions Needed</label><textarea id="pp-risks" placeholder="Field access, gram panchayat approval, safety considerations"></textarea></div>' +
        '<div class="flex"><button type="submit" class="btn sm" id="pp-submit">✅ Pick Problem &amp; Submit Proposal</button>' +
        '<button type="button" class="btn sm ghost" id="pp-cancel">Cancel</button></div>' +
      '</form></div>';
  }

  function proposalDone(p, data) {
    const project = data.project || {};
    return '<div class="alert success">✅ Solution proposal submitted for <b>' + J.esc(p.title) + '</b>.' +
      (project.public_id ? ' Project <b>' + J.esc(project.public_id) + '</b> was created with your proposal as its first milestone.' : '') +
      '</div>' +
      '<p class="muted">Your HEI mentor and evaluators can now review the proposal, add progress milestones, and respond in the project discussion thread.</p>' +
      '<div class="flex mt-1">' +
        '<button type="button" class="btn sm" id="done-open">Open Project →</button>' +
        '<button type="button" class="btn sm ghost" id="done-back">← Back to problem list</button>' +
      '</div>';
  }

  function openProposal(e) {
    const id = e.currentTarget.dataset.adopt;
    picked = bank.find((p) => p.id === id) || null;
    if (!picked) { J.toast('This problem statement is no longer available.', true); loadBank(); return; }
    const box = $('inst-bank');
    box.innerHTML = proposalForm(picked);
    $('pp-back').addEventListener('click', loadBank);
    $('pp-cancel').addEventListener('click', loadBank);
    $('proposal-form').addEventListener('submit', submitProposal);
    const first = $('pp-team');
    if (first) first.focus();
  }

  async function submitProposal(e) {
    e.preventDefault();
    if (!picked) return loadBank();
    const btn = $('pp-submit');
    const payload = {
      title: $('pp-title').value.trim(),
      team: $('pp-team').value.trim(),
      approach: $('pp-approach').value.trim(),
      impact: $('pp-impact').value.trim(),
      resources: $('pp-resources').value.trim(),
      risks: $('pp-risks').value.trim(),
    };
    if (!payload.team) return J.toast('Add at least one student team member.', true);
    if (!payload.approach) return J.toast('Describe your proposed solution before picking this problem statement.', true);
    btn.disabled = true;
    try {
      const url = '/institution/adopt/' + encodeURIComponent(picked.id);
      const data = await J.api(url, { method: 'POST', body: JSON.stringify(payload) });
      const p = picked;
      picked = null;
      bank = [];
      $('inst-bank').innerHTML = proposalDone(p, data);
      const openBtn = $('done-open');
      if (openBtn && data.project && data.project.id) {
        openBtn.addEventListener('click', () => { window.location.href = '/projects.html?id=' + encodeURIComponent(data.project.id); });
      }
      $('done-back').addEventListener('click', () => { loadBank(); loadProjects(); });
      J.toast(data.message);
    } catch (err) { btn.disabled = false; J.toast(err.message, true); }
  }

  async function loadProjects() {
    const box = $('inst-projects');
    try {
      const list = await J.api('/institution/projects');
      if (!list.length) { box.innerHTML = '<p class="muted">No projects yet — pick a problem statement and submit your solution proposal from the section above.</p>'; return; }
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
