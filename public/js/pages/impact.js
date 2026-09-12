/* JanSetu - impact dashboard */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  function statRow(s) {
    const items = [
      { n: s.totalProblems, l: 'Problems Reported' },
      { n: s.solvedProblems, l: 'Solved / Closed' },
      { n: s.activeProjects + (s.completedProjects || 0), l: 'Study+Projects' },
      { n: s.citizens || 0, l: 'Registered Citizens' },
      { n: s.institutions + s.industryPartners, l: 'HEI & Industry' },
      { n: (s.resolutionRate || 0) + '%', l: 'Resolution Rate' },
    ];
    return items.map((i) => '<div class="card stat-card"><div class="num">' + i.n + '</div><div class="lbl">' + i.l + '</div></div>').join('');
  }

  function renderDistrictBars(byDistrict) {
    const max = Math.max.apply(Math, byDistrict.map((d) => d[1]).concat([1]));
    $('district-bars').innerHTML = byDistrict.map((d) =>
      '<div class="mb-1"><div class="flex" style="justify-content:space-between"><b>' + J.esc(d[0]) + '</b><span>' + d[1] + '</span></div>' +
      '<div class="sev-bar"><span style="width:' + Math.round((d[1] / max) * 100) + '%"></span></div></div>'
    ).join('') || '<p class="muted">No data yet.</p>';
  }

  let catChart = null, monChart = null;
  function makeCharts(stats, cats) {
    const labels = cats.map((c) => c.key);
    const vals = cats.map((c) => stats.byCategory[c.key] || 0);
    if (catChart) catChart.destroy();
    catChart = new Chart($('chart-sector'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Reports', data: vals, backgroundColor: '#2170e6', borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
    if (monChart) monChart.destroy();
    monChart = new Chart($('chart-month'), {
      type: 'line',
      data: { labels: stats.monthly.map((m) => m.month), datasets: [{ label: 'Reports', data: stats.monthly.map((m) => m.count), borderColor: '#1856b8', backgroundColor: 'rgba(33,112,230,.15)', fill: true, tension: .3 }] },
      options: { plugins: { legend: { display: false } }, maintainAspectRatio: false },
    });
  }

  let map = null, markers = [];
  function initMap(points) {
    map = L.map('map').setView([23.3441, 85.3096], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
    points.filter((p) => p.lat && p.lng).forEach((p) => {
      const mk = L.marker([p.lat, p.lng]).addTo(map).bindPopup('<b>' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</b><br/>' + J.esc(p.district || '') + ' · ' + J.esc(p.status));
      markers.push(mk);
    });
  }

  function loadSuccess(problems) {
    const done = problems.filter((p) => ['deployed', 'closed'].includes(p.status));
    $('success-list').innerHTML = done.length
      ? done.map((p) => '<div class="problem-item"><div class="spread"><b>' + J.catIcon(p.category) + ' ' + J.esc(p.title) + '</b>' + J.statusBadge(p.status) + '</div><div class="pi-meta"><span>📍 ' + J.esc(p.district || '—') + '</span><span>🗓️ ' + J.fmtDate(p.created_at) + '</span><span>👍 ' + (p.votes || 0) + '</span></div></div>').join('')
      : '<p class="muted">No deployed solutions yet — first breakthrough coming soon!</p>';
  }

  async function init() {
    J.renderHeader('nav.impact'); J.renderFooter();
    try {
      const data = await J.api('/public/stats');
      $('impact-stats').innerHTML = statRow(data.stats);
      renderDistrictBars(data.stats.byDistrict || []);
      makeCharts(data.stats, data.categories || []);
      initMap(data.mapPoints || []);
      loadSuccess(await J.api('/problems?sort=recent'));
    } catch (e) { $('impact-stats').innerHTML = '<div class="card center muted">Could not load data.</div>'; }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
