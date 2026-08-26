import { Octokit } from 'octokit';

let octokit;

function getOctokit() {
  if (!octokit) {
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokit;
}

export async function pushFileToGitHub(filePath, content, commitMessage = "AI update") {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!process.env.GITHUB_TOKEN || !owner || !repo) {
    return "❌ Error: GITHUB_TOKEN / GITHUB_REPO_OWNER / GITHUB_REPO_NAME are not configured on the server.";
  }

  try {
    // Get existing file's SHA if it exists
    let sha = null;
    try {
      const { data } = await getOctokit().repos.getContent({ owner, repo, path: filePath });
      sha = data.sha;
    } catch (e) {
      if (e.status !== 404) {
        throw e; // real error (auth, permissions, etc.) — don't silently ignore it
      }
      // 404 means the file doesn't exist yet – okay
    }

    // Encode content to base64 (GitHub requires it)
    const encoded = Buffer.from(content).toString('base64');

    await getOctokit().repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: encoded,
      sha: sha || undefined,
    });

    return `✅ File ${filePath} pushed to GitHub.`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}
