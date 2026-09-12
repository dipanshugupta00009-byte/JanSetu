/* JanSetu - problem bank page */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);
  let map = null, markers = [];

  function buildQuery() {
    const p = new URLSearchParams();
    if ($('f-q').value.trim()) p.set('q', $('f-q').value.trim());
    if ($('f-cat').value) p.set('category', $('f-cat').value);
    if ($('f-dist').value) p.set('district', $('f-dist').value);
    p.set('sort', $('f-sort').value);
    return p.toString();
  }

  function problemCard(p) {
    return '<div class="problem-item">' +
      '<div class="pi-top"><div><div class="pi-title">' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</div>' +
      '<div class="pi-id">' + J.esc(p.public_id) + ' · ' + J.esc(p.category) + '</div></div>' + J.statusBadge(p.status) + '</div>' +
      '<p class="pi-desc">' + J.esc((p.description || '').slice(0, 260)) + '…</p>' +
      '<div class="pi-meta">' +
        '<span>📍 <b>' + J.esc(p.district || '—') + '</b>' + (p.block ? ' · ' + J.esc(p.block) : '') + '</span>' +
        '<span>🗓️ ' + J.fmtDate(p.created_at) + '</span>' +
        '<span>👍 <b>' + (p.votes || 0) + '</b> endorsements</span>' +
        '<span>⚠️ Severity ' + (p.severity || 0) + '/100</span>' +
      '</div>' +
      '<div class="sev-bar"><span style="width:' + Math.min(100, p.severity || 0) + '%"></span></div>' +
      '<div class="flex mt-1">' +
        '<button class="vote-btn" data-vote="' + J.esc(p.public_id) + '">👍 Endorse (' + (p.votes || 0) + ')</button>' +
        '<a class="btn sm ghost" href="/track.html?id=' + encodeURIComponent(p.public_id) + '">Track / Details</a>' +
      '</div></div>';
  }

  async function loadProblems() {
    const box = $('problem-list');
    box.innerHTML = '<div class="card center muted">Loading…</div>';
    try {
      const list = await J.api('/problems?' + buildQuery());
      if (!list.length) { box.innerHTML = '<div class="card center muted">No problems match these filters.</div>'; if (map) clearMarkers(); return; }
      box.innerHTML = list.map(problemCard).join('');
      box.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', onVote));
      drawMarkers(list);
    } catch (e) { box.innerHTML = '<div class="card center muted">Could not load problems.</div>'; }
  }

  async function onVote(e) {
    const btn = e.currentTarget; const id = btn.dataset.vote;
    try {
      const me = await J.fetchMe();
      if (!me.authed) { window.location.href = '/login.html?next=/problems.html'; return; }
      const r = await J.api('/problems/' + encodeURIComponent(id) + '/vote', { method: 'POST' });
      btn.classList.add('done'); btn.textContent = '👍 Endorsed (' + r.votes + ')'; J.toast(r.message);
    } catch (err) { if (err.status === 401) window.location.href = '/login.html?next=/problems.html'; else J.toast(err.message, true); }
  }
  function initMap() {
    map = L.map('map').setView([23.3441, 85.3096], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
  }

  function clearMarkers() { markers.forEach((m) => map.removeLayer(m)); markers = []; }

  function drawMarkers(list) {
    if (!map) return;
    clearMarkers();
    const pts = list.filter((p) => p.location_lat && p.location_lng);
    pts.forEach((p) => {
      const mk = L.marker([p.location_lat, p.location_lng]).addTo(map).bindPopup(
        '<b>' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</b><br/>' + J.esc(p.district || '') + '<br/><a href="/track.html?id=' + encodeURIComponent(p.public_id) + '">View →</a>');
      markers.push(mk);
    });
    if (pts.length) {
      const b = L.latLngBounds(pts.map((p) => [p.location_lat, p.location_lng]));
      map.fitBounds(b, { padding: [30, 30] });
    }
  }

  async function loadOptions() {
    try {
      const data = await J.api('/problems/options');
      $('f-cat').innerHTML = '<option value="">All categories</option>' + data.categories.map((c) => '<option value="' + c.key + '">' + J.esc(c.label) + '</option>').join('');
      $('f-dist').innerHTML = '<option value="">All districts</option>' + data.districts.map((d) => '<option value="' + J.esc(d) + '">' + J.esc(d) + '</option>').join('');
      // pre-select category from URL ?cat=
      const cat = new URLSearchParams(window.location.search).get('cat');
      if (cat) $('f-cat').value = cat;
    } catch (e) {}
  }

  function init() {
    J.renderHeader('nav.problems'); J.renderFooter();
    initMap();
    loadOptions().then(loadProblems);
    $('f-apply').addEventListener('click', loadProblems);
    ['f-q', 'f-cat', 'f-dist', 'f-sort'].forEach((id) => { $(id).addEventListener('change', loadProblems); });
    $('f-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadProblems(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
