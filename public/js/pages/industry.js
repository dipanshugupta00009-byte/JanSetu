/* JanSetu - industry desk */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  async function loadProfile() {
    try {
      const data = await J.api('/industry/me');
      const p = data.profile || {};
      $('ind-profile').innerHTML = '<p><b>Company:</b> ' + J.esc(data.user.org_name || data.user.name) + '</p><p><b>Capabilities:</b> ' + (p.capabilities && p.capabilities.length ? p.capabilities.map(J.esc).join(', ') : '<span class="muted">not set</span>') + '</p><p><b>Funding:</b> ' + J.esc(p.funding_program || '—') + '</p>';
      $('ip-cap').value = (p.capabilities || []).join(', ');
      $('ip-fund').value = p.funding_program || '';
    } catch (e) { J.toast(e.message, true); }
  }

  async function saveProfile() {
    try { await J.api('/industry/me', { method: 'PUT', body: JSON.stringify({ capabilities: $('ip-cap').value, funding_program: $('ip-fund').value }) }); loadProfile(); J.toast('Profile saved.'); }
    catch (e) { J.toast(e.message, true); }
  }

  async function loadActive() {
    const box = $('ind-projects');
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const list = await J.api('/industry/active-projects');
      if (!list.length) { box.innerHTML = '<p class="muted">No active projects yet.</p>'; return; }
      box.innerHTML = list.map((p) => '<div class="problem-item">' +
        '<div class="spread"><b>' + J.esc(p.title) + '</b>' + J.statusBadge(p.status) + '</div>' +
        '<div class="pi-meta"><span>Institution: <b>' + J.esc(p.institution_name || '—') + '</b></span><span>Due: ' + J.fmtDate(p.due_date) + '</span></div>' +
        '<div class="flex mt-1">' +
          '<button class="btn sm" data-collab="' + p.id + '" data-title="' + J.esc(p.title) + '">💼 Offer Collaboration</button>' +
          '<a class="btn sm ghost" href="/projects.html?id=' + p.id + '">View Project</a>' +
        '</div></div>').join('');
      box.querySelectorAll('[data-collab]').forEach((b) => b.addEventListener('click', offer));
    } catch (e) { box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>'; }
  }

  async function offer(e) {
    const btn = e.currentTarget;
    const amount = prompt('Co-funding amount in ₹ (0 if none):', '0');
    const title = prompt('Offer title:', 'Technical + funding support');
    const desc = prompt('Describe support (resources, personnel, CSR):', '');
    if (title == null) return;
    btn.disabled = true;
    try {
      const data = await J.api('/industry/collaborate/' + encodeURIComponent(btn.dataset.collab), { method: 'POST', body: JSON.stringify({ title: title, description: desc || '', funding_amount: parseInt(amount, 10) || 0 }) });
      J.toast(data.message); loadOffers();
    } catch (err) { btn.disabled = false; J.toast(err.message, true); }
  }

  async function loadOffers() {
    const box = $('ind-offers');
    try {
      const collabs = await J.api('/industry/collabs');
      if (!collabs.length) {
        box.innerHTML = '<p class="muted">No collaboration offers sent yet. Click "Offer Collaboration" on any active project above.</p>';
        return;
      }
      box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th>Project</th><th>Offer Title</th><th>Funding</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
        collabs.map((c) => '<tr><td><b>' + J.esc(c.project_title || 'Project') + '</b></td><td>' + J.esc(c.title) + '</td><td>' + (c.funding_amount ? '₹' + c.funding_amount.toLocaleString('en-IN') : 'In-kind / Tech') + '</td><td><span class="pill ' + (c.status === 'approved' ? 'green' : '') + '">' + J.esc(c.status) + '</span></td><td>' + J.fmtDate(c.created_at) + '</td></tr>').join('') +
        '</tbody></table></div>';
    } catch (e) {
      box.innerHTML = '<p class="muted">No offers yet.</p>';
    }
  }

  async function init() {
    try { await J.requireAuth(['industry', 'admin']); }
    catch (e) { return; }
    J.renderHeader('nav.industry'); J.renderFooter();
    loadProfile(); loadActive(); loadOffers();
    $('ip-save2').addEventListener('click', saveProfile);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
