/**
 * JanSetu – Evaluator routes.
 * Review queue, structured scoring, approve/reject/request-info workflow.
 * Only users with role 'evaluator' or 'admin' can act.
 */
const express = require('express');
const store = require('../data/store');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { sanitizeText } = require('../utils/helpers');

const router = express.Router();

router.use(authMw.attachUser, authMw.requireRole('evaluator', 'admin'));

// GET /api/evaluator/queue
router.get('/queue', asyncHandler(async (req, res) => {
  const problems = await store.listProblems({ reviewable: true });
  res.json(problems);
}));

// POST /api/evaluator/review/:problemId
router.post('/review/:problemId', asyncHandler(async (req, res) => {
  const problem = await store.findProblemById(req.params.problemId);
  if (!problem) return res.status(404).json({ error: 'Problem not found.' });
  if (['closed', 'rejected'].includes(problem.status)) {
    return res.status(400).json({ error: 'This problem has already been finalised.' });
  }

  const impact = Math.min(5, Math.max(0, parseInt(req.body.impact, 10) || 0));
  const feasibility = Math.min(5, Math.max(0, parseInt(req.body.feasibility, 10) || 0));
  const innovation = Math.min(5, Math.max(0, parseInt(req.body.innovation, 10) || 0));
  const resources = Math.min(5, Math.max(0, parseInt(req.body.resources, 10) || 0));
  const decision = ['approve', 'reject', 'request_info', 'escalate'].includes(req.body.decision) ? req.body.decision : 'request_info';
  const comments = sanitizeText(req.body.comments, 2000);

  const review = await store.addReview({
    problem_id: problem.id,
    reviewer_id: req.user.id,
    impact, feasibility, innovation, resources,
    decision,
    comments,
  });

  const statusMap = { approve: 'approved', reject: 'rejected', request_info: 'info_needed', escalate: 'info_needed' };
  const updated = await store.updateProblem(problem.id, { status: statusMap[decision] });
  audit(req, 'problem_review', 'problem', problem.id, { decision, total: review.total });
  res.json({ review, problem: updated, message: decision === 'approve' ? 'Problem approved and now visible in the adoptable bank.' : 'Decision recorded.' });
}));

module.exports = router;