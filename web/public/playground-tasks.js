const taskListSessionTokenKey = "switchboard-session-token";
const taskListAdminTokenKey = "switchboard-admin-token";
const taskListStatusLabels = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
const taskListPriorityLabels = { low: "Low", medium: "Medium", high: "High" };
const taskListCommonFieldTypes = [
  ["person", "Person"],
  ["date", "Date"],
  ["status", "Status"],
  ["dropdown", "Dropdown"],
  ["text", "Text"],
  ["file", "File Attachment"]
];
const taskListDropdownDefaults = ["Option 1", "Option 2", "Option 3"];
const taskListFileLimitBytes = 1024 * 1024;

const taskListState = {
  tasks: [],
  projects: [],
  users: [],
  page: { cursor: "0", nextCursor: null, limit: 100, total: 0 },
  filters: { search: "", status: "", priority: "", projectId: "", assigneeId: "", cursor: "0", limit: "100" }
};

const taskListHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

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

function commonFieldTypeOptions() {
  return taskListCommonFieldTypes.map(([value, label]) => `<option value="${taskListHtml(value)}">${taskListHtml(label)}</option>`).join("");
}

function commonFieldLabel(value) {
  return taskListCommonFieldTypes.find(([key]) => key === value)?.[1] || "Text";
}

function renderTaskListFilters() {
  const projectSelect = document.getElementById("taskListProject");
  const assigneeSelect = document.getElementById("taskListAssignee");
  if (projectSelect) projectSelect.innerHTML = taskListOptions(taskListState.projects, taskListState.filters.projectId, "All projects");
  if (assigneeSelect) assigneeSelect.innerHTML = taskListOptions(taskListState.users, taskListState.filters.assigneeId, "All assignees");
}

function taskListFieldTypeLabel(type = "text") {
  return commonFieldLabel(type);
}

function taskListFieldDownload(field = {}) {
  const fileData = String(field.fileData || "");
  const fileName = field.fileName || field.value || "attachment";
  if (!fileData.startsWith("data:")) return taskListHtml(fileName || "Attached file");
  return `<a href="${taskListHtml(fileData)}" download="${taskListHtml(fileName)}">${taskListHtml(fileName)}</a>`;
}

function taskListFieldDisplayValue(field = {}) {
  const type = field.type || "text";
  if (type === "person") return taskListHtml(taskListUserName(field.value) || field.value || "-");
  if (type === "file") return taskListFieldDownload(field);
  return taskListHtml(field.value || "-");
}

function taskListCustomFields(task) {
  const fields = Array.isArray(task.customFields) ? task.customFields : [];
  if (!fields.length) return `<span class="muted-cell">No custom fields</span>`;
  return `<div class="task-custom-fields">${fields.map((field) => `<span><em>${taskListHtml(taskListFieldTypeLabel(field.type))}</em><strong>${taskListHtml(field.name || "Field")}</strong>${taskListFieldDisplayValue(field)}</span>`).join("")}</div>`;
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

function taskListFieldValueControl(type = "text", value = "", meta = {}) {
  if (type === "person") {
    const options = taskListState.users.map((user) => `<option value="${taskListHtml(user.id)}"${user.id === value ? " selected" : ""}>${taskListHtml(user.name || user.email)}</option>`).join("");
    return `<label><span>Value</span><select data-custom-field-value><option value="">Select person</option>${options}</select></label>`;
  }
  if (type === "date") {
    return `<label><span>Value</span><input data-custom-field-value type="date" value="${taskListHtml(value)}" /></label>`;
  }
  if (type === "status") {
    const options = Object.entries(taskListStatusLabels).map(([key, label]) => `<option value="${taskListHtml(key)}"${key === value ? " selected" : ""}>${taskListHtml(label)}</option>`).join("");
    return `<label><span>Value</span><select data-custom-field-value><option value="">Select status</option>${options}</select></label>`;
  }
  if (type === "dropdown") {
    const options = taskListDropdownDefaults.map((label) => `<option value="${taskListHtml(label)}"${label === value ? " selected" : ""}>${taskListHtml(label)}</option>`).join("");
    return `<label><span>Value</span><select data-custom-field-value><option value="">Select option</option>${options}</select></label>`;
  }
  if (type === "file") {
    const fileName = meta.fileName || value || "No file selected";
    return `<label><span>Value</span><input data-custom-field-file type="file" /><input data-custom-field-value type="hidden" value="${taskListHtml(value)}" /><small class="file-field-preview" data-file-preview>${taskListHtml(fileName)}</small></label>`;
  }
  return `<label><span>Value</span><input data-custom-field-value maxlength="240" value="${taskListHtml(value)}" placeholder="Type text" /></label>`;
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
          <div class="common-field-picker">
            <label><span>Custom field data type</span><select id="taskListCommonFieldType">${commonFieldTypeOptions()}</select></label>
            <button type="button" class="secondary-action" id="taskListAddCommonField">Add Selected</button>
          </div>
          <div class="custom-field-builder" id="taskListCustomFields" aria-label="Custom fields"></div>
          <button type="button" class="secondary-action" id="taskListAddCustomField">Add Text Field</button>
        </details>
        <div class="playground-modal-actions"><button type="button" id="taskListTaskCancel">Cancel</button><button class="primary-action" id="taskListTaskSave" type="button">Create Task</button></div>
      </form>
    </div>
  `);
  document.getElementById("taskListTaskModalClose")?.addEventListener("click", closeTaskListModal);
  document.getElementById("taskListTaskCancel")?.addEventListener("click", closeTaskListModal);
  document.getElementById("taskListTaskSave")?.addEventListener("click", () => document.getElementById("taskListTaskForm")?.requestSubmit());
  document.getElementById("taskListAddCommonField")?.addEventListener("click", addTaskListCommonField);
  document.getElementById("taskListAddCustomField")?.addEventListener("click", () => addTaskListCustomField("", "", "text"));
  document.getElementById("taskListTaskModal")?.addEventListener("click", (event) => {
    if (event.target.id === "taskListTaskModal") closeTaskListModal();
  });
  document.getElementById("taskListTaskForm")?.addEventListener("submit", (event) => saveTaskListTask(event).catch((error) => {
    setTaskListModalBusy(false);
    setTaskListModalMessage(error.message, true);
    taskListSetStatus(error.message, true);
  }));
}

function addTaskListCommonField() {
  const selected = document.getElementById("taskListCommonFieldType")?.value || "text";
  addTaskListCustomField(commonFieldLabel(selected), "", selected);
}

function handleTaskListFileField(event, row) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > taskListFileLimitBytes) {
    event.target.value = "";
    taskListSetStatus("File custom fields support files up to 1 MB for now.", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    row.dataset.fileName = file.name;
    row.dataset.fileType = file.type || "application/octet-stream";
    row.dataset.fileSize = String(file.size);
    row.dataset.fileData = String(reader.result || "");
    const value = row.querySelector("[data-custom-field-value]");
    if (value) value.value = file.name;
    const preview = row.querySelector("[data-file-preview]");
    if (preview) preview.textContent = file.name;
    taskListSetStatus(`Attached ${file.name} to the custom field.`);
  };
  reader.onerror = () => taskListSetStatus("Could not read that file attachment.", true);
  reader.readAsDataURL(file);
}

function addTaskListCustomField(name = "", value = "", type = "text", meta = {}) {
  const container = document.getElementById("taskListCustomFields");
  if (!container) return;
  const row = document.createElement("div");
  const safeType = taskListCommonFieldTypes.some(([key]) => key === type) ? type : "text";
  row.className = "custom-field-row";
  row.dataset.customFieldType = safeType;
  if (meta.fileName) row.dataset.fileName = meta.fileName;
  if (meta.fileType) row.dataset.fileType = meta.fileType;
  if (meta.fileSize) row.dataset.fileSize = String(meta.fileSize);
  if (meta.fileData) row.dataset.fileData = meta.fileData;
  row.innerHTML = `<div class="field-type-pill"><span>Type</span><strong>${taskListHtml(taskListFieldTypeLabel(safeType))}</strong></div><label><span>Field</span><input data-custom-field-name maxlength="60" value="${taskListHtml(name)}" placeholder="${taskListHtml(taskListFieldTypeLabel(safeType))}" /></label>${taskListFieldValueControl(safeType, value, meta)}<button type="button" class="icon-button" aria-label="Remove custom field">x</button>`;
  row.querySelector("button")?.addEventListener("click", () => row.remove());
  row.querySelector("[data-custom-field-file]")?.addEventListener("change", (event) => handleTaskListFileField(event, row));
  container.appendChild(row);
  row.querySelector("[data-custom-field-value], [data-custom-field-file]")?.focus();
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
  form?.querySelectorAll("input, select, button").forEach((field) => {
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
    .map((row) => {
      const field = {
        type: row.dataset.customFieldType || "text",
        name: row.querySelector("[data-custom-field-name]")?.value || "",
        value: row.querySelector("[data-custom-field-value]")?.value || ""
      };
      if (field.type === "file") {
        field.fileName = row.dataset.fileName || field.value;
        field.fileType = row.dataset.fileType || "";
        field.fileSize = Number(row.dataset.fileSize || 0);
        field.fileData = row.dataset.fileData || "";
      }
      return field;
    })
    .filter((field) => field.name.trim() || field.value.trim() || field.fileName);
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
