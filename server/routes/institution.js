/**
 * JanSetu – Institution (HEI) routes.
 * Profile, adoptable bank, adopt, project team/milestones.
 */
const express = require('express');
const store = require('../data/store');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { sanitizeText, asStringArray } = require('../utils/helpers');

const router = express.Router();

router.use(authMw.attachUser, authMw.requireRole('institution', 'admin'));

// GET /api/institution/me
router.get('/me', asyncHandler(async (req, res) => {
  const profile = await store.findInstitutionByUserId(req.user.id);
  res.json({ profile, user: req.user });
}));

// PUT /api/institution/me  – profile update
router.put('/me', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const upd = {};
  if (body.domain_tags !== undefined) upd.domain_tags = asStringArray(body.domain_tags);
  if (body.city !== undefined) upd.city = sanitizeText(body.city, 120);
  if (body.district !== undefined) upd.district = sanitizeText(body.district, 120);
  if (body.reg_no !== undefined) upd.reg_no = sanitizeText(body.reg_no, 80);
  if (body.about !== undefined) upd.about = sanitizeText(body.about, 2000);
  const profile = await store.updateInstitution(req.user.id, upd);
  audit(req, 'institution_profile_update', 'institution', profile ? profile.id : null, {});
  res.json({ profile });
}));

// GET /api/institution/bank – adoptable (approved) problems
router.get('/bank', asyncHandler(async (req, res) => {
  const problems = await store.listProblems({ adoptable: true });
  res.json(problems);
}));

// POST /api/institution/adopt/:problemId
router.post('/adopt/:problemId', asyncHandler(async (req, res) => {
  const problem = await store.findProblemById(req.params.problemId);
  if (!problem) return res.status(404).json({ error: 'Problem not found.' });
  if (problem.status !== 'approved') return res.status(400).json({ error: 'Only approved problems can be adopted.' });
  const profile = await store.findInstitutionByUserId(req.user.id);
  if (!profile) return res.status(400).json({ error: 'Institute profile not found.' });
  const existing = await store.findProjectForProblem(problem.id);
  if (existing) return res.status(409).json({ error: 'This problem already has a project assigned.' });

  const project = await store.createProject({
    problem_id: problem.id,
    institution_id: profile.id,
    industry_id: null,
    title: problem.title,
    mentor_id: req.user.id,
    team: asStringArray(req.body.team),
  });
  await store.updateProblem(problem.id, { status: 'assigned' });
  audit(req, 'problem_adopt', 'project', project.id, { problem: problem.public_id });
  res.status(201).json({ project, message: 'Problem adopted! Project created.' });
}));

// GET /api/institution/projects
router.get('/projects', asyncHandler(async (req, res) => {
  const profile = await store.findInstitutionByUserId(req.user.id);
  if (!profile) return res.json([]);
  const projects = await store.listProjects({ institutionId: profile.id });
  res.json(projects);
}));

module.exports = router;