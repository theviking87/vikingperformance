const FILE_PATH = "data/viking_backup.json";

const env = (name, fallback = "") => process.env[name] || fallback;

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "VIKING-Netlify-Sync"
  };
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function github(url, options = {}) {
  const token = env("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN não configurado no Netlify.");

  const res = await fetch(url, {
    ...options,
    headers: { ...headers(token), ...(options.headers || {}) }
  });

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const err = new Error(body?.message || text || `GitHub HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

function repoUrl() {
  return `https://api.github.com/repos/${encodeURIComponent(env("GITHUB_OWNER", "theviking87"))}/${encodeURIComponent(env("GITHUB_REPO", "vikingperformance"))}`;
}

async function getRemoteFile() {
  const branch = env("GITHUB_BRANCH", "main");
  const url = `${repoUrl()}/contents/${FILE_PATH}?ref=${encodeURIComponent(branch)}`;

  try {
    const file = await github(url);
    const raw = Buffer.from((file.content || "").replace(/\s/g, ""), "base64").toString("utf8");
    return { exists: true, data: JSON.parse(raw), sha: file.sha };
  } catch (e) {
    // On the first sync the JSON file does not exist yet. GitHub returns 404.
    if (e.status === 404) return { exists: false, data: null, sha: null };
    throw e;
  }
}

async function saveRemote(stores, version) {
  const branch = env("GITHUB_BRANCH", "main");
  const url = `${repoUrl()}/contents/${FILE_PATH}`;

  let sha = null;
  try {
    const current = await github(`${url}?ref=${encodeURIComponent(branch)}`);
    sha = current?.sha || null;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const updatedAt = new Date().toISOString();
  const payload = { version: version ?? 1, updatedAt, stores };
  const content = Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");

  const body = {
    message: "VIKING: sincronização cloud",
    content,
    branch
  };
  if (sha) body.sha = sha;

  const result = await github(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return {
    updatedAt,
    path: result?.content?.path || FILE_PATH
  };
}

export default async (req) => {
  try {
    if (!env("GITHUB_TOKEN")) return response({ error: "GITHUB_TOKEN não está configurado." }, 500);

    if (req.method === "GET") {
      const remote = await getRemoteFile();
      if (!remote.exists) return response({ exists: false, stores: null, version: null });

      return response({
        exists: true,
        stores: remote.data?.stores ?? null,
        version: remote.data?.version ?? 1,
        updatedAt: remote.data?.updatedAt ?? null
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      if (!body || typeof body !== "object") return response({ error: "Payload inválido." }, 400);

      const result = await saveRemote(body.stores ?? {}, body.version ?? 1);
      return response({ ok: true, updatedAt: result.updatedAt, path: result.path });
    }

    return response({ error: "Método não suportado." }, 405);
  } catch (e) {
    console.error("VIKING sync error:", e);
    const status = Number.isInteger(e?.status) && e.status >= 400 && e.status < 600 ? e.status : 500;
    return response({ error: e?.message || "Erro de sincronização." }, status);
  }
};
