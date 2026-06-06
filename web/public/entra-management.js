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
    cancelButton: $("cancelEntraEditButton"),
    addButton: $("addEntraButton"),
    dialog: $("entraDialog"),
    closeButton: $("closeEntraModalButton")
  };

  const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const textMatch = (value, query = "") => String(value || "").toLowerCase().includes(query.trim().toLowerCase());
  const time = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "";

  function injectStyles() {
    if (document.getElementById("entraManagementStyles")) return;
    const style = document.createElement("style");
    style.id = "entraManagementStyles";
    style.textContent = `
      .entra-card-head { align-items: center; }
      .entra-toolbar { min-width: min(520px, 100%); }
      .entra-toolbar input { flex: 1 1 260px; }
      .entra-management-grid { display: block; min-height: 0; }
      .entra-list { max-height: none; overflow: auto; }
      .entra-table-wrap { width: 100%; overflow-x: auto; }
      .entra-table { width: 100%; min-width: 760px; border-collapse: collapse; color: var(--text); }
      .entra-table th, .entra-table td { padding: 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
      .entra-table th { color: var(--muted); background: var(--panel-soft); font-size: 0.76rem; font-weight: 900; text-transform: uppercase; }
      .entra-table td { color: var(--text); font-size: 0.88rem; }
      .entra-table tr.active td { box-shadow: inset 3px 0 0 var(--primary); }
      .entra-table .muted-cell { color: var(--muted); }
      .entra-table .actions { justify-content: flex-end; flex-wrap: nowrap; }
      .entra-record-name { display: block; font-weight: 900; }
      .entra-record-note { display: block; margin-top: 3px; color: var(--muted); font-size: 0.78rem; }
      .entra-modal { position: fixed; inset: 0; width: min(680px, calc(100vw - 28px)); max-height: min(720px, calc(100dvh - 28px)); margin: auto; padding: 0; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: var(--text); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42); }
      .entra-modal::backdrop { background: rgba(0, 0, 0, 0.58); }
      .entra-modal-content { display: grid; max-height: min(720px, calc(100dvh - 28px)); overflow: hidden; }
      .entra-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px; border-bottom: 1px solid var(--line); background: var(--panel-soft); }
      .entra-modal-head h2 { margin: 0; font-size: 1rem; }
      .entra-modal-close { width: 38px; height: 38px; padding: 0; font-size: 1.1rem; }
      .entra-dialog-body { max-height: calc(100dvh - 104px); overflow: auto; padding: 12px; }
      .entra-dialog-body .management-form { border: 0; padding: 0; }
      .entra-scope-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      @media (max-width: 760px) {
        .entra-card-head { align-items: stretch; flex-direction: column; }
        .entra-toolbar { width: 100%; min-width: 0; flex-direction: column; align-items: stretch; }
        .entra-toolbar input, .entra-toolbar button { flex: 0 0 auto; }
        .entra-table { min-width: 680px; }
        .entra-scope-row { grid-template-columns: 1fr; }
      }
      @media (max-width: 520px) {
        .entra-table-wrap { overflow-x: visible; }
        .entra-table { min-width: 0; display: block; }
        .entra-table thead { display: none; }
        .entra-table tbody, .entra-table tr, .entra-table td { display: block; width: 100%; }
        .entra-table tr { padding: 10px; border-bottom: 1px solid var(--line); }
        .entra-table tr.active { box-shadow: inset 3px 0 0 var(--primary); }
        .entra-table tr.active td { box-shadow: none; }
        .entra-table td { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; padding: 6px 0; border: 0; font-size: 0.84rem; }
        .entra-table td::before { color: var(--muted); font-size: 0.68rem; font-weight: 900; text-transform: uppercase; }
        .entra-table td:nth-child(1)::before { content: "Name"; }
        .entra-table td:nth-child(2)::before { content: "Company"; }
        .entra-table td:nth-child(3)::before { content: "Department"; }
        .entra-table td:nth-child(4)::before { content: "Status"; }
        .entra-table td:nth-child(5)::before { content: "Updated"; }
        .entra-table td:nth-child(6) { display: block; padding-top: 8px; }
        .entra-table td:nth-child(6)::before { content: none; }
        .entra-table .actions { justify-content: stretch; flex-wrap: wrap; }
        .entra-table .actions button { flex: 1 1 120px; }
      }
      @media (max-width: 340px), (max-height: 420px) and (max-width: 740px) {
        .entra-table tr { padding: 8px; }
        .entra-table td { grid-template-columns: 74px minmax(0, 1fr); gap: 6px; font-size: 0.78rem; }
        .entra-table td::before { font-size: 0.64rem; }
        .entra-modal { width: calc(100vw - 12px); max-height: calc(100dvh - 12px); }
        .entra-modal-head { padding: 8px; }
        .entra-dialog-body { max-height: calc(100dvh - 66px); padding: 8px; }
      }
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
    return state.companies.find((item) => item.id === companyId)?.name || "Not set";
  }

  function departmentName(departmentId) {
    return state.departments.find((item) => item.id === departmentId)?.name || "Not set";
  }

  function statusBadge(status = "active") {
    const cls = status === "archived" ? "status-storage" : "status-ready";
    return `<small class="status-badge ${cls}">${html(status)}</small>`;
  }

  function tableCell(content, className = "") {
    return `<td${className ? ` class="${className}"` : ""}>${content}</td>`;
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

  function openDialog() {
    if (!els.dialog || els.dialog.open) return;
    els.dialog.showModal();
    window.setTimeout(() => els.name?.focus(), 0);
  }

  function closeDialog() {
    if (els.dialog?.open) els.dialog.close();
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
    openDialog();
  }

  function nameCell(record) {
    const note = record.description || "No description";
    return `<span class="entra-record-name">${html(record.name)}</span><span class="entra-record-note">${html(note)}</span>`;
  }

  function companyCell(record) {
    if (page === "company") return `${state.departments.filter((item) => item.companyId === record.id).length} departments`;
    return html(record.companyName || companyName(record.companyId));
  }

  function departmentCell(record) {
    if (page === "company") return `${state.groups.filter((item) => item.companyId === record.id).length} groups`;
    if (page === "department") return `${state.groups.filter((item) => item.departmentId === record.id).length} groups`;
    return html(record.departmentName || departmentName(record.departmentId));
  }

  function renderList() {
    if (!els.list) return;
    const query = els.search?.value || "";
    const records = collection().filter((record) => [record.name, record.description, record.status, record.companyName, record.departmentName].some((value) => textMatch(value, query)));
    if (!records.length) {
      els.list.innerHTML = `<div class="empty action-empty"><strong>No ${plural[page]} found.</strong><p>Create a ${labels[page].toLowerCase()} record or clear the search.</p></div>`;
      return;
    }

    const rows = records.map((record) => {
      const archived = record.status === "archived";
      const action = archived
        ? `<button type="button" data-reactivate="${html(record.id)}">Reactivate</button>`
        : `<button type="button" data-archive="${html(record.id)}">Archive</button>`;
      return `<tr${record.id === state.editingId ? " class=\"active\"" : ""}>
        ${tableCell(nameCell(record))}
        ${tableCell(companyCell(record), "muted-cell")}
        ${tableCell(departmentCell(record), "muted-cell")}
        ${tableCell(statusBadge(record.status))}
        ${tableCell(html(time(record.updatedAt)), "muted-cell")}
        ${tableCell(`<div class="actions"><button type="button" data-edit="${html(record.id)}">Edit</button>${action}</div>`)}
      </tr>`;
    }).join("");

    const secondColumn = page === "company" ? "Departments" : "Company";
    const thirdColumn = page === "company" ? "Groups" : page === "department" ? "Groups" : "Department";
    els.list.innerHTML = `<div class="entra-table-wrap"><table class="entra-table"><thead><tr><th>Name</th><th>${secondColumn}</th><th>${thirdColumn}</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
      closeDialog();
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
    els.addButton?.addEventListener("click", () => { resetForm(); openDialog(); });
    els.closeButton?.addEventListener("click", closeDialog);
    els.cancelButton?.addEventListener("click", () => { resetForm(); closeDialog(); renderList(); });
    els.dialog?.addEventListener("click", (event) => { if (event.target === els.dialog) closeDialog(); });
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
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();
    });
  }

  injectStyles();
  bind();
  resetForm();
  loadData().catch((error) => setStatus(error.message, true));
})();
