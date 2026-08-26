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
