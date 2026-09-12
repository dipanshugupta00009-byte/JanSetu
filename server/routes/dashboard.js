/**
 * JanSetu – Citizen dashboard routes.
 * My submissions, status tracker, and profile.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../data/store');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { sanitizeText, isStrongPassword } = require('../utils/helpers');

const router = express.Router();

router.use(authMw.attachUser, authMw.requireRole('citizen', 'evaluator', 'institution', 'industry'));

// GET /api/dashboard/my-problems
router.get('/my-problems', asyncHandler(async (req, res) => {
  const problems = await store.myProblems(req.user.id);
  res.json(problems);
}));

// GET /api/dashboard/me
router.get('/me', asyncHandler(async (req, res) => {
  const extra = {};
  if (req.user.role === 'institution') extra.profile = await store.findInstitutionByUserId(req.user.id);
  if (req.user.role === 'industry') extra.profile = await store.findIndustryByUserId(req.user.id);
  res.json({ user: req.user, ...extra });
}));

// PATCH /api/dashboard/me
router.patch('/me', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const upd = {};
  if (body.name) upd.name = sanitizeText(body.name, 120);
  if (body.district) upd.district = sanitizeText(body.district, 120);
  if (['hi', 'en', 'sat'].includes(body.language)) upd.language = body.language;
  const user = await store.updateUser(req.user.id, upd);
  audit(req, 'profile_update', 'user', user.id, {});
  res.json({ user });
}));

// PATCH /api/dashboard/password
router.patch('/password', asyncHandler(async (req, res) => {
  const oldPass = String(req.body.old_password || '');
  const newPass = String(req.body.new_password || '');
  if (!bcrypt.compareSync(oldPass, req.user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  if (!isStrongPassword(newPass)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters and contain letters and numbers/symbols.' });
  }
  const user = await store.updateUser(req.user.id, { password_hash: bcrypt.hashSync(newPass, 10) });
  audit(req, 'password_change', 'user', user.id, {});
  res.json({ user, message: 'Password updated successfully.' });
}));

module.exports = router;