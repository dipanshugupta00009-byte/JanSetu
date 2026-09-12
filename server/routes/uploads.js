/**
 * JanSetu – Media uploads (photos/videos/documents).
 * Requires auth; files stored under ./uploads and served from /uploads.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const env = require('../config/env');
const authMw = require('../middleware/auth');
const { asyncHandler, audit } = require('../middleware/handlers');

const router = express.Router();

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const { sanitizeFilename } = require('../utils/helpers');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.pdf']);
const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const original = sanitizeFilename(file.originalname || '');
  const parts = original.split('.').filter(Boolean);
  if (parts.length > 2) {
    return cb(new Error('Files with multiple extensions are not allowed for security reasons.'));
  }
  const ext = path.extname(original).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension "${ext}" is not permitted. Only images (jpg/png/webp/gif), video (mp4/webm), or PDF are allowed.`));
  }
  if (MIME_MAP[ext] !== file.mimetype) {
    return cb(new Error('File extension does not match its declared content type.'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

// Simple upload (AJAX-friendly, accepts one file per call)
router.post('/', authMw.attachUser, authMw.requireAnyRole, asyncHandler(async (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const url = `/uploads/${req.file.filename}`;
    const safeOriginal = sanitizeFilename(req.file.originalname);
    audit(req, 'file_upload', 'file', req.file.filename, { size: req.file.size, original: safeOriginal });
    res.status(201).json({ url, originalname: safeOriginal, size: req.file.size });
  });
}));

module.exports = router;