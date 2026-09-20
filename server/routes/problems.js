/**
 * JanSetu – Problem routes.
 * Public bank + detail; submissions require login (citizen/evaluator/institution/industry can report too).
 */
const express = require('express');
const store = require('../data/store');
const { CATEGORIES } = require('../utils/categories');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { sanitizeText, asStringArray, toFloat, isPhone, sanitizeQuery } = require('../utils/helpers');

const router = express.Router();

const PUBLIC_STATUSES = ['approved', 'assigned', 'in_progress', 'piloted', 'deployed', 'closed'];

function listVisible(status) {
  return !status || ['submitted', 'under_review', 'info_needed'].includes(status);
}

// GET /api/problems  (public bank)
router.get('/', asyncHandler(async (req, res) => {
  const filters = {
    publicOnly: true,
    category: req.query.category || null,
    district: req.query.district || null,
    q: req.query.q ? sanitizeQuery(req.query.q) : null,
    sort: req.query.sort || 'recent',
  };
  if (req.query.status && PUBLIC_STATUSES.includes(req.query.status)) filters.status = req.query.status;
  const problems = await store.listProblems(filters);
  res.json(problems);
}));

// GET /api/problems/options  (categories, districts, statuses)
router.get('/options', asyncHandler(async (req, res) => {
  const districts = [
    'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih',
    'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga',
    'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela-Kharsawan', 'Simdega', 'West Singhbhum',
  ];
  const statuses = PUBLIC_STATUSES.concat(['submitted', 'under_review', 'info_needed']);
  res.json({ categories: CATEGORIES, districts, statuses });
}));

// GET /api/problems/:id  (public detail)
router.get('/:id', asyncHandler(async (req, res) => {
  let problem = await store.findProblemByPublicId(req.params.id);
  if (!problem) problem = await store.findProblemById(req.params.id);
  if (!problem) return res.status(404).json({ error: 'Problem not found.' });
  if (problem.status === 'rejected') {
    // Rejected problems are only visible to their owner / admin / evaluator
    if (!req.user || (req.user.id !== problem.user_id && !['admin', 'evaluator'].includes(req.user.role))) {
      return res.status(404).json({ error: 'Problem not found.' });
    }
  }
  const reviews = await store.listReviewsByProblem(problem.id);
  const project = await store.findProjectForProblem(problem.id);
  const similar = problem.duplicate_of ? await store.findProblemById(problem.duplicate_of) : null;
  res.json({ problem, reviews, project: project || null, similar: similar ? { id: similar.public_id, title: similar.title } : null });
}));

// POST /api/problems  (citizen submission)
router.post('/', authMw.attachUser, authMw.requireAnyRole, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = sanitizeText(body.title, 160);
  const description = sanitizeText(body.description, 4000);
  if (title.length < 8) return res.status(400).json({ error: 'Title must be at least 8 characters.' });
  if (description.length < 20) return res.status(400).json({ error: 'Please describe the problem (at least 20 characters).' });

  const lat = toFloat(body.lat, -90, 90);
  const lng = toFloat(body.lng, -180, 180);
  if ((lat && !lng) || (!lat && lng)) {
    return res.status(400).json({ error: 'Both latitude and longitude are needed for a valid location.' });
  }

  const problem = await store.createProblem({
    user_id: req.user.id,
    title,
    description,
    category: body.category,
    tags: asStringArray(body.tags),
    is_anonymous: !!body.is_anonymous,
    location_lat: lat,
    location_lng: lng,
    district: body.district ? sanitizeText(body.district, 120) : null,
    block: body.block ? sanitizeText(body.block, 120) : null,
    village: body.village ? sanitizeText(body.village, 120) : null,
    address: body.address ? sanitizeText(body.address, 300) : null,
    media: Array.isArray(body.media) ? body.media.map((m) => sanitizeText(m, 500)).slice(0, 8) : [],
    language: body.language || 'en',
  });
  if (problem && problem.is_duplicate) {
    audit(req, 'problem_duplicate_count', 'problem', problem.problem.id, { original: problem.problem.public_id, title });
    return res.status(200).json({
      is_duplicate: true,
      duplicate_of: { public_id: problem.problem.public_id, title: problem.problem.title },
      problem: problem.problem,
      message: problem.message,
    });
  }
  audit(req, 'problem_submit', 'problem', problem.id, { title });
  res.status(201).json({
    is_duplicate: false,
    problem,
    message: 'Problem submitted successfully for review.',
  });
}));

// POST /api/problems/:id/vote  (endorse)
router.post('/:id/vote', authMw.attachUser, authMw.requireAnyRole, asyncHandler(async (req, res) => {
  const problem = await store.findProblemByPublicId(req.params.id);
  if (!problem) return res.status(404).json({ error: 'Problem not found.' });
  const result = await store.addVote(problem.id, req.user.id);
  audit(req, 'problem_vote', 'problem', problem.id, {});
  res.json(result);
}));

// GET /api/problems/:id/reviews
router.get('/:id/reviews', authMw.attachUser, asyncHandler(async (req, res) => {
  const problem = await store.findProblemByPublicId(req.params.id) || await store.findProblemById(req.params.id);
  if (!problem) return res.status(404).json({ error: 'Problem not found.' });
  const reviews = await store.listReviewsByProblem(problem.id);
  res.json(reviews);
}));

module.exports = router;