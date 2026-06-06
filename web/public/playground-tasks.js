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

async function taskListFetch(url) {
  const response = await fetch(url, { headers: taskListHeaders() });
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

function renderTaskList() {
  const body = document.getElementById("taskListBody");
  if (!body) return;
  if (!taskListState.tasks.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty compact-empty">No tasks match these filters.</div></td></tr>`;
  } else {
    body.innerHTML = taskListState.tasks.map((task) => `<tr><td><strong>${taskListHtml(task.title)}</strong><small>${taskListHtml(task.description || "No description yet.")}</small></td><td><span class="status-badge ${taskListStatusClass(task.status)}">${taskListHtml(taskListStatusLabels[task.status] || task.status || "Open")}</span></td><td><span class="priority ${taskListHtml(task.priority || "medium")}">${taskListHtml(taskListPriorityLabels[task.priority] || task.priority || "Medium")}</span></td><td>${taskListHtml(task.projectTitle || "No project")}</td><td>${taskListHtml(taskListAssignees(task))}</td><td>${taskListHtml(task.dueLabel || task.dueDate || "No due date")}</td></tr>`).join("");
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

function initTaskListPage() {
  ["taskListSearch", "taskListStatus", "taskListPriority", "taskListProject", "taskListAssignee"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", applyTaskListFilters);
    document.getElementById(id)?.addEventListener("change", applyTaskListFilters);
  });
  document.getElementById("refreshTasksButton")?.addEventListener("click", () => loadTaskList().catch((error) => taskListSetStatus(error.message, true)));
  document.getElementById("taskListPrev")?.addEventListener("click", () => changeTaskListPage(-1));
  document.getElementById("taskListNext")?.addEventListener("click", () => changeTaskListPage(1));
  loadTaskList().catch((error) => taskListSetStatus(error.message, true));
}

if (document.body.dataset.adminPage === "playground-tasks") initTaskListPage();
