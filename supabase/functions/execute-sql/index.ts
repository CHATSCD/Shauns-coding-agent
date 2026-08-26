// supabase/functions/execute-sql/index.ts
//
// Runs arbitrary SQL against the project's Postgres database. Because this
// is effectively an unrestricted SQL execution endpoint, it must only be
// callable by our own server (which holds the service-role key) — never by
// a browser or anything holding just the anon/publishable key, which is
// meant to be public. The bearer token is checked against
// SUPABASE_SERVICE_ROLE_KEY, not merely validated as "some" JWT.
import { Pool } from "jsr:@db/postgres@^0";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sql } = await req.json();
    if (!sql || typeof sql !== "string") {
      return new Response(JSON.stringify({ error: "No SQL provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_DB_URL is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const pool = new Pool(dbUrl, 1, true);
    const connection = await pool.connect();
    try {
      const result = await connection.queryObject(sql);
      return new Response(
        JSON.stringify({ success: true, rows: result.rows }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } finally {
      connection.release();
      await pool.end();
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
