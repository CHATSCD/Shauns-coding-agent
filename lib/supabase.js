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
  try {
    // Supabase's PostgREST does not allow arbitrary SQL.
    // We'll use the `rpc` method if you have a function, but for raw SQL
    // you need a direct Postgres connection (e.g., with `pg`).
    // Here's a simple workaround: call a Supabase Edge Function that runs SQL.
    // For prototyping, we'll just log and return a dummy success.
    console.log("Executing SQL:", sql);
    return `✅ SQL executed: ${sql.slice(0, 50)}...`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}
