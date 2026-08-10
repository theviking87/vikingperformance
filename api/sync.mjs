const FILE_PATH = "data/viking_backup.json";

const env = (name, fallback = "") => process.env[name] || fallback;

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function ghHeaders(token, raw = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: raw
      ? "application/vnd.github.raw+json"
      : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "VIKING-Vercel-Sync"
  };
}

function repoUrl() {
  const owner = env("GITHUB_OWNER", "theviking87");
  const repo = env("GITHUB_REPO", "vikingperformance");

  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

async function github(url, options = {}) {
  const token = env("GITHUB_TOKEN");

  if (!token) {
    throw Object.assign(
      new Error("GITHUB_TOKEN não está configurado na Vercel."),
      { status: 500 }
    );
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...ghHeaders(token, options.raw === true),
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  const text = await res.text();

  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(
        body?.message ||
        text ||
        `GitHub HTTP ${res.status}`
      ),
      { status: res.status }
    );
  }

  return { body, text };
}

async function readRemote() {
  const branch = env("GITHUB_BRANCH", "main");

  const url =
    `${repoUrl()}/contents/${FILE_PATH}` +
    `?ref=${encodeURIComponent(branch)}`;

  try {
    const result = await github(url, {
      raw: true,
      headers: {
        Accept: "application/vnd.github.raw+json"
      }
    });

    let data;

    try {
      data = JSON.parse(result.text);
    } catch {
      throw Object.assign(
        new Error(
          "O backup existente no GitHub não contém JSON válido."
        ),
        { status: 409 }
      );
    }

    return {
      exists: true,
      data
    };

  } catch (e) {
    if (e.status === 404) {
      return {
        exists: false,
        data: null
      };
    }

    throw e;
  }
}

async function getSha() {
  const branch = env("GITHUB_BRANCH", "main");

  const url =
    `${repoUrl()}/contents/${FILE_PATH}` +
    `?ref=${encodeURIComponent(branch)}`;

  try {
    const result = await github(url);

    return result.body?.sha || null;

  } catch (e) {
    if (e.status === 404) {
      return null;
    }

    throw e;
  }
}

async function saveRemote(stores, version) {
  const branch = env("GITHUB_BRANCH", "main");

  const url =
    `${repoUrl()}/contents/${FILE_PATH}`;

  const sha = await getSha();

  const payload = {
    version: version ?? 1,
    updatedAt: new Date().toISOString(),
    stores:
      stores && typeof stores === "object"
        ? stores
        : {}
  };

  const content = Buffer
    .from(
      JSON.stringify(payload, null, 2),
      "utf8"
    )
    .toString("base64");

  const body = {
    message: "VIKING: sincronização cloud",
    content,
    branch
  };

  if (sha) {
    body.sha = sha;
  }

  const result = await github(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return {
    ok: true,
    updatedAt: payload.updatedAt,
    path:
      result.body?.content?.path ||
      FILE_PATH
  };
}

/* =========================
   GET
========================= */

export function GET(request) {
  return handleRequest("GET", request);
}

/* =========================
   POST
========================= */

export function POST(request) {
  return handleRequest("POST", request);
}

/* =========================
   HANDLER
========================= */

async function handleRequest(method, request) {

  try {

    if (method === "GET") {

      const remote = await readRemote();

      if (!remote.exists) {

        return json({
          exists: false,
          stores: null,
          version: null,
          updatedAt: null
        });

      }

      const payload = remote.data;

      const stores =
        payload?.stores &&
        typeof payload.stores === "object"
          ? payload.stores
          : payload;

      return json({
        exists: true,
        stores,
        version: payload?.version ?? 1,
        updatedAt: payload?.updatedAt ?? null
      });
    }

    if (method === "POST") {

      let body;

      try {
        body = await request.json();
      } catch {

        return json(
          {
            error:
              "Pedido POST não contém JSON válido."
          },
          400
        );
      }

      if (!body || typeof body !== "object") {

        return json(
          {
            error: "Payload inválido."
          },
          400
        );
      }

      const result = await saveRemote(
        body.stores ?? {},
        body.version ?? 1
      );

      return json(result);
    }

    return json(
      {
        error: "Método não suportado."
      },
      405
    );

  } catch (error) {

    console.error(
      "VIKING Vercel sync error:",
      error
    );

    const status =
      Number.isInteger(error?.status) &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500;

    return json(
      {
        error:
          error?.message ||
          "Erro de sincronização."
      },
      status
    );
  }
}
