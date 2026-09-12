/**
 * JanSetu – Express application entry point.
 * Security: helmet, rate limiting, httpOnly cookies, CSRF, audit logging.
 * Serves the public/ frontend and the /api endpoints.
 */
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const env = require('./config/env');
const store = require('./data/store');
const authMw = require('./middleware/auth');
const handlers = require('./middleware/handlers');

const authRoutes = require('./routes/auth');
const problemRoutes = require('./routes/problems');
const evaluatorRoutes = require('./routes/evaluator');
const institutionRoutes = require('./routes/institution');
const industryRoutes = require('./routes/industry');
const projectRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const publicRoutes = require('./routes/public');
const uploadRoutes = require('./routes/uploads');

const app = express();
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Security headers (strict CSP + nosniff + deny framing)
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://unpkg.com", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: true,
}));

// Additional HTTP security headers
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=()');
  next();
});

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Trust Render/LB proxy for correct IPs + secure cookies
// ---------------------------------------------------------------------------
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Rate limiting (defense-in-depth)
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes.' },
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit reached. Please wait a few minutes.' },
});
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many problem submissions. Please try again later.' },
});
const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Endorsement rate limit reached. Please wait.' },
});

app.use('/api', (req, res, next) => (req.path.startsWith('/auth') ? next() : apiLimiter(req, res, next)));
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', loginLimiter);
app.use('/api/auth/admin-login', loginLimiter);
app.use('/api/upload', uploadLimiter);
app.post('/api/problems', submissionLimiter);
app.post('/api/problems/:id/vote', voteLimiter);

// ---------------------------------------------------------------------------
// Static + uploads
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: env.IS_PROD ? '1h' : 0 }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(env.UPLOAD_DIR, { maxAge: '1d' }));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api', authMw.attachUser);
app.use('/api/auth', authMw.csrfProtect, authRoutes);
app.use('/api/problems', authMw.csrfProtect, problemRoutes);
app.use('/api/evaluator', authMw.csrfProtect, evaluatorRoutes);
app.use('/api/institution', authMw.csrfProtect, institutionRoutes);
app.use('/api/industry', authMw.csrfProtect, industryRoutes);
app.use('/api/projects', authMw.csrfProtect, projectRoutes);
app.use('/api/admin', authMw.csrfProtect, adminRoutes);
app.use('/api/dashboard', authMw.csrfProtect, dashboardRoutes);
app.use('/api/public', publicRoutes); // public read-only (no CSRF needed)
app.use('/api/upload', authMw.csrfProtect, uploadRoutes);

// ---------------------------------------------------------------------------
// Health check (Render needs this)
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'jansetu',
    dbMode: store.isSupabase ? 'supabase' : 'demo',
    time: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// SPA fallback (exclude /admin-login.html handle separately if needed)
// ---------------------------------------------------------------------------
app.get(['/', '/index.html', '/report.html', '/track.html', '/problems.html', '/impact.html', '/login.html', '/register.html', '/dashboard.html', '/evaluator.html', '/institution.html', '/industry.html', '/projects.html', '/admin.html', '/admin-login.html', '/profile.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', path.basename(req.path) === '' ? 'index.html' : path.basename(req.path)));
});

// ---------------------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------------------
app.use(handlers.notFound);
app.use(handlers.errorHandler);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  try {
    await store.seedDefaults();
  } catch (e) {
    console.error('[BOOT] Seed error (continuing):', e.message);
  }
  app.listen(env.PORT, () => {
    console.log(`JanSetu server listening on http://localhost:${env.PORT}`);
    console.log(`DB mode: ${store.isSupabase ? 'Supabase (Postgres)' : 'In-memory DEMO'}`);
  });
})();

module.exports = app;