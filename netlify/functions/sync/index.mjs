export default async (req) => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  const result = {
    token_present: Boolean(token),
    token_length: token ? token.length : 0,
    owner: owner || null,
    repo: repo || null,
    branch,
    github_user: null,
    github_user_status: null,
    repository_status: null,
    repository_visible: false,
    error: null
  };

  if (!token) {
    return new Response(JSON.stringify({
      ...result,
      error: "GITHUB_TOKEN não chegou à Function."
    }), {
      status: 500,
      headers: {"Content-Type":"application/json"}
    });
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "VIKING-Netlify-Sync"
  };

  try {
    const userRes = await fetch("https://api.github.com/user", { headers });
    result.github_user_status = userRes.status;

    if (userRes.ok) {
      const user = await userRes.json();
      result.github_user = user.login || null;
    } else {
      const text = await userRes.text();
      result.error = `GitHub /user devolveu HTTP ${userRes.status}: ${text.slice(0, 300)}`;
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {"Content-Type":"application/json"}
      });
    }

    const repoUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const repoRes = await fetch(repoUrl, { headers });
    result.repository_status = repoRes.status;
    result.repository_visible = repoRes.ok;

    if (!repoRes.ok) {
      const text = await repoRes.text();
      result.error = `GitHub /repos devolveu HTTP ${repoRes.status}: ${text.slice(0, 300)}`;
    } else {
      const repository = await repoRes.json();
      result.repository_full_name = repository.full_name || null;
      result.repository_private = repository.private;
    }
  } catch (e) {
    result.error = String(e?.message || e);
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: {"Content-Type":"application/json"}
  });
};
