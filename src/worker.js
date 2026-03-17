const CONFIG_KEY = "router-config";

const DEFAULT_CONFIG = {
  endpoints: [],
  activeEndpointId: null,
  updatedAt: null,
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type, authorization, x-admin-token",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/api/health") {
      return withCors(jsonResponse(await buildHealthPayload(env)));
    }

    if (url.pathname === "/api/config") {
      if (request.method === "GET") {
        return withCors(jsonResponse(await buildConfigPayload(env)));
      }
      if (request.method === "PUT") {
        const denied = requireAdmin(request, env);
        if (denied) {
          return withCors(denied);
        }
        return withCors(await handleConfigWrite(request, env));
      }
      return withCors(methodNotAllowed(["GET", "PUT"]));
    }

    if (url.pathname.startsWith("/api/endpoints/") && url.pathname.endsWith("/activate")) {
      if (request.method !== "POST") {
        return withCors(methodNotAllowed(["POST"]));
      }
      const denied = requireAdmin(request, env);
      if (denied) {
        return withCors(denied);
      }
      return withCors(await handleActivateEndpoint(url.pathname, env));
    }

    if (url.pathname === "/api/proxy-info") {
      const config = await loadConfig(env);
      const active = getActiveEndpoint(config);
      return withCors(
        jsonResponse({
          activeEndpoint: active,
          proxyBaseUrl: `${url.origin}/modal`,
        })
      );
    }

    if (url.pathname === "/modal" || url.pathname.startsWith("/modal/")) {
      return withCors(await proxyToActiveEndpoint(request, env, url));
    }

    return env.ASSETS.fetch(request);
  },
};

async function buildHealthPayload(env) {
  const config = await loadConfig(env);
  return {
    ok: true,
    endpointCount: config.endpoints.length,
    activeEndpoint: getActiveEndpoint(config),
    updatedAt: config.updatedAt,
  };
}

async function buildConfigPayload(env) {
  const config = await loadConfig(env);
  return {
    ...config,
    activeEndpoint: getActiveEndpoint(config),
  };
}

function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function methodNotAllowed(allowedMethods) {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      allow: allowedMethods.join(", "),
    },
  });
}

function requireAdmin(request, env) {
  const configuredSecret = (env.DASHBOARD_ADMIN_TOKEN || "").trim();
  if (!configuredSecret) {
    return null;
  }
  const bearer = request.headers.get("authorization") || "";
  const bearerToken = bearer.replace(/^Bearer\s+/i, "").trim();
  const directToken = (request.headers.get("x-admin-token") || "").trim();
  const candidate = directToken || bearerToken;
  if (candidate && timingSafeEqual(candidate, configuredSecret)) {
    return null;
  }
  return new Response("Unauthorized", { status: 401 });
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function loadConfig(env) {
  const raw = await env.MODAL_ROUTER_KV.get(CONFIG_KEY, "json");
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_CONFIG);
  }
  const endpoints = Array.isArray(raw.endpoints)
    ? raw.endpoints.map(normalizeEndpoint).filter(Boolean)
    : [];
  const activeEndpointId =
    typeof raw.activeEndpointId === "string" && raw.activeEndpointId.trim()
      ? raw.activeEndpointId.trim()
      : endpoints[0]?.id || null;
  return {
    endpoints,
    activeEndpointId,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

async function saveConfig(env, config) {
  const normalizedEndpoints = config.endpoints.map(normalizeEndpoint).filter(Boolean);
  const normalized = {
    endpoints: normalizedEndpoints,
    activeEndpointId:
      normalizedEndpoints.some((endpoint) => endpoint.id === config.activeEndpointId) &&
      normalizedEndpoints.find((endpoint) => endpoint.id === config.activeEndpointId)?.enabled
        ? config.activeEndpointId
        : normalizedEndpoints.find((endpoint) => endpoint.enabled)?.id || null,
    updatedAt: new Date().toISOString(),
  };
  await env.MODAL_ROUTER_KV.put(CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

async function handleConfigWrite(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }
  const endpoints = Array.isArray(payload?.endpoints) ? payload.endpoints : null;
  if (!endpoints) {
    return jsonResponse({ error: "O campo endpoints deve ser uma lista." }, { status: 400 });
  }
  const normalizedEndpoints = [];
  for (const endpoint of endpoints) {
    try {
      normalizedEndpoints.push(normalizeEndpoint(endpoint));
    } catch (error) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }
  }
  const saved = await saveConfig(env, {
    endpoints: normalizedEndpoints,
    activeEndpointId: typeof payload.activeEndpointId === "string" ? payload.activeEndpointId : null,
  });
  return jsonResponse({
    ok: true,
    ...saved,
    activeEndpoint: getActiveEndpoint(saved),
  });
}

async function handleActivateEndpoint(pathname, env) {
  const match = pathname.match(/^\/api\/endpoints\/([^/]+)\/activate$/);
  const endpointId = match?.[1];
  if (!endpointId) {
    return jsonResponse({ error: "Endpoint invalido." }, { status: 400 });
  }
  const config = await loadConfig(env);
  const target = config.endpoints.find((endpoint) => endpoint.id === endpointId);
  if (!target) {
    return jsonResponse({ error: "Endpoint nao encontrado." }, { status: 404 });
  }
  if (!target.enabled) {
    return jsonResponse({ error: "O endpoint esta desabilitado." }, { status: 400 });
  }
  const saved = await saveConfig(env, {
    ...config,
    activeEndpointId: endpointId,
  });
  return jsonResponse({
    ok: true,
    activeEndpoint: getActiveEndpoint(saved),
    updatedAt: saved.updatedAt,
  });
}

function normalizeEndpoint(endpoint) {
  const id = String(endpoint?.id || crypto.randomUUID()).trim();
  const name = String(endpoint?.name || "").trim();
  const notes = String(endpoint?.notes || "").trim();
  const enabled = endpoint?.enabled !== false;
  const url = normalizeUrl(endpoint?.url || "");
  if (!id) {
    throw new Error("Cada endpoint precisa de um id.");
  }
  if (!name) {
    throw new Error("Cada endpoint precisa de um nome.");
  }
  if (!url) {
    throw new Error(`O endpoint "${name}" precisa de uma URL valida.`);
  }
  return { id, name, url, notes, enabled };
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const url = new URL(raw);
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function getActiveEndpoint(config) {
  const preferred = config.endpoints.find(
    (endpoint) => endpoint.id === config.activeEndpointId && endpoint.enabled
  );
  return preferred || config.endpoints.find((endpoint) => endpoint.enabled) || null;
}

async function proxyToActiveEndpoint(request, env, url) {
  const config = await loadConfig(env);
  const active = getActiveEndpoint(config);
  if (!active) {
    return jsonResponse({ error: "Nenhum endpoint ativo configurado." }, { status: 503 });
  }

  const upstreamUrl = new URL(active.url);
  const relativePath = url.pathname.replace(/^\/modal\/?/, "");
  upstreamUrl.pathname = joinPath(upstreamUrl.pathname, relativePath);
  upstreamUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
  headers.set("x-projectmdl-endpoint-id", active.id);
  headers.set("x-projectmdl-endpoint-name", active.name);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.set("x-projectmdl-endpoint-id", active.id);
  responseHeaders.set("x-projectmdl-endpoint-name", active.name);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

function joinPath(basePath, extraPath) {
  const left = String(basePath || "/").replace(/\/+$/, "");
  const right = String(extraPath || "").replace(/^\/+/, "");
  if (!right) {
    return left || "/";
  }
  if (!left || left === "/") {
    return `/${right}`;
  }
  return `${left}/${right}`;
}
