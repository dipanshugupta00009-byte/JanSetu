/**
 * JanSetu – Environment configuration
 * Loads .env with safe defaults. All secrets are exposed via env.
 */
require('dotenv').config();
const crypto = require('crypto');

const env = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD: (process.env.NODE_ENV || 'development') === 'production',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '12h',

  ADMIN_USERNAME: (process.env.ADMIN_USERNAME || 'admin').trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Jansetu@2024',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'media',

// Google Sign-in (Sign in with Google / Gmail – direct Gmail connection option)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  APP_URL: process.env.APP_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 3000}`,
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  UPLOAD_DIR: require('path').join(__dirname, '..', '..', 'uploads'),
};

// Warn if the JWT secret is still the insecure default in production
if (env.IS_PROD && env.JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.warn('[SECURITY] JWT_SECRET not set in production! Using insecure default.');
}

// Session cookie name
env.COOKIE_NAME = 'janstoken';
env.CSRF_COOKIE = 'jancsrf';

module.exports = env;