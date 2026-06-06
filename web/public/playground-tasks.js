const taskListSessionTokenKey = "switchboard-session-token";
const taskListAdminTokenKey = "switchboard-admin-token";
const taskListStatusLabels = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
const taskListPriorityLabels = { low: "Low", medium: "Medium", high: "High" };

const taskListState = {
  tasks: [],
  projects: [],
  users: [],
  page: { cursor: "0", nextCursor: null, limit: 100, total: 0 },
  filters: { search: "", status: "", priority: "", projectId: "", assigneeId: "", cursor: "0", limit: "100" }
};

const taskListHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function taskListHeaders() {
  const headers = { "Content-Type": "application/json" };
  const adminToken = sessionStorage.getItem(taskListAdminTokenKey) || "";
  const sessionToken = sessionStorage.getItem(taskListSessionTokenKey) || "";
  if (adminToken) headers["x-admin-token"] = adminToken;
  if (sessionToken) headers["x-session-token"] = sessionToken;
  return headers;
}

function taskListSetStatus(message, error = false) {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("error", error);
}

async function taskListFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...taskListHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Task list request failed.");
  return data;
}

function taskListQueryString() {
  const params = new URLSearchParams();
  Object.entries(taskListState.filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function taskListUserName(userId) {
  const user = taskListState.users.find((item) => item.id === userId);
  return user?.name || user?.email || "";
}

function taskListAssignees(task) {
  const names = (task.assigneeIds || []).map(taskListUserName).filter(Boolean);
  return names.length ? names.join(", ") : "Unassigned";
}

function taskListOptions(items, selected, label) {
  return [`<option value="">${taskListHtml(label)}</option>`, ...items.map((item) => `<option value="${taskListHtml(item.id)}"${item.id === selected ? " selected" : ""}>${taskListHtml(item.title || item.name || item.email)}</option>`)].join("");
}

function renderTaskListFilters() {
  const projectSelect = document.getElementById("taskListProject");
  const assigneeSelect = document.getElementById("taskListAssignee");
  if (projectSelect) projectSelect.innerHTML = taskListOptions(taskListState.projects, taskListState.filters.projectId, "All projects");
  if (assigneeSelect) assigneeSelect.innerHTML = taskListOptions(taskListState.users, taskListState.filters.assigneeId, "All assignees");
}

function taskListCustomFields(task) {
  const fields = Array.isArray(task.customFields) ? task.customFields : [];
  if (!fields.length) return `<span class="muted-cell">No custom fields</span>`;
  return `<div class="task-custom-fields">${fields.map((field) => `<span><strong>${taskListHtml(field.name || "Field")}</strong>${taskListHtml(field.value || "-")}</span>`).join("")}</div>`;
}

function renderTaskList() {
  const body = document.getElementById("taskListBody");
  if (!body) return;
  if (!taskListState.tasks.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty compact-empty">No tasks match these filters.</div></td></tr>`;
  } else {
    body.innerHTML = taskListState.tasks.map((task) => `<tr><td><strong>${taskListHtml(task.title)}</strong><small>${taskListHtml(task.description || "Created from Tasks module.")}</small></td><td>${taskListCustomFields(task)}</td><td><span class="status-badge ${taskListStatusClass(task.status)}">${taskListHtml(taskListStatusLabels[task.status] || task.status || "Open")}</span></td><td><span class="priority ${taskListHtml(task.priority || "medium")}">${taskListHtml(taskListPriorityLabels[task.priority] || task.priority || "Medium")}</span></td><td>${taskListHtml(task.projectTitle || "No project")}</td><td>${taskListHtml(taskListAssignees(task))}</td><td>${taskListHtml(task.dueLabel || task.dueDate || "No due date")}</td></tr>`).join("");
  }
  const total = taskListState.page.total ?? taskListState.tasks.length;
  const count = document.getElementById("taskListCount");
  if (count) count.textContent = `${total} task${total === 1 ? "" : "s"}`;
  const prev = document.getElementById("taskListPrev");
  const next = document.getElementById("taskListNext");
  if (prev) prev.disabled = Number(taskListState.page.cursor || 0) <= 0;
  if (next) next.disabled = !taskListState.page.nextCursor;
}

function taskListStatusClass(status = "") {
  if (status === "backlog") return "status-public";
  if (status === "todo") return "status-storage";
  if (status === "in_progress" || status === "review") return "status-loaded";
  return "status-ready";
}

async function loadTaskList() {
  taskListSetStatus("Loading saved Playground tasks...");
  const data = await taskListFetch(`/api/admin/playground?${taskListQueryString()}`);
  taskListState.tasks = data.tasks || [];
  taskListState.projects = data.projects || [];
  taskListState.users = data.users || [];
  taskListState.page = data.taskPage || taskListState.page;
  renderTaskListFilters();
  renderTaskList();
  const total = taskListState.page.total ?? taskListState.tasks.length;
  taskListSetStatus(`Loaded ${total} saved task${total === 1 ? "" : "s"} from ${data.storageMode || "storage"}.`);
}

function applyTaskListFilters() {
  taskListState.filters = {
    search: document.getElementById("taskListSearch")?.value || "",
    status: document.getElementById("taskListStatus")?.value || "",
    priority: document.getElementById("taskListPriority")?.value || "",
    projectId: document.getElementById("taskListProject")?.value || "",
    assigneeId: document.getElementById("taskListAssignee")?.value || "",
    cursor: "0",
    limit: taskListState.filters.limit || "100"
  };
  loadTaskList().catch((error) => taskListSetStatus(error.message, true));
}

function changeTaskListPage(direction) {
  const limit = Number(taskListState.page.limit || taskListState.filters.limit || 100);
  const cursor = Number(taskListState.page.cursor || 0);
  taskListState.filters.cursor = direction > 0 ? taskListState.page.nextCursor || String(cursor) : String(Math.max(0, cursor - limit));
  loadTaskList().catch((error) => taskListSetStatus(error.message, true));
}

function injectTaskListModal() {
  if (document.getElementById("taskListTaskModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="playground-modal-backdrop" id="taskListTaskModal" hidden>
      <form class="playground-modal task-list-modal" id="taskListTaskForm" aria-labelledby="taskListTaskModalTitle">
        <div class="playground-modal-head"><div><p class="section-kicker">Task module</p><h2 id="taskListTaskModalTitle">New Task</h2></div><button type="button" class="icon-button" id="taskListTaskModalClose" aria-label="Close task form">x</button></div>
        <p class="playground-form-message" id="taskListTaskFormMessage" hidden></p>
        <div class="playground-form-grid title-only-form">
          <label class="wide-field">Title<input id="taskListTaskTitle" name="title" required maxlength="140" placeholder="Task title" /></label>
        </div>
        <details class="task-custom-field-panel" id="taskListCustomFieldPanel">
          <summary>Add custom fields</summary>
          <div class="custom-field-builder" id="taskListCustomFields" aria-label="Custom fields"></div>
          <button type="button" class="secondary-action" id="taskListAddCustomField">Add Field</button>
        </details>
        <div class="playground-modal-actions"><button type="button" id="taskListTaskCancel">Cancel</button><button class="primary-action" id="taskListTaskSave" type="button">Create Task</button></div>
      </form>
    </div>
  `);
  document.getElementById("taskListTaskModalClose")?.addEventListener("click", closeTaskListModal);
  document.getElementById("taskListTaskCancel")?.addEventListener("click", closeTaskListModal);
  document.getElementById("taskListTaskSave")?.addEventListener("click", () => document.getElementById("taskListTaskForm")?.requestSubmit());
  document.getElementById("taskListAddCustomField")?.addEventListener("click", () => addTaskListCustomField());
  document.getElementById("taskListTaskModal")?.addEventListener("click", (event) => {
    if (event.target.id === "taskListTaskModal") closeTaskListModal();
  });
  document.getElementById("taskListTaskForm")?.addEventListener("submit", (event) => saveTaskListTask(event).catch((error) => {
    setTaskListModalBusy(false);
    setTaskListModalMessage(error.message, true);
    taskListSetStatus(error.message, true);
  }));
}

function addTaskListCustomField(name = "", value = "") {
  const container = document.getElementById("taskListCustomFields");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "custom-field-row";
  row.innerHTML = `<label><span>Field</span><input data-custom-field-name maxlength="60" value="${taskListHtml(name)}" placeholder="Owner" /></label><label><span>Value</span><input data-custom-field-value maxlength="240" value="${taskListHtml(value)}" placeholder="Design" /></label><button type="button" class="icon-button" aria-label="Remove custom field">x</button>`;
  row.querySelector("button")?.addEventListener("click", () => row.remove());
  container.appendChild(row);
  row.querySelector("input")?.focus();
}

function setTaskListModalMessage(message = "", error = false) {
  const messageEl = document.getElementById("taskListTaskFormMessage");
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.hidden = !message;
  messageEl.classList.toggle("error", error);
}

function setTaskListModalBusy(busy) {
  const form = document.getElementById("taskListTaskForm");
  const saveButton = document.getElementById("taskListTaskSave");
  form?.querySelectorAll("input, button").forEach((field) => {
    if (["taskListTaskModalClose", "taskListTaskCancel"].includes(field.id)) return;
    field.disabled = busy;
  });
  if (saveButton) saveButton.textContent = busy ? "Creating..." : "Create Task";
}

function openTaskListModal() {
  injectTaskListModal();
  setTaskListModalBusy(false);
  setTaskListModalMessage("");
  const form = document.getElementById("taskListTaskForm");
  form?.reset();
  const fields = document.getElementById("taskListCustomFields");
  if (fields) fields.innerHTML = "";
  const panel = document.getElementById("taskListCustomFieldPanel");
  if (panel) panel.open = false;
  document.getElementById("taskListTaskModal").hidden = false;
  document.getElementById("taskListTaskTitle")?.focus();
}

function closeTaskListModal() {
  const modal = document.getElementById("taskListTaskModal");
  if (modal) modal.hidden = true;
  setTaskListModalBusy(false);
}

function taskListFormPayload() {
  const customFields = [...document.querySelectorAll("#taskListCustomFields .custom-field-row")]
    .map((row) => ({
      name: row.querySelector("[data-custom-field-name]")?.value || "",
      value: row.querySelector("[data-custom-field-value]")?.value || ""
    }))
    .filter((field) => field.name.trim() || field.value.trim());
  return {
    title: document.getElementById("taskListTaskTitle")?.value || "",
    status: "todo",
    priority: "medium",
    category: "Tasks",
    description: "",
    dueLabel: "No due date",
    dueDate: "",
    projectId: "",
    assigneeIds: [],
    customFields
  };
}

async function saveTaskListTask(event) {
  event.preventDefault();
  setTaskListModalBusy(true);
  setTaskListModalMessage("Creating task...");
  taskListSetStatus("Creating task...");
  await taskListFetch("/api/admin/playground/tasks", {
    method: "POST",
    body: JSON.stringify(taskListFormPayload())
  });
  closeTaskListModal();
  taskListState.filters.cursor = "0";
  await loadTaskList();
  taskListSetStatus("Task saved to Playground storage.");
}

function initTaskListPage() {
  ["taskListSearch", "taskListStatus", "taskListPriority", "taskListProject", "taskListAssignee"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", applyTaskListFilters);
    document.getElementById(id)?.addEventListener("change", applyTaskListFilters);
  });
  document.getElementById("refreshTasksButton")?.addEventListener("click", () => loadTaskList().catch((error) => taskListSetStatus(error.message, true)));
  document.getElementById("taskListNewTaskButton")?.addEventListener("click", openTaskListModal);
  document.getElementById("taskListCardNewTaskButton")?.addEventListener("click", openTaskListModal);
  document.getElementById("taskListPrev")?.addEventListener("click", () => changeTaskListPage(-1));
  document.getElementById("taskListNext")?.addEventListener("click", () => changeTaskListPage(1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTaskListModal();
  });
  injectTaskListModal();
  loadTaskList().catch((error) => taskListSetStatus(error.message, true));
}

if (document.body.dataset.adminPage === "playground-tasks") initTaskListPage();
