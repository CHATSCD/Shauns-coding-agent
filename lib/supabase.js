// Runs SQL via the `execute-sql` Supabase Edge Function (see
// supabase/functions/execute-sql/index.ts), which is the only way to run
// arbitrary SQL — PostgREST itself doesn't allow it. The Edge Function
// only accepts requests authenticated with the service-role key, so that
// key is sent here and must never be exposed to a browser.
export async function runSql(sql) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return "❌ Error: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured on the server.";
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/execute-sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Edge function returned status ${response.status}`);
    }
    return `✅ SQL executed: ${JSON.stringify(data.rows ?? [])}`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}
