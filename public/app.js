const STORAGE_KEY = "projectmdl-admin-token";

const state = {
  config: {
    endpoints: [],
    activeEndpointId: null,
    activeEndpoint: null,
    updatedAt: null,
  },
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
    const payload = await api("/api/config");
    state.config = payload;
    render();
    if (options.showStatus) {
      setStatus("Configuracao atualizada.");
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

function render() {
  const active = state.config.activeEndpoint;
  elements.proxyBase.textContent = `${location.origin}/modal`;
  elements.activeEndpointName.textContent = active ? active.name : "nenhum";
  elements.endpointCounter.textContent = `${state.config.endpoints.length} configurados`;
  renderEndpointList();
}

function renderEndpointList() {
  elements.endpointList.innerHTML = "";
  if (!state.config.endpoints.length) {
    const empty = document.createElement("div");
    empty.className = "status-box";
    empty.textContent = "Nenhum endpoint cadastrado ainda.";
    elements.endpointList.append(empty);
    return;
  }

  for (const endpoint of state.config.endpoints) {
    const fragment = elements.endpointTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".endpoint-card");
    const name = fragment.querySelector(".endpoint-name");
    const url = fragment.querySelector(".endpoint-url");
    const notes = fragment.querySelector(".endpoint-notes");
    const activeBadge = fragment.querySelector(".active-badge");
    const disabledBadge = fragment.querySelector(".disabled-badge");
    const activateButton = fragment.querySelector(".activate-button");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");

    name.textContent = endpoint.name;
    url.textContent = endpoint.url;
    notes.textContent = endpoint.notes || "Sem notas.";
    activeBadge.hidden = state.config.activeEndpoint?.id !== endpoint.id;
    disabledBadge.hidden = endpoint.enabled;
    activateButton.disabled = !endpoint.enabled || state.config.activeEndpoint?.id === endpoint.id;

    activateButton.addEventListener("click", () => activateEndpoint(endpoint.id));
    editButton.addEventListener("click", () => populateForm(endpoint));
    deleteButton.addEventListener("click", () => removeEndpoint(endpoint.id));

    card.dataset.endpointId = endpoint.id;
    elements.endpointList.append(fragment);
  }
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
    state.config.activeEndpointId = payload.activeEndpoint?.id || null;
    await refreshConfig();
    setStatus(`Endpoint ativo: ${payload.activeEndpoint?.name || "nenhum"}.`);
  } catch (error) {
    setStatus(error.message, true);
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
