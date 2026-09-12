/**
 * JanSetu – Supabase client
 * When SUPABASE_URL + SUPABASE_SERVICE_KEY are configured the app persists
 * everything to Supabase Postgres. Otherwise the server runs in DEMO mode
 * using an in-memory store (great for local preview / Render without DB).
 */
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const configured =
  Boolean(env.SUPABASE_URL) && Boolean(env.SUPABASE_SERVICE_KEY);

let client = null;
if (configured) {
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  console.log('[DB] Connected to Supabase at', env.SUPABASE_URL);
} else {
  console.log('[DB] Supabase not configured — running in DEMO (in-memory) mode.');
}

module.exports = {
  client,
  isConfigured: () => configured,
  s3: client, // alias for convenience
};