const state = {
  auth: {
    ready: false,
    authenticated: false,
    user: null,
    loggingIn: false,
  },
  viewMode: "admin",
  adminTab: "overview",
  previewUserId: "",
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
  users: [],
  activeFiles: {
    activeTab: "workflows",
    loadingKind: null,
    deletingKey: null,
    byKind: {
      workflows: {
        items: [],
        endpointId: null,
        endpointName: null,
        sourceUrl: null,
        loadedAtUtc: null,
        error: null,
      },
      images: {
        items: [],
        endpointId: null,
        endpointName: null,
        sourceUrl: null,
        loadedAtUtc: null,
        error: null,
      },
    },
  },
};

const elements = {
  authPanel: document.getElementById("auth-panel"),
  dashboardShell: document.getElementById("dashboard-shell"),
  loginForm: document.getElementById("login-form"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginSubmitButton: document.getElementById("login-submit-button"),
  loginStatusBox: document.getElementById("login-status-box"),
  logoutButton: document.getElementById("logout-button"),
  sessionUserName: document.getElementById("session-user-name"),
  adminModeButton: document.getElementById("admin-mode-button"),
  userModeButton: document.getElementById("user-mode-button"),
  previewUserSelect: document.getElementById("preview-user-select"),
  viewModeSummary: document.getElementById("view-mode-summary"),
  adminTabButtons: [...document.querySelectorAll("[data-admin-tab-target]")],
  adminTabSections: [...document.querySelectorAll("[data-admin-tab]")],
  refreshButton: document.getElementById("refresh-button"),
  refreshCatalogButton: document.getElementById("refresh-catalog-button"),
  refreshFilesButton: document.getElementById("refresh-files-button"),
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
  filesCounter: document.getElementById("files-counter"),
  filesStatus: document.getElementById("files-status"),
  filesTableBody: document.getElementById("files-table-body"),
  filesTabWorkflows: document.getElementById("files-tab-workflows"),
  filesTabImages: document.getElementById("files-tab-images"),
  usersCounter: document.getElementById("users-counter"),
  usersList: document.getElementById("users-list"),
  permissionsList: document.getElementById("permissions-list"),
  userTemplate: document.getElementById("user-row-template"),
  userForm: document.getElementById("user-form"),
  userId: document.getElementById("user-id"),
  userName: document.getElementById("user-name"),
  userUsername: document.getElementById("user-username"),
  userEmail: document.getElementById("user-email"),
  userPassword: document.getElementById("user-password"),
  userNotes: document.getElementById("user-notes"),
  cancelUserEditButton: document.getElementById("cancel-user-edit-button"),
  userFormMode: document.getElementById("user-form-mode"),
  endpointList: document.getElementById("endpoint-list"),
  endpointTemplate: document.getElementById("endpoint-row-template"),
  endpointForm: document.getElementById("endpoint-form"),
  endpointId: document.getElementById("endpoint-id"),
  endpointName: document.getElementById("endpoint-name"),
  endpointUrl: document.getElementById("endpoint-url"),
  endpointNotes: document.getElementById("endpoint-notes"),
  endpointAssignedUserId: document.getElementById("endpoint-assigned-user-id"),
  endpointEnabled: document.getElementById("endpoint-enabled"),
  cancelEditButton: document.getElementById("cancel-edit-button"),
  formMode: document.getElementById("form-mode"),
  adminOnlySections: [...document.querySelectorAll("[data-admin-only='true']")],
};

boot();

function boot() {
  bindEvents();
  bootstrapSession();
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await login();
  });

  elements.logoutButton.addEventListener("click", async () => {
    await logout();
  });

  for (const button of elements.adminTabButtons) {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.adminTabTarget || "overview";
      state.adminTab = nextTab;
      render();
    });
  }

  elements.adminModeButton.addEventListener("click", () => {
    setViewMode("admin");
  });

  elements.userModeButton.addEventListener("click", () => {
    setViewMode("user");
  });

  elements.previewUserSelect.addEventListener("change", (event) => {
    state.previewUserId = event.currentTarget.value;
    render();
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshConfig({ showStatus: true });
  });

  elements.refreshCatalogButton.addEventListener("click", () => {
    refreshCatalog({ showStatus: true });
  });

  elements.refreshFilesButton.addEventListener("click", () => {
    refreshActiveFiles({ kind: state.activeFiles.activeTab, showStatus: true });
  });

  elements.saveCatalogButton.addEventListener("click", () => {
    saveCatalogEntries();
  });

  elements.filesTabWorkflows.addEventListener("click", () => {
    switchFilesTab("workflows");
  });

  elements.filesTabImages.addEventListener("click", () => {
    switchFilesTab("images");
  });

  elements.cancelEditButton.addEventListener("click", resetForm);

  elements.userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveUser();
      resetUserForm();
      setStatus("Usuario salvo com sucesso.");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  elements.cancelUserEditButton.addEventListener("click", resetUserForm);

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

async function bootstrapSession() {
  try {
    const session = await api("/api/auth/session", { allowUnauthorized: true });
    state.auth.ready = true;
    state.auth.authenticated = Boolean(session.authenticated);
    state.auth.user = session.user || null;
    if (state.auth.authenticated) {
      if (state.auth.user?.role === "admin") {
        state.viewMode = "admin";
      } else {
        state.viewMode = "user";
      }
      renderAuth();
      await refreshConfig({ showStatus: false, force: true });
      return;
    }
    renderAuth();
    setLoginStatus(buildLoginReadinessMessage(session));
  } catch (error) {
    state.auth.ready = true;
    state.auth.authenticated = false;
    state.auth.user = null;
    renderAuth();
    setLoginStatus(error.message, true);
  }
}

function buildLoginReadinessMessage(session) {
  if (!session?.authConfigured) {
    return "Falta configurar DASHBOARD_SESSION_SECRET no Worker.";
  }
  if (!session?.bootstrapAdminConfigured && !session?.hasStoredUsers) {
    return "Nenhum acesso configurado. Defina DASHBOARD_ADMIN_USERNAME e DASHBOARD_ADMIN_PASSWORD no Worker.";
  }
  return "Entre com suas credenciais para acessar os endpoints.";
}

function renderAuth() {
  const isAuthenticated = state.auth.authenticated;
  elements.authPanel.hidden = isAuthenticated;
  elements.dashboardShell.hidden = !isAuthenticated;
  elements.sessionUserName.textContent = state.auth.user?.name || "nao autenticado";
  elements.logoutButton.hidden = !isAuthenticated;
  elements.loginSubmitButton.disabled = state.auth.loggingIn;
  elements.loginSubmitButton.textContent = state.auth.loggingIn ? "Entrando..." : "Entrar";
}

async function login() {
  if (state.auth.loggingIn) {
    return;
  }
  const loginValue = elements.loginUsername.value.trim();
  const passwordValue = elements.loginPassword.value;
  state.auth.loggingIn = true;
  renderAuth();
  try {
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: {
        login: loginValue,
        password: passwordValue,
      },
      allowUnauthorized: true,
    });
    state.auth.authenticated = Boolean(payload.authenticated);
    state.auth.user = payload.user || null;
    state.auth.ready = true;
    state.viewMode = state.auth.user?.role === "admin" ? "admin" : "user";
    elements.loginPassword.value = "";
    setLoginStatus(`Bem-vindo, ${state.auth.user?.name || "usuario"}.`);
    renderAuth();
    await refreshConfig({ showStatus: false, force: true });
  } catch (error) {
    state.auth.authenticated = false;
    state.auth.user = null;
    setLoginStatus(error.message, true);
    renderAuth();
  } finally {
    state.auth.loggingIn = false;
    renderAuth();
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", {
      method: "POST",
      allowUnauthorized: true,
    });
  } catch {
    // ignore
  }
  state.auth.authenticated = false;
  state.auth.user = null;
  state.users = [];
  state.previewUserId = "";
  state.config = {
    endpoints: [],
    activeEndpointId: null,
    activeEndpoint: null,
    updatedAt: null,
    registryByEndpointId: {},
    registryCount: 0,
  };
  state.endpointStatusesById = {};
  state.catalog = {
    entries: [],
    totalEntries: 0,
    lastUpdated: null,
    recentSyncs: [],
    recentEndpoints: [],
  };
  resetActiveFilesState();
  elements.loginPassword.value = "";
  setLoginStatus("Sessao encerrada.");
  renderAuth();
}

function setLoginStatus(message, isError = false) {
  elements.loginStatusBox.textContent = message;
  elements.loginStatusBox.style.color = isError ? "#ffbec3" : "";
}

async function refreshConfig(options = {}) {
  if (!options.force && !confirmCatalogRefreshLoss()) {
    return;
  }
  try {
    const [config, catalog, usersPayload, statusError] = await Promise.all([
      api("/api/config"),
      api("/api/catalog"),
      api("/api/users"),
      refreshEndpointStatuses(),
    ]);
    const previousActiveEndpointId = state.config.activeEndpoint?.id || state.config.activeEndpointId;
    state.config = config;
    state.catalog = catalog;
    state.users = usersPayload.users || [];
    state.catalogDirty = false;
    state.catalogDirtyEntryIds = {};
    if (previousActiveEndpointId !== (config.activeEndpoint?.id || config.activeEndpointId)) {
      resetActiveFilesState();
    }
    syncPreviewUserSelection();
    render();
    await refreshActiveFiles({
      kind: state.activeFiles.activeTab,
      showStatus: false,
      suppressMissingActive: true,
    });
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
  let openedConsoleGroup = false;
  try {
    console.group("[projectmdl] Atualizar catalogo");
    openedConsoleGroup = true;
    console.log("action", "refresh-catalog");
    console.log("readsCentralCatalogOnly", true);
    console.log("catalogDirty", state.catalogDirty);
    console.log("activeEndpointId", state.config.activeEndpointId || null);
    console.log("activeEndpointName", state.config.activeEndpoint?.name || null);
    console.log("activeEndpointUrl", state.config.activeEndpoint?.url || null);
    console.log("request", "GET /api/catalog");
    state.catalog = await api("/api/catalog");
    console.log("response.totalEntries", state.catalog.totalEntries || state.catalog.entries?.length || 0);
    console.log("response.lastUpdated", state.catalog.lastUpdated || null);
    console.log("response.recentSync", state.catalog.recentSyncs?.[0] || null);
    console.log(
      "note",
      "Este botao le apenas o catalogo central salvo no Dashboard. Para puxar do endpoint ativo, use 'Salvar Catalogo'."
    );
    console.log("payload", state.catalog);
    console.groupEnd();
    openedConsoleGroup = false;
    state.catalogDirty = false;
    state.catalogDirtyEntryIds = {};
    renderCatalog();
    renderOverview();
    if (options.showStatus) {
      setStatus(
        "Catalogo central atualizado. Para puxar do endpoint ativo do Modal, use Salvar Catalogo."
      );
    }
  } catch (error) {
    console.error("[projectmdl] Atualizar catalogo falhou", {
      activeEndpointId: state.config.activeEndpointId || null,
      activeEndpointName: state.config.activeEndpoint?.name || null,
      activeEndpointUrl: state.config.activeEndpoint?.url || null,
      error: error?.message || String(error),
    });
    if (openedConsoleGroup) {
      console.groupEnd();
    }
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
  const active = getCurrentVisibleActiveEndpoint();
  const displayEndpoints = getDisplayEndpoints();
  elements.proxyBase.textContent = `${location.origin}/modal`;
  elements.activeEndpointName.textContent = active ? active.name : "nenhum";
  elements.endpointCounter.textContent = buildEndpointCounterText(displayEndpoints);
  renderViewMode();
  renderOverview();
  renderUsers();
  renderPermissions();
  renderEndpointList(displayEndpoints);
  renderCatalog();
  renderFiles();
}

function renderViewMode() {
  const isAdminUser = state.auth.user?.role === "admin";
  const isAdmin = isAdminUser && state.viewMode === "admin";
  elements.adminModeButton.hidden = !isAdminUser;
  elements.userModeButton.hidden = !isAdminUser;
  elements.previewUserSelect.closest(".preview-user-field").hidden = !isAdminUser;
  elements.adminModeButton.classList.toggle("is-active", isAdmin);
  elements.userModeButton.classList.toggle("is-active", !isAdmin);
  for (const section of elements.adminOnlySections) {
    section.hidden = !isAdmin;
  }
  for (const button of elements.adminTabButtons) {
    const isCurrent = button.dataset.adminTabTarget === state.adminTab;
    button.classList.toggle("is-active", isCurrent);
    button.setAttribute("aria-selected", String(isCurrent));
  }
  for (const section of elements.adminTabSections) {
    const targetTab = section.dataset.adminTab;
    const isAdminOnly = section.dataset.adminOnly === "true";
    section.hidden =
      state.viewMode === "admin"
        ? Boolean(targetTab && targetTab !== state.adminTab)
        : isAdminOnly;
  }
  elements.previewUserSelect.disabled = !state.users.length;
  populatePreviewUserSelect();
  elements.viewModeSummary.textContent = isAdmin
    ? "Administrador com acesso completo ao painel."
    : buildUserModeSummary();
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

function renderUsers() {
  elements.usersCounter.textContent = `${state.users.length} usuario(s)`;
  replaceSelectOptions(
    elements.endpointAssignedUserId,
    "Sem atribuicao",
    state.users.map((user) => user.id),
    elements.endpointAssignedUserId.value
  );
  for (const option of elements.endpointAssignedUserId.options) {
    const user = state.users.find((candidate) => candidate.id === option.value);
    if (user) {
      option.textContent = user.name;
    }
  }

  elements.usersList.innerHTML = "";
  if (!state.users.length) {
    const empty = document.createElement("div");
    empty.className = "status-box";
    empty.textContent = "Nenhum usuario cadastrado ainda.";
    elements.usersList.append(empty);
    return;
  }

  for (const user of state.users) {
    const fragment = elements.userTemplate.content.cloneNode(true);
    fragment.querySelector(".user-name").textContent = user.name;
    fragment.querySelector(".user-email").textContent = user.username
      ? `${user.username}${user.email ? ` | ${user.email}` : ""}`
      : user.email || "Sem email";
    fragment.querySelector(".user-notes").textContent = user.notes || "Sem notas.";
    fragment.querySelector(".preview-user-button").addEventListener("click", () => {
      state.previewUserId = user.id;
      setViewMode("user");
    });
    fragment.querySelector(".edit-user-button").addEventListener("click", () => populateUserForm(user));
    fragment.querySelector(".delete-user-button").addEventListener("click", () => removeUser(user.id));
    elements.usersList.append(fragment);
  }
}

function renderPermissions() {
  elements.permissionsList.innerHTML = "";
  if (!state.config.endpoints.length) {
    const empty = document.createElement("div");
    empty.className = "status-box";
    empty.textContent = "Nenhum endpoint configurado ainda.";
    elements.permissionsList.append(empty);
    return;
  }

  for (const endpoint of state.config.endpoints) {
    const card = document.createElement("article");
    card.className = "permission-card";

    const header = document.createElement("div");
    header.className = "permission-card-head";

    const titleBlock = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = endpoint.name;
    const subtitle = document.createElement("p");
    subtitle.className = "permission-card-subtitle";
    subtitle.textContent = buildEndpointUiUrl(endpoint) || endpoint.url;
    titleBlock.append(title, subtitle);

    const controls = document.createElement("div");
    controls.className = "permission-controls";

    const userField = document.createElement("label");
    userField.className = "field compact-field";
    const userSpan = document.createElement("span");
    userSpan.textContent = "Usuario";
    const userSelect = document.createElement("select");
    const currentValue = endpoint.assignedUserId || "";
    replaceSelectOptions(
      userSelect,
      "Sem atribuicao",
      state.users.map((user) => user.id),
      currentValue
    );
    for (const option of userSelect.options) {
      const user = state.users.find((candidate) => candidate.id === option.value);
      if (user) {
        option.textContent = user.name;
      }
    }
    userSelect.addEventListener("change", () => {
      saveEndpointPermissions(endpoint.id, {
        assignedUserId: userSelect.value || null,
        userCanDeploy: deployToggle.checked,
      });
    });
    userField.append(userSpan, userSelect);

    const deployField = document.createElement("label");
    deployField.className = "toggle";
    const deployToggle = document.createElement("input");
    deployToggle.type = "checkbox";
    deployToggle.checked = endpoint.userCanDeploy !== false;
    deployToggle.addEventListener("change", () => {
      saveEndpointPermissions(endpoint.id, {
        assignedUserId: userSelect.value || null,
        userCanDeploy: deployToggle.checked,
      });
    });
    const deployText = document.createElement("span");
    deployText.textContent = "Usuario pode deploy/stop";
    deployField.append(deployToggle, deployText);

    controls.append(userField, deployField);
    header.append(titleBlock, controls);
    card.append(header);
    elements.permissionsList.append(card);
  }
}

function populatePreviewUserSelect() {
  const selectedValue = state.previewUserId;
  elements.previewUserSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Selecione um usuario";
  elements.previewUserSelect.append(defaultOption);
  for (const user of state.users) {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.name;
    elements.previewUserSelect.append(option);
  }
  elements.previewUserSelect.value = state.users.some((user) => user.id === selectedValue)
    ? selectedValue
    : "";
}

function syncPreviewUserSelection() {
  if (!state.users.length) {
    state.previewUserId = "";
    return;
  }
  if (state.previewUserId && state.users.some((user) => user.id === state.previewUserId)) {
    return;
  }
  state.previewUserId = state.users[0].id;
}

function buildUserModeSummary() {
  const previewUser = getPreviewUser();
  if (!previewUser) {
    return "Modo usuario sem um usuario selecionado. Cadastre um usuario e selecione-o para visualizar a tela.";
  }
  const assignedCount = state.config.endpoints.filter(
    (endpoint) => endpoint.assignedUserId === previewUser.id
  ).length;
  return `Visualizando como ${previewUser.name}. Ele vera ${assignedCount} endpoint(s) atribuido(s).`;
}

function getPreviewUser() {
  const targetUserId =
    state.auth.user?.role === "admin" ? state.previewUserId : state.auth.user?.id || state.previewUserId;
  return state.users.find((user) => user.id === targetUserId) || null;
}

function setViewMode(mode) {
  if (state.auth.user?.role !== "admin") {
    state.viewMode = "user";
    render();
    return;
  }
  state.viewMode = mode === "user" ? "user" : "admin";
  if (state.viewMode === "user") {
    syncPreviewUserSelection();
  }
  render();
}

function renderCatalog() {
  const entries = getFilteredCatalogEntries();
  const totalEntries = Number(state.catalog.totalEntries || state.catalog.entries.length || 0);
  elements.catalogCounter.textContent = `${entries.length} visiveis | ${totalEntries} no total`;
  elements.catalogSyncSummary.textContent = buildCatalogSyncSummary();
  renderCatalogFilterOptions();
  renderCatalogTable(entries);
}

function renderFiles() {
  const kind = state.activeFiles.activeTab;
  const bucket = state.activeFiles.byKind[kind];
  const activeEndpoint = getCurrentVisibleActiveEndpoint();
  const isLoading = state.activeFiles.loadingKind === kind;

  elements.filesTabWorkflows.classList.toggle("is-active", kind === "workflows");
  elements.filesTabWorkflows.setAttribute("aria-selected", String(kind === "workflows"));
  elements.filesTabImages.classList.toggle("is-active", kind === "images");
  elements.filesTabImages.setAttribute("aria-selected", String(kind === "images"));
  elements.refreshFilesButton.disabled = !activeEndpoint || isLoading;
  elements.refreshFilesButton.textContent = isLoading ? "Atualizando..." : "Atualizar arquivos";

  if (!activeEndpoint) {
    elements.filesCounter.textContent = "Nenhum endpoint ativo";
    elements.filesStatus.textContent =
      "Ative um endpoint para consultar workflows e imagens persistidas.";
    renderFilesTable([]);
    return;
  }

  elements.filesCounter.textContent = `${bucket.items.length} ${
    kind === "workflows" ? "workflow(s)" : "imagem(ns)"
  } | endpoint ativo: ${activeEndpoint.name}`;
  elements.filesStatus.textContent = buildFilesStatusText(kind, bucket, activeEndpoint, isLoading);
  renderFilesTable(bucket.items, kind);
}

function buildFilesStatusText(kind, bucket, activeEndpoint, isLoading) {
  if (isLoading) {
    return `Consultando ${kind === "workflows" ? "workflows" : "imagens"} persistidos de ${activeEndpoint.name}...`;
  }
  if (bucket.error) {
    return bucket.error;
  }
  if (!bucket.loadedAtUtc) {
    return `Nenhuma consulta feita ainda para ${kind === "workflows" ? "workflows" : "imagens"} do endpoint ativo.`;
  }
  const parts = [
    `Origem: ${bucket.sourceUrl || activeEndpoint.url}`,
    `Atualizado: ${formatTimestamp(bucket.loadedAtUtc)}`,
  ];
  if (bucket.endpointName) {
    parts.push(`Endpoint: ${bucket.endpointName}`);
  }
  return parts.join(" | ");
}

function renderFilesTable(items, kind) {
  elements.filesTableBody.innerHTML = "";
  if (!items.length) {
    const emptyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "catalog-empty";
    cell.textContent = `Nenhum ${kind === "workflows" ? "workflow" : "arquivo de imagem"} encontrado.`;
    emptyRow.append(cell);
    elements.filesTableBody.append(emptyRow);
    return;
  }

  for (const item of items) {
    const row = document.createElement("tr");
    row.append(
      buildFilePreviewCell(item, kind),
      buildFileTextCell(item.name),
      buildFileTextCell(item.relativePath, "file-path-cell"),
      buildFileTextCell(item.modifiedAtUtc ? formatTimestamp(item.modifiedAtUtc) : "sem data", "catalog-meta-cell"),
      buildFileTextCell(formatBytes(item.sizeBytes), "catalog-meta-cell"),
      buildFileActionsCell(item, kind)
    );
    elements.filesTableBody.append(row);
  }
}

function buildFilePreviewCell(item, kind) {
  const cell = document.createElement("td");
  cell.className = "file-preview-cell";
  if (kind !== "images") {
    cell.textContent = "—";
    return cell;
  }

  const image = document.createElement("img");
  image.className = "file-preview-image";
  image.alt = item.name;
  image.loading = "lazy";
  image.src = buildActiveFilePreviewUrl(kind, item.relativePath);
  image.addEventListener("error", () => {
    cell.textContent = "sem preview";
  });
  cell.append(image);
  return cell;
}

function buildFileTextCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) {
    cell.className = className;
  }
  cell.textContent = text;
  return cell;
}

function buildFileActionsCell(item, kind) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  wrapper.className = "file-actions";

  const downloadLink = document.createElement("a");
  downloadLink.className = "endpoint-link";
  downloadLink.textContent = "Baixar";
  downloadLink.href = buildActiveFileDownloadUrl(kind, item.relativePath);
  downloadLink.rel = "noreferrer";
  downloadLink.target = "_blank";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent =
    state.activeFiles.deletingKey === `${kind}:${item.relativePath}` ? "Deletando..." : "Deletar";
  deleteButton.disabled = state.activeFiles.deletingKey === `${kind}:${item.relativePath}`;
  deleteButton.addEventListener("click", () => deleteActiveFile(kind, item));

  wrapper.append(downloadLink, deleteButton);
  cell.append(wrapper);
  return cell;
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
    const ownership = fragment.querySelector(".endpoint-ownership");
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
    const deployButton = fragment.querySelector(".deploy-button");
    const stopButton = fragment.querySelector(".stop-button");
    const restartButton = fragment.querySelector(".restart-button");
    const activateButton = fragment.querySelector(".activate-button");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const registry = endpoint.registry || null;
    const liveStatus = state.endpointStatusesById[endpoint.id] || null;
    const isConfigured = endpoint.configured !== false;
    const canRefresh = canRefreshEndpointStatus(endpoint, liveStatus);
    const isRefreshing = state.refreshingEndpointIds[endpoint.id] === true;

    name.textContent = endpoint.name;
    const cloudflareUiUrl = buildEndpointUiUrl(endpoint);
    url.textContent =
      state.viewMode === "user"
        ? cloudflareUiUrl || "UI indisponivel no dominio do dashboard."
        : endpoint.url ||
          liveStatus?.publicBaseUrl ||
          registry?.publicBaseUrl ||
          liveStatus?.workflowApiEndpoint ||
          registry?.workflowApiEndpoint ||
          "Sem URL reportada.";
    notes.textContent = buildEndpointNotes(endpoint);
    const assignedUser = state.users.find((user) => user.id === endpoint.assignedUserId) || null;
    ownership.hidden = !assignedUser;
    ownership.textContent = assignedUser ? `Atribuido a: ${assignedUser.name}` : "";
    const proxyPath = buildEndpointProxyPath(endpoint);
    proxySummary.hidden = !proxyPath;
    proxySummary.textContent = proxyPath ? `UI Cloudflare: ${proxyPath}` : "";
    activeBadge.hidden = !isConfigured || state.config.activeEndpoint?.id !== endpoint.id;
    disabledBadge.hidden = !isConfigured || endpoint.enabled !== false;
    registryBadge.hidden = !registry;
    unmanagedBadge.hidden = isConfigured || !registry;
    refreshStatusButton.hidden = !canRefresh;
    refreshStatusButton.disabled = isRefreshing;
    const canOperateEndpoint = Boolean(endpoint.modalAccountKey && endpoint.modalAppName);
    const userCanOperateEndpoint = canOperateEndpoint && endpoint.userCanDeploy !== false;
    deployButton.hidden = !isConfigured || !canOperateEndpoint;
    stopButton.hidden = !isConfigured || !canOperateEndpoint;
    restartButton.hidden = !isConfigured || !canOperateEndpoint;
    activateButton.disabled =
      !isConfigured || !endpoint.enabled || state.config.activeEndpoint?.id === endpoint.id;
    if (state.viewMode === "user") {
      refreshStatusButton.hidden = true;
      activateButton.hidden = true;
      editButton.hidden = true;
      deleteButton.hidden = true;
      deployButton.textContent = "Ligar";
      stopButton.textContent = "Desligar";
      restartButton.textContent = "Reiniciar";
      deployButton.hidden = !userCanOperateEndpoint;
      stopButton.hidden = !userCanOperateEndpoint;
      restartButton.hidden = !userCanOperateEndpoint;
      actions.hidden = !userCanOperateEndpoint;
    } else {
      deployButton.textContent = "Deploy";
      stopButton.textContent = "Stop";
      restartButton.textContent = "Restart";
      actions.hidden = !isConfigured && !canRefresh;
      activateButton.hidden = !isConfigured;
      editButton.hidden = !isConfigured;
      deleteButton.hidden = !isConfigured;
    }

    const liveSummaryText = buildLiveStatusSummary(liveStatus);
    liveStatusSummary.hidden = !liveSummaryText;
    liveStatusSummary.textContent = liveSummaryText;

    const summaryText = buildRegistrySummary(registry, endpoint.id);
    registrySummary.hidden = !summaryText;
    registrySummary.textContent = summaryText;

    const hasLinks =
      state.viewMode === "user"
        ? [applyOptionalLink(uiLink, cloudflareUiUrl)].some(Boolean)
        : [
            applyOptionalLink(uiLink, cloudflareUiUrl),
            applyOptionalLink(statusLink, liveStatus?.statusEndpoint || registry?.statusEndpoint),
            applyOptionalLink(
              workflowLink,
              liveStatus?.workflowApiEndpoint || registry?.workflowApiEndpoint
            ),
            applyOptionalLink(
              promptLink,
              liveStatus?.promptStatusEndpoint || registry?.promptStatusEndpoint
            ),
            applyOptionalLink(
              publicLink,
              liveStatus?.publicBaseUrl || registry?.publicBaseUrl || endpoint.url
            ),
          ].some(Boolean);
    endpointLinks.hidden = !hasLinks;

    if (canRefresh) {
      refreshStatusButton.addEventListener("click", () =>
        refreshSingleEndpointStatus(endpoint.id, endpoint.name)
      );
    }

    if (isConfigured && canOperateEndpoint) {
      deployButton.addEventListener("click", () => dispatchJobForEndpoint(endpoint, "deploy"));
      stopButton.addEventListener("click", () => dispatchJobForEndpoint(endpoint, "stop"));
      restartButton.addEventListener("click", () => dispatchJobForEndpoint(endpoint, "restart"));
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
  const combined = configuredEndpoints.concat(discoveredEndpoints);
  if (state.viewMode !== "user") {
    return combined;
  }
  const previewUser = getPreviewUser();
  if (!previewUser) {
    return [];
  }
  return combined.filter(
    (endpoint) => endpoint.configured && endpoint.assignedUserId === previewUser.id
  );
}

function getCurrentVisibleActiveEndpoint() {
  if (state.viewMode !== "user") {
    return state.config.activeEndpoint;
  }
  const previewUser = getPreviewUser();
  if (!previewUser) {
    return null;
  }
  const assignedActive =
    state.config.activeEndpoint && state.config.activeEndpoint.assignedUserId === previewUser.id
      ? state.config.activeEndpoint
      : null;
  if (assignedActive) {
    return assignedActive;
  }
  return state.config.endpoints.find(
    (endpoint) => endpoint.enabled !== false && endpoint.assignedUserId === previewUser.id
  ) || null;
}

function buildEndpointCounterText(displayEndpoints) {
  if (state.viewMode === "user") {
    const previewUser = getPreviewUser();
    const assignedCount = displayEndpoints.length;
    const onlineCount = Object.values(state.endpointStatusesById).filter(
      (status) =>
        status.reachable &&
        status.ok &&
        displayEndpoints.some((endpoint) => endpoint.id === status.endpointId)
    ).length;
    const parts = [
      previewUser ? `${assignedCount} atribuídos para ${previewUser.name}` : `${assignedCount} atribuídos`,
    ];
    if (onlineCount) {
      parts.push(`${onlineCount} online`);
    }
    return parts.join(" | ");
  }
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

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let current = size;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const precision = current >= 10 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(precision)} ${units[unitIndex]}`;
}

function buildConfigWithFormChanges() {
  const id = elements.endpointId.value.trim() || crypto.randomUUID();
  const current = state.config.endpoints.find((endpoint) => endpoint.id === id) || {};
  const entry = {
    ...current,
    id,
    name: elements.endpointName.value.trim(),
    url: elements.endpointUrl.value.trim(),
    notes: elements.endpointNotes.value.trim(),
    assignedUserId: elements.endpointAssignedUserId.value.trim() || null,
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
  elements.endpointAssignedUserId.value = endpoint.assignedUserId || "";
  elements.endpointEnabled.checked = endpoint.enabled !== false;
  elements.formMode.textContent = "edicao";
}

function resetForm() {
  elements.endpointForm.reset();
  elements.endpointId.value = "";
  elements.endpointEnabled.checked = true;
  elements.endpointAssignedUserId.value = "";
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

function switchFilesTab(kind) {
  if (!state.activeFiles.byKind[kind] || state.activeFiles.activeTab === kind) {
    return;
  }
  state.activeFiles.activeTab = kind;
  renderFiles();
  const bucket = state.activeFiles.byKind[kind];
  const activeEndpointId = state.config.activeEndpoint?.id || null;
  if (!bucket.loadedAtUtc || bucket.endpointId !== activeEndpointId) {
    refreshActiveFiles({ kind, showStatus: false, suppressMissingActive: true });
  }
}

function resetActiveFilesState() {
  state.activeFiles.loadingKind = null;
  state.activeFiles.deletingKey = null;
  state.activeFiles.byKind = {
    workflows: {
      items: [],
      endpointId: null,
      endpointName: null,
      sourceUrl: null,
      loadedAtUtc: null,
      error: null,
    },
    images: {
      items: [],
      endpointId: null,
      endpointName: null,
      sourceUrl: null,
      loadedAtUtc: null,
      error: null,
    },
  };
}

async function refreshActiveFiles(options = {}) {
  const kind = options.kind || state.activeFiles.activeTab;
  const activeEndpoint = getCurrentVisibleActiveEndpoint();
  if (!activeEndpoint) {
    if (!options.suppressMissingActive) {
      setStatus("Nenhum endpoint ativo configurado para consultar arquivos.", true);
    }
    renderFiles();
    return;
  }

  state.activeFiles.loadingKind = kind;
  state.activeFiles.byKind[kind].error = null;
  renderFiles();

  try {
    const payload = await api(`/api/active-files/${kind}`);
    state.activeFiles.byKind[kind] = {
      items: Array.isArray(payload.items) ? payload.items : [],
      endpointId: payload.endpointId || activeEndpoint.id,
      endpointName: payload.endpointName || activeEndpoint.name,
      sourceUrl: payload.sourceUrl || null,
      loadedAtUtc: new Date().toISOString(),
      error: null,
    };
    if (options.showStatus) {
      setStatus(
        `${kind === "workflows" ? "Workflows" : "Imagens"} carregados do endpoint ativo ${payload.endpointName || activeEndpoint.name}.`
      );
    }
  } catch (error) {
    state.activeFiles.byKind[kind] = {
      ...state.activeFiles.byKind[kind],
      items: [],
      endpointId: activeEndpoint.id,
      endpointName: activeEndpoint.name,
      sourceUrl: null,
      loadedAtUtc: null,
      error: error.message,
    };
    if (options.showStatus) {
      setStatus(error.message, true);
    }
  } finally {
    state.activeFiles.loadingKind = null;
    renderFiles();
  }
}

async function deleteActiveFile(kind, item) {
  if (!confirm(`Deletar "${item.name}" do endpoint ativo?`)) {
    return;
  }
  const deletingKey = `${kind}:${item.relativePath}`;
  state.activeFiles.deletingKey = deletingKey;
  renderFiles();
  try {
    const payload = await api(`/api/active-files/${kind}/delete`, {
      method: "POST",
      body: {
        path: item.relativePath,
      },
    });
    setStatus(
      `${kind === "workflows" ? "Workflow" : "Arquivo"} removido do endpoint ativo: ${payload.deletedPath || item.relativePath}.`
    );
    await refreshActiveFiles({ kind, showStatus: false, suppressMissingActive: true });
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    state.activeFiles.deletingKey = null;
    renderFiles();
  }
}

function buildActiveFileDownloadUrl(kind, relativePath) {
  return `/api/active-files/${kind}/download?path=${encodeURIComponent(relativePath)}`;
}

function buildActiveFilePreviewUrl(kind, relativePath) {
  return `/api/active-files/${kind}/download?path=${encodeURIComponent(relativePath)}&inline=1`;
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
  const previousActiveEndpointId = state.config.activeEndpoint?.id || state.config.activeEndpointId;
  const payload = await api("/api/config", {
    method: "PUT",
    body: nextConfig,
  });
  state.config = payload;
  if (previousActiveEndpointId !== (payload.activeEndpoint?.id || payload.activeEndpointId)) {
    resetActiveFilesState();
  }
  await refreshEndpointStatuses();
  render();
  await refreshActiveFiles({
    kind: state.activeFiles.activeTab,
    showStatus: false,
    suppressMissingActive: true,
  });
}

async function saveEndpointPermissions(endpointId, patch) {
  const endpoint = state.config.endpoints.find((candidate) => candidate.id === endpointId);
  if (!endpoint) {
    return;
  }
  const nextConfig = {
    endpoints: state.config.endpoints.map((candidate) =>
      candidate.id === endpointId
        ? {
            ...candidate,
            assignedUserId: patch.assignedUserId || null,
            userCanDeploy: patch.userCanDeploy !== false,
          }
        : candidate
    ),
    activeEndpointId: state.config.activeEndpointId,
  };
  await saveConfig(nextConfig);
  setStatus(`Permissoes atualizadas para ${endpoint.name}.`);
}

async function saveUser() {
  const payload = await api("/api/users", {
    method: "POST",
    body: {
      id: elements.userId.value.trim() || undefined,
      name: elements.userName.value.trim(),
      username: elements.userUsername.value.trim(),
      email: elements.userEmail.value.trim(),
      password: elements.userPassword.value,
      notes: elements.userNotes.value.trim(),
      role: "user",
    },
  });
  state.users = payload.users || [];
  syncPreviewUserSelection();
  render();
}

function populateUserForm(user) {
  elements.userId.value = user.id;
  elements.userName.value = user.name;
  elements.userUsername.value = user.username || "";
  elements.userEmail.value = user.email || "";
  elements.userPassword.value = "";
  elements.userNotes.value = user.notes || "";
  elements.userFormMode.textContent = "edicao";
}

function resetUserForm() {
  elements.userForm.reset();
  elements.userId.value = "";
  elements.userPassword.value = "";
  elements.userFormMode.textContent = "novo";
}

async function removeUser(userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (!user) {
    return;
  }
  if (!confirm(`Remover o usuario "${user.name}"? Os endpoints atribuidos ficarao sem usuario.`)) {
    return;
  }
  const payload = await api(`/api/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  state.users = payload.users || [];
  if (state.previewUserId === userId) {
    syncPreviewUserSelection();
  }
  await refreshConfig({ showStatus: false, force: true });
  setStatus(`Usuario removido: ${user.name}.`);
}

async function dispatchJobForEndpoint(endpoint, action) {
  const previewUser = getPreviewUser();
  const payload = await api("/api/jobs", {
    method: "POST",
    body: {
      action,
      endpointId: endpoint.id,
      requestedByUserId: state.viewMode === "user" ? previewUser?.id || null : null,
      requestedByUserName: state.viewMode === "user" ? previewUser?.name || null : null,
    },
  });
  const messageBase =
    action === "deploy"
      ? "Deploy disparado"
      : action === "stop"
        ? "Stop disparado"
        : "Restart disparado";
  if (payload?.job?.status === "dispatched") {
    setStatus(`${messageBase} para ${endpoint.name}. Workflow: ${payload.job.workflowId}.`);
  } else {
    setStatus(
      payload?.job?.dispatchError || `Falha ao disparar ${action} para ${endpoint.name}.`,
      true
    );
  }
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
    if (response.status === 401 && !options.allowUnauthorized) {
      state.auth.authenticated = false;
      state.auth.user = null;
      renderAuth();
      setLoginStatus("Sua sessao expirou. Faça login novamente.", true);
    }
    throw new Error(typeof payload === "string" ? payload : payload.error || "Erro inesperado.");
  }

  return payload;
}

function setStatus(message, isError = false) {
  elements.statusBox.textContent = message;
  elements.statusBox.style.color = isError ? "#ffbec3" : "";
}
