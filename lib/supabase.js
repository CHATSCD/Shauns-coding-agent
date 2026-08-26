import { createClient } from '@supabase/supabase-js';

let supabase;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

export async function runSql(sql) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "❌ Error: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured on the server.";
  }

  try {
    // PostgREST doesn't allow arbitrary SQL directly, so this calls a
    // Postgres function named `exec_sql(query text)` that must exist in
    // the target database (CREATE FUNCTION exec_sql(query text) RETURNS
    // void AS $$ BEGIN EXECUTE query; END; $$ LANGUAGE plpgsql;).
    const { error } = await getSupabase().rpc('exec_sql', { query: sql });
    if (error) {
      return `❌ Error: ${error.message}`;
    }
    return `✅ SQL executed: ${sql.slice(0, 50)}...`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}
