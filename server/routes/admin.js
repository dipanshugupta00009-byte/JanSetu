/**
 * JanSetu – Admin routes (analytics, users, reviews, logs, exports).
 */
const express = require('express');
const store = require('../data/store');
const { CATEGORIES } = require('../utils/categories');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');

const router = express.Router();

router.use(authMw.attachUser, authMw.requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await store.getStats();
  stats.categories = CATEGORIES;
  res.json(stats);
}));

// GET /api/admin/problems
router.get('/problems', asyncHandler(async (req, res) => {
  const problems = await store.listProblems({});
  res.json(problems);
}));

// GET /api/admin/users
router.get('/users', asyncHandler(async (req, res) => {
  const users = await store.listUsers();
  const safe = users.map((u) => {
    const { password_hash, ...rest } = u;
    return rest;
  });
  res.json(safe);
}));

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const role = String(req.body.role || '');
  if (!['citizen', 'evaluator', 'institution', 'industry', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  const user = await store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const updated = await store.updateUser(user.id, { role });
  audit(req, 'user_role_change', 'user', user.id, { role });
  res.json({ user: updated });
}));

// GET /api/admin/reviews
router.get('/reviews', asyncHandler(async (req, res) => {
  const problems = await store.listProblems({});
  const out = [];
  for (const p of problems) {
    const reviews = await store.listReviewsByProblem(p.id);
    if (reviews.length) out.push({ problem: { id: p.public_id, title: p.title, status: p.status }, reviews });
  }
  res.json(out);
}));

// GET /api/admin/audit-logs
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const logs = await store.listAuditLogs(200);
  res.json(logs);
}));

// GET /api/admin/export.csv
router.get('/export.csv', asyncHandler(async (req, res) => {
  const problems = await store.listProblems({});
  const rows = problems.map((p) => [
    p.public_id, p.title, p.category, p.status, p.district || '', p.votes || 0,
    new Date(p.created_at).toISOString(),
  ]);
  const header = ['public_id', 'title', 'category', 'status', 'district', 'votes', 'created_at'];
  // Construct CSV with unquoted header to satisfy test expectation, rows remain quoted for safety.
  const csvHeader = header.join(',');
  const csvRows = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [csvHeader, ...csvRows].join('\r\n');
  audit(req, 'export_csv', 'system', null, { rows: rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="jansetu-export.csv"');
  res.send(csv);
}));

module.exports = router;