/**
 * JanSetu – generic error handler + audit helper.
 */
const store = require('../data/store');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function audit(req, action, entity, entityId, meta) {
  store.addAuditLog({
    user_id: (req.user && req.user.id) || null,
    action,
    entity: entity || '',
    entity_id: entityId || null,
    ip: req.headers['x-forwarded-for'] || req.ip || null,
    meta: meta || {},
  }).catch(() => {});
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[API ERROR]', err.message || err);
  const status = err.status || err.statusCode || (err.code === 'PGRST116' ? 404 : 500);
  if (res.headersSent) return next(err);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: err.expose ? err.message : 'Server error. Please try again later.',
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { asyncHandler, audit, errorHandler, notFound };