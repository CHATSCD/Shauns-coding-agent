import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function pushFileToGitHub(filePath, content, commitMessage = "AI update") {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  try {
    // Get existing file's SHA if it exists
    let sha = null;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
      sha = data.sha;
    } catch (e) {
      // File doesn't exist yet – okay
    }

    // Encode content to base64 (GitHub requires it)
    const encoded = Buffer.from(content).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
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
