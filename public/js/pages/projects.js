/* JanSetu - projects kanban board + detail */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);
  const COLS = ['assigned', 'in_progress', 'piloted', 'deployed', 'closed'];
  let projects = [];
  let currentProjectId = null;

  async function load() {
    try {
      projects = await J.api('/projects?mine=1');
      renderBoard();
      const sel = new URLSearchParams(window.location.search).get('id');
      if (sel) openDetail(sel);
      else if (projects.length) openDetail(projects[0].id);
      else $('proj-detail').innerHTML = '<p class="muted">No project selected.</p>';
    } catch (e) {
      $('kanban').innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>';
    }
  }

  function renderBoard() {
    const box = $('kanban');
    if (!projects.length) {
      box.innerHTML = '<p class="muted">No projects yet. HEIs can adopt problems from the HEI Desk.</p>';
      return;
    }
    box.innerHTML = '<div class="kanban">' + COLS.map((c) => {
      const list = projects.filter((p) => p.status === c);
      return '<div class="kan-col"><h4>' + c.replace('_', ' ') + ' <span class="pill">' + list.length + '</span></h4>' +
        list.map((p) => kanCard(p)).join('') + '</div>';
    }).join('') + '</div>';

    box.querySelectorAll('[data-mv]').forEach((sel) => sel.addEventListener('change', move));
    box.querySelectorAll('[data-openp]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      openDetail(e.currentTarget.dataset.openp);
    }));
  }

  function kanCard(p) {
    return '<div class="kan-card">' +
      '<div class="kc-title"><a href="#" data-openp="' + p.id + '">' + J.esc((p.problem || {}).title || p.title) + '</a></div>' +
      '<div class="muted">' + J.esc(p.public_id) + '</div>' +
      '<div class="muted">🏛 ' + J.esc(p.institution_name || 'HEI') + '</div>' +
      '<select data-mv="' + p.id + '">' + COLS.map((c) => '<option value="' + c + '"' + (c === p.status ? ' selected' : '') + '>' + c.replace('_', ' ') + '</option>').join('') + '</select>' +
      '</div>';
  }

  async function move(e) {
    const sel = e.currentTarget;
    try {
      const data = await J.api('/projects/' + encodeURIComponent(sel.dataset.mv) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: sel.value }),
      });
      J.toast(data.message);
      load();
    } catch (err) {
      sel.value = sel.getAttribute('data-prev') || '';
      J.toast(err.message, true);
    }
  }

  async function openDetail(id) {
    currentProjectId = id;
    const box = $('proj-detail');
    box.innerHTML = '<p class="muted">Loading project details…</p>';
    try {
      const data = await J.api('/projects/' + encodeURIComponent(id));
      const p = data.project;
      const messages = data.messages || [];
      const collabs = data.collabs || [];
      const me = await J.fetchMe();
      const myId = (me.user && me.user.id) || null;

      let html = '';
      html += '<div class="spread mb-1">';
      html += '<div><h2>' + J.esc(p.title) + '</h2><div class="muted">Project ID: <b>' + J.esc(p.public_id) + '</b> · Institution: <b>' + J.esc(p.institution_name || 'HEI') + '</b>' + (p.industry_name ? ' · Industry Partner: <b>' + J.esc(p.industry_name) + '</b>' : '') + '</div></div>';
      html += '<div>' + J.statusBadge(p.status) + '</div>';
      html += '</div>';

      if (p.problem) {
        html += '<div class="card tint mb-2">';
        html += '<h4>📍 Problem Context: ' + J.catIcon(p.problem.category) + ' ' + J.esc(p.problem.title) + '</h4>';
        html += '<p class="muted mb-1">' + J.esc(p.problem.description) + '</p>';
        html += '<div class="pi-meta"><span>District: <b>' + J.esc(p.problem.district || '—') + '</b></span><span>Report ID: <b>' + J.esc(p.problem.public_id) + '</b></span><span><a href="/track.html?id=' + encodeURIComponent(p.problem.public_id) + '" target="_blank">Track Report →</a></span></div>';
        html += '</div>';
      }

      html += '<div class="grid cols-2 mb-2">';
      html += '<div class="card">';
      html += '<h4>👥 Student & Faculty Team</h4>';
      if (p.team && p.team.length) {
        html += '<ul>' + p.team.map((m) => '<li>' + J.esc(m) + '</li>').join('') + '</ul>';
      } else {
        html += '<p class="muted">No team members registered yet.</p>';
      }
      html += '<div class="muted mt-1">Start Date: ' + J.fmtDate(p.start_date) + (p.due_date ? ' · Due Date: ' + J.fmtDate(p.due_date) : '') + '</div>';
      html += '</div>';

      html += '<div class="card">';
      html += '<h4>💼 Industry Collaborations (CSR / Technical)</h4>';
      if (collabs.length) {
        html += collabs.map((c) => '<div class="mb-1" style="border-left:3px solid var(--blue-600);padding-left:8px"><b>' + J.esc(c.title) + '</b>' + (c.funding_amount ? ' · ₹' + c.funding_amount.toLocaleString('en-IN') : '') + '<div class="muted">' + J.esc(c.description || '') + '</div><span class="pill ' + (c.status === 'approved' ? 'green' : '') + '">' + J.esc(c.status) + '</span></div>').join('');
      } else {
        html += '<p class="muted">No industry collaboration offers yet. Industry partners can offer support from the Industry Desk.</p>';
      }
      html += '</div>';
      html += '</div>';

      // Milestones
      html += '<div class="card mb-2">';
      html += '<div class="spread mb-1"><div><h4>🎯 Solution Proposal & Milestones</h4><p class="muted">Start with a clear proposal: explain your approach, expected impact, resources, and delivery plan.</p></div><button class="btn sm ghost" id="toggle-milestone-form">+ Submit Proposal</button></div>';
      html += '<form id="milestone-form" class="hide mb-2 card tint">';
      html += '<div class="form-row">';
      html += '<div class="field"><label class="req">Proposal Title</label><input type="text" id="m-title" placeholder="e.g. Solar-powered school water pump" required /></div>';
      html += '<div class="field"><label>Submission Type</label><select id="m-type"><option value="proposal">Solution Proposal</option><option value="prototype">Prototype Update</option><option value="pilot">Pilot Report</option><option value="final">Final Report</option><option value="other">Other</option></select></div>';
      html += '</div>';
      html += '<div class="field"><label class="req">Solution proposal</label><textarea id="m-notes" required placeholder="Describe: 1) root cause and proposed solution, 2) student team and skills, 3) beneficiaries and expected measurable impact, 4) materials/budget, 5) timeline, and 6) risks or permissions needed."></textarea></div>';
      html += '<button type="submit" class="btn sm">Submit for HEI Review</button>';
      html += '</form>';

      if (p.milestones && p.milestones.length) {
        html += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Milestone</th><th>Type</th><th>Status</th><th>Submitted</th><th>Notes</th></tr></thead><tbody>';
        html += p.milestones.map((m) => '<tr><td><b>' + J.esc(m.title) + '</b></td><td><span class="pill">' + J.esc(m.type) + '</span></td><td><span class="badge approved">' + J.esc(m.status) + '</span></td><td>' + J.fmtDate(m.submitted_at) + '</td><td class="muted">' + J.esc(m.notes || '—') + '</td></tr>').join('');
        html += '</tbody></table></div>';
      } else {
        html += '<p class="muted">No milestones recorded yet. Add the first project milestone above.</p>';
      }
      html += '</div>';

      // Message thread
      html += '<div class="card">';
      html += '<h4>💬 Project Discussion & Mentorship</h4>';
      html += '<p class="muted">Private channel between HEI faculty/students, Industry mentors, and Evaluators.</p>';
      html += '<div class="chat-box mb-1" id="chat-thread">';
      if (messages.length) {
        html += messages.map((m) => {
          const isMine = myId && m.user_id === myId;
          return '<div class="msg ' + (isMine ? 'mine' : '') + '"><div class="who">' + J.esc(m.user_name || 'Participant') + '</div><div class="txt">' + J.esc(m.body) + '</div><div class="when">' + J.fmtDateTime(m.created_at) + '</div></div>';
        }).join('');
      } else {
        html += '<p class="muted center p-2">No messages in this project thread yet. Start the conversation!</p>';
      }
      html += '</div>';

      html += '<form id="chat-form" class="flex">';
      html += '<input type="text" id="msg-input" placeholder="Type a project update, question for mentor, or technical feedback…" style="flex:1" required />';
      html += '<button type="submit" class="btn sm">Send 💬</button>';
      html += '</form>';
      html += '</div>';

      box.innerHTML = html;

      // Scroll chat to bottom
      const threadEl = $('chat-thread');
      if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;

      // Event listeners
      const toggleBtn = $('toggle-milestone-form');
      const mForm = $('milestone-form');
      if (toggleBtn && mForm) {
        toggleBtn.addEventListener('click', () => {
          mForm.classList.toggle('hide');
        });
      }

      if (mForm) {
        mForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const title = $('m-title').value.trim();
          const type = $('m-type').value;
          const notes = $('m-notes').value.trim();
          if (!title || !notes) return J.toast('Proposal title and solution details are required.', true);
          try {
            await J.api('/projects/' + encodeURIComponent(id) + '/milestones', {
              method: 'POST',
              body: JSON.stringify({ title, type, notes }),
            });
            J.toast('Milestone added!');
            openDetail(id);
          } catch (err) {
            J.toast(err.message, true);
          }
        });
      }

      const cForm = $('chat-form');
      if (cForm) {
        cForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const body = $('msg-input').value.trim();
          if (!body) return;
          $('msg-input').value = '';
          try {
            await J.api('/projects/' + encodeURIComponent(id) + '/messages', {
              method: 'POST',
              body: JSON.stringify({ body }),
            });
            openDetail(id);
          } catch (err) {
            J.toast(err.message, true);
          }
        });
      }
    } catch (e) {
      box.innerHTML = '<div class="alert error">' + J.esc(e.message) + '</div>';
    }
  }

  async function init() {
    try {
      await J.requireAuth(['institution', 'industry', 'admin', 'evaluator']);
    } catch (e) {
      return;
    }
    J.renderHeader('nav.projects');
    J.renderFooter();
    load();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
