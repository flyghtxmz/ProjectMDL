const STORAGE_KEY = "projectmdl-admin-token";

const state = {
  config: {
    endpoints: [],
    activeEndpointId: null,
    activeEndpoint: null,
    updatedAt: null,
    registryByEndpointId: {},
    registryCount: 0,
  },
  endpointStatusesById: {},
  lastStatusProbeAtUtc: null,
  refreshingEndpointIds: {},
};

const elements = {
  adminToken: document.getElementById("admin-token"),
  saveTokenButton: document.getElementById("save-token-button"),
  clearTokenButton: document.getElementById("clear-token-button"),
  refreshButton: document.getElementById("refresh-button"),
  statusBox: document.getElementById("status-box"),
  proxyBase: document.getElementById("proxy-base"),
  activeEndpointName: document.getElementById("active-endpoint-name"),
  endpointCounter: document.getElementById("endpoint-counter"),
  endpointList: document.getElementById("endpoint-list"),
  endpointTemplate: document.getElementById("endpoint-row-template"),
  endpointForm: document.getElementById("endpoint-form"),
  endpointId: document.getElementById("endpoint-id"),
  endpointName: document.getElementById("endpoint-name"),
  endpointUrl: document.getElementById("endpoint-url"),
  endpointNotes: document.getElementById("endpoint-notes"),
  endpointEnabled: document.getElementById("endpoint-enabled"),
  cancelEditButton: document.getElementById("cancel-edit-button"),
  formMode: document.getElementById("form-mode"),
};

boot();

function boot() {
  elements.adminToken.value = localStorage.getItem(STORAGE_KEY) || "";
  bindEvents();
  refreshConfig({ showStatus: false });
}

function bindEvents() {
  elements.saveTokenButton.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, elements.adminToken.value.trim());
    setStatus("Token salvo localmente no navegador.");
  });

  elements.clearTokenButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    elements.adminToken.value = "";
    setStatus("Token removido.");
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshConfig({ showStatus: true });
  });

  elements.cancelEditButton.addEventListener("click", resetForm);

  elements.endpointForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const nextConfig = buildConfigWithFormChanges();
      await saveConfig(nextConfig);
      resetForm();
      setStatus("Endpoint salvo com sucesso.");
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

async function refreshConfig(options = {}) {
  try {
    state.config = await api("/api/config");
    const statusError = await refreshEndpointStatuses();
    render();
    if (options.showStatus) {
      if (statusError) {
        setStatus(`Configuracao atualizada, mas o status ao vivo falhou: ${statusError.message}`, true);
      } else {
        setStatus("Configuracao e status atualizados.");
      }
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function refreshEndpointStatuses() {
  try {
    const payload = await api("/api/endpoint-statuses");
    state.endpointStatusesById = payload.statusesByEndpointId || {};
    state.lastStatusProbeAtUtc = payload.probedAtUtc || null;
    return null;
  } catch (error) {
    return error;
  }
}

function render() {
  const active = state.config.activeEndpoint;
  const displayEndpoints = getDisplayEndpoints();
  elements.proxyBase.textContent = `${location.origin}/modal`;
  elements.activeEndpointName.textContent = active ? active.name : "nenhum";
  elements.endpointCounter.textContent = buildEndpointCounterText(displayEndpoints);
  renderEndpointList(displayEndpoints);
}

function renderEndpointList(displayEndpoints) {
  elements.endpointList.innerHTML = "";
  if (!displayEndpoints.length) {
    const empty = document.createElement("div");
    empty.className = "status-box";
    empty.textContent = "Nenhum endpoint configurado ou reportado ainda.";
    elements.endpointList.append(empty);
    return;
  }

  for (const endpoint of displayEndpoints) {
    const fragment = elements.endpointTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".endpoint-card");
    const name = fragment.querySelector(".endpoint-name");
    const url = fragment.querySelector(".endpoint-url");
    const notes = fragment.querySelector(".endpoint-notes");
    const activeBadge = fragment.querySelector(".active-badge");
    const disabledBadge = fragment.querySelector(".disabled-badge");
    const registryBadge = fragment.querySelector(".registry-badge");
    const unmanagedBadge = fragment.querySelector(".unmanaged-badge");
    const liveStatusSummary = fragment.querySelector(".live-status-summary");
    const registrySummary = fragment.querySelector(".registry-summary");
    const endpointLinks = fragment.querySelector(".endpoint-links");
    const statusLink = fragment.querySelector(".status-link");
    const workflowLink = fragment.querySelector(".workflow-link");
    const promptLink = fragment.querySelector(".prompt-link");
    const publicLink = fragment.querySelector(".public-link");
    const actions = fragment.querySelector(".endpoint-actions");
    const refreshStatusButton = fragment.querySelector(".refresh-status-button");
    const activateButton = fragment.querySelector(".activate-button");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const registry = endpoint.registry || null;
    const liveStatus = state.endpointStatusesById[endpoint.id] || null;
    const isConfigured = endpoint.configured !== false;
    const canRefresh = canRefreshEndpointStatus(endpoint, liveStatus);
    const isRefreshing = state.refreshingEndpointIds[endpoint.id] === true;

    name.textContent = endpoint.name;
    url.textContent =
      endpoint.url ||
      liveStatus?.publicBaseUrl ||
      registry?.publicBaseUrl ||
      liveStatus?.workflowApiEndpoint ||
      registry?.workflowApiEndpoint ||
      "Sem URL reportada.";
    notes.textContent = buildEndpointNotes(endpoint);
    activeBadge.hidden = !isConfigured || state.config.activeEndpoint?.id !== endpoint.id;
    disabledBadge.hidden = !isConfigured || endpoint.enabled !== false;
    registryBadge.hidden = !registry;
    unmanagedBadge.hidden = isConfigured || !registry;
    refreshStatusButton.hidden = !canRefresh;
    refreshStatusButton.disabled = isRefreshing;
    activateButton.disabled =
      !isConfigured || !endpoint.enabled || state.config.activeEndpoint?.id === endpoint.id;
    actions.hidden = !isConfigured && !canRefresh;
    activateButton.hidden = !isConfigured;
    editButton.hidden = !isConfigured;
    deleteButton.hidden = !isConfigured;

    const liveSummaryText = buildLiveStatusSummary(liveStatus);
    liveStatusSummary.hidden = !liveSummaryText;
    liveStatusSummary.textContent = liveSummaryText;

    const summaryText = buildRegistrySummary(registry, endpoint.id);
    registrySummary.hidden = !summaryText;
    registrySummary.textContent = summaryText;

    const hasLinks = [
      applyOptionalLink(statusLink, liveStatus?.statusEndpoint || registry?.statusEndpoint),
      applyOptionalLink(
        workflowLink,
        liveStatus?.workflowApiEndpoint || registry?.workflowApiEndpoint
      ),
      applyOptionalLink(promptLink, liveStatus?.promptStatusEndpoint || registry?.promptStatusEndpoint),
      applyOptionalLink(publicLink, liveStatus?.publicBaseUrl || registry?.publicBaseUrl || endpoint.url),
    ].some(Boolean);
    endpointLinks.hidden = !hasLinks;

    if (canRefresh) {
      refreshStatusButton.addEventListener("click", () =>
        refreshSingleEndpointStatus(endpoint.id, endpoint.name)
      );
    }

    if (isConfigured) {
      activateButton.addEventListener("click", () => activateEndpoint(endpoint.id));
      editButton.addEventListener("click", () => populateForm(endpoint));
      deleteButton.addEventListener("click", () => removeEndpoint(endpoint.id));
    }

    card.dataset.endpointId = endpoint.id;
    elements.endpointList.append(fragment);
  }
}

function getDisplayEndpoints() {
  const registryByEndpointId = state.config.registryByEndpointId || {};
  const configuredIds = new Set();
  const configuredEndpoints = state.config.endpoints.map((endpoint) => {
    configuredIds.add(endpoint.id);
    return {
      ...endpoint,
      configured: true,
      registry: registryByEndpointId[endpoint.id] || null,
    };
  });
  const discoveredEndpoints = Object.values(registryByEndpointId)
    .filter((record) => !configuredIds.has(record.endpointId))
    .sort((left, right) => compareText(left.endpointLabel || left.endpointId, right.endpointLabel || right.endpointId))
    .map((record) => ({
      id: record.endpointId,
      name: record.endpointLabel || record.endpointId,
      url: record.publicBaseUrl || record.workflowApiEndpoint || record.statusEndpoint || "",
      notes: "",
      enabled: false,
      configured: false,
      registry: record,
    }));
  return configuredEndpoints.concat(discoveredEndpoints);
}

function buildEndpointCounterText(displayEndpoints) {
  const configuredCount = state.config.endpoints.length;
  const registryCount = Number(state.config.registryCount || 0);
  const discoveredCount = displayEndpoints.filter((endpoint) => endpoint.configured === false).length;
  const onlineCount = Object.values(state.endpointStatusesById).filter(
    (status) => status.reachable && status.ok
  ).length;
  const parts = [`${configuredCount} configurados`];
  if (registryCount) {
    parts.push(`${registryCount} registrados`);
  }
  if (discoveredCount) {
    parts.push(`${discoveredCount} auto-descobertos`);
  }
  if (onlineCount) {
    parts.push(`${onlineCount} online`);
  }
  if (state.lastStatusProbeAtUtc) {
    parts.push(`status ${formatTimestamp(state.lastStatusProbeAtUtc)}`);
  }
  return parts.join(" | ");
}

function buildEndpointNotes(endpoint) {
  const parts = [];
  if (endpoint.notes) {
    parts.push(endpoint.notes);
  }
  if (endpoint.configured === false) {
    parts.push("Registrado pelo Modal. Cadastre este id no roteador para ativar o proxy.");
  }
  return parts.join(" ") || "Sem notas.";
}

function buildRegistrySummary(registry, fallbackEndpointId) {
  if (!registry) {
    return "";
  }
  const parts = [`id: ${registry.endpointId || fallbackEndpointId}`];
  if (registry.lastEventType) {
    parts.push(`ultimo evento: ${registry.lastEventType}`);
  }
  if (registry.lastSeenUtc) {
    parts.push(`ultimo sinal: ${formatTimestamp(registry.lastSeenUtc)}`);
  }
  if (registry.mode) {
    parts.push(`modo: ${registry.mode}`);
  }
  if (typeof registry.coldStartEligible === "boolean") {
    parts.push(`cold start: ${registry.coldStartEligible ? "elegivel" : "nao"}`);
  }
  if (registry.gpuType) {
    parts.push(`gpu: ${registry.gpuType}`);
  }
  if (Number.isInteger(registry.minContainers)) {
    parts.push(`min containers: ${registry.minContainers}`);
  }
  if (registry.lastBootId) {
    parts.push(`boot: ${truncateText(registry.lastBootId, 16)}`);
  }
  return parts.join(" | ");
}

function buildLiveStatusSummary(liveStatus) {
  if (!liveStatus) {
    return "";
  }
  const parts = [];
  if (!liveStatus.reachable) {
    parts.push(`status: indisponivel`);
    if (liveStatus.error) {
      parts.push(`erro: ${liveStatus.error}`);
    }
    if (liveStatus.checkedAtUtc) {
      parts.push(`checado: ${formatTimestamp(liveStatus.checkedAtUtc)}`);
    }
    return parts.join(" | ");
  }

  parts.push(`status: ${liveStatus.ready ? "pronto" : "respondendo"}`);
  if (liveStatus.serviceState) {
    parts.push(`servico: ${liveStatus.serviceState}`);
  }
  if (liveStatus.modal?.mode) {
    parts.push(`modo: ${liveStatus.modal.mode}`);
  }
  if (typeof liveStatus.modal?.coldStartEligible === "boolean") {
    parts.push(`cold start: ${liveStatus.modal.coldStartEligible ? "sim" : "nao"}`);
  }
  if (liveStatus.gpuType) {
    parts.push(`gpu: ${liveStatus.gpuType}`);
  }
  if (Number.isInteger(liveStatus.modal?.minContainers)) {
    parts.push(`min containers: ${liveStatus.modal.minContainers}`);
  }
  if (typeof liveStatus.uptimeSeconds === "number") {
    parts.push(`uptime: ${formatDurationSeconds(liveStatus.uptimeSeconds)}`);
  }
  if (liveStatus.checkedAtUtc) {
    parts.push(`checado: ${formatTimestamp(liveStatus.checkedAtUtc)}`);
  }
  return parts.join(" | ");
}

function canRefreshEndpointStatus(endpoint, liveStatus) {
  return Boolean(
    endpoint?.url ||
      endpoint?.registry?.publicBaseUrl ||
      endpoint?.registry?.statusEndpoint ||
      liveStatus?.publicBaseUrl ||
      liveStatus?.statusEndpoint
  );
}

function applyOptionalLink(anchor, url) {
  if (!url) {
    anchor.hidden = true;
    anchor.removeAttribute("href");
    return false;
  }
  anchor.hidden = false;
  anchor.href = url;
  return true;
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), "pt-BR", { sensitivity: "base" });
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function truncateText(value, limit) {
  const text = String(value || "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

function formatDurationSeconds(value) {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function buildConfigWithFormChanges() {
  const id = elements.endpointId.value.trim() || crypto.randomUUID();
  const entry = {
    id,
    name: elements.endpointName.value.trim(),
    url: elements.endpointUrl.value.trim(),
    notes: elements.endpointNotes.value.trim(),
    enabled: elements.endpointEnabled.checked,
  };
  if (!entry.name) {
    throw new Error("Preencha o nome do endpoint.");
  }
  if (!entry.url) {
    throw new Error("Preencha a URL do endpoint.");
  }

  const endpoints = state.config.endpoints.filter((endpoint) => endpoint.id !== id);
  endpoints.unshift(entry);

  const activeEndpointId =
    state.config.activeEndpointId && state.config.activeEndpointId !== id
      ? state.config.activeEndpointId
      : entry.enabled
        ? id
        : state.config.activeEndpointId;

  return {
    endpoints,
    activeEndpointId,
  };
}

function populateForm(endpoint) {
  elements.endpointId.value = endpoint.id;
  elements.endpointName.value = endpoint.name;
  elements.endpointUrl.value = endpoint.url;
  elements.endpointNotes.value = endpoint.notes || "";
  elements.endpointEnabled.checked = endpoint.enabled !== false;
  elements.formMode.textContent = "edicao";
}

function resetForm() {
  elements.endpointForm.reset();
  elements.endpointId.value = "";
  elements.endpointEnabled.checked = true;
  elements.formMode.textContent = "novo";
}

async function activateEndpoint(endpointId) {
  try {
    const payload = await api(`/api/endpoints/${endpointId}/activate`, { method: "POST" });
    state.config = payload;
    await refreshConfig();
    setStatus(`Endpoint ativo: ${payload.activeEndpoint?.name || "nenhum"}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function refreshSingleEndpointStatus(endpointId, endpointName) {
  state.refreshingEndpointIds[endpointId] = true;
  render();
  try {
    const payload = await api(`/api/endpoints/${endpointId}/status`);
    state.endpointStatusesById[endpointId] = payload;
    state.lastStatusProbeAtUtc = payload.checkedAtUtc || new Date().toISOString();
    setStatus(`Status atualizado: ${endpointName || endpointId}.`);
  } catch (error) {
    setStatus(`Falha ao atualizar ${endpointName || endpointId}: ${error.message}`, true);
  } finally {
    delete state.refreshingEndpointIds[endpointId];
    render();
  }
}

async function removeEndpoint(endpointId) {
  const target = state.config.endpoints.find((endpoint) => endpoint.id === endpointId);
  if (!target) {
    return;
  }
  if (!confirm(`Remover o endpoint "${target.name}"?`)) {
    return;
  }
  try {
    const nextConfig = {
      endpoints: state.config.endpoints.filter((endpoint) => endpoint.id !== endpointId),
      activeEndpointId:
        state.config.activeEndpointId === endpointId ? null : state.config.activeEndpointId,
    };
    await saveConfig(nextConfig);
    setStatus(`Endpoint removido: ${target.name}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveConfig(nextConfig) {
  const payload = await api("/api/config", {
    method: "PUT",
    body: nextConfig,
  });
  state.config = payload;
  await refreshEndpointStatuses();
  render();
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = elements.adminToken.value.trim();
  if (token) {
    headers.set("x-admin-token", token);
  }

  let body = options.body;
  if (body && typeof body !== "string") {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : payload.error || "Erro inesperado.");
  }

  return payload;
}

function setStatus(message, isError = false) {
  elements.statusBox.textContent = message;
  elements.statusBox.style.color = isError ? "#ffbec3" : "";
}
