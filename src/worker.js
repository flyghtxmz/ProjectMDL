const CONFIG_KEY = "router-config";
const REGISTRY_KEY_PREFIX = "registry:endpoint:";
const CATALOG_ENTRY_KEY_PREFIX = "catalog:entry:";
const CATALOG_META_KEY = "catalog:meta";
const CATALOG_SNAPSHOT_KEY = "catalog:snapshot";
const CONTROL_CONFIG_KEY = "control:config";
const MODAL_ACCOUNT_KEY_PREFIX = "modal-account:";
const JOB_KEY_PREFIX = "job:";
const USERS_KEY = "control:users";
const CATALOG_MERGE_PRESERVE_EXISTING = "preserve_existing";
const CATALOG_MERGE_PREFER_INCOMING = "prefer_incoming";
const DEFAULT_GITHUB_OWNER = "flyghtxmz";
const DEFAULT_GITHUB_REPO = "comfyui-catalog";
const DEFAULT_GITHUB_BRANCH = "main";
const DEFAULT_GITHUB_CATALOG_PATH = "catalog.json";
const DEFAULT_STATUS_PATHS = ["/comfyui/status", "/comfyui-modal/status"];
const DEFAULT_ACTIVE_CATALOG_PATHS = [
  "/comfyui/catalog",
  "/comfyui/catalog.json",
  "/comfyui-modal/catalog",
  "/comfyui-modal/catalog.json",
  "/catalog",
];
const ACTIVE_FILE_ROUTE_CONFIG = {
  workflows: {
    label: "workflows",
    listPath: "/comfyui/workflows",
    downloadPath: "/comfyui/workflows/download",
    deletePath: "/comfyui/workflows/delete",
  },
  images: {
    label: "imagens",
    listPath: "/comfyui/files/images",
    downloadPath: "/comfyui/files/download",
    deletePath: "/comfyui/files/delete",
  },
};
const DASHBOARD_PATH_PREFIX = "/dashboard";
const PROXY_SLUG_PREFIX = "cmfy_";
const MAX_RECENT_CATALOG_SYNCS = 12;
const MAX_RECENT_JOBS = 40;

const DEFAULT_CONFIG = {
  endpoints: [],
  activeEndpointId: null,
  updatedAt: null,
};

const DEFAULT_CONTROL_CONFIG = {
  githubOwner: null,
  githubRepo: null,
  githubRef: "main",
  deployWorkflowId: "deploy-modal.yml",
  stopWorkflowId: "stop-modal.yml",
  restartWorkflowId: "restart-modal.yml",
  updatedAt: null,
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type, authorization, x-admin-token, x-registry-token",
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

    if (url.pathname === "/api/control/config") {
      if (request.method === "GET") {
        return withCors(jsonResponse(await loadControlConfig(env)));
      }
      if (request.method === "PUT") {
        return withCors(await handleControlConfigWrite(request, env));
      }
      return withCors(methodNotAllowed(["GET", "PUT"]));
    }

    if (url.pathname === "/api/modal-accounts") {
      if (request.method === "GET") {
        return withCors(jsonResponse(await buildModalAccountsPayload(env)));
      }
      if (request.method === "POST") {
        return withCors(await handleModalAccountWrite(request, env));
      }
      return withCors(methodNotAllowed(["GET", "POST"]));
    }

    if (url.pathname === "/api/users") {
      if (request.method === "GET") {
        return withCors(jsonResponse(await buildUsersPayload(env)));
      }
      if (request.method === "POST") {
        return withCors(await handleUserWrite(request, env));
      }
      return withCors(methodNotAllowed(["GET", "POST"]));
    }

    if (url.pathname.startsWith("/api/users/")) {
      if (request.method !== "DELETE") {
        return withCors(methodNotAllowed(["DELETE"]));
      }
      return withCors(await handleUserDelete(url.pathname, env));
    }

    if (url.pathname.startsWith("/api/modal-accounts/")) {
      if (request.method !== "DELETE") {
        return withCors(methodNotAllowed(["DELETE"]));
      }
      return withCors(await handleModalAccountDelete(url.pathname, env));
    }

    if (url.pathname === "/api/jobs") {
      if (request.method === "GET") {
        return withCors(jsonResponse(await buildJobsPayload(env)));
      }
      if (request.method === "POST") {
        return withCors(await handleJobDispatch(request, env));
      }
      return withCors(methodNotAllowed(["GET", "POST"]));
    }

    if (url.pathname === "/api/catalog") {
      let response;
      if (request.method === "GET") {
        response = withCors(
          jsonResponse(await buildCatalogPayload(env), {
            headers: {
              "cache-control": "no-store",
            },
          })
        );
        logApiRequest(request, url, response);
        return response;
      }
      if (request.method === "PUT") {
        response = withCors(await handleCatalogSave(request, env));
        logApiRequest(request, url, response);
        return response;
      }
      response = withCors(methodNotAllowed(["GET", "PUT"]));
      logApiRequest(request, url, response);
      return response;
    }

    if (url.pathname === "/catalog.json") {
      if (request.method !== "GET") {
        const response = withCors(methodNotAllowed(["GET"]));
        logApiRequest(request, url, response);
        return response;
      }
      const { entries, meta } = await loadCatalog(env);
      const response = withCors(
        jsonResponse(buildCatalogSnapshotData(entries, meta), {
          headers: {
            "cache-control": "no-store",
          },
        })
      );
      logApiRequest(request, url, response);
      return response;
    }

    if (url.pathname === "/api/catalog/save-active") {
      let response;
      if (request.method !== "POST") {
        response = withCors(methodNotAllowed(["POST"]));
        logApiRequest(request, url, response);
        return response;
      }
      response = withCors(await handleActiveCatalogSave(env));
      logApiRequest(request, url, response);
      return response;
    }

    if (url.pathname === "/api/catalog/import") {
      let response;
      if (request.method !== "POST") {
        response = withCors(methodNotAllowed(["POST"]));
        logApiRequest(request, url, response);
        return response;
      }
      response = withCors(await handleCatalogImport(request, env));
      logApiRequest(request, url, response);
      return response;
    }

    const activeFilesMatch = url.pathname.match(
      /^\/api\/active-files\/(workflows|images)(?:\/(download|delete))?$/
    );
    if (activeFilesMatch) {
      const [, fileKind, action = "list"] = activeFilesMatch;
      let response;
      if (action === "list") {
        if (request.method !== "GET") {
          response = withCors(methodNotAllowed(["GET"]));
          logApiRequest(request, url, response);
          return response;
        }
        response = withCors(await handleActiveFilesList(env, fileKind));
        logApiRequest(request, url, response);
        return response;
      }
      if (action === "download") {
        if (request.method !== "GET") {
          response = withCors(methodNotAllowed(["GET"]));
          logApiRequest(request, url, response);
          return response;
        }
        response = withCors(await handleActiveFilesDownload(request, env, fileKind));
        logApiRequest(request, url, response);
        return response;
      }
      if (action === "delete") {
        if (request.method !== "POST") {
          response = withCors(methodNotAllowed(["POST"]));
          logApiRequest(request, url, response);
          return response;
        }
        response = withCors(await handleActiveFilesDelete(request, env, fileKind));
        logApiRequest(request, url, response);
        return response;
      }
    }

    if (url.pathname === "/api/endpoint-statuses") {
      if (request.method !== "GET") {
        return withCors(methodNotAllowed(["GET"]));
      }
      return withCors(jsonResponse(await buildEndpointStatusesPayload(env)));
    }

    if (url.pathname.startsWith("/api/endpoints/") && url.pathname.endsWith("/status")) {
      if (request.method !== "GET") {
        return withCors(methodNotAllowed(["GET"]));
      }
      return withCors(await handleSingleEndpointStatus(url.pathname, env));
    }

    if (url.pathname === "/api/modal-registry/report") {
      if (request.method !== "POST") {
        return withCors(methodNotAllowed(["POST"]));
      }
      const denied = requireRegistryReporter(request, env);
      if (denied) {
        return withCors(denied);
      }
      return withCors(await handleRegistryReport(request, env));
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

    if (url.pathname === DASHBOARD_PATH_PREFIX) {
      return Response.redirect(`${url.origin}${DASHBOARD_PATH_PREFIX}/`, 308);
    }

    if (url.pathname === `${DASHBOARD_PATH_PREFIX}/` || url.pathname.startsWith(`${DASHBOARD_PATH_PREFIX}/`)) {
      return serveDashboardAsset(request, env, url);
    }

    const aliasMatch = matchEndpointAliasPath(url.pathname);
    if (aliasMatch) {
      return proxyToEndpointAlias(request, env, url, aliasMatch);
    }

    return env.ASSETS.fetch(request);
  },
};

async function buildHealthPayload(env) {
  const [config, registryByEndpointId, catalogMeta] = await Promise.all([
    loadConfig(env),
    loadRegistry(env),
    loadCatalogMeta(env),
  ]);
  return {
    ok: true,
    endpointCount: config.endpoints.length,
    activeEndpoint: getActiveEndpoint(config),
    updatedAt: config.updatedAt,
    registryEndpointCount: Object.keys(registryByEndpointId).length,
    catalogEntryCount: Number(catalogMeta.totalEntries || 0),
    catalogLastUpdated: catalogMeta.lastUpdated || null,
  };
}

async function buildConfigPayload(env, config = null) {
  const resolvedConfig = config || (await loadConfig(env));
  const registryByEndpointId = await loadRegistry(env);
  return {
    ...resolvedConfig,
    activeEndpoint: getActiveEndpoint(resolvedConfig),
    registryByEndpointId,
    registryCount: Object.keys(registryByEndpointId).length,
  };
}

async function loadControlConfig(env) {
  const raw = await env.MODAL_ROUTER_KV.get(CONTROL_CONFIG_KEY, "json");
  return normalizeControlConfig(raw);
}

async function saveControlConfig(env, payload) {
  const normalized = normalizeControlConfig(payload);
  normalized.updatedAt = new Date().toISOString();
  await env.MODAL_ROUTER_KV.put(CONTROL_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

async function handleControlConfigWrite(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }
  return jsonResponse(await saveControlConfig(env, payload));
}

function normalizeControlConfig(raw) {
  return {
    githubOwner: normalizeOptionalText(raw?.githubOwner),
    githubRepo: normalizeOptionalText(raw?.githubRepo),
    githubRef: normalizeOptionalText(raw?.githubRef) || DEFAULT_CONTROL_CONFIG.githubRef,
    deployWorkflowId:
      normalizeOptionalText(raw?.deployWorkflowId) || DEFAULT_CONTROL_CONFIG.deployWorkflowId,
    stopWorkflowId:
      normalizeOptionalText(raw?.stopWorkflowId) || DEFAULT_CONTROL_CONFIG.stopWorkflowId,
    restartWorkflowId:
      normalizeOptionalText(raw?.restartWorkflowId) || DEFAULT_CONTROL_CONFIG.restartWorkflowId,
    updatedAt: normalizeOptionalTimestamp(raw?.updatedAt),
  };
}

async function buildModalAccountsPayload(env) {
  return {
    ok: true,
    accounts: await loadModalAccounts(env),
  };
}

async function loadModalAccounts(env) {
  const names = await listKvKeys(env, MODAL_ACCOUNT_KEY_PREFIX);
  if (!names.length) {
    return [];
  }
  const records = await Promise.all(names.map((name) => env.MODAL_ROUTER_KV.get(name, "json")));
  return records
    .map(normalizeModalAccount)
    .filter(Boolean)
    .sort((left, right) => String(left.label || left.key).localeCompare(String(right.label || right.key), "pt-BR", { sensitivity: "base" }));
}

async function handleModalAccountWrite(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }
  let account;
  try {
    account = normalizeModalAccount(payload, { generateKey: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 400 });
  }
  account.updatedAt = new Date().toISOString();
  account.createdAt =
    normalizeOptionalTimestamp(payload?.createdAt) || normalizeOptionalTimestamp(payload?.created_at) || account.updatedAt;
  await env.MODAL_ROUTER_KV.put(modalAccountKvKey(account.key), JSON.stringify(account));
  return jsonResponse({
    ok: true,
    account,
    accounts: await loadModalAccounts(env),
  });
}

async function handleModalAccountDelete(pathname, env) {
  const match = pathname.match(/^\/api\/modal-accounts\/([^/]+)$/);
  const accountKey = decodeURIComponent(match?.[1] || "").trim();
  if (!accountKey) {
    return jsonResponse({ error: "Conta Modal invalida." }, { status: 400 });
  }
  const accounts = await loadModalAccounts(env);
  if (!accounts.some((account) => account.key === accountKey)) {
    return jsonResponse({ error: "Conta Modal nao encontrada." }, { status: 404 });
  }
  const config = await loadConfig(env);
  if (config.endpoints.some((endpoint) => endpoint.modalAccountKey === accountKey)) {
    return jsonResponse(
      { error: "Existe endpoint usando esta conta Modal. Remova ou troque a atribuicao antes." },
      { status: 409 }
    );
  }
  await env.MODAL_ROUTER_KV.delete(modalAccountKvKey(accountKey));
  return jsonResponse({
    ok: true,
    accountKey,
    accounts: await loadModalAccounts(env),
  });
}

function normalizeModalAccount(raw, options = {}) {
  const key = normalizeAccountKey(raw?.key || raw?.accountKey || raw?.account_key);
  const label = normalizeOptionalText(raw?.label) || key;
  if (!key) {
    throw new Error("Cada conta Modal precisa de um account key.");
  }
  return {
    key,
    label,
    githubTokenIdSecretName:
      normalizeOptionalText(raw?.githubTokenIdSecretName) ||
      normalizeOptionalText(raw?.github_token_id_secret_name) ||
      `MODAL_${key.toUpperCase()}_TOKEN_ID`,
    githubTokenSecretSecretName:
      normalizeOptionalText(raw?.githubTokenSecretSecretName) ||
      normalizeOptionalText(raw?.github_token_secret_secret_name) ||
      `MODAL_${key.toUpperCase()}_TOKEN_SECRET`,
    notes: normalizeOptionalText(raw?.notes),
    createdAt:
      normalizeOptionalTimestamp(raw?.createdAt) || normalizeOptionalTimestamp(raw?.created_at),
    updatedAt:
      normalizeOptionalTimestamp(raw?.updatedAt) || normalizeOptionalTimestamp(raw?.updated_at),
  };
}

function normalizeAccountKey(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw || null;
}

function modalAccountKvKey(accountKey) {
  return `${MODAL_ACCOUNT_KEY_PREFIX}${accountKey}`;
}

async function buildUsersPayload(env) {
  return {
    ok: true,
    users: await loadUsers(env),
  };
}

async function loadUsers(env) {
  const raw = await env.MODAL_ROUTER_KV.get(USERS_KEY, "json");
  const users = Array.isArray(raw) ? raw.map(normalizeUser).filter(Boolean) : [];
  return users.sort((left, right) =>
    String(left.name || left.email || left.id).localeCompare(String(right.name || right.email || right.id), "pt-BR", {
      sensitivity: "base",
    })
  );
}

async function saveUsers(env, users) {
  const normalizedUsers = users.map(normalizeUser).filter(Boolean);
  await env.MODAL_ROUTER_KV.put(USERS_KEY, JSON.stringify(normalizedUsers));
  return normalizedUsers;
}

async function handleUserWrite(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }
  let nextUser;
  try {
    nextUser = normalizeUser(payload, { generateId: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 400 });
  }
  const users = await loadUsers(env);
  const remaining = users.filter((user) => user.id !== nextUser.id);
  const savedUsers = await saveUsers(env, [...remaining, nextUser]);
  return jsonResponse({
    ok: true,
    user: nextUser,
    users: savedUsers,
  });
}

async function handleUserDelete(pathname, env) {
  const match = pathname.match(/^\/api\/users\/([^/]+)$/);
  const userId = decodeURIComponent(match?.[1] || "").trim();
  if (!userId) {
    return jsonResponse({ error: "Usuario invalido." }, { status: 400 });
  }
  const users = await loadUsers(env);
  if (!users.some((user) => user.id === userId)) {
    return jsonResponse({ error: "Usuario nao encontrado." }, { status: 404 });
  }
  const config = await loadConfig(env);
  const nextEndpoints = config.endpoints.map((endpoint) =>
    endpoint.assignedUserId === userId ? { ...endpoint, assignedUserId: null } : endpoint
  );
  await saveConfig(env, {
    ...config,
    endpoints: nextEndpoints,
  });
  const savedUsers = await saveUsers(
    env,
    users.filter((user) => user.id !== userId)
  );
  return jsonResponse({
    ok: true,
    userId,
    users: savedUsers,
  });
}

function normalizeUser(raw, options = {}) {
  const id = normalizeOptionalText(raw?.id) || (options.generateId ? crypto.randomUUID() : null);
  const name = normalizeOptionalText(raw?.name);
  const email = normalizeOptionalText(raw?.email);
  if (!id) {
    throw new Error("Cada usuario precisa de um id.");
  }
  if (!name) {
    throw new Error("Cada usuario precisa de um nome.");
  }
  return {
    id,
    name,
    email,
    notes: normalizeOptionalText(raw?.notes),
    role: normalizeOptionalText(raw?.role) || "user",
    createdAt:
      normalizeOptionalTimestamp(raw?.createdAt) ||
      normalizeOptionalTimestamp(raw?.created_at) ||
      new Date().toISOString(),
    updatedAt:
      normalizeOptionalTimestamp(raw?.updatedAt) ||
      normalizeOptionalTimestamp(raw?.updated_at) ||
      new Date().toISOString(),
  };
}

async function buildJobsPayload(env) {
  return {
    ok: true,
    jobs: await loadJobs(env),
  };
}

async function loadJobs(env) {
  const names = await listKvKeys(env, JOB_KEY_PREFIX);
  if (!names.length) {
    return [];
  }
  const records = await Promise.all(names.map((name) => env.MODAL_ROUTER_KV.get(name, "json")));
  return records
    .map(normalizeJobRecord)
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, MAX_RECENT_JOBS);
}

async function handleJobDispatch(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }

  const action = normalizeJobAction(payload?.action);
  if (!action) {
    return jsonResponse({ error: "Acao invalida. Use deploy, stop ou restart." }, { status: 400 });
  }

  const config = await loadConfig(env);
  const endpointId = normalizeOptionalText(payload?.endpointId) || normalizeOptionalText(payload?.endpoint_id);
  const endpoint = config.endpoints.find((candidate) => candidate.id === endpointId);
  if (!endpoint) {
    return jsonResponse({ error: "Endpoint nao encontrado." }, { status: 404 });
  }

  const controlConfig = await loadControlConfig(env);
  const workflowId = resolveJobWorkflowId(action, controlConfig);
  if (!controlConfig.githubOwner || !controlConfig.githubRepo || !workflowId) {
    return jsonResponse(
      { error: "Configure owner, repo e workflow do GitHub antes de disparar jobs." },
      { status: 400 }
    );
  }

  if (!endpoint.modalAccountKey || !endpoint.modalAppName) {
    return jsonResponse(
      { error: "O endpoint precisa ter conta Modal e app name configurados para operar jobs." },
      { status: 400 }
    );
  }

  const modalAccounts = await loadModalAccounts(env);
  const modalAccount = modalAccounts.find((account) => account.key === endpoint.modalAccountKey);
  if (!modalAccount) {
    return jsonResponse({ error: "Conta Modal do endpoint nao encontrada." }, { status: 400 });
  }

  const githubToken = String(env?.GITHUB_ACTIONS_TOKEN || "").trim();
  if (!githubToken) {
    return jsonResponse({ error: "GITHUB_ACTIONS_TOKEN nao configurado." }, { status: 503 });
  }

  const job = {
    id: crypto.randomUUID(),
    action,
    status: "queued",
    endpointId: endpoint.id,
    endpointName: endpoint.name,
    modalAccountKey: endpoint.modalAccountKey,
    modalAccountLabel: modalAccount.label,
    modalAppName: endpoint.modalAppName,
    githubOwner: controlConfig.githubOwner,
    githubRepo: controlConfig.githubRepo,
    githubRef: endpoint.githubRef || controlConfig.githubRef,
    workflowId,
    entryFile: endpoint.entryFile || "comfyui_modal.py",
    requestedByUserId:
      normalizeOptionalText(payload?.requestedByUserId) ||
      normalizeOptionalText(payload?.requested_by_user_id),
    requestedByUserName:
      normalizeOptionalText(payload?.requestedByUserName) ||
      normalizeOptionalText(payload?.requested_by_user_name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dispatchStatus: null,
    dispatchError: null,
  };

  await env.MODAL_ROUTER_KV.put(jobKvKey(job.id), JSON.stringify(job));

  const dispatchUrl = `https://api.github.com/repos/${encodeURIComponent(controlConfig.githubOwner)}/${encodeURIComponent(controlConfig.githubRepo)}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;
  const dispatchBody = {
    ref: endpoint.githubRef || controlConfig.githubRef,
    inputs: {
      job_id: job.id,
      action,
      endpoint_id: endpoint.id,
      endpoint_name: endpoint.name,
      modal_account_key: endpoint.modalAccountKey,
      modal_account_label: modalAccount.label,
      modal_token_id_secret_name: modalAccount.githubTokenIdSecretName,
      modal_token_secret_secret_name: modalAccount.githubTokenSecretSecretName,
      modal_app_name: endpoint.modalAppName,
      entry_file: endpoint.entryFile || "comfyui_modal.py",
      endpoint_url: endpoint.url,
    },
  };

  try {
    const dispatchResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${githubToken}`,
        "content-type": "application/json; charset=utf-8",
        "user-agent": "projectmdl-worker",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify(dispatchBody),
    });
    if (!dispatchResponse.ok) {
      job.status = "failed";
      job.dispatchStatus = dispatchResponse.status;
      job.dispatchError = await readGitHubErrorBody(dispatchResponse);
    } else {
      job.status = "dispatched";
      job.dispatchStatus = dispatchResponse.status;
      job.dispatchedAt = new Date().toISOString();
    }
  } catch (error) {
    job.status = "failed";
    job.dispatchError = error instanceof Error ? error.message : "Falha ao disparar workflow.";
  }

  job.updatedAt = new Date().toISOString();
  await env.MODAL_ROUTER_KV.put(jobKvKey(job.id), JSON.stringify(job));

  return jsonResponse({
    ok: job.status === "dispatched",
    job,
    jobs: await loadJobs(env),
  });
}

function normalizeJobAction(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["deploy", "stop", "restart"].includes(raw) ? raw : null;
}

function resolveJobWorkflowId(action, controlConfig) {
  if (action === "deploy") {
    return controlConfig.deployWorkflowId;
  }
  if (action === "stop") {
    return controlConfig.stopWorkflowId;
  }
  if (action === "restart") {
    return controlConfig.restartWorkflowId || controlConfig.deployWorkflowId;
  }
  return null;
}

function jobKvKey(jobId) {
  return `${JOB_KEY_PREFIX}${jobId}`;
}

function normalizeJobRecord(raw) {
  const id = normalizeOptionalText(raw?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    action: normalizeOptionalText(raw?.action) || "deploy",
    status: normalizeOptionalText(raw?.status) || "queued",
    endpointId: normalizeOptionalText(raw?.endpointId),
    endpointName: normalizeOptionalText(raw?.endpointName),
    modalAccountKey: normalizeOptionalText(raw?.modalAccountKey),
    modalAccountLabel: normalizeOptionalText(raw?.modalAccountLabel),
    modalAppName: normalizeOptionalText(raw?.modalAppName),
    githubOwner: normalizeOptionalText(raw?.githubOwner),
    githubRepo: normalizeOptionalText(raw?.githubRepo),
    githubRef: normalizeOptionalText(raw?.githubRef),
    workflowId: normalizeOptionalText(raw?.workflowId),
    entryFile: normalizeOptionalText(raw?.entryFile),
    requestedByUserId: normalizeOptionalText(raw?.requestedByUserId),
    requestedByUserName: normalizeOptionalText(raw?.requestedByUserName),
    createdAt: normalizeOptionalTimestamp(raw?.createdAt),
    updatedAt: normalizeOptionalTimestamp(raw?.updatedAt),
    dispatchedAt: normalizeOptionalTimestamp(raw?.dispatchedAt),
    dispatchStatus: normalizeOptionalInteger(raw?.dispatchStatus),
    dispatchError: normalizeOptionalText(raw?.dispatchError),
  };
}

async function listKvKeys(env, prefix) {
  const names = [];
  let cursor = undefined;
  do {
    const page = await env.MODAL_ROUTER_KV.list({
      prefix,
      cursor,
    });
    for (const entry of page.keys) {
      names.push(entry.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

async function buildEndpointStatusesPayload(env) {
  const [config, registryByEndpointId] = await Promise.all([loadConfig(env), loadRegistry(env)]);
  const probeTargets = buildEndpointProbeTargets(config, registryByEndpointId);
  const statuses = await Promise.all(probeTargets.map((target) => probeEndpointStatus(target)));
  const statusesByEndpointId = {};
  for (const status of statuses) {
    statusesByEndpointId[status.endpointId] = status;
  }
  return {
    probedAtUtc: new Date().toISOString(),
    statusesByEndpointId,
  };
}

async function handleSingleEndpointStatus(pathname, env) {
  const match = pathname.match(/^\/api\/endpoints\/([^/]+)\/status$/);
  const endpointId = match?.[1];
  if (!endpointId) {
    return jsonResponse({ error: "Endpoint invalido." }, { status: 400 });
  }
  const [config, registryByEndpointId] = await Promise.all([loadConfig(env), loadRegistry(env)]);
  const target = findEndpointProbeTarget(endpointId, config, registryByEndpointId);
  if (!target) {
    return jsonResponse({ error: "Endpoint nao encontrado ou sem status configurado." }, { status: 404 });
  }
  return jsonResponse(await probeEndpointStatus(target));
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

function logApiRequest(request, url, response) {
  const logPayload = {
    method: request.method,
    path: url.pathname,
    status: response.status,
    userAgent: request.headers.get("user-agent") || "",
  };
  if (response.status === 401) {
    logPayload.reason = "unauthorized";
  } else if (response.status === 403) {
    logPayload.reason = "forbidden";
  }
  console.log(`[projectmdl] ${JSON.stringify(logPayload)}`);
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
  if (!isAuthEnabled(env, "ENABLE_DASHBOARD_AUTH")) {
    return null;
  }
  const configuredSecret = (env.DASHBOARD_ADMIN_TOKEN || "").trim();
  if (!configuredSecret) {
    return null;
  }
  const candidate = readCandidateToken(request, "x-admin-token");
  if (candidate && timingSafeEqual(candidate, configuredSecret)) {
    return null;
  }
  return new Response("Unauthorized", { status: 401 });
}

function requireRegistryReporter(request, env) {
  if (!isAuthEnabled(env, "ENABLE_REGISTRY_AUTH")) {
    return null;
  }
  const configuredSecret = (env.MODAL_REGISTRY_TOKEN || "").trim();
  if (!configuredSecret) {
    return new Response("Registry token not configured.", { status: 503 });
  }
  const candidate = readCandidateToken(request, "x-registry-token");
  if (candidate && timingSafeEqual(candidate, configuredSecret)) {
    return null;
  }
  return new Response("Unauthorized", { status: 401 });
}

function isAuthEnabled(env, envVarName) {
  return String(env?.[envVarName] || "")
    .trim()
    .toLowerCase() === "true";
}

function readCandidateToken(request, directHeaderName) {
  const bearer = request.headers.get("authorization") || "";
  const bearerToken = bearer.replace(/^Bearer\s+/i, "").trim();
  const directToken = (request.headers.get(directHeaderName) || "").trim();
  return directToken || bearerToken;
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
  const normalizedEndpoints = Array.isArray(raw.endpoints)
    ? raw.endpoints.map(normalizeEndpoint).filter(Boolean)
    : [];
  const endpoints = assignProxySlugs(normalizedEndpoints, normalizedEndpoints);
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
  const previousConfig = await loadConfig(env);
  const normalizedEndpoints = assignProxySlugs(
    config.endpoints.map(normalizeEndpoint).filter(Boolean),
    previousConfig.endpoints
  );
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

async function loadRegistry(env) {
  const names = await listRegistryKeys(env);
  if (!names.length) {
    return {};
  }
  const rawRecords = await Promise.all(
    names.map((name) => env.MODAL_ROUTER_KV.get(name, "json"))
  );
  const registryByEndpointId = {};
  for (const raw of rawRecords) {
    const normalized = normalizeStoredRegistryRecord(raw);
    if (!normalized) {
      continue;
    }
    registryByEndpointId[normalized.endpointId] = normalized;
  }
  return registryByEndpointId;
}

async function listRegistryKeys(env) {
  const names = [];
  let cursor = undefined;
  do {
    const page = await env.MODAL_ROUTER_KV.list({
      prefix: REGISTRY_KEY_PREFIX,
      cursor,
    });
    for (const entry of page.keys) {
      names.push(entry.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

async function handleRegistryReport(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }

  let report;
  try {
    report = normalizeRegistryPayload(payload);
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 400 });
  }

  const key = registryKey(report.endpointId);
  const previous = normalizeStoredRegistryRecord(await env.MODAL_ROUTER_KV.get(key, "json"));
  const merged = {
    ...previous,
    ...report,
    firstSeenUtc: previous?.firstSeenUtc || report.lastSeenUtc,
    reportCount: (previous?.reportCount || 0) + 1,
  };

  await env.MODAL_ROUTER_KV.put(key, JSON.stringify(merged));

  return jsonResponse({
    ok: true,
    endpointId: merged.endpointId,
    lastSeenUtc: merged.lastSeenUtc,
    lastEventType: merged.lastEventType,
    reportCount: merged.reportCount,
  });
}

async function buildCatalogPayload(env) {
  const { entries, meta } = await loadCatalog(env);
  return {
    ok: true,
    entries,
    totalEntries: Number(meta.totalEntries || entries.length || 0),
    lastUpdated: meta.lastUpdated || collectCatalogLastUpdated(entries),
    recentSyncs: meta.recentSyncs,
    recentEndpoints: buildRecentCatalogEndpoints(meta.recentSyncs),
  };
}

function buildCatalogSnapshotData(entries, meta) {
  return {
    ok: true,
    entries,
    totalEntries: entries.length,
    lastUpdated: meta?.lastUpdated || collectCatalogLastUpdated(entries) || new Date().toISOString(),
    recentSyncs: meta?.recentSyncs || [],
  };
}

async function handleCatalogImport(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }

  let normalized;
  try {
    normalized = normalizeCatalogImportPayload(payload);
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 400 });
  }

  return jsonResponse(await importCatalogPayload(env, normalized));
}

async function importCatalogPayload(env, normalized, options = {}) {
  const result = await upsertCatalogEntries(env, normalized.entries, {
    source: normalized.source,
    app: normalized.app,
    endpointId: normalized.endpointId,
    endpointLabel: normalized.endpointLabel,
    bootId: normalized.bootId,
    updatedAtUtc: normalized.updatedAtUtc,
    reason: normalized.reason,
    received: normalized.entries.length,
    mergeMode: options.mergeMode || CATALOG_MERGE_PRESERVE_EXISTING,
  });

  return {
    ok: true,
    received: normalized.entries.length,
    upserted: result.upserted,
    github: result.github,
  };
}

async function handleCatalogSave(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }

  const entries = Array.isArray(payload?.entries) ? payload.entries : null;
  if (!entries) {
    return jsonResponse({ error: "O campo entries deve ser uma lista." }, { status: 400 });
  }

  let normalizedEntries;
  try {
    normalizedEntries = entries.map((entry) =>
      normalizeCatalogEntry(entry, {
        source: "dashboard",
        app: "projectmdl-dashboard",
        endpointId: entry?.sourceEndpointId || null,
        endpointLabel: entry?.sourceEndpointLabel || null,
        bootId: entry?.bootId || null,
        updatedAtUtc: payload?.updatedAtUtc || new Date().toISOString(),
        reason: "manual",
      })
    );
  } catch (error) {
    return jsonResponse({ error: error.message }, { status: 400 });
  }

  const result = await upsertCatalogEntries(env, normalizedEntries, {
    source: "dashboard",
    app: "projectmdl-dashboard",
    endpointId: null,
    endpointLabel: "Dashboard",
    bootId: null,
    updatedAtUtc: payload?.updatedAtUtc || new Date().toISOString(),
    reason: "manual",
    received: normalizedEntries.length,
    mergeMode: CATALOG_MERGE_PREFER_INCOMING,
  });

  return jsonResponse({
    ok: true,
    received: normalizedEntries.length,
    upserted: result.upserted,
    github: result.github,
  });
}

async function handleActiveCatalogSave(env) {
  const [config, registryByEndpointId] = await Promise.all([loadConfig(env), loadRegistry(env)]);
  const active = getActiveEndpoint(config);
  if (!active) {
    return jsonResponse({ error: "Nenhum endpoint ativo configurado." }, { status: 503 });
  }

  const probeTarget = buildProbeTarget(
    active.id,
    active.name,
    active.url,
    registryByEndpointId[active.id] || null
  );
  const liveStatus = probeTarget ? await probeEndpointStatus(probeTarget) : null;
  const catalogCandidateUrls = buildActiveCatalogCandidateUrls(active, liveStatus);

  let selectedUrl = null;
  let remotePayload = null;
  let lastError = null;
  for (const candidateUrl of catalogCandidateUrls) {
    try {
      const response = await fetch(candidateUrl, {
        method: "GET",
        headers: {
          accept: "application/json, text/plain;q=0.9, */*;q=0.8",
          "cache-control": "no-store",
        },
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        lastError = `${candidateUrl} -> ${
          typeof payload === "string"
            ? payload.slice(0, 240)
            : payload?.error || `HTTP ${response.status}`
        }`;
        continue;
      }
      selectedUrl = candidateUrl;
      remotePayload = payload;
      break;
    } catch (error) {
      lastError = `${candidateUrl} -> ${
        error instanceof Error ? error.message : "Falha ao consultar o catalogo."
      }`;
    }
  }

  if (!remotePayload) {
    return jsonResponse(
      {
        error:
          lastError ||
          `Nao foi possivel consultar o catalogo do endpoint ativo. URLs tentadas: ${catalogCandidateUrls.join(", ")}`,
        triedUrls: catalogCandidateUrls,
      },
      { status: 502 }
    );
  }

  let normalized;
  try {
    normalized = normalizeRemoteCatalogPayload(remotePayload, {
      activeEndpoint: active,
      liveStatus,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: `${error.message} URL consultada: ${selectedUrl}`,
        sourceUrl: selectedUrl,
      },
      { status: 400 }
    );
  }

  const result = await importCatalogPayload(env, normalized);

  return jsonResponse({
    ok: true,
    received: result.received,
    upserted: result.upserted,
    sourceUrl: selectedUrl,
    endpointId: normalized.endpointId,
    endpointLabel: normalized.endpointLabel,
    github: result.github,
  });
}

async function handleActiveFilesList(env, fileKind) {
  const routeConfig = ACTIVE_FILE_ROUTE_CONFIG[fileKind];
  if (!routeConfig) {
    return jsonResponse({ error: "Tipo de arquivo invalido." }, { status: 400 });
  }

  const context = await loadActiveFileAccessContext(env);
  if (context.errorResponse) {
    return context.errorResponse;
  }

  const sourceUrl = buildActiveFileEndpointUrl(context.baseUrl, routeConfig.listPath);
  try {
    const upstreamResponse = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "cache-control": "no-store",
      },
    });
    const payload = await readUpstreamPayload(upstreamResponse);
    if (!upstreamResponse.ok) {
      return jsonResponse(
        {
          error: `Nao foi possivel consultar ${routeConfig.label} do endpoint ativo.`,
          sourceUrl,
          upstreamStatus: upstreamResponse.status,
          upstreamBody: extractUpstreamError(payload),
        },
        { status: 502 }
      );
    }

    return jsonResponse({
      ok: true,
      kind: fileKind,
      endpointId: context.active.id,
      endpointName: context.active.name,
      sourceUrl,
      items: normalizeActiveFileListPayload(payload),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: `Falha ao consultar ${routeConfig.label} do endpoint ativo.`,
        sourceUrl,
        detail: error instanceof Error ? error.message : "Erro inesperado.",
      },
      { status: 502 }
    );
  }
}

async function handleActiveFilesDownload(request, env, fileKind) {
  const routeConfig = ACTIVE_FILE_ROUTE_CONFIG[fileKind];
  if (!routeConfig) {
    return jsonResponse({ error: "Tipo de arquivo invalido." }, { status: 400 });
  }

  const url = new URL(request.url);
  const relativePath = String(url.searchParams.get("path") || "").trim();
  if (!relativePath) {
    return jsonResponse({ error: "O parametro path e obrigatorio." }, { status: 400 });
  }

  const context = await loadActiveFileAccessContext(env);
  if (context.errorResponse) {
    return context.errorResponse;
  }

  const sourceUrl = new URL(buildActiveFileEndpointUrl(context.baseUrl, routeConfig.downloadPath));
  sourceUrl.searchParams.set("path", relativePath);

  try {
    const upstreamResponse = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        accept: "*/*",
        "cache-control": "no-store",
      },
    });
    if (!upstreamResponse.ok) {
      const payload = await readUpstreamPayload(upstreamResponse);
      return jsonResponse(
        {
          error: `Falha ao baixar ${routeConfig.label} do endpoint ativo.`,
          sourceUrl: sourceUrl.toString(),
          upstreamStatus: upstreamResponse.status,
          upstreamBody: extractUpstreamError(payload),
        },
        { status: 502 }
      );
    }

    const headers = new Headers(upstreamResponse.headers);
    headers.set("cache-control", "no-store");
    if (url.searchParams.get("inline") === "1") {
      headers.delete("content-disposition");
    }
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: `Falha ao baixar ${routeConfig.label} do endpoint ativo.`,
        sourceUrl: sourceUrl.toString(),
        detail: error instanceof Error ? error.message : "Erro inesperado.",
      },
      { status: 502 }
    );
  }
}

async function handleActiveFilesDelete(request, env, fileKind) {
  const routeConfig = ACTIVE_FILE_ROUTE_CONFIG[fileKind];
  if (!routeConfig) {
    return jsonResponse({ error: "Tipo de arquivo invalido." }, { status: 400 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, { status: 400 });
  }

  const relativePath = String(payload?.path || payload?.relative_path || "").trim();
  if (!relativePath) {
    return jsonResponse({ error: "O campo path e obrigatorio." }, { status: 400 });
  }

  const context = await loadActiveFileAccessContext(env);
  if (context.errorResponse) {
    return context.errorResponse;
  }

  const sourceUrl = buildActiveFileEndpointUrl(context.baseUrl, routeConfig.deletePath);
  try {
    const upstreamResponse = await fetch(sourceUrl, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ path: relativePath }),
    });
    const upstreamPayload = await readUpstreamPayload(upstreamResponse);
    if (!upstreamResponse.ok) {
      return jsonResponse(
        {
          error: `Falha ao deletar ${routeConfig.label} do endpoint ativo.`,
          sourceUrl,
          upstreamStatus: upstreamResponse.status,
          upstreamBody: extractUpstreamError(upstreamPayload),
        },
        { status: 502 }
      );
    }

    return jsonResponse({
      ok: true,
      kind: fileKind,
      endpointId: context.active.id,
      endpointName: context.active.name,
      deletedPath: relativePath,
      sourceUrl,
      upstream: typeof upstreamPayload === "string" ? { message: upstreamPayload } : upstreamPayload,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: `Falha ao deletar ${routeConfig.label} do endpoint ativo.`,
        sourceUrl,
        detail: error instanceof Error ? error.message : "Erro inesperado.",
      },
      { status: 502 }
    );
  }
}

async function loadActiveFileAccessContext(env) {
  const [config, registryByEndpointId] = await Promise.all([loadConfig(env), loadRegistry(env)]);
  const active = getActiveEndpoint(config);
  if (!active) {
    return {
      errorResponse: jsonResponse({ error: "Nenhum endpoint ativo configurado." }, { status: 503 }),
    };
  }

  const registry = registryByEndpointId[active.id] || null;
  const baseUrl = normalizeActiveEndpointBaseUrl(active.url || registry?.publicBaseUrl);
  if (!baseUrl) {
    return {
      errorResponse: jsonResponse(
        { error: "Endpoint ativo sem URL base valida para consultar arquivos." },
        { status: 400 }
      ),
    };
  }

  return {
    active,
    registry,
    baseUrl,
  };
}

function buildActiveFileEndpointUrl(baseUrl, routePath) {
  const resolved = resolveUrlAgainstBase(routePath, baseUrl);
  if (!resolved) {
    throw new Error(`Nao foi possivel resolver a rota ${routePath}.`);
  }
  return resolved;
}

async function readUpstreamPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function extractUpstreamError(payload) {
  if (typeof payload === "string") {
    return payload.slice(0, 500);
  }
  if (payload && typeof payload === "object") {
    return payload.error || payload.message || JSON.stringify(payload);
  }
  return "Erro upstream sem detalhes.";
}

function normalizeActiveFileListPayload(payload) {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : null;
  if (!rawItems) {
    throw new Error("Payload de arquivos invalido: items ausente.");
  }
  return rawItems
    .map(normalizeActiveFileItem)
    .filter(Boolean)
    .sort(compareActiveFileItems);
}

function normalizeActiveFileItem(raw) {
  const relativePath =
    normalizeOptionalText(raw?.relative_path) ||
    normalizeOptionalText(raw?.relativePath) ||
    normalizeOptionalText(raw?.path);
  const name =
    normalizeOptionalText(raw?.name) ||
    normalizeOptionalText(raw?.filename) ||
    (relativePath ? relativePath.split("/").filter(Boolean).at(-1) || relativePath : null);
  if (!relativePath || !name) {
    return null;
  }

  return {
    name,
    relativePath,
    sizeBytes:
      normalizeOptionalInteger(raw?.size_bytes) ||
      normalizeOptionalInteger(raw?.sizeBytes) ||
      0,
    modifiedAtUtc:
      normalizeOptionalTimestamp(raw?.modified_at_utc) ||
      normalizeOptionalTimestamp(raw?.modifiedAtUtc) ||
      null,
  };
}

function compareActiveFileItems(left, right) {
  const leftModified = left?.modifiedAtUtc || "";
  const rightModified = right?.modifiedAtUtc || "";
  const timestampOrder = String(rightModified).localeCompare(String(leftModified));
  if (timestampOrder !== 0) {
    return timestampOrder;
  }
  return String(left?.name || "").localeCompare(String(right?.name || ""), "pt-BR", {
    sensitivity: "base",
  });
}

async function loadCatalog(env) {
  const [entries, meta] = await Promise.all([loadCatalogEntries(env), loadCatalogMeta(env)]);
  return { entries, meta };
}

async function loadCatalogEntries(env) {
  const snapshotEntries = await loadCatalogSnapshot(env);
  if (snapshotEntries.length) {
    return snapshotEntries;
  }
  const keys = await listCatalogEntryKeys(env);
  if (!keys.length) {
    return [];
  }
  const rawEntries = await Promise.all(keys.map((key) => env.MODAL_ROUTER_KV.get(key, "json")));
  return rawEntries
    .map(normalizeStoredCatalogEntry)
    .filter(Boolean)
    .sort((left, right) => compareCatalogEntries(right, left));
}

async function loadCatalogSnapshot(env) {
  const raw = await env.MODAL_ROUTER_KV.get(CATALOG_SNAPSHOT_KEY, "json");
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(normalizeStoredCatalogEntry)
    .filter(Boolean)
    .sort((left, right) => compareCatalogEntries(right, left));
}

async function saveCatalogSnapshot(env, entries) {
  const normalizedEntries = entries
    .map(normalizeCatalogEntryForStorage)
    .filter(Boolean)
    .sort((left, right) => compareCatalogEntries(right, left));
  await env.MODAL_ROUTER_KV.put(CATALOG_SNAPSHOT_KEY, JSON.stringify(normalizedEntries));
  return normalizedEntries;
}

async function listCatalogEntryKeys(env) {
  const names = [];
  let cursor = undefined;
  do {
    const page = await env.MODAL_ROUTER_KV.list({
      prefix: CATALOG_ENTRY_KEY_PREFIX,
      cursor,
    });
    for (const entry of page.keys) {
      names.push(entry.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

async function loadCatalogMeta(env) {
  const raw = await env.MODAL_ROUTER_KV.get(CATALOG_META_KEY, "json");
  return normalizeCatalogMeta(raw);
}

async function saveCatalogMeta(env, meta) {
  const normalized = normalizeCatalogMeta(meta);
  await env.MODAL_ROUTER_KV.put(CATALOG_META_KEY, JSON.stringify(normalized));
  return normalized;
}

function normalizeCatalogMeta(raw) {
  const recentSyncs = Array.isArray(raw?.recentSyncs)
    ? raw.recentSyncs
        .map(normalizeCatalogSyncRecord)
        .filter(Boolean)
        .slice(0, MAX_RECENT_CATALOG_SYNCS)
    : [];
  return {
    totalEntries: normalizeOptionalInteger(raw?.totalEntries) || 0,
    lastUpdated: normalizeOptionalTimestamp(raw?.lastUpdated),
    recentSyncs,
  };
}

function normalizeCatalogSyncRecord(raw) {
  const syncedAtUtc = normalizeOptionalTimestamp(raw?.syncedAtUtc);
  const source = normalizeOptionalText(raw?.source);
  const app = normalizeOptionalText(raw?.app);
  const endpointId = normalizeOptionalText(raw?.endpointId);
  const endpointLabel = normalizeOptionalText(raw?.endpointLabel);
  if (!syncedAtUtc && !endpointId && !source && !app) {
    return null;
  }
  return {
    syncedAtUtc,
    source,
    app,
    endpointId,
    endpointLabel,
    bootId: normalizeOptionalText(raw?.bootId),
    updatedAtUtc: normalizeOptionalTimestamp(raw?.updatedAtUtc),
    reason: normalizeOptionalText(raw?.reason),
    received: normalizeOptionalInteger(raw?.received) || 0,
    upserted: normalizeOptionalInteger(raw?.upserted) || 0,
  };
}

async function upsertCatalogEntries(env, entries, syncContext) {
  const normalizedEntries = entries.map((entry) => normalizeCatalogEntry(entry, syncContext));
  const currentSnapshotEntries = await loadCatalogSnapshot(env);
  const snapshotById = new Map(currentSnapshotEntries.map((entry) => [entry.entryId, entry]));
  const mergeMode = syncContext?.mergeMode || CATALOG_MERGE_PRESERVE_EXISTING;
  const upsertedEntries = await Promise.all(
    normalizedEntries.map(async (entry) => {
      const key = catalogEntryKey(entry.entryId);
      const existing = normalizeStoredCatalogEntry(await env.MODAL_ROUTER_KV.get(key, "json"));
      const merged = mergeCatalogEntries(existing, entry, mergeMode);
      await env.MODAL_ROUTER_KV.put(key, JSON.stringify(merged));
      snapshotById.set(merged.entryId, merged);
      return merged;
    })
  );

  const snapshotEntries = await saveCatalogSnapshot(env, [...snapshotById.values()]);

  const currentMeta = await loadCatalogMeta(env);
  const nextMeta = {
    ...currentMeta,
    totalEntries: snapshotEntries.length,
    lastUpdated:
      normalizeOptionalTimestamp(syncContext?.updatedAtUtc) ||
      collectCatalogLastUpdated(upsertedEntries) ||
      new Date().toISOString(),
    recentSyncs: [
      normalizeCatalogSyncRecord({
        syncedAtUtc: new Date().toISOString(),
        source: syncContext?.source,
        app: syncContext?.app,
        endpointId: syncContext?.endpointId,
        endpointLabel: syncContext?.endpointLabel,
        bootId: syncContext?.bootId,
        updatedAtUtc: syncContext?.updatedAtUtc,
        reason: syncContext?.reason,
        received: syncContext?.received || normalizedEntries.length,
        upserted: normalizedEntries.length,
      }),
      ...(currentMeta.recentSyncs || []),
    ]
      .filter(Boolean)
      .slice(0, MAX_RECENT_CATALOG_SYNCS),
  };
  await saveCatalogMeta(env, nextMeta);
  const github = await publishCatalogSnapshotToGitHub(
    env,
    buildCatalogSnapshotData(snapshotEntries, nextMeta)
  );

  return {
    upserted: normalizedEntries.length,
    entries: upsertedEntries,
    github,
  };
}

async function countCatalogEntries(env) {
  const snapshotEntries = await loadCatalogSnapshot(env);
  if (snapshotEntries.length) {
    return snapshotEntries.length;
  }
  const keys = await listCatalogEntryKeys(env);
  return keys.length;
}

function getGitHubCatalogConfig(env) {
  return {
    token: String(env?.GITHUB_TOKEN || "").trim(),
    owner: String(env?.GITHUB_OWNER || DEFAULT_GITHUB_OWNER).trim(),
    repo: String(env?.GITHUB_REPO || DEFAULT_GITHUB_REPO).trim(),
    branch: String(env?.GITHUB_BRANCH || DEFAULT_GITHUB_BRANCH).trim(),
    path: String(env?.GITHUB_CATALOG_PATH || DEFAULT_GITHUB_CATALOG_PATH).trim(),
  };
}

async function publishCatalogSnapshotToGitHub(env, snapshotData) {
  const config = getGitHubCatalogConfig(env);
  console.log(`[projectmdl] Publishing catalog snapshot to GitHub`);

  if (!config.token) {
    const error = "GITHUB_TOKEN not configured";
    console.log(`[projectmdl] GitHub catalog snapshot update failed: ${error}`);
    return { ok: false, skipped: true, error };
  }

  const encodedPath = config.path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const getUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`;
  const putUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${config.token}`,
    "content-type": "application/json; charset=utf-8",
    "user-agent": "projectmdl-worker",
    "x-github-api-version": "2022-11-28",
  };

  let sha = null;
  const getResponse = await fetch(getUrl, {
    method: "GET",
    headers,
  });
  if (getResponse.status === 200) {
    const payload = await getResponse.json();
    sha = typeof payload?.sha === "string" ? payload.sha : null;
  } else if (getResponse.status !== 404) {
    const error = `GET contents failed (${getResponse.status}): ${await readGitHubErrorBody(getResponse)}`;
    console.log(`[projectmdl] GitHub catalog snapshot update failed: ${error}`);
    return { ok: false, error };
  }

  const putBody = {
    message: `Update catalog snapshot ${snapshotData.lastUpdated || new Date().toISOString()}`,
    content: encodeBase64Utf8(JSON.stringify(snapshotData, null, 2)),
    branch: config.branch,
  };
  if (sha) {
    putBody.sha = sha;
  }

  const putResponse = await fetch(putUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(putBody),
  });
  if (!putResponse.ok) {
    const error = `PUT contents failed (${putResponse.status}): ${await readGitHubErrorBody(putResponse)}`;
    console.log(`[projectmdl] GitHub catalog snapshot update failed: ${error}`);
    return { ok: false, error };
  }

  const payload = await putResponse.json();
  console.log(`[projectmdl] GitHub catalog snapshot updated successfully`);
  return {
    ok: true,
    sha: payload?.content?.sha || payload?.commit?.sha || null,
    downloadUrl: payload?.content?.download_url || null,
    htmlUrl: payload?.content?.html_url || null,
  };
}

async function readGitHubErrorBody(response) {
  const contentType = response.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      return payload?.message || JSON.stringify(payload);
    }
    return (await response.text()).slice(0, 500);
  } catch {
    return `HTTP ${response.status}`;
  }
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function normalizeCatalogImportPayload(payload) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : null;
  if (!entries) {
    throw new Error("O campo entries deve ser uma lista.");
  }
  return {
    source: normalizeOptionalText(payload?.source) || "comfyui-modal",
    app: normalizeOptionalText(payload?.app) || "comfyui-modal",
    endpointId: normalizeOptionalText(payload?.endpoint_id),
    endpointLabel: normalizeOptionalText(payload?.endpoint_label),
    bootId: normalizeOptionalText(payload?.boot_id),
    updatedAtUtc: normalizeOptionalTimestamp(payload?.updated_at_utc) || new Date().toISOString(),
    reason: normalizeOptionalText(payload?.reason) || "catalog-update",
    entryCount: normalizeOptionalInteger(payload?.entry_count) || entries.length,
    entries: entries.map((entry) =>
      normalizeCatalogEntry(entry, {
        source: payload?.source,
        app: payload?.app,
        endpointId: payload?.endpoint_id,
        endpointLabel: payload?.endpoint_label,
        bootId: payload?.boot_id,
        updatedAtUtc: payload?.updated_at_utc,
        reason: payload?.reason,
      })
    ),
  };
}

function normalizeRemoteCatalogPayload(payload, context = {}) {
  const remoteEntries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.entries)
      ? payload.entries
      : Array.isArray(payload?.catalog?.entries)
        ? payload.catalog.entries
        : null;

  if (!remoteEntries) {
    throw new Error("O endpoint ativo nao retornou um catalogo valido.");
  }

  const activeEndpoint = context.activeEndpoint || null;
  const liveStatus = context.liveStatus || null;
  const updatedAtUtc =
    normalizeOptionalTimestamp(payload?.updated_at_utc) ||
    normalizeOptionalTimestamp(payload?.updatedAtUtc) ||
    liveStatus?.checkedAtUtc ||
    new Date().toISOString();

  return {
    source: normalizeOptionalText(payload?.source) || "active-endpoint",
    app:
      normalizeOptionalText(payload?.app) ||
      normalizeOptionalText(liveStatus?.app) ||
      "comfyui-modal",
    endpointId: activeEndpoint?.id || normalizeOptionalText(payload?.endpoint_id),
    endpointLabel:
      activeEndpoint?.name ||
      normalizeOptionalText(payload?.endpoint_label) ||
      normalizeOptionalText(liveStatus?.endpointLabel),
    bootId:
      normalizeOptionalText(payload?.boot_id) ||
      normalizeOptionalText(liveStatus?.bootId),
    updatedAtUtc,
    reason: normalizeOptionalText(payload?.reason) || "manual",
    entries: remoteEntries.map((entry) =>
      normalizeCatalogEntry(entry, {
        source: payload?.source || "active-endpoint",
        app: payload?.app || liveStatus?.app || "comfyui-modal",
        endpointId: activeEndpoint?.id || payload?.endpoint_id,
        endpointLabel: activeEndpoint?.name || payload?.endpoint_label,
        bootId: payload?.boot_id || liveStatus?.bootId,
        updatedAtUtc,
        reason: payload?.reason || "manual",
      })
    ),
  };
}

function normalizeCatalogEntry(entry, context = {}) {
  const entryId =
    normalizeOptionalText(entry?.entryId) ||
    normalizeOptionalText(entry?.entry_id) ||
    buildCatalogEntryId(entry);
  const filename =
    normalizeOptionalText(entry?.filename) ||
    normalizeOptionalText(entry?.savedPath) ||
    normalizeOptionalText(entry?.saved_path) ||
    entryId;
  const url = normalizeOptionalUrl(entry?.url);
  if (!filename) {
    throw new Error("Cada entrada do catalogo precisa de filename.");
  }
  if (!url) {
    throw new Error(`A entrada "${filename}" precisa de uma URL valida.`);
  }
  return {
    entryId,
    provider: normalizeOptionalText(entry?.provider) || "outro",
    url,
    filename,
    category: normalizeOptionalText(entry?.category) || "geral",
    subdir: normalizeOptionalText(entry?.subdir) || "",
    savedPath: normalizeOptionalText(entry?.savedPath) || normalizeOptionalText(entry?.saved_path),
    timestampUtc:
      normalizeOptionalTimestamp(entry?.timestampUtc) ||
      normalizeOptionalTimestamp(entry?.timestamp_utc) ||
      normalizeOptionalTimestamp(context?.updatedAtUtc) ||
      new Date().toISOString(),
    updatedAtUtc:
      normalizeOptionalTimestamp(entry?.updatedAtUtc) ||
      normalizeOptionalTimestamp(context?.updatedAtUtc) ||
      normalizeOptionalTimestamp(entry?.timestampUtc) ||
      normalizeOptionalTimestamp(entry?.timestamp_utc) ||
      new Date().toISOString(),
    source: normalizeOptionalText(entry?.source) || normalizeOptionalText(context?.source) || "manual",
    app: normalizeOptionalText(entry?.app) || normalizeOptionalText(context?.app),
    sourceEndpointId:
      normalizeOptionalText(entry?.sourceEndpointId) || normalizeOptionalText(context?.endpointId),
    sourceEndpointLabel:
      normalizeOptionalText(entry?.sourceEndpointLabel) ||
      normalizeOptionalText(context?.endpointLabel),
    bootId: normalizeOptionalText(entry?.bootId) || normalizeOptionalText(context?.bootId),
    lastReason:
      normalizeOptionalText(entry?.lastReason) || normalizeOptionalText(context?.reason) || "manual",
  };
}

function normalizeStoredCatalogEntry(raw) {
  const entryId = normalizeOptionalText(raw?.entryId);
  if (!entryId) {
    return null;
  }
  const url = normalizeOptionalUrl(raw?.url);
  if (!url) {
    return null;
  }
  return {
    entryId,
    provider: normalizeOptionalText(raw?.provider) || "outro",
    url,
    filename: normalizeOptionalText(raw?.filename) || entryId,
    category: normalizeOptionalText(raw?.category) || "geral",
    subdir: normalizeOptionalText(raw?.subdir) || "",
    savedPath: normalizeOptionalText(raw?.savedPath),
    timestampUtc: normalizeOptionalTimestamp(raw?.timestampUtc),
    updatedAtUtc: normalizeOptionalTimestamp(raw?.updatedAtUtc),
    source: normalizeOptionalText(raw?.source),
    app: normalizeOptionalText(raw?.app),
    sourceEndpointId: normalizeOptionalText(raw?.sourceEndpointId),
    sourceEndpointLabel: normalizeOptionalText(raw?.sourceEndpointLabel),
    bootId: normalizeOptionalText(raw?.bootId),
    lastReason: normalizeOptionalText(raw?.lastReason),
    createdAtUtc: normalizeOptionalTimestamp(raw?.createdAtUtc),
    lastImportedAtUtc: normalizeOptionalTimestamp(raw?.lastImportedAtUtc),
    lastImportedSource: normalizeOptionalText(raw?.lastImportedSource),
    lastImportedReason: normalizeOptionalText(raw?.lastImportedReason),
  };
}

function normalizeCatalogEntryForStorage(entry) {
  const normalized = normalizeStoredCatalogEntry(entry);
  if (!normalized) {
    return null;
  }
  return {
    ...normalized,
    createdAtUtc: normalized.createdAtUtc || new Date().toISOString(),
  };
}

function mergeCatalogEntries(existing, incoming, mergeMode) {
  const now = new Date().toISOString();
  if (!existing) {
    return {
      ...incoming,
      createdAtUtc: now,
      lastImportedAtUtc: incoming.updatedAtUtc || now,
      lastImportedSource: incoming.source,
      lastImportedReason: incoming.lastReason,
    };
  }

  if (mergeMode === CATALOG_MERGE_PREFER_INCOMING) {
    return {
      ...existing,
      ...incoming,
      createdAtUtc: existing.createdAtUtc || now,
      lastImportedAtUtc: incoming.updatedAtUtc || now,
      lastImportedSource: incoming.source || existing.lastImportedSource,
      lastImportedReason: incoming.lastReason || existing.lastImportedReason,
    };
  }

  return {
    entryId: existing.entryId || incoming.entryId,
    provider: preferCatalogExistingValue(existing.provider, incoming.provider),
    url: preferCatalogExistingValue(existing.url, incoming.url),
    filename: preferCatalogExistingValue(existing.filename, incoming.filename),
    category: preferCatalogExistingValue(existing.category, incoming.category),
    subdir: preferCatalogExistingValue(existing.subdir, incoming.subdir),
    savedPath: preferCatalogExistingValue(existing.savedPath, incoming.savedPath),
    timestampUtc: preferCatalogExistingValue(existing.timestampUtc, incoming.timestampUtc),
    updatedAtUtc: preferCatalogExistingValue(existing.updatedAtUtc, incoming.updatedAtUtc),
    source: preferCatalogExistingValue(existing.source, incoming.source),
    app: preferCatalogExistingValue(existing.app, incoming.app),
    sourceEndpointId: preferCatalogExistingValue(
      existing.sourceEndpointId,
      incoming.sourceEndpointId
    ),
    sourceEndpointLabel: preferCatalogExistingValue(
      existing.sourceEndpointLabel,
      incoming.sourceEndpointLabel
    ),
    bootId: preferCatalogExistingValue(existing.bootId, incoming.bootId),
    lastReason: preferCatalogExistingValue(existing.lastReason, incoming.lastReason),
    createdAtUtc: existing.createdAtUtc || now,
    lastImportedAtUtc: incoming.updatedAtUtc || now,
    lastImportedSource: incoming.source || existing.lastImportedSource,
    lastImportedReason: incoming.lastReason || existing.lastImportedReason,
  };
}

function preferCatalogExistingValue(existingValue, incomingValue) {
  return hasCatalogValue(existingValue) ? existingValue : incomingValue;
}

function hasCatalogValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

function catalogEntryKey(entryId) {
  return `${CATALOG_ENTRY_KEY_PREFIX}${entryId}`;
}

function buildCatalogEntryId(entry) {
  const basis = [
    normalizeOptionalText(entry?.url) || "",
    normalizeOptionalText(entry?.filename) || "",
    normalizeOptionalText(entry?.category) || "",
    normalizeOptionalText(entry?.subdir) || "",
  ].join("|");
  return `catalog_${hashStableText(basis || crypto.randomUUID())}`;
}

function hashStableText(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function collectCatalogLastUpdated(entries) {
  const timestamps = entries
    .map((entry) => normalizeOptionalTimestamp(entry?.updatedAtUtc || entry?.timestampUtc))
    .filter(Boolean)
    .sort();
  return timestamps.at(-1) || null;
}

function buildRecentCatalogEndpoints(recentSyncs) {
  const seen = new Set();
  const endpoints = [];
  for (const sync of recentSyncs || []) {
    const endpointId = normalizeOptionalText(sync?.endpointId);
    if (!endpointId || seen.has(endpointId)) {
      continue;
    }
    seen.add(endpointId);
    endpoints.push({
      endpointId,
      endpointLabel: normalizeOptionalText(sync?.endpointLabel) || endpointId,
      updatedAtUtc: normalizeOptionalTimestamp(sync?.updatedAtUtc) || sync?.syncedAtUtc,
      reason: normalizeOptionalText(sync?.reason),
    });
  }
  return endpoints;
}

function compareCatalogEntries(left, right) {
  const leftUpdated = left?.updatedAtUtc || left?.timestampUtc || "";
  const rightUpdated = right?.updatedAtUtc || right?.timestampUtc || "";
  return String(leftUpdated).localeCompare(String(rightUpdated));
}

function buildActiveCatalogCandidateUrls(activeEndpoint, liveStatus) {
  const candidates = new Set();
  const baseUrl = normalizeActiveEndpointBaseUrl(activeEndpoint?.url);
  const explicitCandidates = [
    liveStatus?.catalogEndpoint,
    liveStatus?.catalogApiEndpoint,
    activeEndpoint?.catalogUrl,
  ];

  for (const candidate of explicitCandidates) {
    const resolved = resolveUrlAgainstBase(candidate, baseUrl);
    if (resolved) {
      candidates.add(resolved);
    }
  }

  for (const path of DEFAULT_ACTIVE_CATALOG_PATHS) {
    const resolved = resolveUrlAgainstBase(path, baseUrl);
    if (resolved) {
      candidates.add(resolved);
    }
  }

  return [...candidates];
}

function normalizeActiveEndpointBaseUrl(value) {
  const normalizedUrl = normalizeOptionalUrl(value);
  if (!normalizedUrl) {
    return null;
  }
  const url = new URL(normalizedUrl);
  const pathname = url.pathname.replace(/\/+$/, "");
  const strippedPath = pathname.replace(
    /\/(?:comfyui|comfyui-modal)\/api\/run-workflow$/i,
    ""
  );
  url.pathname = strippedPath || "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
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
    ...(await buildConfigPayload(env, saved)),
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
    ...(await buildConfigPayload(env, saved)),
  });
}

function normalizeEndpoint(endpoint) {
  const id = String(endpoint?.id || crypto.randomUUID()).trim();
  const name = String(endpoint?.name || "").trim();
  const notes = String(endpoint?.notes || "").trim();
  const enabled = endpoint?.enabled !== false;
  const url = normalizeUrl(endpoint?.url || "");
  const proxySlug = normalizeProxySlug(endpoint?.proxySlug);
  const modalAccountKey = normalizeAccountKey(
    endpoint?.modalAccountKey || endpoint?.modal_account_key
  );
  const modalAppName =
    normalizeOptionalText(endpoint?.modalAppName) ||
    normalizeOptionalText(endpoint?.modal_app_name);
  const entryFile =
    normalizeOptionalText(endpoint?.entryFile) ||
    normalizeOptionalText(endpoint?.entry_file) ||
    "comfyui_modal.py";
  const githubRef =
    normalizeOptionalText(endpoint?.githubRef) ||
    normalizeOptionalText(endpoint?.github_ref);
  const assignedUserId =
    normalizeOptionalText(endpoint?.assignedUserId) ||
    normalizeOptionalText(endpoint?.assigned_user_id);
  const userCanDeploy =
    endpoint?.userCanDeploy === false || endpoint?.user_can_deploy === false ? false : true;
  if (!id) {
    throw new Error("Cada endpoint precisa de um id.");
  }
  if (!name) {
    throw new Error("Cada endpoint precisa de um nome.");
  }
  if (!url) {
    throw new Error(`O endpoint "${name}" precisa de uma URL valida.`);
  }
  return {
    id,
    name,
    url,
    notes,
    enabled,
    proxySlug,
    modalAccountKey,
    modalAppName,
    entryFile,
    githubRef,
    assignedUserId,
    userCanDeploy,
  };
}

function normalizeProxySlug(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  return /^cmfy_\d+$/.test(raw) ? raw : null;
}

function assignProxySlugs(endpoints, previousEndpoints = []) {
  const previousById = new Map(
    previousEndpoints
      .map((endpoint) => [endpoint.id, normalizeProxySlug(endpoint.proxySlug)])
      .filter(([, proxySlug]) => Boolean(proxySlug))
  );
  const used = new Set();
  const nextEndpoints = endpoints.map((endpoint) => ({ ...endpoint }));

  for (const endpoint of nextEndpoints) {
    const candidate = normalizeProxySlug(endpoint.proxySlug) || previousById.get(endpoint.id) || null;
    if (!candidate || used.has(candidate)) {
      continue;
    }
    endpoint.proxySlug = candidate;
    used.add(candidate);
  }

  let nextIndex = 1;
  for (const slug of used) {
    const match = slug.match(/^cmfy_(\d+)$/);
    const currentIndex = Number.parseInt(match?.[1] || "0", 10);
    if (currentIndex >= nextIndex) {
      nextIndex = currentIndex + 1;
    }
  }

  for (const endpoint of nextEndpoints) {
    if (normalizeProxySlug(endpoint.proxySlug)) {
      continue;
    }
    let candidate = formatProxySlug(nextIndex);
    while (used.has(candidate)) {
      nextIndex += 1;
      candidate = formatProxySlug(nextIndex);
    }
    endpoint.proxySlug = candidate;
    used.add(candidate);
    nextIndex += 1;
  }

  return nextEndpoints;
}

function formatProxySlug(index) {
  return `${PROXY_SLUG_PREFIX}${String(index).padStart(2, "0")}`;
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

function normalizeOptionalText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function normalizeOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
}

function normalizeOptionalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  return normalizeUrl(raw);
}

function resolveUrlAgainstBase(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  if (/^https?:\/\//i.test(raw)) {
    return normalizeUrl(raw);
  }
  if (!baseUrl) {
    return null;
  }
  const resolved = new URL(raw, `${normalizeUrl(baseUrl)}/`);
  resolved.hash = "";
  return resolved.toString().replace(/\/+$/, "");
}

function normalizeRegistryPayload(payload) {
  const endpointId = normalizeOptionalText(payload?.endpoint_id);
  if (!endpointId) {
    throw new Error("O campo endpoint_id e obrigatorio.");
  }
  const eventAtUtc = normalizeOptionalTimestamp(payload?.event_at_utc) || new Date().toISOString();
  const minContainers = normalizeOptionalInteger(payload?.min_containers);
  const explicitColdStartEligible = normalizeOptionalBoolean(payload?.cold_start_eligible);
  return {
    endpointId,
    endpointLabel: normalizeOptionalText(payload?.endpoint_label) || endpointId,
    lastEventType: normalizeOptionalText(payload?.event_type) || "unknown",
    lastSeenUtc: eventAtUtc,
    receivedAtUtc: new Date().toISOString(),
    lastBootId: normalizeOptionalText(payload?.boot_id),
    startedAtUtc: normalizeOptionalTimestamp(payload?.started_at_utc),
    gpuType: normalizeOptionalText(payload?.gpu_type),
    minContainers,
    scaledownWindowSeconds: normalizeOptionalInteger(payload?.scaledown_window_seconds),
    coldStartEligible:
      explicitColdStartEligible !== null
        ? explicitColdStartEligible
        : minContainers === null
          ? null
          : minContainers === 0,
    mode: normalizeOptionalText(payload?.mode),
    statusEndpoint: normalizeOptionalUrl(payload?.status_endpoint),
    workflowApiEndpoint: normalizeOptionalUrl(payload?.workflow_api_endpoint),
    promptStatusEndpoint: normalizeOptionalUrl(payload?.prompt_status_endpoint),
    publicBaseUrl: normalizeOptionalUrl(payload?.public_base_url),
  };
}

function normalizeStoredRegistryRecord(raw) {
  const endpointId = normalizeOptionalText(raw?.endpointId);
  if (!endpointId) {
    return null;
  }
  return {
    endpointId,
    endpointLabel: normalizeOptionalText(raw?.endpointLabel) || endpointId,
    lastEventType: normalizeOptionalText(raw?.lastEventType) || "unknown",
    lastSeenUtc: normalizeOptionalTimestamp(raw?.lastSeenUtc),
    receivedAtUtc: normalizeOptionalTimestamp(raw?.receivedAtUtc),
    lastBootId: normalizeOptionalText(raw?.lastBootId),
    startedAtUtc: normalizeOptionalTimestamp(raw?.startedAtUtc),
    gpuType: normalizeOptionalText(raw?.gpuType),
    minContainers: normalizeOptionalInteger(raw?.minContainers),
    scaledownWindowSeconds: normalizeOptionalInteger(raw?.scaledownWindowSeconds),
    coldStartEligible: normalizeOptionalBoolean(raw?.coldStartEligible),
    mode: normalizeOptionalText(raw?.mode),
    statusEndpoint: normalizeOptionalUrl(raw?.statusEndpoint),
    workflowApiEndpoint: normalizeOptionalUrl(raw?.workflowApiEndpoint),
    promptStatusEndpoint: normalizeOptionalUrl(raw?.promptStatusEndpoint),
    publicBaseUrl: normalizeOptionalUrl(raw?.publicBaseUrl),
    firstSeenUtc: normalizeOptionalTimestamp(raw?.firstSeenUtc),
    reportCount: normalizeOptionalInteger(raw?.reportCount) || 0,
  };
}

function registryKey(endpointId) {
  return `${REGISTRY_KEY_PREFIX}${endpointId}`;
}

function buildEndpointProbeTargets(config, registryByEndpointId) {
  const targets = [];
  const seen = new Set();

  for (const endpoint of config.endpoints) {
    const registry = registryByEndpointId[endpoint.id] || null;
    const target = buildProbeTarget(endpoint.id, endpoint.name, endpoint.url, registry);
    if (!target || seen.has(target.endpointId)) {
      continue;
    }
    seen.add(target.endpointId);
    targets.push(target);
  }

  for (const registry of Object.values(registryByEndpointId)) {
    if (seen.has(registry.endpointId)) {
      continue;
    }
    const target = buildProbeTarget(
      registry.endpointId,
      registry.endpointLabel || registry.endpointId,
      registry.publicBaseUrl,
      registry
    );
    if (!target) {
      continue;
    }
    seen.add(target.endpointId);
    targets.push(target);
  }

  return targets;
}

function findEndpointProbeTarget(endpointId, config, registryByEndpointId) {
  const configEndpoint = config.endpoints.find((endpoint) => endpoint.id === endpointId);
  if (configEndpoint) {
    return buildProbeTarget(
      configEndpoint.id,
      configEndpoint.name,
      configEndpoint.url,
      registryByEndpointId[configEndpoint.id] || null
    );
  }
  const registry = registryByEndpointId[endpointId];
  if (!registry) {
    return null;
  }
  return buildProbeTarget(
    registry.endpointId,
    registry.endpointLabel || registry.endpointId,
    registry.publicBaseUrl,
    registry
  );
}

function buildProbeTarget(endpointId, endpointLabel, baseUrl, registry) {
  const normalizedBaseUrl = normalizeOptionalUrl(baseUrl);
  const statusUrls = buildStatusCandidateUrls(normalizedBaseUrl, registry);
  if (!statusUrls.length) {
    return null;
  }
  return {
    endpointId,
    endpointLabel,
    baseUrl: normalizedBaseUrl,
    statusUrl: statusUrls[0],
    statusUrls,
  };
}

function buildStatusCandidateUrls(baseUrl, registry) {
  const candidates = [];
  const explicit = resolveUrlAgainstBase(registry?.statusEndpoint, baseUrl);
  if (explicit) {
    candidates.push(explicit);
  }
  for (const path of DEFAULT_STATUS_PATHS) {
    const resolved = resolveUrlAgainstBase(path, baseUrl);
    if (resolved && !candidates.includes(resolved)) {
      candidates.push(resolved);
    }
  }
  return candidates;
}

async function probeEndpointStatus(target) {
  const candidateUrls = Array.isArray(target.statusUrls) && target.statusUrls.length
    ? target.statusUrls
    : [target.statusUrl];
  let lastError = null;
  for (const candidateUrl of candidateUrls) {
    try {
      const response = await fetch(candidateUrl, {
        method: "GET",
        headers: {
          accept: "application/json, text/plain;q=0.9, */*;q=0.8",
          "cache-control": "no-store",
        },
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        lastError =
          typeof payload === "string"
            ? `${candidateUrl} -> ${payload.slice(0, 240)}`
            : `${candidateUrl} -> ${payload?.error || `HTTP ${response.status}`}`;
        continue;
      }
      return normalizeEndpointStatusPayload(
        {
          ...target,
          statusUrl: candidateUrl,
        },
        payload,
        response.status
      );
    } catch (error) {
      lastError = `${candidateUrl} -> ${
        error instanceof Error ? error.message : "Falha ao consultar o endpoint."
      }`;
    }
  }
  return {
    endpointId: target.endpointId,
    endpointLabel: target.endpointLabel,
    baseUrl: target.baseUrl,
    probeUrl: candidateUrls[0] || target.statusUrl,
    triedProbeUrls: candidateUrls,
    reachable: false,
    ok: false,
    httpStatus: null,
    error: lastError || "Falha ao consultar o endpoint.",
    checkedAtUtc: new Date().toISOString(),
  };
}

function normalizeEndpointStatusPayload(target, payload, httpStatus) {
  const modal = payload?.modal && typeof payload.modal === "object" ? payload.modal : {};
  const registry = payload?.registry && typeof payload.registry === "object" ? payload.registry : {};
  return {
    endpointId: target.endpointId,
    endpointLabel: target.endpointLabel,
    baseUrl: target.baseUrl,
    probeUrl: target.statusUrl,
    reachable: true,
    ok: payload?.ok !== false,
    ready: payload?.ready === true,
    httpStatus,
    serviceState: normalizeOptionalText(payload?.service_state),
    app: normalizeOptionalText(payload?.app),
    bootId: normalizeOptionalText(payload?.boot_id),
    startedAtUtc: normalizeOptionalTimestamp(payload?.started_at_utc),
    uptimeSeconds:
      typeof payload?.uptime_seconds === "number" ? Number(payload.uptime_seconds) : null,
    gpuType: normalizeOptionalText(payload?.gpu_type),
    statusEndpoint: resolveUrlAgainstBase(payload?.status_endpoint, target.baseUrl) || target.statusUrl,
    catalogEndpoint:
      resolveUrlAgainstBase(payload?.catalog_endpoint, target.baseUrl) ||
      resolveUrlAgainstBase(payload?.catalog_url, target.baseUrl),
    catalogApiEndpoint: resolveUrlAgainstBase(payload?.catalog_api_endpoint, target.baseUrl),
    workflowApiEndpoint: resolveUrlAgainstBase(payload?.workflow_api_endpoint, target.baseUrl),
    promptStatusEndpoint: resolveUrlAgainstBase(payload?.prompt_status_endpoint, target.baseUrl),
    publicBaseUrl: normalizeOptionalUrl(target.baseUrl),
    modal: {
      minContainers: normalizeOptionalInteger(modal?.min_containers),
      scaledownWindowSeconds: normalizeOptionalInteger(modal?.scaledown_window_seconds),
      coldStartEligible: normalizeOptionalBoolean(modal?.cold_start_eligible),
      mode: normalizeOptionalText(modal?.mode),
    },
    registry: {
      enabled: normalizeOptionalBoolean(registry?.enabled),
      endpointId: normalizeOptionalText(registry?.endpoint_id),
      endpointLabel: normalizeOptionalText(registry?.endpoint_label),
      heartbeatIntervalSeconds: normalizeOptionalInteger(registry?.heartbeat_interval_seconds),
      lastSuccessAtUtc: normalizeOptionalTimestamp(registry?.last_success_at_utc),
      lastError: normalizeOptionalText(registry?.last_error),
    },
    checkedAtUtc: new Date().toISOString(),
    error: null,
  };
}

function getActiveEndpoint(config) {
  const preferred = config.endpoints.find(
    (endpoint) => endpoint.id === config.activeEndpointId && endpoint.enabled
  );
  return preferred || config.endpoints.find((endpoint) => endpoint.enabled) || null;
}

function serveDashboardAsset(request, env, url) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname =
    url.pathname === `${DASHBOARD_PATH_PREFIX}/`
      ? "/index.html"
      : url.pathname.slice(DASHBOARD_PATH_PREFIX.length) || "/index.html";
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function matchEndpointAliasPath(pathname) {
  const match = pathname.match(/^\/(cmfy_\d+)(\/.*)?$/i);
  if (!match) {
    return null;
  }
  const proxySlug = normalizeProxySlug(match[1]);
  if (!proxySlug) {
    return null;
  }
  return {
    proxySlug,
    aliasBasePath: `/${proxySlug}`,
    relativePath: match[2] || "/",
    isAliasRoot: !match[2],
  };
}

async function proxyToActiveEndpoint(request, env, url) {
  const config = await loadConfig(env);
  const active = getActiveEndpoint(config);
  if (!active) {
    return jsonResponse({ error: "Nenhum endpoint ativo configurado." }, { status: 503 });
  }

  const relativePath = `/${url.pathname.replace(/^\/modal\/?/, "")}`.replace(/\/+$/, (value) =>
    value.length > 1 ? "/" : value
  );
  return proxyEndpointRequest(request, url, active, {
    requestPath: relativePath,
    aliasBasePath: null,
  });
}

async function proxyToEndpointAlias(request, env, url, aliasMatch) {
  if (aliasMatch.isAliasRoot && (request.method === "GET" || request.method === "HEAD")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = `${aliasMatch.aliasBasePath}/`;
    return Response.redirect(redirectUrl.toString(), 308);
  }

  const config = await loadConfig(env);
  const endpoint = config.endpoints.find((candidate) => candidate.proxySlug === aliasMatch.proxySlug);
  if (!endpoint) {
    return new Response("Endpoint nao encontrado.", { status: 404 });
  }

  return proxyEndpointRequest(request, url, endpoint, {
    requestPath: aliasMatch.relativePath,
    aliasBasePath: aliasMatch.aliasBasePath,
  });
}

async function proxyEndpointRequest(request, url, endpoint, options) {
  const aliasBasePath = options.aliasBasePath || null;
  const upstreamBaseUrl = new URL(endpoint.url);
  const upstreamUrl = buildUpstreamRequestUrl(upstreamBaseUrl, options.requestPath, url.search);
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
  if (aliasBasePath) {
    headers.set("x-forwarded-prefix", aliasBasePath);
  }
  headers.set("x-projectmdl-endpoint-id", endpoint.id);
  headers.set("x-projectmdl-endpoint-name", endpoint.name);
  if (endpoint.proxySlug) {
    headers.set("x-projectmdl-proxy-slug", endpoint.proxySlug);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  return buildEndpointProxyResponse({
    endpoint,
    url,
    aliasBasePath,
    upstreamBaseUrl,
    upstreamUrl,
    upstreamResponse,
  });
}

async function buildEndpointProxyResponse(context) {
  const responseHeaders = new Headers(context.upstreamResponse.headers);
  responseHeaders.set("x-projectmdl-endpoint-id", context.endpoint.id);
  responseHeaders.set("x-projectmdl-endpoint-name", context.endpoint.name);
  if (context.endpoint.proxySlug) {
    responseHeaders.set("x-projectmdl-proxy-slug", context.endpoint.proxySlug);
  }

  rewriteProxyLocationHeader(responseHeaders, context);

  if (context.upstreamResponse.status === 101) {
    return new Response(null, {
      status: context.upstreamResponse.status,
      statusText: context.upstreamResponse.statusText,
      headers: responseHeaders,
      webSocket: context.upstreamResponse.webSocket,
    });
  }

  if (!context.aliasBasePath) {
    return new Response(context.upstreamResponse.body, {
      status: context.upstreamResponse.status,
      statusText: context.upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  const contentType = responseHeaders.get("content-type") || "";
  if (isHtmlContentType(contentType)) {
    const html = await context.upstreamResponse.text();
    responseHeaders.delete("content-length");
    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("content-security-policy-report-only");
    return new Response(rewriteHtmlDocument(html, context.aliasBasePath), {
      status: context.upstreamResponse.status,
      statusText: context.upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  if (isCssContentType(contentType)) {
    const css = await context.upstreamResponse.text();
    responseHeaders.delete("content-length");
    return new Response(rewriteCssText(css, context.aliasBasePath), {
      status: context.upstreamResponse.status,
      statusText: context.upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  return new Response(context.upstreamResponse.body, {
    status: context.upstreamResponse.status,
    statusText: context.upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

function buildUpstreamRequestUrl(upstreamBaseUrl, requestPath, search) {
  const upstreamUrl = new URL(upstreamBaseUrl.toString());
  const relativePath = String(requestPath || "/").replace(/^\/+/, "");
  upstreamUrl.pathname = joinPath(upstreamBaseUrl.pathname, relativePath);
  upstreamUrl.search = search;
  return upstreamUrl;
}

function rewriteProxyLocationHeader(headers, context) {
  const location = headers.get("location");
  if (!location || !context.aliasBasePath) {
    return;
  }
  const rewritten = rewriteUpstreamUrlToAlias(location, context);
  if (rewritten) {
    headers.set("location", rewritten);
  }
}

function rewriteUpstreamUrlToAlias(rawUrl, context) {
  try {
    const absoluteUrl = new URL(rawUrl, context.upstreamUrl);
    if (absoluteUrl.origin !== context.upstreamBaseUrl.origin) {
      return rawUrl;
    }
    const proxiedUrl = new URL(context.url.origin);
    const proxiedPath = stripBasePath(absoluteUrl.pathname, context.upstreamBaseUrl.pathname);
    proxiedUrl.pathname =
      proxiedPath === "/"
        ? `${context.aliasBasePath}/`
        : `${context.aliasBasePath}${proxiedPath.startsWith("/") ? proxiedPath : `/${proxiedPath}`}`;
    proxiedUrl.search = absoluteUrl.search;
    proxiedUrl.hash = absoluteUrl.hash;
    return rawUrl.startsWith("/") ? `${proxiedUrl.pathname}${proxiedUrl.search}${proxiedUrl.hash}` : proxiedUrl.toString();
  } catch {
    return rawUrl;
  }
}

function isHtmlContentType(contentType) {
  return /\btext\/html\b/i.test(contentType);
}

function isCssContentType(contentType) {
  return /\btext\/css\b/i.test(contentType);
}

function stripBasePath(pathname, basePath) {
  const normalizedPath = String(pathname || "/") || "/";
  const normalizedBase = normalizeBasePath(basePath);
  if (normalizedBase === "/") {
    return normalizedPath;
  }
  if (normalizedPath === normalizedBase) {
    return "/";
  }
  if (normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath.slice(normalizedBase.length) || "/";
  }
  return normalizedPath;
}

function normalizeBasePath(pathname) {
  const normalizedPath = `/${String(pathname || "").replace(/^\/+/, "").replace(/\/+$/, "")}`;
  return normalizedPath === "/" ? "/" : normalizedPath;
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

function rewriteHtmlDocument(html, aliasBasePath) {
  const injection = buildProxyBootstrap(aliasBasePath);
  let rewritten = String(html || "");

  rewritten = rewritten.replace(
    /\b(href|src|action|poster)=("|')\/(?!\/)/gi,
    `$1=$2${aliasBasePath}/`
  );
  rewritten = rewritten.replace(/url\((['"]?)\/(?!\/)/gi, `url($1${aliasBasePath}/`);
  rewritten = rewritten.replace(/\bcontent=(["'])\/(?!\/)/gi, `content=$1${aliasBasePath}/`);
  rewritten = rewritten.replace(/\bsrcset=(["'])(.*?)\1/gi, (_, quote, value) => {
    return `srcset=${quote}${rewriteSrcsetValue(value, aliasBasePath)}${quote}`;
  });

  rewritten = rewritten.replace(
    /(<head\b[^>]*>)/i,
    `$1<base href="${aliasBasePath}/" />${injection}`
  );
  if (!/<head\b/i.test(rewritten)) {
    rewritten = `${injection}${rewritten}`;
  }

  return rewritten;
}

function rewriteCssText(css, aliasBasePath) {
  return String(css || "")
    .replace(/url\((['"]?)\/(?!\/)/gi, `url($1${aliasBasePath}/`)
    .replace(/@import\s+(["'])\/(?!\/)/gi, `@import $1${aliasBasePath}/`);
}

function rewriteSrcsetValue(value, aliasBasePath) {
  return String(value || "")
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed || !trimmed.startsWith("/")) {
        return trimmed;
      }
      const firstSpace = trimmed.search(/\s/);
      if (firstSpace === -1) {
        return `${aliasBasePath}${trimmed}`;
      }
      return `${aliasBasePath}${trimmed.slice(0, firstSpace)}${trimmed.slice(firstSpace)}`;
    })
    .join(", ");
}

function buildProxyBootstrap(aliasBasePath) {
  const aliasPathLiteral = JSON.stringify(aliasBasePath);
  return [
    "<script>",
    "(function(){",
    "if(window.__projectmdlProxyPatched)return;",
    "window.__projectmdlProxyPatched=true;",
    `const base=${aliasPathLiteral};`,
    "const root=base+'/';",
    "const origin=location.origin;",
    "const host=location.host;",
    "const prefixAbsolute=function(abs,preferRelative){",
    "if(abs.pathname===base||abs.pathname.startsWith(root))return preferRelative?abs.pathname+abs.search+abs.hash:abs.toString();",
    "abs.pathname=abs.pathname==='/'?root:base+abs.pathname;",
    "return preferRelative?abs.pathname+abs.search+abs.hash:abs.toString();",
    "};",
    "const prefix=function(value){",
    "if(value===undefined||value===null)return value;",
    "const raw=String(value);",
    "if(!raw||raw.startsWith('#')||raw.startsWith('data:')||raw.startsWith('blob:')||raw.startsWith('javascript:')||raw.startsWith('mailto:'))return value;",
    "if(raw===base||raw.startsWith(root)||raw.startsWith(base+'?'))return raw;",
    "try{",
    "const abs=new URL(raw,location.href);",
    "const sameOrigin=abs.origin===origin;",
    "const sameHost=abs.host===host;",
    "const isSameHostWs=(abs.protocol==='ws:'||abs.protocol==='wss:')&&sameHost;",
    "if(!sameOrigin&&!isSameHostWs)return raw;",
    "if(raw.startsWith('//')){",
    "const rendered=prefixAbsolute(abs,false);",
    "return rendered.startsWith(abs.protocol)?rendered.replace(/^[a-z]+:/i,''):rendered;",
    "}",
    "return prefixAbsolute(abs,raw.startsWith('/'));",
    "}catch(_error){return raw;}",
    "};",
    "const prefixSrcset=function(value){",
    "return String(value||'').split(',').map(function(entry){",
    "const trimmed=entry.trim();",
    "if(!trimmed||!trimmed.startsWith('/'))return trimmed;",
    "const idx=trimmed.search(/\\s/);",
    "return idx===-1?base+trimmed:base+trimmed.slice(0,idx)+trimmed.slice(idx);",
    "}).join(', ');",
    "};",
    "const patchProperty=function(Ctor,name,mapper){",
    "if(!Ctor||!Ctor.prototype)return;",
    "const descriptor=Object.getOwnPropertyDescriptor(Ctor.prototype,name);",
    "if(!descriptor||typeof descriptor.set!=='function')return;",
    "Object.defineProperty(Ctor.prototype,name,{configurable:true,enumerable:descriptor.enumerable,get:descriptor.get,set:function(value){return descriptor.set.call(this,(mapper||prefix)(value));}});",
    "};",
    "const nativeFetch=window.fetch;",
    "if(nativeFetch){window.fetch=function(input,init){if(typeof input==='string'||input instanceof URL){return nativeFetch.call(this,prefix(input),init);}if(input&&typeof Request!=='undefined'&&input instanceof Request){return nativeFetch.call(this,new Request(prefix(input.url),input),init);}return nativeFetch.call(this,input,init);};}",
    "const NativeWS=window.WebSocket;",
    "if(NativeWS){const WrappedWS=function(url,protocols){return protocols===undefined?new NativeWS(prefix(url)):new NativeWS(prefix(url),protocols);};WrappedWS.prototype=NativeWS.prototype;Object.setPrototypeOf(WrappedWS,NativeWS);window.WebSocket=WrappedWS;}",
    "const NativeES=window.EventSource;",
    "if(NativeES){const WrappedES=function(url,config){return config===undefined?new NativeES(prefix(url)):new NativeES(prefix(url),config);};WrappedES.prototype=NativeES.prototype;Object.setPrototypeOf(WrappedES,NativeES);window.EventSource=WrappedES;}",
    "const xhrOpen=XMLHttpRequest.prototype.open;",
    "XMLHttpRequest.prototype.open=function(method,url){const args=[method,prefix(url)].concat(Array.prototype.slice.call(arguments,2));return xhrOpen.apply(this,args);};",
    "const wrapHistory=function(name){const original=history[name];if(!original)return;history[name]=function(state,title,url){return original.call(this,state,title,prefix(url));};};",
    "wrapHistory('pushState');",
    "wrapHistory('replaceState');",
    "const nativeOpen=window.open;",
    "if(nativeOpen){window.open=function(url,target,features){return nativeOpen.call(this,prefix(url),target,features);};}",
    "const nativeSetAttribute=Element.prototype.setAttribute;",
    "Element.prototype.setAttribute=function(name,value){if(typeof name==='string'&&/^(href|src|action|poster)$/i.test(name)){return nativeSetAttribute.call(this,name,prefix(value));}if(String(name).toLowerCase()==='srcset'){return nativeSetAttribute.call(this,name,prefixSrcset(value));}return nativeSetAttribute.call(this,name,value);};",
    "patchProperty(window.HTMLAnchorElement,'href');",
    "patchProperty(window.HTMLLinkElement,'href');",
    "patchProperty(window.HTMLImageElement,'src');",
    "patchProperty(window.HTMLScriptElement,'src');",
    "patchProperty(window.HTMLIFrameElement,'src');",
    "patchProperty(window.HTMLFormElement,'action');",
    "patchProperty(window.HTMLSourceElement,'src');",
    "patchProperty(window.HTMLSourceElement,'srcset',prefixSrcset);",
    "patchProperty(window.HTMLMediaElement,'poster');",
    "})();",
    "</script>",
  ].join("");
}
