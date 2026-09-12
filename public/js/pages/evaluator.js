/* JanSetu - evaluator review queue */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  function reviewCard(p) {
    return '<div class="card mb-1" data-pid="' + p.id + '">' +
      '<div class="spread"><b>' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</b>' + J.statusBadge(p.status) + '</div>' +
      '<div class="pi-meta mt-1"><span>ID ' + J.esc(p.public_id) + '</span><span>📍 ' + J.esc(p.district || '—') + '</span><span>👍 ' + (p.votes || 0) + '</span><span>Severity ' + (p.severity || 0) + '</span></div>' +
      '<p class="mt-1">' + J.esc((p.description || '').slice(0, 300)) + '</p>' +
      '<div class="form-row mt-1">' +
        score('impact', 'Impact (1-5)') + score('feasibility', 'Feasibility (1-5)') + score('innovation', 'Innovation (1-5)') + score('resources', 'Resources (1-5)') +
      '</div>' +
      '<div class="field mt-1"><label>Comments · टिप्पणी</label><textarea data-c="comments" placeholder="Decision note for the reporter…"></textarea></div>' +
      '<div class="flex">' +
        '<button class="btn sm" data-dec="approve">✅ Approve</button>' +
        '<button class="btn sm ghost" data-dec="request_info">❓ Request More Info</button>' +
        '<button class="btn sm ghost" data-dec="escalate">🏛️ Escalate to Dept</button>' +
        '<button class="btn sm danger" data-dec="reject">⛔ Reject</button>' +
      '</div></div>';
  }

  function score(key, label) {
    return '<div class="field"><label>' + label + '</label><select data-s="' + key + '">' +
      ['1', '2', '3', '4', '5'].map((v) => '<option value="' + v + '">' + v + '</option>').join('') + '</select></div>';
  }

  async function load() {
    const box = $('ev-queue');
    box.innerHTML = '<div class="card center muted">Loading queue…</div>';
    try {
      const list = await J.api('/evaluator/queue');
      $('ev-count').textContent = list.length + ' awaiting review';
      if (!list.length) { box.innerHTML = '<div class="card center muted">No problems in the queue. 🎉</div>'; return; }
      box.innerHTML = list.map(reviewCard).join('');
      box.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', onDecide));
      // auto-fill rough suggestions
      box.querySelectorAll('[data-pid]').forEach((card) => {
        const sev = (card.closest('.card').querySelectorAll('.pi-meta span')[2] || {}).textContent || '';
      });
    } catch (e) { box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>'; }
  }

  async function onDecide(e) {
    const btn = e.currentTarget;
    const card = btn.closest('[data-pid]');
    const pid = card.dataset.pid;
    const payload = {
      decision: btn.dataset.dec,
      impact: card.querySelector('[data-s=impact]').value,
      feasibility: card.querySelector('[data-s=feasibility]').value,
      innovation: card.querySelector('[data-s=innovation]').value,
      resources: card.querySelector('[data-s=resources]').value,
      comments: card.querySelector('[data-c=comments]').value,
    };
    btn.disabled = true;
    try {
      const data = await J.api('/evaluator/review/' + encodeURIComponent(pid), { method: 'POST', body: JSON.stringify(payload) });
      J.toast(data.message);
      card.style.opacity = '.45';
      btn.textContent = '✓ ' + btn.textContent;
      setTimeout(() => { if (e.currentTarget.dataset.dec !== 'request_info') card.remove(); }, 500);
      setTimeout(load, 700);
    } catch (err) { btn.disabled = false; J.toast(err.message, true); }
  }

  async function init() {
    try { await J.requireAuth(['evaluator', 'admin']); }
    catch (e) { return; }
    J.renderHeader('nav.evaluator'); J.renderFooter();
    load();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
