import { Octokit } from 'octokit';

let octokit;

function getOctokit() {
  if (!octokit) {
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokit;
}

export async function createGithubRepo(name, { description, private: isPrivate = false } = {}) {
  const owner = process.env.GITHUB_REPO_OWNER;

  if (!process.env.GITHUB_TOKEN || !owner) {
    return "❌ Error: GITHUB_TOKEN / GITHUB_REPO_OWNER are not configured on the server.";
  }
  if (!name || typeof name !== "string") {
    return "❌ Error: A repository name is required.";
  }

  const client = getOctokit();

  try {
    // GITHUB_REPO_OWNER may be an org or a personal account — the API call
    // to create a repo differs between the two, so check which it is first.
    let isOrg = false;
    try {
      await client.rest.orgs.get({ org: owner });
      isOrg = true;
    } catch (e) {
      if (e.status !== 404) {
        throw e;
      }
    }

    const { data } = isOrg
      ? await client.rest.repos.createInOrg({ org: owner, name, description, private: isPrivate })
      : await client.rest.repos.createForAuthenticatedUser({ name, description, private: isPrivate });

    return `✅ Repository created: ${data.full_name} (${data.html_url})`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}

export async function pushFileToGitHub(filePath, content, commitMessage = "AI update", repo, owner) {
  const targetOwner = owner || process.env.GITHUB_REPO_OWNER;
  const targetRepo = repo || process.env.GITHUB_REPO_NAME;

  if (!process.env.GITHUB_TOKEN || !targetOwner || !targetRepo) {
    return "❌ Error: GITHUB_TOKEN / GITHUB_REPO_OWNER / GITHUB_REPO_NAME are not configured on the server.";
  }

  try {
    // Get existing file's SHA if it exists
    let sha = null;
    try {
      const { data } = await getOctokit().repos.getContent({ owner: targetOwner, repo: targetRepo, path: filePath });
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
      owner: targetOwner,
      repo: targetRepo,
      path: filePath,
      message: commitMessage,
      content: encoded,
      sha: sha || undefined,
    });

    return `✅ File ${filePath} pushed to ${targetOwner}/${targetRepo}.`;
  } catch (error) {
    return `❌ Error: ${error.message}`;
  }
}
