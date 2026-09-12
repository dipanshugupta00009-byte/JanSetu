/**
 * JanSetu – data layer selector.
 * Uses the Supabase store when configured, else the in-memory demo store.
 */
const supabase = require('../config/supabase');

let store;
if (supabase.isConfigured()) {
  store = require('./supabaseStore');
} else {
  store = require('./memory');
}

store.isSupabase = supabase.isConfigured();
module.exports = store;