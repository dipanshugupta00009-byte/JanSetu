/**
 * JanSetu – Authentication routes
 * Public: register, login (email/phone), admin login, me, logout.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../data/store');
const env = require('../config/env');
const { asyncHandler, audit } = require('../middleware/handlers');
const authMw = require('../middleware/auth');
const { isEmail, isGmail, isPhone, sanitizeText, isStrongPassword } = require('../utils/helpers');
const { sendEmailVerificationOtp } = require('../utils/mailer');
const crypto = require('crypto');

const router = express.Router();
const emailChallenges = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;

// Gmail-only rule: every account email must end with @gmail.com
const GMAIL_ONLY_ERROR = 'Only Gmail addresses ending with @gmail.com are accepted.';

function hashOtp(email, code) {
  return crypto.createHash('sha256').update(email + ':' + code + ':' + env.JWT_SECRET).digest('hex');
}

function validOtp(email, code) {
  const challenge = emailChallenges.get(email);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) return false;
  challenge.attempts += 1;
  const actual = Buffer.from(hashOtp(email, code), 'hex');
  const expected = Buffer.from(challenge.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// Google Sign-in (Sign in with Google / Gmail – direct Gmail connection option)
// ---------------------------------------------------------------------------

// GET /api/auth/google/config – tells the frontend whether Google sign-in is enabled
router.get('/google/config', (req, res) => {
  res.json({ enabled: Boolean(env.GOOGLE_CLIENT_ID), client_id: env.GOOGLE_CLIENT_ID || '' });
});

// POST /api/auth/send-otp – send a short-lived email verification code
router.post('/send-otp', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!isGmail(email)) {
    return res.status(400).json({ error: GMAIL_ONLY_ERROR });
  }
  if (await store.findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Please login.' });
  }

  // Cooldown rate limit (30s per email)
  const prev = emailChallenges.get(email);
  if (prev && prev.sentAt && (Date.now() - prev.sentAt < 30000)) {
    const remainingSec = Math.ceil((30000 - (Date.now() - prev.sentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${remainingSec}s before requesting a new code.` });
  }

  const code = String(crypto.randomInt(100000, 1000000));
  emailChallenges.set(email, { hash: hashOtp(email, code), expiresAt: Date.now() + OTP_TTL_MS, sentAt: Date.now(), attempts: 0 });
  try {
    const result = await sendEmailVerificationOtp(email, code);
    if (result && result.devMode) {
      return res.json({
        message: `Verification code generated! (Dev code: ${code})`,
        devOtp: code,
      });
    }
  } catch (e) {
    emailChallenges.delete(email);
    return res.status(500).json({ error: 'Failed to send verification code: ' + e.message });
  }
  res.json({ message: 'A verification code was sent to your email address.' });
}));

// Verify a Google ID token server-side (never trust the client alone)
async function verifyGoogleToken(credential) {
  if (!credential || typeof credential !== 'string' || credential.length > 8192) {
    throw new Error('Missing Google sign-in token. Please try again.');
  }
  let res;
  try {
    res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { headers: { Accept: 'application/json' } });
  } catch (e) {
    throw new Error('Unable to reach Google for verification. Check your internet connection.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody && (errBody.error_description || errBody.error)) || 'Google rejected the sign-in token. Please try again.');
  }
  const info = await res.json();
  const verified = info.email_verified === 'true' || info.email_verified === true || info.email_verified === 1;

  if (!info || !info.email || !verified) throw new Error('Google did not return a verified email address.');
  if (env.GOOGLE_CLIENT_ID) {
    const validAud = info.aud === env.GOOGLE_CLIENT_ID || info.azp === env.GOOGLE_CLIENT_ID;
    if (!validAud) throw new Error('Google token client mismatch. Please refresh the page and try again.');
  }
  const exp = Number(info.exp || 0);
  if (exp && exp * 1000 < Date.now()) throw new Error('Google sign-in token has expired. Please try again.');
  return info;
}

// POST /api/auth/google – Sign in / register with a Google (Gmail) account
router.post('/google', asyncHandler(async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google sign-in has not been configured on this server yet.' });
  }
 
  let info;
  try {
    info = await verifyGoogleToken(String(req.body.credential || '').trim());
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
 
  const email = String(info.email || '').toLowerCase().trim();
  if (!isEmail(email)) return res.status(400).json({ error: 'Google returned an invalid email address.' });
  if (!isGmail(email)) return res.status(400).json({ error: GMAIL_ONLY_ERROR });
 
  const name = sanitizeText(info.name || email.split('@')[0] || 'Google User', 120);
  let user = await store.findUserByEmail(email);
 
  if (!user) {
    // New visitor – create a Citizen account with an unusable password (Google handles auth)
    const randomHash = bcrypt.hashSync(crypto.randomUUID() + ':' + Date.now(), 10);
    const lang = ['hi', 'en', 'sat'].includes(req.body.language) ? req.body.language : 'hi';
    try {
      user = await store.createUser({
        name: name || 'Google User',
        email: email,
        phone: null,
        password_hash: randomHash,
        role: 'citizen',
        org_name: null,
        district: null,
        language: lang,
      });
    } catch (e) {
      if (e && e.code === '23505') {
        user = await store.findUserByEmail(email);
        if (!user) return res.status(409).json({ error: 'An account with this Gmail address already exists. Please login.' });
      } else {
        throw e;
      }
    }
    if (user) audit(req, 'register_google', 'user', user.id, { email });
  }
 
  await store.updateUser(user.id, { last_login: new Date().toISOString() });
  authMw.saveSession(res, user);
  audit(req, 'login_google', 'user', user.id, { email });
  res.json({ user: publicUser(user), message: 'Signed in with Google!' });
}));

function publicUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = sanitizeText(body.name, 120);
  const role = ['citizen', 'evaluator', 'institution', 'industry'].includes(body.role) ? body.role : 'citizen';
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').replace(/[\s-]/g, '');
  const password = String(body.password || '');
  const org_name = sanitizeText(body.org_name, 200);
  const district = sanitizeText(body.district, 120);
  const language = ['hi', 'en', 'sat'].includes(body.language) ? body.language : 'hi';

  if (!name) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!isGmail(email)) {
    return res.status(400).json({ error: GMAIL_ONLY_ERROR });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and contain letters and numbers/symbols.' });
  }
  if (await store.findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Please login.' });
  }
  if (phone && (await store.findUserByPhone(phone))) {
    return res.status(409).json({ error: `An account with mobile number ${phone} already exists. Leave it blank or use another number.` });
  }
  if ((role === 'institution' || role === 'industry') && !org_name) {
    return res.status(400).json({ error: 'Organisation name is required for this role.' });
  }
  if (!validOtp(email, String(body.otp || '').trim())) {
    return res.status(400).json({ error: 'Please verify your email with the valid OTP before creating your account.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = await store.createUser({
    name, email: email || null, phone: phone || null,
    password_hash: passwordHash, role, org_name, district, language,
  });
  authMw.saveSession(res, user);
  if (email) emailChallenges.delete(email);
  audit(req, 'register', 'user', user.id, { role });
  res.status(201).json({ user: publicUser(user), message: 'Registration successful!' });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const login = String(req.body.login || req.body.email || req.body.phone || '').trim();
  const password = String(req.body.password || '');
  if (!login || !password) return res.status(400).json({ error: 'Login ID and password are required.' });

  const user = await store.findUserByLogin(login);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    audit(req, 'login_failure', 'user', null, { login: sanitizeText(login, 60) });
    return res.status(401).json({ error: 'Invalid credentials. Please check and try again.' });
  }
  await store.updateUser(user.id, { last_login: new Date().toISOString() });
  authMw.saveSession(res, user);
  audit(req, 'login', 'user', user.id, { loginType: login.includes('@') ? 'email' : 'phone' });
  res.json({ user: publicUser(user) });
}));

// POST /api/auth/admin-login
router.post('/admin-login', asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    audit(req, 'admin_login_failure', 'system', null, { username: sanitizeText(username, 60) });
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  let admin = await store.findUserByLogin(username);
  if (!admin) {
    const passwordHash = bcrypt.hashSync(password, 10);
    admin = await store.createUser({
      name: 'District Administrator', email: username, password_hash: passwordHash,
      role: 'admin', org_name: 'JanSetu Administration', district: 'Ranchi', language: 'en',
    });
  }
  await store.updateUser(admin.id, { last_login: new Date().toISOString() });
  authMw.saveSession(res, admin);
  audit(req, 'admin_login', 'user', admin.id, {});
  res.json({ user: publicUser(admin) });
}));

// GET /api/auth/me
router.get('/me', authMw.attachUser, asyncHandler(async (req, res) => {
  res.json({ authed: req.isAuthed, user: publicUser(req.user) });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(env.COOKIE_NAME);
  res.clearCookie(env.CSRF_COOKIE);
  res.json({ ok: true });
});

module.exports = router;
