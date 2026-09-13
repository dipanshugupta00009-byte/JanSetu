/**
 * JanSetu – Authentication + authorization middleware.
 * JWT stored in an httpOnly cookie, CSRF double-submit token pattern,
 * bcrypt password verification against the active store.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const store = require('../data/store');

const ROLES = ['citizen', 'evaluator', 'institution', 'industry', 'admin'];

// ---------------------------------------------------------------------------
// Cookie → session
// ---------------------------------------------------------------------------
function signSession(user) {
  return jwt.sign(
    { sid: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY }
  );
}

function saveSession(res, user) {
  const token = signSession(user);
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
  // CSRF token (readable by frontend JS, double-submit)
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie(env.CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure: env.IS_PROD,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
  return csrf;
}

/** Best-effort: pull user from the request cookie */
async function loadUserFromRequest(req) {
  const token = req.cookies && req.cookies[env.COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await store.findUserById(payload.sid);
    return user || null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
function attachUser(req, res, next) {
  if (!req.cookies || !req.cookies[env.CSRF_COOKIE]) {
    refreshCsrf(req, res);
  }
  loadUserFromRequest(req)
    .then((user) => {
      req.user = user;
      req.isAuthed = !!user;
      next();
    })
    .catch(() => {
      req.user = null;
      req.isAuthed = false;
      next();
    });
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied for your role.' });
    }
    next();
  };
}

function requireAnyRole(req, res, next) {
  return requireRole('citizen', 'evaluator', 'institution', 'industry')(req, res, next);
}

// ---------------------------------------------------------------------------
// CSRF protection (skip when authenticated via a non-browser path)
// ---------------------------------------------------------------------------
function csrfProtect(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const header = req.headers['x-csrf-token'];
  const cookie = req.cookies && req.cookies[env.CSRF_COOKIE];
  // When the request is explicitly an API/script call with Authorization header
  if (req.headers.authorization && header) {
    return next();
  }
  // Allow initial unauthenticated login and registration
  if (req.baseUrl === '/api/auth' && ['/login', '/register', '/send-otp', '/admin-login', '/google'].includes(req.path)) {
    if (!cookie || !header || header === cookie) return next();
  }
  if (!header || !cookie || header !== cookie) {
    return res.status(403).json({ error: 'Invalid CSRF token. Refresh the page and try again.' });
  }
  next();
}

function refreshCsrf(req, res) {
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie(env.CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure: env.IS_PROD,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
  return csrf;
}

module.exports = {
  ROLES,
  signSession,
  saveSession,
  refreshCsrf,
  loadUserFromRequest,
  attachUser,
  requireAuth,
  requireRole,
  requireAnyRole,
  csrfProtect,
};