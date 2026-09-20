/**
 * JanSetu – In-Memory demo store.
 * Used automatically when Supabase environment variables are not configured.
 * Implements the same interface as supabaseStore.js so the rest of the
 * application does not care which backend is active.
 */
const { randId, makePublicId, nowIso } = require('../utils/helpers');
const { autoTagSector, computeSeverity, validCategory } = require('../utils/categories');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { computeStats } = require('../utils/stats');
const { SEED_USERS, SEED_PROBLEMS, SEED_PROJECT } = require('./seedData');

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------
const state = {
  users: [],
  problems: [],
  votes: [],
  reviews: [],
  institutions: [],
  industries: [],
  projects: [],
  milestones: [],
  messages: [],
  collabs: [],
  auditLogs: [],
};

let problemSeq = 0;
let projectSeq = 0;
let stateSeeded = false;

function daysAgoIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function seedDefaults() {
  if (stateSeeded) return;
  stateSeeded = true;

  const adminId = randId();
  state.users.push({
    id: adminId,
    name: 'District Administrator',
    email: env.ADMIN_USERNAME,
    phone: null,
    password_hash: bcrypt.hashSync(env.ADMIN_PASSWORD, 10),
    role: 'admin',
    org_name: 'JanSetu Administration',
    district: 'Ranchi',
    language: 'en',
    created_at: nowIso(),
    last_login: null,
  });

  const ids = {};
  for (const su of SEED_USERS) {
    const id = randId();
    ids[su.email] = id;
    state.users.push({
      id,
      name: su.name,
      email: su.email,
      phone: su.phone,
      password_hash: bcrypt.hashSync(su.password, 10),
      role: su.role,
      org_name: su.org_name || null,
      district: su.district || null,
      language: su.language || 'en',
      created_at: nowIso(),
      last_login: null,
    });
    if (su.role === 'institution') {
      state.institutions.push({
        id: randId(),
        user_id: id,
        reg_no: 'HEI-' + randId().slice(0, 8),
        domain_tags: ['renewable energy', 'civil engineering', 'rural water'],
        city: su.district,
        district: su.district,
        approved: true,
        created_at: nowIso(),
      });
    }
    if (su.role === 'industry') {
      state.industries.push({
        id: randId(),
        user_id: id,
        company_name: su.org_name,
        capabilities: ['solar installations', 'IoT', 'CSR funding'],
        interest_sectors: ['electricity', 'water'],
        funding_program: 'CSR / Tata Steel Foundation',
        approved: true,
        created_at: nowIso(),
      });
    }
  }

  const pIds = {};
  SEED_PROBLEMS.forEach((sp, i) => {
    problemSeq += 1;
    const id = randId();
    pIds[i] = id;
    state.problems.push({
      id,
      public_id: makePublicId('JST', problemSeq),
      user_id: ids[sp.byEmail],
      title: sp.title,
      category: validCategory(sp.category),
      sector: autoTagSector(sp.title, sp.description),
      description: sp.description,
      tags: [],
      status: sp.status,
      severity: computeSeverity({ ...sp, votes: sp.votes }),
      votes: sp.votes,
      is_anonymous: false,
      location_lat: sp.lat,
      location_lng: sp.lng,
      district: sp.district,
      block: sp.block,
      village: sp.village,
      address: sp.village + ', ' + sp.block + ', ' + sp.district,
      media: sp.media || [],
      language: 'en',
      duplicate_of: null,
      created_at: daysAgoIso(Math.abs(sp.at)),
      updated_at: daysAgoIso(Math.abs(sp.at)),
    });
  });

  // Seed one project so the Kanban board is not empty
  const inst = state.institutions.find((x) => x.user_id === ids[SEED_PROJECT.institutionEmail]);
  projectSeq += 1;
  const projectId = randId();
  state.projects.push({
    id: projectId,
    public_id: makePublicId('PRJ', projectSeq),
    problem_id: pIds[SEED_PROJECT.problemIndex],
    institution_id: inst ? inst.id : null,
    industry_id: ids['meena@example.com'],
    title: SEED_PROBLEMS[SEED_PROJECT.problemIndex].title,
    status: 'in_progress',
    mentor_id: ids['nirmal@example.com'],
    team: ['Rahul (B.E. EEE)', 'Sneha (B.E. Civil)', 'Arjun (MBA)'],
    proposal_url: null,
    pilot_report_url: null,
    final_url: null,
    start_date: daysAgoIso(20),
    due_date: daysAgoIso(-60),
    created_at: daysAgoIso(20),
    updated_at: daysAgoIso(20),
  });

  SEED_PROJECT.milestones.forEach((m) => {
    state.milestones.push({
      id: randId(),
      project_id: projectId,
      title: m.title,
      type: m.type,
      status: m.status,
      due_date: daysAgoIso(-30),
      submitted_at: daysAgoIso(Math.abs(m.at)),
      file_url: null,
      notes: m.notes,
    });
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
async function createUser(data) {
  const user = {
    id: randId(),
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    password_hash: data.password_hash,
    role: data.role || 'citizen',
    org_name: data.org_name || null,
    district: data.district || null,
    language: data.language || 'hi',
    created_at: nowIso(),
    last_login: null,
  };
  state.users.push(user);
  if (user.role === 'institution') {
    state.institutions.push({
      id: randId(),
      user_id: user.id,
      reg_no: data.reg_no || 'HEI-' + randId().slice(0, 8),
      domain_tags: data.domain_tags || [],
      city: data.district,
      district: data.district,
      approved: false,
      created_at: nowIso(),
    });
  }
  if (user.role === 'industry') {
    state.industries.push({
      id: randId(),
      user_id: user.id,
      company_name: data.org_name || data.company_name,
      capabilities: data.capabilities || [],
      interest_sectors: data.interest_sectors || [],
      funding_program: data.funding_program || null,
      approved: false,
      created_at: nowIso(),
    });
  }
  return user;
}

async function findUserByEmail(email) {
  return state.users.find((u) => u.email && u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

async function findUserByPhone(phone) {
  return state.users.find((u) => u.phone && String(u.phone).replace(/\D/g, '') === String(phone).replace(/\D/g, '')) || null;
}

async function findUserByLogin(login) {
  const l = String(login || '').toLowerCase().trim();
  if (!l) return null;
  const user = await findUserByEmail(l);
  if (user) return user;
  return findUserByPhone(l);
}

async function findUserById(id) {
  return state.users.find((u) => u.id === id) || null;
}

async function updateUser(id, fields) {
  const u = state.users.find((x) => x.id === id);
  if (!u) return null;
  Object.assign(u, fields, { updated_at: nowIso() });
  return u;
}

async function listUsers() {
  return state.users.map((u) => ({ ...u }));
}

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------
function similarTitle(a, b) {
  const wa = new Set(String(a).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wb = new Set(String(b).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const inter = [...wa].filter((w) => wb.has(w));
  return inter.length >= 4 && inter.length >= Math.max(wa.size, wb.size) * 0.5;
}

async function findSimilarProblem(title) {
  for (const p of state.problems) {
    if (p.status === 'rejected' || p.status === 'closed') continue;
    if (similarTitle(p.title, title)) return p;
  }
  return null;
}

function mapProblemOut(p) {
  const owner = p.is_anonymous ? null : (state.users.find((u) => u.id === p.user_id) || null);
  return { ...p, user_name: owner ? owner.name : 'Anonymous Citizen' };
}

async function createProblem(data) {
  let duplicate = data.duplicate_of || null;
  if (!duplicate) {
    const dup = await findSimilarProblem(data.title);
    if (dup) {
      // SIH Flowchart: Duplicate? Yes -> Add Count to Previous One
      if (data.user_id) {
        try { await addVote(dup.id, data.user_id); } catch (e) {}
      } else {
        dup.votes = (dup.votes || 0) + 1;
      }
      return {
        is_duplicate: true,
        duplicate_of: dup,
        problem: dup,
        message: `A similar problem was already reported (${dup.public_id || 'existing'}). Your submission has been added as an endorsement count (+1) to the existing complaint!`,
      };
    }
  }
  problemSeq += 1;
  const problem = {
    id: randId(),
    public_id: makePublicId('JST', problemSeq),
    user_id: data.user_id || null,
    title: data.title,
    category: validCategory(data.category),
    sector: data.sector || autoTagSector(data.title, data.description),
    description: data.description,
    tags: data.tags || [],
    status: 'submitted',
    severity: 0,
    votes: 0,
    is_anonymous: !!data.is_anonymous,
    location_lat: data.location_lat || null,
    location_lng: data.location_lng || null,
    district: data.district || null,
    block: data.block || null,
    village: data.village || null,
    address: data.address || null,
    media: data.media || [],
    language: data.language || 'en',
    duplicate_of: duplicate,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  problem.severity = computeSeverity(problem);
  state.problems.push(problem);
  return mapProblemOut(problem);
}

async function listProblems(filters = {}) {
  let list = [...state.problems];
  if (filters.publicOnly) list = list.filter((p) => !['rejected'].includes(p.status));
  if (filters.status) list = list.filter((p) => p.status === filters.status);
  if (filters.category) list = list.filter((p) => p.category === filters.category);
  if (filters.district) list = list.filter((p) => p.district === filters.district);
  if (filters.reviewable) list = list.filter((p) => ['submitted', 'under_review', 'info_needed'].includes(p.status));
  if (filters.adoptable) list = list.filter((p) => p.status === 'approved');
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    list = list.filter((p) => (p.title + ' ' + p.description).toLowerCase().includes(q));
  }
  list.sort((a, b) => (filters.sort === 'votes' ? b.votes - a.votes : new Date(b.created_at) - new Date(a.created_at)));
  return list.map(mapProblemOut);
}

async function findProblemById(id) {
  const p = state.problems.find((x) => x.id === id);
  return p ? mapProblemOut(p) : null;
}

async function findProblemByPublicId(pid) {
  const p = state.problems.find((x) => x.public_id === String(pid).toUpperCase());
  return p ? mapProblemOut(p) : null;
}

async function myProblems(userId) {
  return state.problems.filter((p) => p.user_id === userId).map(mapProblemOut);
}

async function updateProblem(id, fields) {
  const p = state.problems.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, fields, { updated_at: nowIso() });
  p.severity = computeSeverity(p);
  return mapProblemOut(p);
}

async function addVote(problemId, userId) {
  const exists = state.votes.some((v) => v.problem_id === problemId && v.user_id === userId);
  if (exists) {
    return { ok: false, votes: state.problems.find((p) => p.id === problemId).votes, message: 'You have already endorsed this problem' };
  }
  state.votes.push({ problem_id: problemId, user_id: userId, created_at: nowIso() });
  const p = state.problems.find((x) => x.id === problemId);
  p.votes += 1;
  await updateProblem(problemId, { votes: p.votes });
  return { ok: true, votes: p.votes, message: 'Endorsement recorded' };
}

// ---------------------------------------------------------------------------
// Reviews (expert evaluation)
// ---------------------------------------------------------------------------
async function addReview(data) {
  const review = {
    id: randId(),
    problem_id: data.problem_id,
    reviewer_id: data.reviewer_id,
    impact: data.impact || 0,
    feasibility: data.feasibility || 0,
    innovation: data.innovation || 0,
    resources: data.resources || 0,
    total: (data.impact || 0) + (data.feasibility || 0) + (data.innovation || 0) + (data.resources || 0),
    decision: data.decision,
    comments: data.comments || '',
    created_at: nowIso(),
  };
  state.reviews.push(review);
  return review;
}

async function listReviewsByProblem(problemId) {
  return state.reviews.filter((r) => r.problem_id === problemId)
    .map((r) => ({ ...r, reviewer_name: (state.users.find((u) => u.id === r.reviewer_id) || {}).name }));
}

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------
async function findInstitutionByUserId(userId) {
  return state.institutions.find((i) => i.user_id === userId) || null;
}

async function updateInstitution(userId, fields) {
  const i = state.institutions.find((x) => x.user_id === userId);
  if (!i) return null;
  Object.assign(i, fields, { updated_at: nowIso() });
  return i;
}

async function listInstitutions() {
  return state.institutions.map((i) => ({ ...i, user: (state.users.find((u) => u.id === i.user_id) || null) }));
}

// ---------------------------------------------------------------------------
// Industry partners
// ---------------------------------------------------------------------------
async function findIndustryByUserId(userId) {
  return state.industries.find((i) => i.user_id === userId) || null;
}

async function updateIndustry(userId, fields) {
  const i = state.industries.find((x) => x.user_id === userId);
  if (!i) return null;
  Object.assign(i, fields, { updated_at: nowIso() });
  return i;
}

async function listIndustry() {
  return state.industries.map((i) => ({ ...i, user: (state.users.find((u) => u.id === i.user_id) || null) }));
}

// ---------------------------------------------------------------------------
// Projects (lifecycle)
// ---------------------------------------------------------------------------
async function findProjectForProblem(problemId) {
  return state.projects.find((p) => p.problem_id === problemId) || null;
}

function mapProjectOut(p) {
  const problem = state.problems.find((x) => x.id === p.problem_id) || null;
  const inst = state.institutions.find((x) => x.id === p.institution_id) || null;
  const industry = p.industry_id ? (state.users.find((u) => u.id === p.industry_id) || null) : null;
  return {
    ...p,
    problem,
    institution_name: inst ? (state.users.find((u) => u.id === inst.user_id) || {}).org_name || null : null,
    industry_name: industry ? industry.org_name : null,
    milestones: state.milestones.filter((m) => m.project_id === p.id).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)),
  };
}

async function createProject(data) {
  projectSeq += 1;
  const project = {
    id: randId(),
    public_id: makePublicId('PRJ', projectSeq),
    problem_id: data.problem_id,
    institution_id: data.institution_id,
    industry_id: data.industry_id || null,
    title: data.title,
    status: 'assigned',
    mentor_id: data.mentor_id || null,
    team: data.team || [],
    proposal_url: null,
    pilot_report_url: null,
    final_url: null,
    start_date: data.start_date || nowIso(),
    due_date: data.due_date || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.projects.push(project);
  return mapProjectOut(project);
}

async function listProjects(filters = {}) {
  let list = [...state.projects];
  if (filters.institutionId) list = list.filter((p) => p.institution_id === filters.institutionId);
  if (filters.industryUserId) list = list.filter((p) => p.industry_id === filters.industryUserId);
  if (filters.status) list = list.filter((p) => p.status === filters.status);
  return list.map(mapProjectOut);
}

async function findProjectById(id) {
  const p = state.projects.find((x) => x.id === id);
  return p ? mapProjectOut(p) : null;
}

async function updateProject(id, fields) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, fields, { updated_at: nowIso() });
  return mapProjectOut(p);
}

async function addMilestone(data) {
  const m = {
    id: randId(),
    project_id: data.project_id,
    title: data.title,
    type: data.type || 'other',
    status: 'submitted',
    due_date: data.due_date || null,
    submitted_at: nowIso(),
    file_url: data.file_url || null,
    notes: data.notes || '',
  };
  state.milestones.push(m);
  return m;
}

async function listMilestones(projectId) {
  return state.milestones.filter((m) => m.project_id === projectId).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
}

async function addMessage(data) {
  const m = {
    id: randId(),
    project_id: data.project_id,
    user_id: data.user_id,
    body: data.body,
    created_at: nowIso(),
  };
  state.messages.push(m);
  return { ...m, user_name: (state.users.find((u) => u.id === data.user_id) || {}).name };
}

async function listMessages(projectId) {
  return state.messages.filter((m) => m.project_id === projectId)
    .map((m) => ({ ...m, user_name: (state.users.find((u) => u.id === m.user_id) || {}).name }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// ---------------------------------------------------------------------------
// Collaborations (industry offers on a project)
// ---------------------------------------------------------------------------
async function createCollab(data) {
  const c = {
    id: randId(),
    project_id: data.project_id,
    org_id: data.org_id,
    role: data.role || 'industry',
    title: data.title,
    description: data.description || '',
    funding_amount: data.funding_amount || null,
    status: 'pending',
    created_at: nowIso(),
  };
  state.collabs.push(c);
  return c;
}

async function listCollabs(filters = {}) {
  let list = [...state.collabs];
  if (filters.orgId) list = list.filter((c) => c.org_id === filters.orgId);
  if (filters.projectId) list = list.filter((c) => c.project_id === filters.projectId);
  return list.map((c) => ({ ...c, project_title: (state.projects.find((p) => p.id === c.project_id) || {}).title }));
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------
async function addAuditLog(data) {
  state.auditLogs.push({
    id: randId(),
    user_id: data.user_id || null,
    action: data.action || '',
    entity: data.entity || '',
    entity_id: data.entity_id || null,
    ip: data.ip || null,
    meta: data.meta || {},
    created_at: nowIso(),
  });
  return null;
}

async function listAuditLogs(limit = 100) {
  return state.auditLogs
    .map((a) => ({ ...a, user_name: (state.users.find((u) => u.id === a.user_id) || {}).name || 'system' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Admin stats
// ---------------------------------------------------------------------------
async function getStats() {
  return computeStats(state.problems, state.projects, state.users);
}

// ---------------------------------------------------------------------------
module.exports = {
  seedDefaults,
  createUser, findUserByEmail, findUserByPhone, findUserByLogin, findUserById, updateUser, listUsers,
  createProblem, findProblemById, findProblemByPublicId, listProblems, myProblems, updateProblem, addVote, findSimilarProblem, listReviewsByProblem,
  addReview,
  findInstitutionByUserId, updateInstitution, listInstitutions,
  findIndustryByUserId, updateIndustry, listIndustry,
  createProject, listProjects, findProjectById, updateProject, addMilestone, listMilestones, addMessage, listMessages, findProjectForProblem,
  createCollab, listCollabs,
  addAuditLog, listAuditLogs,
  getStats,
};
