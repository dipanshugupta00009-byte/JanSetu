/**
 * JanSetu – Industry partner routes.
 * Profile, browse bank, submit collaboration offer on a project (CSR co-funding).
 */
const express = require('express');
const store = require('../data/store');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { sanitizeText, asStringArray } = require('../utils/helpers');

const router = express.Router();

router.use(authMw.attachUser, authMw.requireRole('industry', 'admin'));

// GET /api/industry/me
router.get('/me', asyncHandler(async (req, res) => {
  const profile = await store.findIndustryByUserId(req.user.id);
  res.json({ profile, user: req.user });
}));

// PUT /api/industry/me
router.put('/me', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const upd = {};
  if (body.capabilities !== undefined) upd.capabilities = asStringArray(body.capabilities);
  if (body.interest_sectors !== undefined) upd.interest_sectors = asStringArray(body.interest_sectors);
  if (body.funding_program !== undefined) upd.funding_program = sanitizeText(body.funding_program, 200);
  if (body.about !== undefined) upd.about = sanitizeText(body.about, 2000);
  const profile = await store.updateIndustry(req.user.id, upd);
  audit(req, 'industry_profile_update', 'industry', profile ? profile.id : null, {});
  res.json({ profile });
}));

// GET /api/industry/active-projects – projects available for collaboration
router.get('/active-projects', asyncHandler(async (req, res) => {
  const projects = await store.listProjects({});
  res.json(projects.filter((p) => ['assigned', 'in_progress', 'piloted'].includes(p.status)));
}));

// POST /api/industry/collaborate/:projectId
router.post('/collaborate/:projectId', asyncHandler(async (req, res) => {
  const project = await store.findProjectById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const profile = await store.findIndustryByUserId(req.user.id);
  if (!profile) return res.status(400).json({ error: 'Company profile not found.' });

  const amount = Math.max(0, parseInt(req.body.funding_amount, 10) || 0);
  const collab = await store.createCollab({
    project_id: project.id,
    org_id: profile.id,
    role: 'industry',
    title: sanitizeText(req.body.title, 200) || 'Collaboration offer',
    description: sanitizeText(req.body.description, 2000),
    funding_amount: amount || null,
  });
  audit(req, 'collab_offer', 'collab', collab.id, { project: project.public_id });
  res.status(201).json({ collab, message: 'Collaboration offer sent to the institution.' });
}));

// GET /api/industry/collabs – my collaboration offers
router.get('/collabs', asyncHandler(async (req, res) => {
  const profile = await store.findIndustryByUserId(req.user.id);
  if (!profile) return res.json([]);
  const collabs = await store.listCollabs({ orgId: profile.id });
  res.json(collabs);
}));

module.exports = router;