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
  catalog: {
    entries: [],
    totalEntries: 0,
    lastUpdated: null,
    recentSyncs: [],
    recentEndpoints: [],
  },
  catalogFilters: {
    query: "",
    provider: "",
    category: "",
  },
  catalogDirty: false,
  catalogDirtyEntryIds: {},
  catalogSaving: false,
};

const elements = {
  refreshButton: document.getElementById("refresh-button"),
  refreshCatalogButton: document.getElementById("refresh-catalog-button"),
  saveCatalogButton: document.getElementById("save-catalog-button"),
  statusBox: document.getElementById("status-box"),
  proxyBase: document.getElementById("proxy-base"),
  activeEndpointName: document.getElementById("active-endpoint-name"),
  endpointCounter: document.getElementById("endpoint-counter"),
  catalogEntryCount: document.getElementById("catalog-entry-count"),
  catalogLastSync: document.getElementById("catalog-last-sync"),
  catalogLastSource: document.getElementById("catalog-last-source"),
  catalogCounter: document.getElementById("catalog-counter"),
  catalogSyncSummary: document.getElementById("catalog-sync-summary"),
  catalogSearch: document.getElementById("catalog-search"),
  catalogProviderFilter: document.getElementById("catalog-provider-filter"),
  catalogCategoryFilter: document.getElementById("catalog-category-filter"),
  catalogTableBody: document.getElementById("catalog-table-body"),
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
  bindEvents();
  refreshConfig({ showStatus: false });
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => {
    refreshConfig({ showStatus: true });
  });

  elements.refreshCatalogButton.addEventListener("click", () => {
    refreshCatalog({ showStatus: true });
  });

  elements.saveCatalogButton.addEventListener("click", () => {
    saveCatalogEntries();
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

  elements.catalogSearch.addEventListener("input", (event) => {
    state.catalogFilters.query = event.currentTarget.value.trim();
    renderCatalog();
  });

  elements.catalogProviderFilter.addEventListener("change", (event) => {
    state.catalogFilters.provider = event.currentTarget.value;
    renderCatalog();
  });

  elements.catalogCategoryFilter.addEventListener("change", (event) => {
    state.catalogFilters.category = event.currentTarget.value;
    renderCatalog();
  });
}

async function refreshConfig(options = {}) {
  if (!options.force && !confirmCatalogRefreshLoss()) {
    return;
  }
  try {
    const [config, catalog, statusError] = await Promise.all([
      api("/api/config"),
      api("/api/catalog"),
      refreshEndpointStatuses(),
    ]);
    state.config = config;
    state.catalog = catalog;
    state.catalogDirty = false;
    state.catalogDirtyEntryIds = {};
    render();
    if (options.showStatus) {
      if (statusError) {
        setStatus(
          `Configuracao e catalogo atualizados, mas o status ao vivo falhou: ${statusError.message}`,
          true
        );
      } else {
        setStatus("Configuracao, catalogo e status atualizados.");
      }
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function refreshCatalog(options = {}) {
  if (!options.force && !confirmCatalogRefreshLoss()) {
    return;
  }
  try {
    state.catalog = await api("/api/catalog");
    state.catalogDirty = false;
    state.catalogDirtyEntryIds = {};
    renderCatalog();
    renderOverview();
    if (options.showStatus) {
      setStatus("Catalogo atualizado.");
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

function confirmCatalogRefreshLoss() {
  if (!state.catalogDirty) {
    return true;
  }
  return confirm(
    "Existem alteracoes nao salvas no catalogo. Atualizar agora vai descartar esse estado local. Continuar?"
  );
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
  renderOverview();
  renderEndpointList(displayEndpoints);
  renderCatalog();
}

function renderOverview() {
  const totalEntries = Number(state.catalog.totalEntries || state.catalog.entries.length || 0);
  const lastSync = state.catalog.lastUpdated || null;
  const lastSource = state.catalog.recentSyncs?.[0] || null;

  elements.catalogEntryCount.textContent = String(totalEntries);
  elements.catalogLastSync.textContent = lastSync ? formatTimestamp(lastSync) : "nenhuma";
  elements.catalogLastSource.textContent =
    lastSource?.endpointLabel ||
    lastSource?.endpointId ||
    lastSource?.app ||
    lastSource?.source ||
    "nenhum";
  elements.saveCatalogButton.disabled = state.catalogSaving;
  elements.saveCatalogButton.textContent = state.catalogSaving
    ? "Salvando..."
    : state.catalogDirty
      ? "Salvar Catalogo*"
      : "Salvar Catalogo";
  elements.saveCatalogButton.title = state.catalogDirty
    ? "Persistir as edicoes locais do catalogo central."
    : "Importar e persistir o catalogo do endpoint ativo.";
}

function renderCatalog() {
  const entries = getFilteredCatalogEntries();
  const totalEntries = Number(state.catalog.totalEntries || state.catalog.entries.length || 0);
  elements.catalogCounter.textContent = `${entries.length} visiveis | ${totalEntries} no total`;
  elements.catalogSyncSummary.textContent = buildCatalogSyncSummary();
  renderCatalogFilterOptions();
  renderCatalogTable(entries);
}

function renderCatalogFilterOptions() {
  const providerValues = collectUniqueCatalogValues(state.catalog.entries, "provider");
  const categoryValues = collectUniqueCatalogValues(state.catalog.entries, "category");
  replaceSelectOptions(elements.catalogProviderFilter, "Todos", providerValues, state.catalogFilters.provider);
  replaceSelectOptions(elements.catalogCategoryFilter, "Todas", categoryValues, state.catalogFilters.category);
}

function renderCatalogTable(entries) {
  elements.catalogTableBody.innerHTML = "";
  if (!entries.length) {
    const emptyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "catalog-empty";
    cell.textContent = "Nenhuma entrada encontrada para os filtros atuais.";
    emptyRow.append(cell);
    elements.catalogTableBody.append(emptyRow);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("tr");
    row.dataset.entryId = entry.entryId;
    if (state.catalogDirtyEntryIds[entry.entryId]) {
      row.classList.add("catalog-row-dirty");
    }

    row.append(
      buildCatalogEditableCell(entry, "filename", "text", "Nome do arquivo"),
      buildCatalogEditableCell(entry, "provider", "text", "Provider"),
      buildCatalogEditableCell(entry, "category", "text", "Categoria"),
      buildCatalogEditableCell(entry, "subdir", "text", "Subpasta"),
      buildCatalogLinkCell(entry),
      buildCatalogSourceCell(entry),
      buildCatalogUpdatedCell(entry)
    );

    elements.catalogTableBody.append(row);
  }
}

function buildCatalogEditableCell(entry, field, type, label) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.className = "catalog-input";
  input.value = entry[field] || "";
  input.placeholder = label;
  input.addEventListener("input", (event) => {
    updateCatalogEntryField(entry.entryId, field, event.currentTarget.value);
  });
  cell.append(input);
  return cell;
}

function buildCatalogLinkCell(entry) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  wrapper.className = "catalog-link-cell";

  const input = document.createElement("input");
  input.type = "url";
  input.className = "catalog-input";
  input.value = entry.url || "";
  input.placeholder = "https://...";
  input.addEventListener("input", (event) => {
    const nextValue = event.currentTarget.value;
    updateCatalogEntryField(entry.entryId, "url", nextValue);
    if (nextValue) {
      anchor.href = nextValue;
      anchor.hidden = false;
    } else {
      anchor.hidden = true;
      anchor.removeAttribute("href");
    }
  });

  const anchor = document.createElement("a");
  anchor.className = "endpoint-link";
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = "Abrir";
  if (entry.url) {
    anchor.href = entry.url;
  } else {
    anchor.hidden = true;
  }

  wrapper.append(input, anchor);
  cell.append(wrapper);
  return cell;
}

function buildCatalogSourceCell(entry) {
  const cell = document.createElement("td");
  const primary = entry.sourceEndpointLabel || entry.sourceEndpointId || entry.source || "manual";
  const secondary = entry.app ? `app: ${entry.app}` : "";
  cell.className = "catalog-meta-cell";
  cell.textContent = secondary ? `${primary} | ${secondary}` : primary;
  return cell;
}

function buildCatalogUpdatedCell(entry) {
  const cell = document.createElement("td");
  const updatedAt = entry.updatedAtUtc || entry.timestampUtc;
  cell.className = "catalog-meta-cell";
  cell.textContent = updatedAt ? formatTimestamp(updatedAt) : "sem data";
  return cell;
}

function updateCatalogEntryField(entryId, field, value) {
  const target = state.catalog.entries.find((entry) => entry.entryId === entryId);
  if (!target) {
    return;
  }
  target[field] = value;
  target.updatedAtUtc = new Date().toISOString();
  state.catalogDirty = true;
  state.catalogDirtyEntryIds[entryId] = true;
  document
    .querySelector(`tr[data-entry-id="${entryId}"]`)
    ?.classList.add("catalog-row-dirty");
  renderOverview();
}

function getFilteredCatalogEntries() {
  const query = state.catalogFilters.query.trim().toLowerCase();
  const providerFilter = state.catalogFilters.provider;
  const categoryFilter = state.catalogFilters.category;

  return [...(state.catalog.entries || [])].filter((entry) => {
    if (providerFilter && entry.provider !== providerFilter) {
      return false;
    }
    if (categoryFilter && entry.category !== categoryFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [
      entry.filename,
      entry.url,
      entry.provider,
      entry.category,
      entry.subdir,
      entry.sourceEndpointLabel,
      entry.sourceEndpointId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function collectUniqueCatalogValues(entries, field) {
  return [...new Set(entries.map((entry) => entry[field]).filter(Boolean))].sort((left, right) =>
    compareText(left, right)
  );
}

function replaceSelectOptions(select, allLabel, values, selectedValue) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = allLabel;
  select.append(defaultOption);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  select.value = values.includes(selectedValue) ? selectedValue : "";
}

function buildCatalogSyncSummary() {
  const lastSync = state.catalog.recentSyncs?.[0] || null;
  if (!lastSync) {
    return "Nenhuma sincronizacao recebida ainda.";
  }
  const parts = [];
  parts.push(`ultima sync: ${formatTimestamp(lastSync.syncedAtUtc || lastSync.updatedAtUtc)}`);
  if (lastSync.endpointLabel || lastSync.endpointId) {
    parts.push(`endpoint: ${lastSync.endpointLabel || lastSync.endpointId}`);
  }
  if (lastSync.reason) {
    parts.push(`motivo: ${lastSync.reason}`);
  }
  if (lastSync.upserted) {
    parts.push(`upserts: ${lastSync.upserted}`);
  }
  return parts.join(" | ");
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
    const proxySummary = fragment.querySelector(".endpoint-proxy-summary");
    const activeBadge = fragment.querySelector(".active-badge");
    const disabledBadge = fragment.querySelector(".disabled-badge");
    const registryBadge = fragment.querySelector(".registry-badge");
    const unmanagedBadge = fragment.querySelector(".unmanaged-badge");
    const liveStatusSummary = fragment.querySelector(".live-status-summary");
    const registrySummary = fragment.querySelector(".registry-summary");
    const endpointLinks = fragment.querySelector(".endpoint-links");
    const uiLink = fragment.querySelector(".ui-link");
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
    const proxyPath = buildEndpointProxyPath(endpoint);
    proxySummary.hidden = !proxyPath;
    proxySummary.textContent = proxyPath ? `UI Cloudflare: ${proxyPath}` : "";
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
      applyOptionalLink(uiLink, buildEndpointUiUrl(endpoint)),
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

function buildEndpointProxyPath(endpoint) {
  if (!endpoint?.configured || !endpoint?.proxySlug) {
    return "";
  }
  return `/${endpoint.proxySlug}`;
}

function buildEndpointUiUrl(endpoint) {
  const proxyPath = buildEndpointProxyPath(endpoint);
  if (!proxyPath) {
    return "";
  }
  return `${location.origin}${proxyPath}/`;
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

async function saveCatalogEntries() {
  if (state.catalogSaving) {
    return;
  }
  try {
    state.catalogSaving = true;
    renderOverview();
    const pendingLocalEntries = collectPendingCatalogEntries();
    const activeSyncPayload = await api("/api/catalog/save-active", {
      method: "POST",
    });

    let message = buildCatalogSaveMessage(
      activeSyncPayload,
      `Catalogo sincronizado do endpoint ativo ${activeSyncPayload.endpointLabel || activeSyncPayload.endpointId || ""}. URL: ${activeSyncPayload.sourceUrl || "nao informada"}.`
    );
    let nextCatalog = await api("/api/catalog");

    if (pendingLocalEntries.length) {
      const mergedEntries = mergeCatalogEntriesForSave(nextCatalog.entries, pendingLocalEntries);
      const savePayload = await api("/api/catalog", {
        method: "PUT",
        body: {
          entries: mergedEntries,
          updatedAtUtc: new Date().toISOString(),
        },
      });
      message = `${message} ${buildCatalogSaveMessage(savePayload, "Edicoes locais aplicadas ao catalogo central.")}`;
      nextCatalog = await api("/api/catalog");
    }

    setStatus(message);
    state.catalogDirty = false;
    state.catalogDirtyEntryIds = {};
    state.catalog = nextCatalog;
    renderOverview();
    renderCatalog();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    state.catalogSaving = false;
    renderOverview();
  }
}

function buildCatalogSaveMessage(payload, prefix) {
  const parts = [prefix, `${payload.upserted || 0} entradas persistidas.`];
  if (payload?.github?.ok) {
    parts.push("Snapshot publicado no GitHub.");
  } else if (payload?.github?.error) {
    parts.push(`Falha ao publicar no GitHub: ${payload.github.error}`);
  }
  return parts.join(" ");
}

function collectPendingCatalogEntries() {
  if (!state.catalogDirty) {
    return [];
  }
  const dirtyIds = new Set(
    Object.entries(state.catalogDirtyEntryIds || {})
      .filter(([, isDirty]) => Boolean(isDirty))
      .map(([entryId]) => entryId)
  );
  if (!dirtyIds.size) {
    return [];
  }
  return state.catalog.entries
    .filter((entry) => dirtyIds.has(entry.entryId))
    .map((entry) => ({ ...entry }));
}

function mergeCatalogEntriesForSave(baseEntries, pendingEntries) {
  const byId = new Map((Array.isArray(baseEntries) ? baseEntries : []).map((entry) => [entry.entryId, { ...entry }]));
  for (const pendingEntry of pendingEntries) {
    if (!pendingEntry?.entryId) {
      continue;
    }
    const existing = byId.get(pendingEntry.entryId) || {};
    byId.set(pendingEntry.entryId, {
      ...existing,
      ...pendingEntry,
    });
  }
  return Array.from(byId.values());
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
