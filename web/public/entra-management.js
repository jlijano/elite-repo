(() => {
  const page = document.body?.dataset.adminPage || "";
  if (!["company", "department", "group"].includes(page)) return;

  const sessionTokenStorageKey = "switchboard-session-token";
  const adminTokenStorageKey = "switchboard-admin-token";
  const state = { companies: [], departments: [], groups: [], editingId: "" };
  const labels = { company: "Company", department: "Department", group: "Group" };
  const plural = { company: "companies", department: "departments", group: "groups" };
  const endpoints = { company: "companies", department: "departments", group: "groups" };

  const $ = (id) => document.getElementById(id);
  const els = {
    status: $("status"),
    search: $("entraSearch"),
    list: $("entraList"),
    form: $("entraForm"),
    formTitle: $("entraFormTitle"),
    name: $("entraName"),
    description: $("entraDescription"),
    statusField: $("entraStatus"),
    company: $("entraCompany"),
    department: $("entraDepartment"),
    saveButton: $("saveEntraButton"),
    cancelButton: $("cancelEntraEditButton")
  };

  const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const textMatch = (value, query = "") => String(value || "").toLowerCase().includes(query.trim().toLowerCase());
  const time = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "";

  function injectStyles() {
    if (document.getElementById("entraManagementStyles")) return;
    const style = document.createElement("style");
    style.id = "entraManagementStyles";
    style.textContent = `
      .entra-management-grid { display: grid; grid-template-columns: minmax(320px, 0.9fr) minmax(360px, 1.1fr); min-height: 520px; }
      .entra-form-panel { min-width: 0; display: grid; align-content: start; gap: 12px; padding: 12px; border-left: 1px solid var(--line); }
      .entra-list { max-height: 640px; }
      .entra-toolbar { min-width: min(440px, 100%); }
      .entra-toolbar input { flex: 1 1 220px; }
      .entra-meta { color: var(--muted); }
      .entra-parent { color: var(--text); font-weight: 800; }
      .entra-scope-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      @media (max-width: 1060px) { .entra-management-grid { grid-template-columns: 1fr; } .entra-form-panel { border-left: 0; border-top: 1px solid var(--line); } }
      @media (max-width: 760px) { .entra-toolbar { width: 100%; min-width: 0; flex-direction: column; align-items: stretch; } .entra-scope-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, error = false) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.hidden = false;
    els.status.classList.toggle("error", error);
  }

  function adminHeaders() {
    const headers = { "Content-Type": "application/json" };
    const sessionToken = sessionStorage.getItem(sessionTokenStorageKey) || "";
    const adminToken = sessionStorage.getItem(adminTokenStorageKey) || "";
    if (sessionToken) headers["x-session-token"] = sessionToken;
    if (adminToken) headers["x-admin-token"] = adminToken;
    return headers;
  }

  async function apiJson(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...adminHeaders(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function collection() {
    return state[plural[page]] || [];
  }

  function companyName(companyId) {
    return state.companies.find((item) => item.id === companyId)?.name || "No company";
  }

  function departmentName(departmentId) {
    return state.departments.find((item) => item.id === departmentId)?.name || "No department";
  }

  function statusBadge(status = "active") {
    const cls = status === "archived" ? "status-storage" : "status-ready";
    return `<small class="status-badge ${cls}">${html(status)}</small>`;
  }

  function fillSelect(select, items, placeholder, selected = "") {
    if (!select) return;
    select.innerHTML = `<option value="">${html(placeholder)}</option>${items.map((item) => `<option value="${html(item.id)}">${html(item.name)}</option>`).join("")}`;
    select.value = selected || "";
  }

  function updateDepartmentOptions(selected = "") {
    if (!els.department) return;
    const companyId = els.company?.value || "";
    const departments = state.departments.filter((item) => item.status !== "archived" && (!companyId || item.companyId === companyId));
    fillSelect(els.department, departments, "No department", selected);
  }

  function renderScopeControls(record = {}) {
    fillSelect(els.company, state.companies.filter((item) => item.status !== "archived"), "Select company", record.companyId || "");
    updateDepartmentOptions(record.departmentId || "");
  }

  function resetForm() {
    state.editingId = "";
    els.form?.reset();
    if (els.statusField) els.statusField.value = "active";
    if (els.formTitle) els.formTitle.textContent = `Create ${labels[page]}`;
    if (els.saveButton) els.saveButton.textContent = `Create ${labels[page]}`;
    if (els.cancelButton) els.cancelButton.hidden = true;
    renderScopeControls();
  }

  function fillForm(record) {
    state.editingId = record.id;
    if (els.name) els.name.value = record.name || "";
    if (els.description) els.description.value = record.description || "";
    if (els.statusField) els.statusField.value = record.status || "active";
    renderScopeControls(record);
    if (els.formTitle) els.formTitle.textContent = `Edit ${record.name || labels[page]}`;
    if (els.saveButton) els.saveButton.textContent = "Save changes";
    if (els.cancelButton) els.cancelButton.hidden = false;
    els.name?.focus();
  }

  function recordMeta(record) {
    if (page === "company") return `${state.departments.filter((item) => item.companyId === record.id).length} departments · ${state.groups.filter((item) => item.companyId === record.id).length} groups`;
    if (page === "department") return `<span class="entra-parent">${html(record.companyName || companyName(record.companyId))}</span> · ${state.groups.filter((item) => item.departmentId === record.id).length} groups`;
    return `<span class="entra-parent">${html(record.companyName || companyName(record.companyId))}</span>${record.departmentId ? ` · ${html(record.departmentName || departmentName(record.departmentId))}` : " · No department"}`;
  }

  function renderList() {
    if (!els.list) return;
    const query = els.search?.value || "";
    const records = collection().filter((record) => [record.name, record.description, record.status, record.companyName, record.departmentName].some((value) => textMatch(value, query)));
    if (!records.length) {
      els.list.innerHTML = `<div class="empty action-empty"><strong>No ${plural[page]} found.</strong><p>Create a ${labels[page].toLowerCase()} record or clear the search.</p></div>`;
      return;
    }
    els.list.innerHTML = records.map((record) => {
      const archived = record.status === "archived";
      const action = archived
        ? `<button type="button" data-reactivate="${html(record.id)}">Reactivate</button>`
        : `<button type="button" data-archive="${html(record.id)}">Archive</button>`;
      return `<article class="item ${record.id === state.editingId ? "active" : ""}">
        <div class="row"><span>${html(record.name)}</span>${statusBadge(record.status)}</div>
        <p class="entra-meta">${recordMeta(record)}</p>
        <p>${html(record.description || "No description yet.")}</p>
        <p class="entra-meta">Updated ${html(time(record.updatedAt))}</p>
        <div class="actions"><button type="button" data-edit="${html(record.id)}">Edit</button>${action}</div>
      </article>`;
    }).join("");
  }

  async function loadData(message = `Loading ${plural[page]}...`) {
    setStatus(message);
    const data = await apiJson("/api/admin/entra");
    state.companies = data.companies || [];
    state.departments = data.departments || [];
    state.groups = data.groups || [];
    renderScopeControls();
    renderList();
    setStatus(`${collection().length} ${plural[page]} available.`);
  }

  function payload() {
    const body = {
      name: els.name?.value || "",
      description: els.description?.value || "",
      status: els.statusField?.value || "active"
    };
    if (page === "department" || page === "group") body.companyId = els.company?.value || "";
    if (page === "group") body.departmentId = els.department?.value || "";
    return body;
  }

  async function saveRecord(event) {
    event.preventDefault();
    const endpoint = endpoints[page];
    const method = state.editingId ? "PATCH" : "POST";
    const url = state.editingId ? `/api/admin/entra/${endpoint}/${encodeURIComponent(state.editingId)}` : `/api/admin/entra/${endpoint}`;
    setStatus(state.editingId ? `Saving ${labels[page].toLowerCase()}...` : `Creating ${labels[page].toLowerCase()}...`);
    try {
      await apiJson(url, { method, body: JSON.stringify(payload()) });
      resetForm();
      await loadData(method === "POST" ? `${labels[page]} created.` : `${labels[page]} updated.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function setRecordStatus(recordId, action) {
    const endpoint = endpoints[page];
    setStatus(action === "archive" ? `Archiving ${labels[page].toLowerCase()}...` : `Reactivating ${labels[page].toLowerCase()}...`);
    try {
      await apiJson(`/api/admin/entra/${endpoint}/${encodeURIComponent(recordId)}/${action}`, { method: "POST", body: "{}" });
      if (state.editingId === recordId) resetForm();
      await loadData(action === "archive" ? `${labels[page]} archived.` : `${labels[page]} reactivated.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function bind() {
    els.form?.addEventListener("submit", saveRecord);
    els.cancelButton?.addEventListener("click", () => { resetForm(); renderList(); });
    els.search?.addEventListener("input", renderList);
    els.company?.addEventListener("change", () => updateDepartmentOptions());
    els.list?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit]");
      const archive = event.target.closest("[data-archive]");
      const reactivate = event.target.closest("[data-reactivate]");
      if (edit) {
        const record = collection().find((item) => item.id === edit.dataset.edit);
        if (record) fillForm(record);
        renderList();
      }
      if (archive) setRecordStatus(archive.dataset.archive, "archive");
      if (reactivate) setRecordStatus(reactivate.dataset.reactivate, "reactivate");
    });
  }

  injectStyles();
  bind();
  resetForm();
  loadData().catch((error) => setStatus(error.message, true));
})();
