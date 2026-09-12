/**
 * JanSetu – small generic helpers
 */
const crypto = require('crypto');

function randId() {
  return crypto.randomUUID();
}

/** Strip HTML tags / script injections / dangerous schemes from user text */
function sanitizeText(value, maxLen = 4000) {
  let s = String(value == null ? '' : value);
  // Remove null bytes and control characters
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');
  // Neutralize dangerous URI schemes (javascript:, data:, vbscript:)
  s = s.replace(/(?:javascript|vbscript|data):/gi, '');
  // Recursively strip HTML and script tags to defeat nested bypasses (e.g. <<script>script>)
  let prev;
  do {
    prev = s;
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
         .replace(/<[^>]*>/g, '');
  } while (s !== prev);
  // Neutralize remaining angle brackets and trim
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
  return s.slice(0, maxLen);
}

function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[\/\?<>\\:\*\|"]/g, '')
    .replace(/\.\.+/g, '.')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
}

function sanitizeQuery(q) {
  return String(q || '').replace(/['";\(\)\\%]/g, '').trim().slice(0, 100);
}

function isStrongPassword(p) {
  if (typeof p !== 'string') return false;
  if (p.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(p);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p);
  return hasLetter && hasNumberOrSymbol;
}

function makePublicId(prefix, seq) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

function nowIso() {
  return new Date().toISOString();
}

/** Safe JSON parse */
function parseJson(v, fallback = null) {
  if (v == null) return fallback;
  try {
    return JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

/** Normalise an array of tags/strings */
function asStringArray(v, max = 12) {
  if (Array.isArray(v)) return v.map((s) => sanitizeText(s, 40)).slice(0, max);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => sanitizeText(s, 40)).filter(Boolean).slice(0, max);
  return [];
}

/** Validate + parse floats for lat/lng */
function toFloat(v, min, max) {
  const n = parseFloat(v);
  if (Number.isFinite(n) && n >= min && n <= max) return n;
  return null;
}

/** Email regex */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9]{10,13}$/;

function isEmail(v) { return EMAIL_RE.test(v); }
function isPhone(v) { return PHONE_RE.test(String(v).replace(/[\s-]/g, '')); }

module.exports = {
  randId,
  sanitizeText,
  sanitizeFilename,
  sanitizeQuery,
  isStrongPassword,
  makePublicId,
  nowIso,
  parseJson,
  asStringArray,
  toFloat,
  isEmail,
  isPhone,
};