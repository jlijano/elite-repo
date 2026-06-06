(() => {
  const configByPage = {
    playground: { resource: "boards", singular: "board", title: "Board Management", subtitle: "Create and maintain Playground boards.", add: "Add board" },
    "playground-projects": { resource: "projects", singular: "project", title: "Project Management", subtitle: "Create and maintain Playground projects.", add: "Add project" },
    "playground-tasks": { resource: "tasks", singular: "task", title: "Task Management", subtitle: "Create and maintain Playground tasks.", add: "Add task" },
    "playground-notes": { resource: "notes", singular: "note", title: "Notes Management", subtitle: "Create and maintain Playground notes.", add: "Add note" },
    "playground-automation": { resource: "automations", singular: "automation", title: "Automation Management", subtitle: "Create and maintain Playground automation rules.", add: "Add automation" }
  };
  const state = { records: {}, users: [], query: "", editing: null };
  const page = document.body?.dataset.adminPage || "";
  const config = configByPage[page];
  if (!config) return;

  const html = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const label = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const find = (resource, id) => (state.records[resource] || []).find((item) => item.id === id);
  const boardOptions = (selected = "") => [`<option value="">No board</option>`, ...(state.records.boards || []).map((item) => `<option value="${html(item.id)}"${item.id === selected ? " selected" : ""}>${html(item.title)}</option>`)].join("");
  const projectOptions = (selected = "") => [`<option value="">No project</option>`, ...(state.records.projects || []).map((item) => `<option value="${html(item.id)}"${item.id === selected ? " selected" : ""}>${html(item.title)}</option>`)].join("");

  function installStyles() {
    if (document.getElementById("playgroundCrudStyles")) return;
    const style = document.createElement("style");
    style.id = "playgroundCrudStyles";
    style.textContent = `
      .playground-crud-toolbar{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap}.playground-crud-toolbar input{min-width:220px;border:1px solid var(--border-color,#d9dfe8);border-radius:8px;padding:.65rem .8rem;background:var(--surface,#fff);color:inherit}.playground-crud-list{margin-top:1rem;border:1px solid var(--border-color,#d9dfe8);border-radius:8px;overflow:hidden;background:var(--surface,#fff)}.playground-crud-table{width:100%;border-collapse:collapse;font-size:.92rem}.playground-crud-table th,.playground-crud-table td{padding:.85rem .9rem;border-bottom:1px solid var(--border-color,#e7ebf1);text-align:left;vertical-align:top}.playground-crud-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-text,#687386);background:color-mix(in srgb,var(--surface,#fff),#111 3%)}.playground-crud-table tr:last-child td{border-bottom:0}.playground-crud-table tbody tr:hover{background:color-mix(in srgb,var(--accent,#2563eb),transparent 94%)}.playground-crud-title{font-weight:800;display:block}.playground-crud-muted{color:var(--muted-text,#687386);font-size:.82rem}.playground-crud-status{display:inline-flex;align-items:center;border:1px solid var(--border-color,#d9dfe8);border-radius:999px;padding:.18rem .5rem;font-size:.74rem;font-weight:800;text-transform:capitalize}.playground-crud-actions{display:flex;gap:.35rem;flex-wrap:wrap}.playground-crud-actions button,.playground-crud-toolbar button,.playground-crud-modal button{border:1px solid var(--border-color,#d9dfe8);border-radius:8px;padding:.55rem .75rem;background:var(--surface,#fff);color:inherit;font-weight:800;cursor:pointer}.playground-crud-toolbar .primary-action,.playground-crud-modal .primary-action{background:var(--accent,#2563eb);border-color:var(--accent,#2563eb);color:#fff}.playground-crud-empty{padding:1.5rem;color:var(--muted-text,#687386)}.playground-crud-modal{border:0;border-radius:10px;padding:0;max-width:620px;width:min(620px,calc(100vw - 24px));box-shadow:0 24px 70px rgba(15,23,42,.25);background:var(--surface,#fff);color:inherit}.playground-crud-modal::backdrop{background:rgba(15,23,42,.45)}.playground-crud-modal form{padding:1.25rem}.playground-crud-modal header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}.playground-crud-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.playground-crud-field{display:flex;flex-direction:column;gap:.35rem}.playground-crud-field.full{grid-column:1/-1}.playground-crud-field label{font-size:.78rem;font-weight:800;color:var(--muted-text,#687386)}.playground-crud-field input,.playground-crud-field select,.playground-crud-field textarea{border:1px solid var(--border-color,#d9dfe8);border-radius:8px;padding:.7rem .8rem;background:var(--surface,#fff);color:inherit;font:inherit}.playground-crud-field textarea{min-height:92px;resize:vertical}.playground-crud-modal footer{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem}.playground-crud-metrics .metric-card strong{text-transform:capitalize}@media (max-width:760px){.playground-crud-table{min-width:760px}.playground-crud-list{overflow-x:auto}.playground-crud-grid{grid-template-columns:1fr}.playground-crud-toolbar input{min-width:0;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function setupLayout() {
    installStyles();
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    layout.innerHTML = `
      <p class="admin-status" id="status">Loading Playground ${html(config.singular)} records...</p>
      <section class="playground-metrics playground-crud-metrics" id="playgroundCrudMetrics" aria-label="Playground management summary"></section>
      <section class="admin-card wide" aria-labelledby="playgroundCrudTitle">
        <div class="card-head">
          <div><p class="section-kicker">Playground CRUD</p><h2 id="playgroundCrudTitle">${html(config.title)}</h2><p class="card-subtitle">${html(config.subtitle)}</p></div>
          <div class="playground-crud-toolbar">
            <input id="playgroundCrudSearch" type="search" placeholder="Search ${html(config.resource)}" aria-label="Search ${html(config.resource)}" />
            <button class="primary-action" id="playgroundCrudAdd" type="button">${html(config.add)}</button>
            <button id="playgroundCrudRefresh" type="button">Refresh</button>
          </div>
        </div>
        <div class="playground-crud-list" id="playgroundCrudList">Loading...</div>
      </section>
      <dialog class="playground-crud-modal" id="playgroundCrudDialog" aria-labelledby="playgroundCrudDialogTitle"></dialog>
    `;
    document.getElementById("playgroundCrudSearch")?.addEventListener("input", (event) => { state.query = event.target.value.toLowerCase(); renderList(); });
    document.getElementById("playgroundCrudAdd")?.addEventListener("click", () => openModal());
    document.getElementById("playgroundCrudRefresh")?.addEventListener("click", loadRecords);
  }

  function status(message, error = false) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
    el.hidden = false;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Playground request failed.");
    return data;
  }

  async function loadRecords() {
    status(`Loading Playground ${config.singular} records...`);
    try {
      const data = await request("/api/admin/playground?includeArchived=true");
      state.records = data;
      state.users = data.users || [];
      renderMetrics(data.metrics || {});
      renderList();
      status(`${label(config.resource)} management ready.`);
    } catch (error) {
      status(error.message, true);
      document.getElementById("playgroundCrudList").innerHTML = `<div class="playground-crud-empty">${html(error.message)}</div>`;
    }
  }

  function renderMetrics(metrics) {
    const cards = [
      ["Boards", metrics.boards ?? 0, "Active board spaces"],
      ["Projects", metrics.projects ?? 0, "Active projects"],
      ["Tasks", metrics.tasks ?? 0, "Active tasks"],
      ["Automations", metrics.automations ?? 0, "Rules and drafts"]
    ];
    document.getElementById("playgroundCrudMetrics").innerHTML = cards.map(([name, value, text]) => `<article class="metric-card"><span>${html(name)}</span><strong>${html(value)}</strong><p>${html(text)}</p></article>`).join("");
  }

  function rowText(record) {
    return Object.values(record).filter((value) => typeof value !== "object").join(" ").toLowerCase();
  }

  function currentRecords() {
    const records = state.records[config.resource] || [];
    if (!state.query) return records;
    return records.filter((record) => rowText(record).includes(state.query));
  }

  function columns() {
    if (config.resource === "boards") return ["Board", "Status", "Sort", "Updated", "Actions"];
    if (config.resource === "projects") return ["Project", "Board", "Status", "Progress", "Actions"];
    if (config.resource === "tasks") return ["Task", "Board/Project", "Status", "Priority", "Actions"];
    if (config.resource === "notes") return ["Note", "Board/Project", "Status", "Updated", "Actions"];
    return ["Automation", "Board", "Trigger", "Status", "Actions"];
  }

  function renderRecord(record) {
    const edit = `<button type="button" data-action="edit" data-id="${html(record.id)}">Edit</button>`;
    const archived = record.status === "archived" || record.recordStatus === "archived";
    const archive = `<button type="button" data-action="${archived ? "reactivate" : "archive"}" data-id="${html(record.id)}">${archived ? "Reactivate" : "Archive"}</button>`;
    const actions = `<div class="playground-crud-actions">${edit}${archive}</div>`;
    if (config.resource === "boards") return `<tr><td><span class="playground-crud-title">${html(record.title)}</span><span class="playground-crud-muted">${html(record.description)}</span></td><td>${pill(record.status)}</td><td>${html(record.sortOrder)}</td><td>${date(record.updatedAt)}</td><td>${actions}</td></tr>`;
    if (config.resource === "projects") return `<tr><td><span class="playground-crud-title">${html(record.title)}</span><span class="playground-crud-muted">${html(record.description)}</span></td><td>${html(record.boardTitle || "No board")}</td><td>${pill(record.status)}</td><td>${html(record.progress)}%</td><td>${actions}</td></tr>`;
    if (config.resource === "tasks") return `<tr><td><span class="playground-crud-title">${html(record.title)}</span><span class="playground-crud-muted">${html(record.description)}</span></td><td>${html([record.boardTitle, record.projectTitle].filter(Boolean).join(" / ") || "Unlinked")}</td><td>${pill(record.recordStatus === "archived" ? "archived" : record.status)}</td><td>${html(label(record.priority))}</td><td>${actions}</td></tr>`;
    if (config.resource === "notes") return `<tr><td><span class="playground-crud-title">${html(record.label)}</span><span class="playground-crud-muted">${html(record.content)}</span></td><td>${html([record.boardTitle, record.projectTitle].filter(Boolean).join(" / ") || "Unlinked")}</td><td>${pill(record.status)}</td><td>${date(record.updatedAt)}</td><td>${actions}</td></tr>`;
    return `<tr><td><span class="playground-crud-title">${html(record.title)}</span><span class="playground-crud-muted">${html(record.description)}</span></td><td>${html(record.boardTitle || "No board")}</td><td>${html(record.trigger)}</td><td>${pill(record.status)}</td><td>${actions}</td></tr>`;
  }

  function pill(value) { return `<span class="playground-crud-status">${html(label(value))}</span>`; }
  function date(value) { return value ? html(new Date(value).toLocaleDateString()) : "-"; }

  function renderList() {
    const records = currentRecords();
    const list = document.getElementById("playgroundCrudList");
    if (!records.length) {
      list.innerHTML = `<div class="playground-crud-empty">No ${html(config.resource)} found.</div>`;
      return;
    }
    list.innerHTML = `<table class="playground-crud-table"><thead><tr>${columns().map((item) => `<th>${html(item)}</th>`).join("")}</tr></thead><tbody>${records.map(renderRecord).join("")}</tbody></table>`;
    list.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", handleAction));
  }

  function field(name, labelText, value = "", attrs = "") {
    return `<div class="playground-crud-field"><label for="${name}">${html(labelText)}</label><input id="${name}" name="${name}" value="${html(value)}" ${attrs} /></div>`;
  }
  function textArea(name, labelText, value = "") {
    return `<div class="playground-crud-field full"><label for="${name}">${html(labelText)}</label><textarea id="${name}" name="${name}">${html(value)}</textarea></div>`;
  }
  function select(name, labelText, options) {
    return `<div class="playground-crud-field"><label for="${name}">${html(labelText)}</label><select id="${name}" name="${name}">${options}</select></div>`;
  }
  function option(value, text, selected) { return `<option value="${html(value)}"${value === selected ? " selected" : ""}>${html(text)}</option>`; }

  function formFields(record = {}) {
    if (config.resource === "boards") return `${field("title", "Board name", record.title || "")}${select("status", "Status", option("active", "Active", record.status || "active") + option("archived", "Archived", record.status))}${field("sortOrder", "Sort order", record.sortOrder ?? 0, 'type="number" min="0"')}${textArea("description", "Description", record.description || "")}`;
    if (config.resource === "projects") return `${select("boardId", "Board", boardOptions(record.boardId))}${field("title", "Project name", record.title || "")}${select("status", "Status", ["planning","active","in_progress","review","completed","archived"].map((item) => option(item, label(item), record.status || "planning")).join(""))}${field("progress", "Progress", record.progress ?? 0, 'type="number" min="0" max="100"')}${field("taskCount", "Task count", record.taskCount ?? 0, 'type="number" min="0"')}${textArea("description", "Description", record.description || "")}`;
    if (config.resource === "tasks") return `${select("boardId", "Board", boardOptions(record.boardId))}${select("projectId", "Project", projectOptions(record.projectId))}${field("title", "Task name", record.title || "")}${select("status", "Workflow status", ["backlog","todo","in_progress","review","done"].map((item) => option(item, label(item), record.status || "todo")).join(""))}${select("recordStatus", "Record status", option("active", "Active", record.recordStatus || "active") + option("archived", "Archived", record.recordStatus))}${select("priority", "Priority", ["low","medium","high"].map((item) => option(item, label(item), record.priority || "medium")).join(""))}${field("category", "Category", record.category || "Tasks")}${field("dueDate", "Due date", record.dueDate || "", 'type="date"')}${field("dueLabel", "Due label", record.dueLabel || "")}${textArea("description", "Description", record.description || "")}`;
    if (config.resource === "notes") return `${select("boardId", "Board", boardOptions(record.boardId))}${select("projectId", "Project", projectOptions(record.projectId))}${field("label", "Label", record.label || "Note")}${select("status", "Status", option("active", "Active", record.status || "active") + option("archived", "Archived", record.status))}${textArea("content", "Note", record.content || "")}`;
    return `${select("boardId", "Board", boardOptions(record.boardId))}${field("title", "Automation name", record.title || "")}${select("status", "Status", ["draft","manual","active","paused","archived"].map((item) => option(item, label(item), record.status || "draft")).join(""))}${select("action", "Action", ["suggest","move_task","assign_owner","create_note","notify_admin"].map((item) => option(item, label(item), record.action || "suggest")).join(""))}${field("trigger", "Trigger", record.trigger || "")}${textArea("description", "Description", record.description || "")}`;
  }

  function openModal(record = null) {
    state.editing = record;
    const dialog = document.getElementById("playgroundCrudDialog");
    dialog.innerHTML = `<form method="dialog"><header><div><p class="section-kicker">${record ? "Edit" : "Add"} ${html(config.singular)}</p><h2 id="playgroundCrudDialogTitle">${record ? html(record.title || record.label || config.title) : html(config.add)}</h2></div><button type="button" value="cancel" data-close>Close</button></header><div class="playground-crud-grid">${formFields(record || {})}</div><footer><button type="button" data-close>Cancel</button><button class="primary-action" type="submit">Save</button></footer></form>`;
    dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
    dialog.querySelector("form").addEventListener("submit", saveRecord);
    dialog.showModal();
  }

  function payloadFromForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (config.resource === "tasks" && state.editing) {
      data.assigneeIds = state.editing.assigneeIds || [];
      data.customFields = state.editing.customFields || [];
    }
    return data;
  }

  async function saveRecord(event) {
    event.preventDefault();
    const dialog = document.getElementById("playgroundCrudDialog");
    const payload = payloadFromForm(event.currentTarget);
    const url = state.editing ? `/api/admin/playground/${config.resource}/${state.editing.id}` : `/api/admin/playground/${config.resource}`;
    const method = state.editing ? "PATCH" : "POST";
    try {
      await request(url, { method, body: JSON.stringify(payload) });
      dialog.close();
      await loadRecords();
      status(`${label(config.singular)} saved.`);
    } catch (error) {
      status(error.message, true);
    }
  }

  async function handleAction(event) {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const record = find(config.resource, id);
    if (action === "edit") return openModal(record);
    try {
      await request(`/api/admin/playground/${config.resource}/${id}/${action}`, { method: "POST", body: "{}" });
      await loadRecords();
      status(`${label(config.singular)} ${action === "archive" ? "archived" : "reactivated"}.`);
    } catch (error) {
      status(error.message, true);
    }
    return undefined;
  }

  setupLayout();
  loadRecords();
})();
