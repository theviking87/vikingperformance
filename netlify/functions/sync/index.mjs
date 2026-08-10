const GH_API = 'https://api.github.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function config() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = process.env.GITHUB_DATA_PATH || 'data/viking_backup.json';
  const branch = process.env.GITHUB_BRANCH || '';
  if (!token || !owner || !repo) throw new Error('Faltam GITHUB_TOKEN, GITHUB_OWNER ou GITHUB_REPO no Netlify.');
  return { token, owner, repo, path, branch };
}

async function github(path, options = {}) {
  const { token } = config();
  const res = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data.message || `GitHub respondeu ${res.status}`);
  return data;
}

function repoPath() {
  const { owner, repo, path } = config();
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function verifyRepository() {
  const { owner, repo } = config();
  try {
    return await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  } catch (e) {
    if (String(e.message).includes('404')) {
      throw new Error(`GitHub não encontrou o repositório '${owner}/${repo}'. Confirma GITHUB_OWNER e GITHUB_REPO e se o token tem acesso a este repositório.`);
    }
    throw e;
  }
}

async function readRemote() {
  await verifyRepository();
  try {
    const file = await github(repoPath());
    const raw = Buffer.from(file.content || '', 'base64').toString('utf8');
    const payload = JSON.parse(raw);
    return {
      exists: true,
      updatedAt: payload.updatedAt || file.commit?.committer?.date || '',
      stores: payload.stores || payload.data || payload,
      sha: file.sha,
    };
  } catch (e) {
    if (String(e.message).includes('404')) return { exists: false, updatedAt: '', stores: null, sha: null };
    throw e;
  }
}

export default async (req) => {
  try {
    if (req.method === 'GET') {
      const remote = await readRemote();
      return json({ exists: remote.exists, updatedAt: remote.updatedAt, stores: remote.stores });
    }

    if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

    const body = await req.json();
    if (!body || !body.stores || typeof body.stores !== 'object') {
      return json({ error: 'Payload de sincronização inválido.' }, 400);
    }

    const current = await readRemote();
    const updatedAt = new Date().toISOString();
    const payload = JSON.stringify({
      version: 1,
      app: 'VIKING Performance',
      updatedAt,
      stores: body.stores,
    }, null, 2);

    const { owner, repo, path, branch } = config();
    const target = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    const putBody = {
      message: `VIKING sync ${updatedAt}`,
      content: Buffer.from(payload, 'utf8').toString('base64'),
      ...(current.sha ? { sha: current.sha } : {}),
      ...(branch ? { branch } : {}),
    };

    const result = await github(target, { method: 'PUT', body: JSON.stringify(putBody) });
    return json({ ok: true, updatedAt, sha: result.content?.sha || null });
  } catch (e) {
    console.error('VIKING sync error:', e);
    return json({ error: e.message || 'Erro interno de sincronização.' }, 500);
  }
};
