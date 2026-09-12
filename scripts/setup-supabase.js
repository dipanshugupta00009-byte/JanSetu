/**
 * JanSetu – Optional Supabase setup helper.
 * Creates tables by running supabase/schema.sql against your Supabase
 * Postgres. Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in the environment.
 *
 * Usage:  node scripts/setup-supabase.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || '';
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env first.');
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

// The schema is intentionally designed to be re-runnable (CREATE TABLE IF NOT EXISTS)
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
(async () => {
  const { error } = await client.rpc('exec_sql', { sql });

  if (error) {
    // supabase_public.exec_sql may not exist – fall back to the SQL editor message
    console.error('[setup] Could not auto-run SQL. Error:', error.message);
    console.log('Please paste supabase/schema.sql into your Supabase SQL Editor and run it there.');
    process.exit(1);
  }
  console.log('[setup] Schema applied successfully.');

  // Finally seed the demo content through the app boot itself (npm start).
  console.log('[setup] Done. Start the server with `npm start` to auto-seed demo data.');
})().catch((err) => {
  console.error('[setup] Failed:', err);
  process.exit(1);
});