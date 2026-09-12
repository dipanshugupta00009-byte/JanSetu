/* JanSetu – landing page script */
(function () {
  'use strict';
  const J = window.JanSetu;

  async function loadSectors() {
    const el = document.getElementById('sector-chips');
    if (!el) return;
    try {
      const opts = await J.api('/problems/options');
      el.innerHTML = opts.categories
        .map((c) => `<a class="pill" href="/problems.html?cat=${encodeURIComponent(c.key)}">${J.catIcon(c.key)} ${J.esc(c.label)}</a>`)
        .join(' ');
    } catch (e) { /* ignore */ }
  }

  async function loadStats() {
    const el = document.getElementById('stats-row');
    if (!el) return;
    try {
      const data = await J.api('/public/stats');
      const s = data.stats;
      el.innerHTML = [
        stat(s.totalProblems, 'Problems Reported', 'समस्याएँ'),
        stat(s.solvedProblems, 'Solved / Resolved', 'समाधान'),
        stat(s.activeProjects + (s.completedProjects || 0), 'Solutions Deployed', 'परियोजनाएँ'),
        stat((s.institutions || 0) + (s.industryPartners || 0), 'HEI & Industry Partners', 'साझेदार'),
      ].join('');
    } catch (e) { el.innerHTML = ''; }
  }
  function stat(num, lbl, hi) {
    return `<div class="card stat-card"><div class="num">${num}</div><div class="lbl">${lbl}</div><div class="lbl" style="color:#123f85">${hi}</div></div>`;
  }

  async function loadRecent() {
    const el = document.getElementById('recent-problems');
    if (!el) return;
    try {
      const probs = await J.api('/problems?sort=recent');
      if (!probs.length) { el.innerHTML = '<div class="card center muted">No problems reported yet — be the first!</div>'; return; }
      el.innerHTML = probs.slice(0, 4).map(problemCard).join('');
      el.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', onVote));
      el.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openModal(a.dataset.open); }));
    } catch (e) {
      el.innerHTML = '<div class="card center muted">Could not load problems.</div>';
    }
  }

  let probCache = {};
  function problemCard(p) {
    probCache[p.public_id] = p;
    const catLabel = p.category;
    return `<div class="problem-item">
      <div class="pi-top">
        <div>
          <div class="pi-title">${J.catIcon(p.category)} ${J.esc(p.title)}</div>
          <div class="pi-id">${J.esc(p.public_id)} · ${J.esc(p.category)}</div>
        </div>
        ${J.statusBadge(p.status)}
      </div>
      <p class="pi-desc">${J.esc((p.description || '').slice(0, 220))}…</p>
      <div class="pi-meta">
        <span>📍 <b>${J.esc(p.district || '—')}</b>${p.block ? ' · ' + J.esc(p.block) : ''}</span>
        <span>🗓️ ${J.fmtDate(p.created_at)}</span>
        <span>👍 <b>${p.votes || 0}</b> endorsements</span>
      </div>
      <div class="flex mt-1">
        <button class="vote-btn" data-vote="${J.esc(p.public_id)}">👍 Endorse</button>
        <a class="btn sm ghost" href="/track.html?id=${encodeURIComponent(p.public_id)}">Track Status</a>
      </div>
    </div>`;
  }

  async function onVote(e) {
    const id = e.currentTarget.dataset.vote;
    const btn = e.currentTarget;
    try {
      const me = await J.fetchMe();
      if (!me.authed) { window.location.href = '/login.html?next=/'; return; }
      const r = await J.api(`/problems/${encodeURIComponent(id)}/vote`, { method: 'POST' });
      btn.classList.add('done');
      btn.disabled = true;
      btn.textContent = `👍 ${r.votes}`;
      J.toast(r.message);
    } catch (err) {
      if (err.status === 401) window.location.href = '/login.html?next=/';
      else J.toast(err.message, true);
    }
  }

  function openModal(id) { /* optional detail modal on home */ }

  async function init() {
    J.renderHeader('nav.home');
    J.renderFooter();
    loadSectors();
    loadStats();
    loadRecent();
  }
  document.addEventListener('DOMContentLoaded', init);
})();