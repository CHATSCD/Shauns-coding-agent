import crypto from 'crypto';

const VERCEL_API = 'https://api.vercel.com';

/**
 * Deploy a small set of static files as a brand-new Vercel project/deployment
 * on the team in VERCEL_TEAM_ID, targeting production. Used by the OneJob Site Factory
 * build pipeline to publish one one-pager per lead — separate from
 * triggerVercelDeploy() below, which redeploys *this* agent app via its own
 * deploy hook.
 *
 * @param {string} slug - desired project name (already slugified)
 * @param {{path: string, content: string, encoding?: 'utf-8'|'base64'}[]} files
 * @returns {Promise<{ok: true, url: string, deploymentUrl: string, projectName: string, deploymentId: string} | {ok: false, error: string}>}
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

    const deploymentUrl = `https://${data.url}`;
    const projectName = data.name || slug;
    const projectId = data.projectId || projectName;

    // New projects can default to Vercel Authentication (SSO), which puts the
    // site behind a login. OneJob one-pagers must be public.
    await disableSsoProtection(projectId, token, teamId);

    // Use the project's own *.vercel.app domain (Vercel may shorten long
    // names), never the team-scoped `<project>-<team-slug>.vercel.app` alias.
    const publicHost =
      (await getProjectVercelDomain(projectId, token, teamId)) ||
      pickPublicAlias(data.alias, projectName) ||
      (await pollForAlias(data.id, projectName, token, teamId)) ||
      `${projectName}.vercel.app`;

    return {
      ok: true,
      url: `https://${publicHost}`,
      deploymentUrl,
      projectName,
      deploymentId: data.id,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function disableSsoProtection(projectId, token, teamId) {
  try {
    await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}?teamId=${teamId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssoProtection: null }),
    });
  } catch {
    // non-fatal — the URL check downstream will surface a protected site
  }
}

async function getProjectVercelDomain(projectId, token, teamId) {
  try {
    const res = await fetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains?teamId=${teamId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const hosts = (d.domains || [])
      .map((x) => x?.name || '')
      .filter((h) => h.endsWith('.vercel.app'));
    if (!hosts.length) return null;
    return hosts.sort((a, b) => a.length - b.length)[0];
  } catch {
    return null;
  }
}

// Pick the public production alias (e.g. `<project>.vercel.app`), not the
// SSO-protected per-deployment / team-scoped hosts (`...-shauns.vercel.app`).
function pickPublicAlias(aliases, projectName) {
  if (!Array.isArray(aliases) || !aliases.length) return null;
  const hosts = aliases
    .map((a) => (typeof a === 'string' ? a : a?.domain || a?.alias || ''))
    .map((h) => h.replace(/^https?:\/\//, ''))
    .filter(Boolean);
  const exact = hosts.find((h) => h === `${projectName}.vercel.app`);
  if (exact) return exact;
  const candidates = hosts.filter((h) => !h.includes('-shauns'));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.length - b.length)[0];
}

async function pollForAlias(deploymentId, projectName, token, teamId, timeoutMs = 60000) {
  if (!deploymentId) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}?teamId=${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        const host = pickPublicAlias(d.alias, projectName);
        if (host && (d.readyState === 'READY' || d.aliasAssigned)) return host;
        if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') return host || null;
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
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
