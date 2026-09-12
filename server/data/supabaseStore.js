/**
 * JanSetu – Supabase (Postgres) store.
 * Implements the same interface as memory.js against the schema in
 * supabase/schema.sql. Uses the server-side service key, so Row Level
 * Security policies never interfere with application operations.
 */
const { client } = require('../config/supabase');
const env = require('../config/env');
const { makePublicId, asStringArray } = require('../utils/helpers');
const { autoTagSector, computeSeverity, validCategory } = require('../utils/categories');
const bcrypt = require('bcryptjs');
const { computeStats } = require('../utils/stats');
const { SEED_USERS, SEED_PROBLEMS, SEED_PROJECT } = require('./seedData');

const TABLES = {
  users: 'users',
  problems: 'problems',
  votes: 'votes',
  reviews: 'reviews',
  institutions: 'institutions',
  industries: 'industry_partners',
  projects: 'projects',
  milestones: 'milestones',
  messages: 'messages',
  collabs: 'collabs',
  audit: 'audit_logs',
};

function rows(res) {
  if (res.error) throw res.error;
  return res.data || [];
}
function first(res) {
  if (res.error) throw res.error;
  return res.data && res.data.length ? res.data[0] : null;
}
// ---------------------------------------------------------------------------
// Bootstrap: ensure admin + demo content exist on first run
// ---------------------------------------------------------------------------
async function seedDefaults() {
  const existing = rows(await client.from(TABLES.users).select('id').eq('role', 'admin').limit(1));
  if (!existing.length) {
    await client.from(TABLES.users).insert([{
      name: 'District Administrator',
      email: env.ADMIN_USERNAME,
      password_hash: bcrypt.hashSync(env.ADMIN_PASSWORD, 10),
      role: 'admin',
      org_name: 'JanSetu Administration',
      district: 'Ranchi',
      language: 'en',
    }]);
    console.log('[DB] Admin user created automatically.');
  }
  await seedDemoIfEmpty();
}

async function seedDemoIfEmpty() {
  const { count } = await client.from(TABLES.problems).select('*', { count: 'exact', head: true });
  if (count > 0) return;

  const userIds = {};
  for (const su of SEED_USERS) {
    const { data } = await client.from(TABLES.users)
      .insert([{
        name: su.name, email: su.email, phone: su.phone,
        password_hash: bcrypt.hashSync(su.password, 10), role: su.role,
        org_name: su.org_name || null, district: su.district || null,
        language: su.language || 'en',
      }]).select('id');
    userIds[su.email] = data[0].id;
    if (su.role === 'institution') {
      await client.from(TABLES.institutions).insert([{
        user_id: data[0].id, reg_no: 'HEI-' + String(Date.now()).slice(-8),
        domain_tags: ['renewable energy', 'civil engineering', 'rural water'],
        city: su.district, district: su.district, approved: true,
      }]);
    }
    if (su.role === 'industry') {
      await client.from(TABLES.industries).insert([{
        user_id: data[0].id, company_name: su.org_name,
        capabilities: ['solar installations', 'IoT', 'CSR funding'],
        interest_sectors: ['electricity', 'water'],
        funding_program: 'CSR / Tata Steel Foundation', approved: true,
      }]);
    }
  }
  const problemIds = [];
  for (let i = 0; i < SEED_PROBLEMS.length; i++) {
    const sp = SEED_PROBLEMS[i];
    const createdAt = new Date(Date.now() - Math.abs(sp.at) * 86400000).toISOString();
    const { data } = await client.from(TABLES.problems).insert([{
      user_id: userIds[sp.byEmail],
      title: sp.title,
      category: validCategory(sp.category),
      sector: autoTagSector(sp.title, sp.description),
      description: sp.description,
      tags: [],
      status: sp.status,
      severity: computeSeverity({ ...sp, votes: sp.votes }),
      votes: sp.votes,
      is_anonymous: false,
      location_lat: sp.lat, location_lng: sp.lng,
      district: sp.district, block: sp.block, village: sp.village,
      address: [sp.village, sp.block, sp.district].join(', '),
      media: sp.media,
      language: 'en',
      created_at: createdAt, updated_at: createdAt,
    }]).select('id');
    problemIds.push(data[0].id);
  }

  const inst = first(await client.from(TABLES.institutions).select('id').eq('user_id', userIds[SEED_PROJECT.institutionEmail]));
  if (inst) {
    const { data: proj } = await client.from(TABLES.projects).insert([{
      problem_id: problemIds[SEED_PROJECT.problemIndex],
      institution_id: inst.id,
      industry_id: userIds['meena@example.com'],
      title: SEED_PROBLEMS[SEED_PROJECT.problemIndex].title,
      status: 'in_progress',
      mentor_id: userIds['nirmal@example.com'],
      team: ['Rahul (B.E. EEE)', 'Sneha (B.E. Civil)', 'Arjun (MBA)'],
      start_date: new Date(Date.now() - 20 * 86400000).toISOString(),
      due_date: new Date(Date.now() + 60 * 86400000).toISOString(),
    }]).select('id');
    for (const m of SEED_PROJECT.milestones) {
      await client.from(TABLES.milestones).insert([{
        project_id: proj[0].id, title: m.title, type: m.type, status: m.status,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        submitted_at: new Date(Date.now() - Math.abs(m.at) * 86400000).toISOString(),
        notes: m.notes,
      }]);
    }
  }
  console.log('[DB] Demo data seeded.');
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
async function createUser(data) {
  const result = await client.from(TABLES.users).insert([{
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    password_hash: data.password_hash,
    role: data.role || 'citizen',
    org_name: data.org_name || null,
    district: data.district || null,
    language: data.language || 'hi',
  }]).select('*');
  if (result.error) throw result.error;
  const user = result.data && result.data[0];
  if (!user) throw new Error('The account could not be saved. Please try again.');
  if (user.role === 'institution') {
    await client.from(TABLES.institutions).insert([{
      user_id: user.id, reg_no: data.reg_no || 'HEI-' + String(Date.now()).slice(-8),
      domain_tags: asStringArray(data.domain_tags), city: data.district, district: data.district,
      approved: false,
    }]);
  }
  if (user.role === 'industry') {
    await client.from(TABLES.industries).insert([{
      user_id: user.id, company_name: data.org_name || data.company_name,
      capabilities: asStringArray(data.capabilities),
      interest_sectors: asStringArray(data.interest_sectors),
      funding_program: data.funding_program || null, approved: false,
    }]);
  }
  return user;
}

async function findUserByEmail(email) {
  return first(await client.from(TABLES.users).select('*').ilike('email', String(email || '').trim()).limit(1));
}
async function findUserByPhone(phone) {
  return first(await client.from(TABLES.users).select('*').eq('phone', String(phone || '')).limit(1));
}
async function findUserByLogin(login) {
  const l = String(login || '').trim();
  if (!l) return null;
  if (l.includes('@')) return findUserByEmail(l);
  return findUserByPhone(l);
}
async function findUserById(id) {
  return first(await client.from(TABLES.users).select('*').eq('id', id).limit(1));
}
async function updateUser(id, fields) {
  return first(await client.from(TABLES.users).update(fields).eq('id', id).select('*'));
}
async function listUsers() {
  return rows(await client.from(TABLES.users).select('*').order('created_at', { ascending: false }).limit(500));
}

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------
function mapProblemOut(p) {
  if (!p) return p;
  const owner = p.is_anonymous ? null : p.users;
  return { ...p, user_name: owner ? owner.name : 'Anonymous Citizen' };
}

async function createProblem(data) {
  let duplicate = data.duplicate_of || null;
  if (!duplicate) {
    const similar = await findSimilarProblem(data.title);
    if (similar) duplicate = similar.id;
  }
  const { count } = await client.from(TABLES.problems).select('*', { count: 'exact', head: true });
  const publicId = makePublicId('JST', (count || 0) + 1);
  const problem = {
    user_id: data.user_id || null,
    public_id: publicId,
    title: data.title,
    category: validCategory(data.category),
    sector: data.sector || autoTagSector(data.title, data.description),
    description: data.description,
    tags: asStringArray(data.tags),
    status: 'submitted',
    votes: 0,
    is_anonymous: !!data.is_anonymous,
    location_lat: data.location_lat || null,
    location_lng: data.location_lng || null,
    district: data.district || null,
    block: data.block || null,
    village: data.village || null,
    address: data.address || null,
    media: Array.isArray(data.media) ? data.media : [],
    language: data.language || 'en',
    duplicate_of: duplicate,
  };
  problem.severity = computeSeverity(problem);
  const out = await client.from(TABLES.problems).insert([problem]).select('*, users(name)');
  return mapProblemOut(rows(out)[0]);
}

async function findSimilarProblem(title) {
  const all = rows(await client.from(TABLES.problems).select('id, title, status').not('status', 'in', '("rejected","closed")').limit(1000));
  const wa = new Set(String(title).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  for (const p of all) {
    const wb = new Set(String(p.title).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const inter = [...wa].filter((w) => wb.has(w)).length;
    if (inter >= 4 && inter >= Math.max(wa.size, wb.size) * 0.5) return p;
  }
  return null;
}

async function listProblems(filters = {}) {
  let q = client.from(TABLES.problems).select('*, users(name)');
  if (filters.publicOnly) q = q.not('status', 'eq', 'rejected');
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.district) q = q.eq('district', filters.district);
  if (filters.reviewable) q = q.in('status', ['submitted', 'under_review', 'info_needed']);
  if (filters.adoptable) q = q.eq('status', 'approved');
  if (filters.q) q = q.or('title.ilike.%' + filters.q + '%,description.ilike.%' + filters.q + '%');
  const desc = !(filters.sort === 'votes');
  q = q.order(filters.sort === 'votes' ? 'votes' : 'created_at', { ascending: desc ? false : true }).limit(500);
  return rows(await q).map(mapProblemOut);
}

async function findProblemById(id) {
  return mapProblemOut(first(await client.from(TABLES.problems).select('*, users(name)').eq('id', id).limit(1)));
}

async function findProblemByPublicId(pid) {
  return mapProblemOut(first(await client.from(TABLES.problems).select('*, users(name)').eq('public_id', String(pid).toUpperCase()).limit(1)));
}

async function myProblems(userId) {
  return rows(await client.from(TABLES.problems).select('*, users(name)').eq('user_id', userId).order('created_at', { ascending: false })).map(mapProblemOut);
}

async function updateProblem(id, fields) {
  const out = await client.from(TABLES.problems).update(fields).eq('id', id).select('*, users(name)');
  return mapProblemOut(rows(out)[0]);
}

async function addVote(problemId, userId) {
  const dup = first(await client.from(TABLES.votes).select('id').eq('problem_id', problemId).eq('user_id', userId).limit(1));
  if (dup) return { ok: false, votes: null, message: 'You have already endorsed this problem' };
  await client.from(TABLES.votes).insert([{ problem_id: problemId, user_id: userId }]);
  const p = first(await client.from(TABLES.problems).select('votes').eq('id', problemId));
  await client.from(TABLES.problems).update({ votes: (p.votes || 0) + 1 }).eq('id', problemId);
  const nu = await findProblemById(problemId);
  return { ok: true, votes: nu.votes, message: 'Endorsement recorded' };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
async function addReview(data) {
  const out = await client.from(TABLES.reviews).insert([{
    problem_id: data.problem_id,
    reviewer_id: data.reviewer_id,
    impact: data.impact || 0,
    feasibility: data.feasibility || 0,
    innovation: data.innovation || 0,
    resources: data.resources || 0,
    total: (data.impact || 0) + (data.feasibility || 0) + (data.innovation || 0) + (data.resources || 0),
    decision: data.decision,
    comments: data.comments || '',
  }]).select('*, users(name)').maybeSingle();
  return out.data || out;
}

async function listReviewsByProblem(problemId) {
  return rows(await client.from(TABLES.reviews).select('*, users(name)').eq('problem_id', problemId).order('created_at', { ascending: false }));
}

// ---------------------------------------------------------------------------
// Institutions / Industry
// ---------------------------------------------------------------------------
async function findInstitutionByUserId(userId) {
  return first(await client.from(TABLES.institutions).select('*').eq('user_id', userId).limit(1));
}
async function updateInstitution(userId, fields) {
  return first(await client.from(TABLES.institutions).update(fields).eq('user_id', userId).select('*'));
}
async function listInstitutions() {
  return rows(await client.from(TABLES.institutions).select('*, users(name, email, org_name, district)').limit(500));
}
async function findIndustryByUserId(userId) {
  return first(await client.from(TABLES.industries).select('*').eq('user_id', userId).limit(1));
}
async function updateIndustry(userId, fields) {
  return first(await client.from(TABLES.industries).update(fields).eq('user_id', userId).select('*'));
}
async function listIndustry() {
  return rows(await client.from(TABLES.industries).select('*, users(name, email, org_name)').limit(500));
}

// ---------------------------------------------------------------------------
// Projects (lifecycle)
// ---------------------------------------------------------------------------
async function findProjectForProblem(problemId) {
  return first(await client.from(TABLES.projects).select('*').eq('problem_id', problemId).limit(1));
}

async function enrichProject(p) {
  if (!p) return p;
  const problem = await findProblemById(p.problem_id);
  const inst = first(await client.from(TABLES.institutions).select('*').eq('id', p.institution_id).limit(1));
  const instUser = inst ? await findUserById(inst.user_id) : null;
  const industryUser = p.industry_id ? await findUserById(p.industry_id) : null;
  const milestones = rows(await client.from(TABLES.milestones).select('*').eq('project_id', p.id).order('submitted_at', { ascending: false }));
  return {
    ...p,
    problem,
    institution_name: instUser ? instUser.org_name || instUser.name : null,
    industry_name: industryUser ? industryUser.org_name : null,
    milestones,
  };
}

async function createProject(data) {
  const { count } = await client.from(TABLES.projects).select('*', { count: 'exact', head: true });
  const publicId = makePublicId('PRJ', (count || 0) + 1);
  const out = await client.from(TABLES.projects).insert([{
    public_id: publicId,
    problem_id: data.problem_id,
    institution_id: data.institution_id,
    industry_id: data.industry_id || null,
    title: data.title,
    status: 'assigned',
    mentor_id: data.mentor_id || null,
    team: data.team || [],
    start_date: data.start_date || new Date().toISOString(),
    due_date: data.due_date || null,
  }]).select('*').maybeSingle();
  return enrichProject(out.data || out);
}

async function listProjects(filters = {}) {
  let q = client.from(TABLES.projects).select('*');
  if (filters.institutionId) q = q.eq('institution_id', filters.institutionId);
  if (filters.industryUserId) q = q.eq('industry_id', filters.industryUserId);
  if (filters.status) q = q.eq('status', filters.status);
  q = q.order('created_at', { ascending: false }).limit(200);
  const list = rows(await q);
  const out = [];
  for (const p of list) out.push(await enrichProject(p));
  return out;
}

async function findProjectById(id) {
  const p = first(await client.from(TABLES.projects).select('*').eq('id', id).limit(1));
  return enrichProject(p);
}

async function updateProject(id, fields) {
  const out = await client.from(TABLES.projects).update(fields).eq('id', id).select('*').maybeSingle();
  return enrichProject(out.data || out);
}

async function addMilestone(data) {
  const out = await client.from(TABLES.milestones).insert([{
    project_id: data.project_id,
    title: data.title,
    type: data.type || 'other',
    status: 'submitted',
    due_date: data.due_date || null,
    submitted_at: new Date().toISOString(),
    file_url: data.file_url || null,
    notes: data.notes || '',
  }]).select('*').maybeSingle();
  return out.data || out;
}

async function listMilestones(projectId) {
  return rows(await client.from(TABLES.milestones).select('*').eq('project_id', projectId).order('submitted_at', { ascending: false }));
}

async function addMessage(data) {
  const out = await client.from(TABLES.messages).insert([{
    project_id: data.project_id,
    user_id: data.user_id,
    body: data.body,
  }]).select('*, users(name)').maybeSingle();
  return out.data || out;
}

async function listMessages(projectId) {
  return rows(await client.from(TABLES.messages).select('*, users(name)').eq('project_id', projectId).order('created_at', { ascending: true }));
}

// ---------------------------------------------------------------------------
// Collaborations
// ---------------------------------------------------------------------------
async function createCollab(data) {
  const out = await client.from(TABLES.collabs).insert([{
    project_id: data.project_id,
    org_id: data.org_id,
    role: data.role || 'industry',
    title: data.title,
    description: data.description || '',
    funding_amount: data.funding_amount || null,
    status: 'pending',
  }]).select('*').maybeSingle();
  return out.data || out;
}

async function listCollabs(filters = {}) {
  let q = client.from(TABLES.collabs).select('*, projects(title)');
  if (filters.orgId) q = q.eq('org_id', filters.orgId);
  if (filters.projectId) q = q.eq('project_id', filters.projectId);
  return rows(await q.order('created_at', { ascending: false }));
}

// ---------------------------------------------------------------------------
// Audit logs + stats
// ---------------------------------------------------------------------------
async function addAuditLog(data) {
  await client.from(TABLES.audit).insert([{
    user_id: data.user_id || null,
    action: data.action || '',
    entity: data.entity || '',
    entity_id: data.entity_id || null,
    ip: data.ip || null,
    meta: data.meta || {},
  }]);
  return null;
}

async function listAuditLogs(limit = 100) {
  return rows(await client.from(TABLES.audit).select('*, users(name)').order('created_at', { ascending: false }).limit(limit));
}

async function getStats() {
  const problems = await listProblems({ publicOnly: true });
  const projects = await listProjects({});
  const users = await listUsers();
  return computeStats(problems, projects, users);
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
