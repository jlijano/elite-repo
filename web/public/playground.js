const playgroundSessionTokenKey = "switchboard-session-token";
const playgroundAdminTokenKey = "switchboard-admin-token";
const playgroundStatusOrder = ["backlog", "todo", "in_progress", "review", "done"];
const playgroundStatusLabels = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done"
};
const playgroundProjectStatusLabels = {
  planning: "Planning",
  active: "Active",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
  archived: "Archived"
};
const playgroundPriorityLabels = { low: "Low", medium: "Medium", high: "High" };

const playgroundState = {
  tasks: [],
  projects: [],
  notes: [],
  users: [],
  metrics: null,
  storageMode: "",
  taskPage: { cursor: "0", nextCursor: null, limit: 100, total: 0 },
  filters: { search: "", status: "", priority: "", projectId: "", assigneeId: "", cursor: "0", limit: "100" },
  editingTaskId: "",
  selectedTaskId: "",
  boardTitle: "Kanban Board"
};

const playgroundHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const playgroundHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const adminToken = sessionStorage.getItem(playgroundAdminTokenKey) || "";
  const sessionToken = sessionStorage.getItem(playgroundSessionTokenKey) || "";
  if (adminToken) headers["x-admin-token"] = adminToken;
  if (sessionToken) headers["x-session-token"] = sessionToken;
  return headers;
};

function playgroundStatusClass(state = "") {
  const normalized = String(state).toLowerCase();
  if (normalized.includes("backlog")) return "status-public";
  if (normalized.includes("todo") || normalized.includes("planning")) return "status-storage";
  if (normalized.includes("progress") || normalized.includes("review")) return "status-loaded";
  return "status-ready";
}

function playgroundBadge(label, state = label) {
  return `<small class="status-badge ${playgroundStatusClass(state)}">${playgroundHtml(label)}</small>`;
}

function playgroundSetStatus(message, error = false) {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("error", error);
}

function setTaskFormMessage(message = "", error = false) {
  const messageEl = document.getElementById("playgroundTaskFormMessage");
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.hidden = !message;
  messageEl.classList.toggle("error", error);
}

function setTaskFormBusy(busy) {
  const form = document.getElementById("playgroundTaskForm");
  const saveButton = document.getElementById("playgroundTaskSave");
  form?.querySelectorAll("input, select, textarea, button").forEach((field) => {
    if (["playgroundTaskModalClose", "playgroundTaskCancel"].includes(field.id)) return;
    field.disabled = busy;
  });
  if (saveButton) saveButton.textContent = busy ? "Saving..." : "Save Task";
}

async function playgroundFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...playgroundHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Playground request failed.");
  return data;
}

function userName(userId) {
  const user = playgroundState.users.find((item) => item.id === userId);
  return user?.name || user?.email || "";
}

function assigneeText(task) {
  const names = (task.assigneeIds || []).map(userName).filter(Boolean);
  return names.length ? names.join(", ") : "Unassigned";
}

function optionList(items, selected, label = "All") {
  return [`<option value="">${playgroundHtml(label)}</option>`, ...items.map((item) => `<option value="${playgroundHtml(item.id)}"${item.id === selected ? " selected" : ""}>${playgroundHtml(item.title || item.name || item.email)}</option>`)].join("");
}

function renderPlaygroundMetrics(metrics = {}) {
  const container = document.querySelector(".playground-metrics");
  if (!container) return;
  const cards = [
    ["Total Tasks", metrics.totalTasks ?? 0, "Across stored workspaces"],
    ["Active Projects", metrics.activeProjects ?? 0, "Tracked this cycle"],
    ["In Progress", metrics.inProgress ?? 0, "Moving through the board"],
    ["Completed", metrics.completed ?? 0, "Closed this sprint"]
  ];
  container.innerHTML = cards.map(([label, value, detail]) => `<article class="metric-card"><span>${playgroundHtml(label)}</span><strong>${playgroundHtml(value)}</strong><p>${playgroundHtml(detail)}</p></article>`).join("");
}

function renderTaskControls() {
  const boardCard = document.querySelector(".playground-board-card");
  if (!boardCard || document.querySelector(".playground-task-controls")) return;
  const controls = document.createElement("div");
  controls.className = "playground-task-controls";
  controls.innerHTML = `
    <label><span>Search</span><input id="playgroundTaskSearch" type="search" placeholder="Search tasks" /></label>
    <label><span>Status</span><select id="playgroundTaskStatus"><option value="">All statuses</option>${playgroundStatusOrder.map((status) => `<option value="${status}">${playgroundStatusLabels[status]}</option>`).join("")}</select></label>
    <label><span>Priority</span><select id="playgroundTaskPriority"><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
    <label><span>Project</span><select id="playgroundTaskProject"></select></label>
    <label><span>Assignee</span><select id="playgroundTaskAssignee"></select></label>
    <div class="playground-page-actions"><button id="playgroundPrevPage" type="button">Previous</button><button id="playgroundNextPage" type="button">Next</button></div>
  `;
  const board = boardCard.querySelector(".kanban-board");
  boardCard.insertBefore(controls, board);
  ["playgroundTaskSearch", "playgroundTaskStatus", "playgroundTaskPriority", "playgroundTaskProject", "playgroundTaskAssignee"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", applyTaskFilters);
    document.getElementById(id)?.addEventListener("change", applyTaskFilters);
  });
  document.getElementById("playgroundPrevPage")?.addEventListener("click", () => changeTaskPage(-1));
  document.getElementById("playgroundNextPage")?.addEventListener("click", () => changeTaskPage(1));
}

function updateTaskControls() {
  const projectSelect = document.getElementById("playgroundTaskProject");
  const assigneeSelect = document.getElementById("playgroundTaskAssignee");
  const statusSelect = document.getElementById("playgroundTaskStatus");
  const prioritySelect = document.getElementById("playgroundTaskPriority");
  const searchInput = document.getElementById("playgroundTaskSearch");
  if (projectSelect) projectSelect.innerHTML = optionList(playgroundState.projects, playgroundState.filters.projectId, "All projects");
  if (assigneeSelect) assigneeSelect.innerHTML = optionList(playgroundState.users, playgroundState.filters.assigneeId, "All assignees");
  if (statusSelect) statusSelect.value = playgroundState.filters.status || "";
  if (prioritySelect) prioritySelect.value = playgroundState.filters.priority || "";
  if (searchInput) searchInput.value = playgroundState.filters.search || "";
  const page = playgroundState.taskPage || {};
  const prev = document.getElementById("playgroundPrevPage");
  const next = document.getElementById("playgroundNextPage");
  if (prev) prev.disabled = Number(page.cursor || 0) <= 0;
  if (next) next.disabled = !page.nextCursor;
}

function applyTaskFilters() {
  playgroundState.filters = {
    search: document.getElementById("playgroundTaskSearch")?.value || "",
    status: document.getElementById("playgroundTaskStatus")?.value || "",
    priority: document.getElementById("playgroundTaskPriority")?.value || "",
    projectId: document.getElementById("playgroundTaskProject")?.value || "",
    assigneeId: document.getElementById("playgroundTaskAssignee")?.value || "",
    cursor: "0",
    limit: playgroundState.filters.limit || "100"
  };
  loadStoredPlayground().catch((error) => playgroundSetStatus(error.message, true));
}

function changeTaskPage(direction) {
  const page = playgroundState.taskPage || {};
  const limit = Number(page.limit || playgroundState.filters.limit || 100);
  const cursor = Number(page.cursor || 0);
  playgroundState.filters.cursor = direction > 0 ? page.nextCursor || String(cursor) : String(Math.max(0, cursor - limit));
  loadStoredPlayground().catch((error) => playgroundSetStatus(error.message, true));
}

function queryString() {
  const params = new URLSearchParams();
  Object.entries(playgroundState.filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function renderPlaygroundBoard(tasks = []) {
  const boardTitle = document.getElementById("kanbanTitle");
  const board = document.querySelector(".kanban-board");
  if (boardTitle) boardTitle.textContent = playgroundState.boardTitle || "Kanban Board";
  if (!board) return;
  board.innerHTML = playgroundStatusOrder.map((status) => {
    const columnTasks = tasks.filter((task) => task.status === status);
    const cards = columnTasks.map((task) => `<article class="task-card" data-task-card="${playgroundHtml(task.id)}"><div class="row"><span>${playgroundHtml(task.title)}</span><small class="tag project">${playgroundHtml(task.category || "Tasks")}</small></div><p>${playgroundHtml(task.description || "No description yet.")}</p><div class="task-meta"><span class="priority ${playgroundHtml(task.priority || "medium")}">${playgroundHtml(playgroundPriorityLabels[task.priority] || task.priority || "Medium")}</span><time${task.dueDate ? ` datetime="${playgroundHtml(task.dueDate)}"` : ""}>${playgroundHtml(task.dueLabel || task.dueDate || "No due date")}</time></div><div class="task-extra"><span>${playgroundHtml(task.projectTitle || "No project")}</span><span>${playgroundHtml(assigneeText(task))}</span></div><div class="task-actions"><button type="button" data-task-detail="${playgroundHtml(task.id)}">Open</button><button type="button" data-task-edit="${playgroundHtml(task.id)}">Edit</button></div></article>`).join("");
    return `<section class="kanban-column" aria-labelledby="${status}Title"><header><h3 id="${status}Title">${playgroundHtml(playgroundStatusLabels[status])}</h3>${playgroundBadge(columnTasks.length, status)}</header>${cards || `<div class="empty compact-empty">No tasks yet.</div>`}</section>`;
  }).join("");
  board.querySelectorAll("[data-task-detail]").forEach((button) => button.addEventListener("click", () => openTaskDetail(button.dataset.taskDetail)));
  board.querySelectorAll("[data-task-edit]").forEach((button) => button.addEventListener("click", () => openTaskModal(playgroundState.tasks.find((task) => task.id === button.dataset.taskEdit))));
}

function renderPlaygroundProjects(projects = []) {
  const list = document.querySelector(".project-list");
  if (!list) return;
  list.innerHTML = projects.length ? projects.map((project) => {
    const progress = Math.min(100, Math.max(0, Number(project.progress || 0)));
    const statusLabel = playgroundProjectStatusLabels[project.status] || project.status || "Planning";
    return `<article class="project-card"><div class="row"><span>${playgroundHtml(project.title)}</span>${playgroundBadge(statusLabel, project.status)}</div><p>${playgroundHtml(project.description || "No description yet.")}</p><div class="progress-track" aria-label="${playgroundHtml(project.title)} progress"><span style="width: ${progress}%"></span></div><div class="project-meta"><strong>${progress}%</strong><span>${playgroundHtml(project.taskCount || 0)} tasks</span></div></article>`;
  }).join("") : `<div class="empty action-empty"><strong>No projects yet.</strong><p>Create a project to start tracking progress.</p></div>`;
}

function renderPlaygroundTodos(tasks = []) {
  const list = document.querySelector(".todo-list");
  if (!list) return;
  const openTasks = tasks.filter((task) => task.status !== "done").slice(0, 5);
  list.innerHTML = openTasks.length ? openTasks.map((task) => `<label class="todo-item"><input type="checkbox" ${task.status === "done" ? "checked" : ""} disabled /> <span>${playgroundHtml(task.title)}</span><small>${playgroundHtml(task.dueLabel || playgroundStatusLabels[task.status] || "Open")}</small><strong class="priority ${playgroundHtml(task.priority || "medium")}">${playgroundHtml(playgroundPriorityLabels[task.priority] || task.priority || "Medium")}</strong></label>`).join("") : `<div class="empty compact-empty">No open tasks.</div>`;
}

function renderPlaygroundNotes(notes = []) {
  const list = document.querySelector(".notes-list");
  if (!list) return;
  list.innerHTML = notes.length ? notes.map((note) => `<article class="item"><div class="row"><span>${playgroundHtml(note.content)}</span>${playgroundBadge(note.label || "Note")}</div></article>`).join("") : `<div class="empty compact-empty">No workspace notes yet.</div>`;
}

function renderPlayground(data) {
  playgroundState.metrics = data.metrics || {};
  playgroundState.tasks = data.tasks || [];
  playgroundState.projects = data.projects || [];
  playgroundState.notes = data.notes || [];
  playgroundState.users = data.users || playgroundState.users || [];
  playgroundState.taskPage = data.taskPage || playgroundState.taskPage;
  playgroundState.storageMode = data.storageMode || "";
  renderTaskControls();
  updateTaskControls();
  renderPlaygroundMetrics(playgroundState.metrics);
  renderPlaygroundBoard(playgroundState.tasks);
  renderPlaygroundProjects(playgroundState.projects);
  renderPlaygroundTodos(playgroundState.tasks);
  renderPlaygroundNotes(playgroundState.notes);
}

async function loadStoredPlayground() {
  playgroundSetStatus("Loading stored Playground records...");
  const data = await playgroundFetch(`/api/admin/playground?${queryString()}`);
  renderPlayground(data);
  const total = data.taskPage?.total ?? data.tasks?.length ?? 0;
  playgroundSetStatus(`Playground records loaded from ${data.storageMode || "storage"}. ${total} task${total === 1 ? "" : "s"} match.`);
}

function injectTaskSurfaces() {
  if (document.getElementById("playgroundTaskModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="playground-modal-backdrop" id="playgroundTaskModal" hidden>
      <form class="playground-modal" id="playgroundTaskForm" aria-labelledby="playgroundTaskModalTitle">
        <div class="playground-modal-head"><div><p class="section-kicker">Task storage</p><h2 id="playgroundTaskModalTitle">New Task</h2></div><button type="button" class="icon-button" id="playgroundTaskModalClose" aria-label="Close task form">x</button></div>
        <p class="playground-form-message" id="playgroundTaskFormMessage" hidden></p>
        <div class="playground-form-grid">
          <label>Title<input id="playgroundTaskTitle" name="title" required maxlength="140" /></label>
          <label>Status<select id="playgroundTaskStatusInput" name="status">${playgroundStatusOrder.map((status) => `<option value="${status}">${playgroundStatusLabels[status]}</option>`).join("")}</select></label>
          <label>Priority<select id="playgroundTaskPriorityInput" name="priority"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
          <label>Project<select id="playgroundTaskProjectInput" name="projectId"></select></label>
          <label>Assignees<select id="playgroundTaskAssigneesInput" name="assigneeIds" multiple size="4"></select></label>
          <label>Due date<input id="playgroundTaskDueDate" name="dueDate" type="date" /></label>
          <label>Due label<input id="playgroundTaskDueLabel" name="dueLabel" maxlength="80" placeholder="Jun 14" /></label>
          <label>Category<input id="playgroundTaskCategory" name="category" maxlength="80" placeholder="Tasks" /></label>
          <label class="wide-field">Description<textarea id="playgroundTaskDescription" name="description" rows="4" maxlength="1200"></textarea></label>
        </div>
        <div class="playground-modal-actions"><button type="button" id="playgroundTaskCancel">Cancel</button><button class="primary-action" id="playgroundTaskSave" type="button">Save Task</button></div>
      </form>
    </div>
    <div class="playground-modal-backdrop" id="playgroundBoardModal" hidden>
      <form class="playground-modal" id="playgroundBoardForm" aria-labelledby="playgroundBoardModalTitle">
        <div class="playground-modal-head"><div><p class="section-kicker">Board view</p><h2 id="playgroundBoardModalTitle">Add Board</h2></div><button type="button" class="icon-button" id="playgroundBoardModalClose" aria-label="Close board form">x</button></div>
        <p class="playground-form-message" id="playgroundBoardFormMessage" hidden></p>
        <div class="playground-form-grid">
          <label>Board name<input id="playgroundBoardTitle" name="title" required maxlength="80" placeholder="Kanban Board" /></label>
          <label>Default status<select id="playgroundBoardStatus" name="status"><option value="">All statuses</option>${playgroundStatusOrder.map((status) => `<option value="${status}">${playgroundStatusLabels[status]}</option>`).join("")}</select></label>
        </div>
        <div class="playground-modal-actions"><button type="button" id="playgroundBoardCancel">Cancel</button><button class="primary-action" id="playgroundBoardSave" type="submit">Save Board View</button></div>
      </form>
    </div>
    <aside class="playground-task-drawer" id="playgroundTaskDrawer" aria-label="Task details" hidden>
      <div class="playground-drawer-head"><div><p class="section-kicker">Task detail</p><h2 id="playgroundDrawerTitle">Task</h2></div><button type="button" class="icon-button" id="playgroundTaskDrawerClose" aria-label="Close task details">x</button></div>
      <div id="playgroundTaskDrawerBody" class="playground-drawer-body"></div>
    </aside>
  `);
  document.getElementById("playgroundTaskModalClose")?.addEventListener("click", closeTaskModal);
  document.getElementById("playgroundTaskCancel")?.addEventListener("click", closeTaskModal);
  document.getElementById("playgroundTaskSave")?.addEventListener("click", () => document.getElementById("playgroundTaskForm")?.requestSubmit());
  document.getElementById("playgroundTaskModal")?.addEventListener("click", (event) => {
    if (event.target.id === "playgroundTaskModal") closeTaskModal();
  });
  document.getElementById("playgroundTaskForm")?.addEventListener("submit", (event) => saveTaskForm(event).catch((error) => {
    setTaskFormBusy(false);
    setTaskFormMessage(error.message, true);
    playgroundSetStatus(error.message, true);
  }));
  document.getElementById("playgroundBoardModalClose")?.addEventListener("click", closeBoardModal);
  document.getElementById("playgroundBoardCancel")?.addEventListener("click", closeBoardModal);
  document.getElementById("playgroundBoardModal")?.addEventListener("click", (event) => {
    if (event.target.id === "playgroundBoardModal") closeBoardModal();
  });
  document.getElementById("playgroundBoardForm")?.addEventListener("submit", saveBoardView);
  document.getElementById("playgroundTaskDrawerClose")?.addEventListener("click", closeTaskDetail);
}

function fillTaskSelects(task = {}) {
  const project = document.getElementById("playgroundTaskProjectInput");
  const assignees = document.getElementById("playgroundTaskAssigneesInput");
  if (project) project.innerHTML = optionList(playgroundState.projects, task.projectId || "", "No project");
  if (assignees) {
    assignees.innerHTML = playgroundState.users.map((user) => `<option value="${playgroundHtml(user.id)}"${(task.assigneeIds || []).includes(user.id) ? " selected" : ""}>${playgroundHtml(user.name || user.email)}</option>`).join("");
  }
}

function openTaskModal(task = null) {
  injectTaskSurfaces();
  playgroundState.editingTaskId = task?.id || "";
  setTaskFormBusy(false);
  setTaskFormMessage("");
  document.getElementById("playgroundTaskModalTitle").textContent = task ? "Edit Task" : "New Task";
  fillTaskSelects(task || {});
  document.getElementById("playgroundTaskTitle").value = task?.title || "";
  document.getElementById("playgroundTaskStatusInput").value = task?.status || "todo";
  document.getElementById("playgroundTaskPriorityInput").value = task?.priority || "medium";
  document.getElementById("playgroundTaskDueDate").value = task?.dueDate || "";
  document.getElementById("playgroundTaskDueLabel").value = task?.dueLabel || "";
  document.getElementById("playgroundTaskCategory").value = task?.category || "Tasks";
  document.getElementById("playgroundTaskDescription").value = task?.description || "";
  document.getElementById("playgroundTaskModal").hidden = false;
  document.getElementById("playgroundTaskTitle")?.focus();
}

function closeTaskModal() {
  const modal = document.getElementById("playgroundTaskModal");
  if (modal) modal.hidden = true;
  setTaskFormBusy(false);
  playgroundState.editingTaskId = "";
}

function openBoardModal() {
  injectTaskSurfaces();
  document.getElementById("playgroundBoardTitle").value = playgroundState.boardTitle || "Kanban Board";
  document.getElementById("playgroundBoardStatus").value = playgroundState.filters.status || "";
  const message = document.getElementById("playgroundBoardFormMessage");
  if (message) {
    message.textContent = "Create a saved board view by naming the board and choosing a default status filter.";
    message.hidden = false;
    message.classList.remove("error");
  }
  document.getElementById("playgroundBoardModal").hidden = false;
  document.getElementById("playgroundBoardTitle")?.focus();
}

function closeBoardModal() {
  const modal = document.getElementById("playgroundBoardModal");
  if (modal) modal.hidden = true;
}

function saveBoardView(event) {
  event.preventDefault();
  const title = document.getElementById("playgroundBoardTitle")?.value?.trim() || "Kanban Board";
  const status = document.getElementById("playgroundBoardStatus")?.value || "";
  playgroundState.boardTitle = title;
  playgroundState.filters.status = status;
  playgroundState.filters.cursor = "0";
  closeBoardModal();
  loadStoredPlayground().catch((error) => playgroundSetStatus(error.message, true));
  playgroundSetStatus(`Board view "${title}" applied${status ? ` for ${playgroundStatusLabels[status] || status}` : ""}.`);
}

function taskFormPayload() {
  const assigneeSelect = document.getElementById("playgroundTaskAssigneesInput");
  return {
    title: document.getElementById("playgroundTaskTitle")?.value || "",
    status: document.getElementById("playgroundTaskStatusInput")?.value || "todo",
    priority: document.getElementById("playgroundTaskPriorityInput")?.value || "medium",
    projectId: document.getElementById("playgroundTaskProjectInput")?.value || "",
    assigneeIds: [...(assigneeSelect?.selectedOptions || [])].map((option) => option.value),
    dueDate: document.getElementById("playgroundTaskDueDate")?.value || "",
    dueLabel: document.getElementById("playgroundTaskDueLabel")?.value || "",
    category: document.getElementById("playgroundTaskCategory")?.value || "Tasks",
    description: document.getElementById("playgroundTaskDescription")?.value || ""
  };
}

async function saveTaskForm(event) {
  event.preventDefault();
  const taskId = playgroundState.editingTaskId;
  setTaskFormBusy(true);
  setTaskFormMessage(taskId ? "Saving task changes..." : "Creating task...");
  playgroundSetStatus(taskId ? "Saving task changes..." : "Creating task...");
  await playgroundFetch(taskId ? `/api/admin/playground/tasks/${encodeURIComponent(taskId)}` : "/api/admin/playground/tasks", {
    method: taskId ? "PATCH" : "POST",
    body: JSON.stringify(taskFormPayload())
  });
  closeTaskModal();
  await loadStoredPlayground();
  if (taskId) await openTaskDetail(taskId);
  playgroundSetStatus(taskId ? "Task updated." : "Task saved to Playground storage.");
}

async function createStoredProject() {
  const title = window.prompt("New project title");
  if (!title || !title.trim()) return;
  playgroundSetStatus("Creating Playground project...");
  await playgroundFetch("/api/admin/playground/projects", {
    method: "POST",
    body: JSON.stringify({ title: title.trim(), description: "New project created from Playground.", status: "planning", progress: 0, taskCount: 0 })
  });
  await loadStoredPlayground();
  playgroundSetStatus("Project saved to Playground storage.");
}

async function openTaskDetail(taskId) {
  playgroundState.selectedTaskId = taskId;
  injectTaskSurfaces();
  const drawer = document.getElementById("playgroundTaskDrawer");
  const body = document.getElementById("playgroundTaskDrawerBody");
  drawer.hidden = false;
  body.innerHTML = `<div class="empty compact-empty">Loading task...</div>`;
  const detail = await playgroundFetch(`/api/admin/playground/tasks/${encodeURIComponent(taskId)}`);
  const task = detail.task;
  document.getElementById("playgroundDrawerTitle").textContent = task.title;
  body.innerHTML = `
    <section class="drawer-section"><div class="drawer-task-summary"><span class="priority ${playgroundHtml(task.priority)}">${playgroundHtml(playgroundPriorityLabels[task.priority] || task.priority)}</span>${playgroundBadge(playgroundStatusLabels[task.status] || task.status, task.status)}</div><p>${playgroundHtml(task.description || "No description yet.")}</p><dl class="task-detail-grid"><div><dt>Project</dt><dd>${playgroundHtml(task.projectTitle || "No project")}</dd></div><div><dt>Assignees</dt><dd>${playgroundHtml(assigneeText(task))}</dd></div><div><dt>Due</dt><dd>${playgroundHtml(task.dueLabel || task.dueDate || "No due date")}</dd></div><div><dt>Status key</dt><dd><code>${playgroundHtml(task.statusKey || task.status)}</code></dd></div></dl><button type="button" class="secondary-action" data-drawer-edit="${playgroundHtml(task.id)}">Edit task</button></section>
    <section class="drawer-section"><h3>Updates</h3><form class="drawer-update-form" id="playgroundTaskUpdateForm"><textarea id="playgroundTaskUpdateBody" rows="3" placeholder="Add an update"></textarea><button class="primary-action" type="submit">Post Update</button></form><div class="drawer-list">${(detail.updates || []).map((update) => `<article class="item"><div class="row"><span>${playgroundHtml(update.createdBy)}</span><small>${playgroundHtml(new Date(update.createdAt).toLocaleString())}</small></div><p>${playgroundHtml(update.body)}</p></article>`).join("") || `<div class="empty compact-empty">No updates yet.</div>`}</div></section>
    <section class="drawer-section"><h3>Activity</h3><div class="drawer-list">${(detail.activity || []).map((item) => `<article class="item"><div class="row"><span>${playgroundHtml(item.action)}</span><small>${playgroundHtml(new Date(item.createdAt).toLocaleString())}</small></div><p>${playgroundHtml(item.actor)}</p>${renderActivityDetails(item.details)}</article>`).join("") || `<div class="empty compact-empty">No activity yet.</div>`}</div></section>
  `;
  body.querySelector("[data-drawer-edit]")?.addEventListener("click", () => openTaskModal(task));
  document.getElementById("playgroundTaskUpdateForm")?.addEventListener("submit", postTaskUpdate);
}

function renderActivityDetails(details = {}) {
  if (!Array.isArray(details.changes) || !details.changes.length) return "";
  return `<ul class="activity-change-list">${details.changes.map((change) => `<li><strong>${playgroundHtml(change.field)}</strong>: ${playgroundHtml(Array.isArray(change.from) ? change.from.join(", ") : change.from)} to ${playgroundHtml(Array.isArray(change.to) ? change.to.join(", ") : change.to)}</li>`).join("")}</ul>`;
}

async function postTaskUpdate(event) {
  event.preventDefault();
  const body = document.getElementById("playgroundTaskUpdateBody")?.value || "";
  if (!body.trim()) return;
  playgroundSetStatus("Posting task update...");
  await playgroundFetch(`/api/admin/playground/tasks/${encodeURIComponent(playgroundState.selectedTaskId)}/updates`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
  await openTaskDetail(playgroundState.selectedTaskId);
  playgroundSetStatus("Task update posted.");
}

function closeTaskDetail() {
  const drawer = document.getElementById("playgroundTaskDrawer");
  if (drawer) drawer.hidden = true;
  playgroundState.selectedTaskId = "";
}

function interceptBoardMenuClicks() {
  document.addEventListener("click", (event) => {
    const boardAction = event.target.closest('.playground-add-dropdown a[href="/playground.html"]');
    if (!boardAction || !boardAction.textContent.trim().toLowerCase().includes("board")) return;
    event.preventDefault();
    const menu = boardAction.closest(".playground-add-dropdown");
    const button = boardAction.closest(".playground-add-menu")?.querySelector(".playground-add-button");
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
    openBoardModal();
  });
}

function initStoredPlayground() {
  injectTaskSurfaces();
  document.querySelector('[aria-label="Create a new task"]')?.addEventListener("click", () => openTaskModal());
  document.querySelector('[aria-label="Create a new project"]')?.addEventListener("click", () => createStoredProject().catch((error) => playgroundSetStatus(error.message, true)));
  interceptBoardMenuClicks();
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTaskModal();
      closeBoardModal();
      closeTaskDetail();
    }
  });
  loadStoredPlayground().catch((error) => playgroundSetStatus(error.message, true));
}

if (document.body.dataset.adminPage === "playground") initStoredPlayground();
