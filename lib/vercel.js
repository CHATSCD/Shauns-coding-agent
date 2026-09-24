import crypto from 'crypto';

const VERCEL_API = 'https://api.vercel.com';

/**
 * Deploy a small set of static files as a brand-new Vercel project/deployment
 * on team `shauns`, targeting production. Used by the OneJob Site Factory
 * build pipeline to publish one one-pager per lead — separate from
 * triggerVercelDeploy() below, which redeploys *this* agent app via its own
 * deploy hook.
 *
 * @param {string} slug - desired project name (already slugified)
 * @param {{path: string, content: string, encoding?: 'utf-8'|'base64'}[]} files
 * @returns {Promise<{ok: true, url: string, projectName: string, deploymentId: string} | {ok: false, error: string}>}
 */
export async function deployStaticSite(slug, files) {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) return { ok: false, error: 'VERCEL_TOKEN is not configured on the server.' };
  if (!teamId) return { ok: false, error: 'VERCEL_TEAM_ID is not configured on the server.' };

  try {
    const body = {
      name: slug,
      target: 'production',
      projectSettings: { framework: null },
      files: files.map((f) => ({
        file: f.path,
        data: f.content,
        encoding: f.encoding || 'utf-8',
      })),
    };

    const res = await fetch(`${VERCEL_API}/v13/deployments?teamId=${teamId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `Vercel API returned ${res.status}` };
    }

    return {
      ok: true,
      url: `https://${data.url}`,
      projectName: data.name,
      deploymentId: data.id,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Vercel project names must be unique per team — if `slug` is already taken
// by an unrelated project, suffix it deterministically from the lead's
// phone number so re-running a batch is idempotent (same lead -> same slug)
// while two different businesses that share a name don't collide.
export function uniqueSlug(baseSlug, disambiguator) {
  if (!disambiguator) return baseSlug;
  const hash = crypto.createHash('sha1').update(disambiguator).digest('hex').slice(0, 6);
  return `${baseSlug}-${hash}`;
}

export async function triggerVercelDeploy() {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK;
  if (!hookUrl) {
    return "❌ Error: VERCEL_DEPLOY_HOOK is not configured on the server.";
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      return `❌ Error: Vercel deploy hook returned status ${res.status}.`;
    }
    return "✅ Vercel deployment triggered.";
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}
