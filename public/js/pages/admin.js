/* JanSetu - District Administration Dashboard Controller */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  let allUsers = [];
  let allProblems = [];

  function statBox(num, label) {
    return '<div class="card stat-card"><div class="num">' + num + '</div><div class="lbl">' + label + '</div></div>';
  }

  async function loadStats() {
    try {
      const stats = await J.api('/admin/stats');
      const box = $('adm-stats');
      box.innerHTML = [
        statBox(stats.totalProblems, 'Total Problems Reported'),
        statBox(stats.solvedProblems, 'Solved / Closed'),
        statBox(stats.activeProjects + (stats.completedProjects || 0), 'HEI Solution Projects'),
        statBox(stats.resolutionRate + '%', 'Resolution Rate'),
        statBox(stats.citizens || 0, 'Citizens Registered'),
        statBox(stats.institutions || 0, 'HEI Institutes'),
        statBox(stats.industryPartners || 0, 'Industry Partners'),
        statBox(stats.totalVotes || 0, 'Total Endorsements'),
      ].join('');
    } catch (e) {
      $('adm-stats').innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>';
    }
  }

  async function loadUsers() {
    const box = $('users-table-container');
    box.innerHTML = '<p class="muted">Loading users…</p>';
    try {
      allUsers = await J.api('/admin/users');
      renderUsers();
    } catch (e) {
      box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>';
    }
  }

  function renderUsers() {
    const box = $('users-table-container');
    const filterRole = $('user-role-filter').value;
    const list = filterRole ? allUsers.filter((u) => u.role === filterRole) : allUsers;

    if (!list.length) {
      box.innerHTML = '<p class="muted">No users found for this role filter.</p>';
      return;
    }

    const ROLES = ['citizen', 'evaluator', 'institution', 'industry', 'admin'];

    box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Name</th><th>Contact (Email/Phone)</th><th>Role</th><th>Organisation / Institute</th><th>District</th><th>Registered</th><th>Change Role</th>' +
      '</tr></thead><tbody>' +
      list.map((u) => {
        return '<tr>' +
          '<td><b>' + J.esc(u.name) + '</b></td>' +
          '<td>' + J.esc(u.email || u.phone || '—') + '</td>' +
          '<td><span class="pill ' + (u.role === 'admin' ? 'green' : '') + '">' + J.esc(u.role) + '</span></td>' +
          '<td>' + J.esc(u.org_name || '—') + '</td>' +
          '<td>' + J.esc(u.district || '—') + '</td>' +
          '<td>' + J.fmtDate(u.created_at) + '</td>' +
          '<td><div class="flex"><select data-uid="' + u.id + '" style="font-size:.8rem;padding:.2rem .4rem">' +
          ROLES.map((r) => '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + r + '</option>').join('') +
          '</select><button class="btn sm" data-save-role="' + u.id + '" style="padding:.2rem .5rem">Save</button></div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';

    box.querySelectorAll('[data-save-role]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const uid = e.currentTarget.dataset.saveRole;
        const select = box.querySelector('select[data-uid="' + uid + '"]');
        const nextRole = select.value;
        try {
          await J.api('/admin/users/' + encodeURIComponent(uid) + '/role', {
            method: 'PATCH',
            body: JSON.stringify({ role: nextRole }),
          });
          J.toast('User role updated to ' + nextRole);
          loadUsers();
        } catch (err) {
          J.toast(err.message, true);
        }
      });
    });
  }

  async function loadProblems() {
    const box = $('problems-table-container');
    box.innerHTML = '<p class="muted">Loading problems…</p>';
    try {
      allProblems = await J.api('/admin/problems');
      $('problems-count').textContent = allProblems.length + ' reports in database';
      if (!allProblems.length) {
        box.innerHTML = '<p class="muted">No problems reported yet.</p>';
        return;
      }
      box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>ID</th><th>Title</th><th>Category</th><th>District</th><th>Status</th><th>Severity</th><th>Votes</th><th>Reported</th><th>Actions</th>' +
        '</tr></thead><tbody>' +
        allProblems.map((p) => {
          return '<tr>' +
            '<td><b>' + J.esc(p.public_id) + '</b></td>' +
            '<td>' + J.catIcon(p.category) + ' ' + J.esc(p.title.slice(0, 50)) + '</td>' +
            '<td>' + J.esc(p.category) + '</td>' +
            '<td>' + J.esc(p.district || '—') + '</td>' +
            '<td>' + J.statusBadge(p.status) + '</td>' +
            '<td>' + (p.severity || 0) + '/100</td>' +
            '<td>👍 ' + (p.votes || 0) + '</td>' +
            '<td>' + J.fmtDate(p.created_at) + '</td>' +
            '<td><a class="btn sm ghost" href="/track.html?id=' + encodeURIComponent(p.public_id) + '" target="_blank">Track / Review</a></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    } catch (e) {
      box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>';
    }
  }

  async function loadAuditLogs() {
    const box = $('audit-table-container');
    box.innerHTML = '<p class="muted">Loading audit trail…</p>';
    try {
      const logs = await J.api('/admin/audit-logs');
      if (!logs.length) {
        box.innerHTML = '<p class="muted">No audit logs recorded yet.</p>';
        return;
      }
      box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Time</th><th>Action</th><th>User</th><th>Entity</th><th>Entity ID</th><th>IP Address</th>' +
        '</tr></thead><tbody>' +
        logs.map((l) => {
          return '<tr>' +
            '<td>' + J.fmtDateTime(l.created_at) + '</td>' +
            '<td><code>' + J.esc(l.action) + '</code></td>' +
            '<td>' + J.esc(l.user_name || 'system') + '</td>' +
            '<td>' + J.esc(l.entity || '—') + '</td>' +
            '<td><small class="muted">' + J.esc((l.entity_id || '').slice(0, 12)) + '</small></td>' +
            '<td><small class="muted">' + J.esc(l.ip || '—') + '</small></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    } catch (e) {
      box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>';
    }
  }

  function setupTabs() {
    const tabs = [
      { btn: 'tab-btn-users', panel: 'tab-users', loader: loadUsers },
      { btn: 'tab-btn-problems', panel: 'tab-problems', loader: loadProblems },
      { btn: 'tab-btn-audit', panel: 'tab-audit', loader: loadAuditLogs },
    ];

    tabs.forEach(({ btn, panel, loader }) => {
      $(btn).addEventListener('click', () => {
        tabs.forEach((t) => {
          $(t.btn).classList.toggle('ghost', t.btn !== btn);
          $(t.panel).classList.toggle('hide', t.panel !== panel);
        });
        loader();
      });
    });

    $('user-role-filter').addEventListener('change', renderUsers);
  }

  async function init() {
    try {
      await J.requireAuth(['admin']);
    } catch (e) {
      return;
    }
    J.renderHeader('nav.adminview');
    J.renderFooter();
    setupTabs();
    loadStats();
    loadUsers();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
