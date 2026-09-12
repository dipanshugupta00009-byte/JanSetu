/**
 * JanSetu – Project lifecycle routes (shared by institution / industry / admin).
 * Kanban status updates, milestone submission, per-project comms thread.
 */
const express = require('express');
const store = require('../data/store');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { sanitizeText } = require('../utils/helpers');

const router = express.Router();

const STATUS_FLOW = ['assigned', 'in_progress', 'piloted', 'deployed', 'closed'];

router.use(authMw.attachUser, authMw.requireRole('institution', 'industry', 'admin', 'evaluator'));

// GET /api/projects?mine=1
router.get('/', asyncHandler(async (req, res) => {
  let filters = {};
  if (req.query.mine === '1') {
    if (req.user.role === 'admin' || req.user.role === 'evaluator') filters = {};
    else if (req.user.role === 'institution') {
      const profile = await store.findInstitutionByUserId(req.user.id);
      if (!profile) return res.json([]);
      filters = { institutionId: profile.id };
    } else if (req.user.role === 'industry') {
      filters = { industryUserId: req.user.id };
    }
  }
  if (req.query.status) filters.status = req.query.status;
  const projects = await store.listProjects(filters);
  res.json(projects);
}));

// GET /api/projects/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const project = await store.findProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const messages = await store.listMessages(project.id);
  const collabs = await store.listCollabs({ projectId: project.id });
  res.json({ project, messages, collabs });
}));

// PATCH /api/projects/:id/status
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const project = await store.findProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const next = req.body.status;
  if (!STATUS_FLOW.includes(next)) return res.status(400).json({ error: 'Invalid status.' });
  // Authorization: institutions can move their own project; admin/evaluator any
  const profile = req.user.role === 'institution' ? await store.findInstitutionByUserId(req.user.id) : null;
  if (req.user.role === 'institution' && profile && project.institution_id !== profile.id) {
    return res.status(403).json({ error: 'You can only update your own projects.' });
  }
  const updated = await store.updateProject(project.id, { status: next });
  await store.updateProblem(project.problem_id, { status: next });
  audit(req, 'project_status', 'project', project.id, { from: project.status, to: next });
  res.json({ project: updated, message: `Project moved to ${next}.` });
}));

// POST /api/projects/:id/milestones
router.post('/:id/milestones', asyncHandler(async (req, res) => {
  const project = await store.findProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const title = sanitizeText(req.body.title, 200);
  if (!title) return res.status(400).json({ error: 'Milestone title required.' });
  const milestone = await store.addMilestone({
    project_id: project.id,
    title,
    type: sanitizeText(req.body.type, 40) || 'other',
    due_date: req.body.due_date || null,
    file_url: req.body.file_url ? sanitizeText(req.body.file_url, 500) : null,
    notes: sanitizeText(req.body.notes, 2000),
  });
  audit(req, 'milestone_submit', 'milestone', milestone.id, { project: project.public_id });
  res.status(201).json({ milestone, message: 'Milestone submitted.' });
}));

// POST /api/projects/:id/messages
router.post('/:id/messages', asyncHandler(async (req, res) => {
  const project = await store.findProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const body = sanitizeText(req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
  const message = await store.addMessage({ project_id: project.id, user_id: req.user.id, body });
  res.status(201).json({ message });
}));

module.exports = router;