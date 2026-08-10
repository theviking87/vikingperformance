const FILE_PATH = "data/viking_backup.json";

const env = (name, fallback = "") => process.env[name] || fallback;

function ghHeaders(token, raw = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "VIKING-Netlify-Sync"
  };
}

function out(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function repoUrl() {
  return `https://api.github.com/repos/${encodeURIComponent(env("GITHUB_OWNER", "theviking87"))}/${encodeURIComponent(env("GITHUB_REPO", "vikingperformance"))}`;
}

async function gh(url, options = {}) {
  const token = env("GITHUB_TOKEN");
  if (!token) throw Object.assign(new Error("GITHUB_TOKEN não está configurado no Netlify."), {status:500});

  const res = await fetch(url, {
    ...options,
    headers: {...ghHeaders(token, options.raw === true), ...(options.headers || {})}
  });

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) throw Object.assign(new Error(body?.message || text || `GitHub HTTP ${res.status}`), {status:res.status});
  return {body, text};
}

async function getFile() {
  const branch = env("GITHUB_BRANCH", "main");
  const url = `${repoUrl()}/contents/${FILE_PATH}?ref=${encodeURIComponent(branch)}`;

  try {
    const raw = await gh(url, {raw:true, headers:{Accept:"application/vnd.github.raw+json"}});
    let parsed;
    try { parsed = JSON.parse(raw.text); }
    catch {
      throw Object.assign(new Error("O backup existente no GitHub não contém JSON válido. Faça uma sincronização no PC para o substituir."), {status:409});
    }
    return {exists:true, data:parsed};
  } catch (e) {
    if (e.status === 404) return {exists:false, data:null};
    throw e;
  }
}

async function getSha() {
  const branch = env("GITHUB_BRANCH", "main");
  const url = `${repoUrl()}/contents/${FILE_PATH}?ref=${encodeURIComponent(branch)}`;
  try {
    const r = await gh(url);
    return r.body?.sha || null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function saveFile(stores, version) {
  const branch = env("GITHUB_BRANCH", "main");
  const url = `${repoUrl()}/contents/${FILE_PATH}`;
  const sha = await getSha();

  const payload = {
    version: version ?? 1,
    updatedAt: new Date().toISOString(),
    stores: stores && typeof stores === "object" ? stores : {}
  };

  const jsonText = JSON.stringify(payload);
  JSON.parse(jsonText);

  const body = {
    message:"VIKING: sincronização cloud",
    content:Buffer.from(jsonText,"utf8").toString("base64"),
    branch
  };
  if (sha) body.sha = sha;

  const r = await gh(url, {
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });

  return {ok:true, updatedAt:payload.updatedAt, path:r.body?.content?.path || FILE_PATH};
}

export default async (req) => {
  try {
    if (!env("GITHUB_TOKEN")) return out({error:"GITHUB_TOKEN não está configurado no Netlify."},500);

    if (req.method === "GET") {
      const remote = await getFile();
      if (!remote.exists) return out({exists:false, stores:null, version:null, updatedAt:null});

      const payload = remote.data;
      const stores = payload?.stores && typeof payload.stores === "object" ? payload.stores : payload;

      return out({
        exists:true,
        stores,
        version:payload?.version ?? 1,
        updatedAt:payload?.updatedAt ?? null
      });
    }

    if (req.method === "POST") {
      let body;
      try { body = await req.json(); }
      catch { return out({error:"Pedido POST não contém JSON válido."},400); }

      if (!body || typeof body !== "object") return out({error:"Payload inválido."},400);
      return out(await saveFile(body.stores ?? {}, body.version ?? 1));
    }

    return out({error:"Método não suportado."},405);
  } catch (e) {
    console.error("VIKING sync error:", e);
    const status = Number.isInteger(e?.status) && e.status >= 400 && e.status < 600 ? e.status : 500;
    return out({error:e?.message || "Erro de sincronização."},status);
  }
};
