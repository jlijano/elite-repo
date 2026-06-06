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

const playgroundState = { tasks: [], projects: [], notes: [], metrics: null, storageMode: "" };
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

async function playgroundFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...playgroundHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Playground request failed.");
  return data;
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

function renderPlaygroundBoard(tasks = []) {
  const board = document.querySelector(".kanban-board");
  if (!board) return;
  board.innerHTML = playgroundStatusOrder.map((status) => {
    const columnTasks = tasks.filter((task) => task.status === status);
    const cards = columnTasks.map((task) => `<article class="task-card"><div class="row"><span>${playgroundHtml(task.title)}</span><small class="tag project">${playgroundHtml(task.category || "Tasks")}</small></div><p>${playgroundHtml(task.description || "No description yet.")}</p><div class="task-meta"><span class="priority ${playgroundHtml(task.priority || "medium")}">${playgroundHtml(task.priority || "Medium")}</span><time${task.dueDate ? ` datetime="${playgroundHtml(task.dueDate)}"` : ""}>${playgroundHtml(task.dueLabel || "No due date")}</time></div></article>`).join("");
    return `<section class="kanban-column" aria-labelledby="${status}Title"><header><h3 id="${status}Title">${playgroundHtml(playgroundStatusLabels[status])}</h3>${playgroundBadge(columnTasks.length, status)}</header>${cards || `<div class="empty compact-empty">No tasks yet.</div>`}</section>`;
  }).join("");
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
  list.innerHTML = openTasks.length ? openTasks.map((task) => `<label class="todo-item"><input type="checkbox" ${task.status === "done" ? "checked" : ""} disabled /> <span>${playgroundHtml(task.title)}</span><small>${playgroundHtml(task.dueLabel || playgroundStatusLabels[task.status] || "Open")}</small><strong class="priority ${playgroundHtml(task.priority || "medium")}">${playgroundHtml(task.priority || "Medium")}</strong></label>`).join("") : `<div class="empty compact-empty">No open tasks.</div>`;
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
  playgroundState.storageMode = data.storageMode || "";
  renderPlaygroundMetrics(playgroundState.metrics);
  renderPlaygroundBoard(playgroundState.tasks);
  renderPlaygroundProjects(playgroundState.projects);
  renderPlaygroundTodos(playgroundState.tasks);
  renderPlaygroundNotes(playgroundState.notes);
}

async function loadStoredPlayground() {
  playgroundSetStatus("Loading stored Playground records...");
  const data = await playgroundFetch("/api/admin/playground");
  renderPlayground(data);
  playgroundSetStatus(`Playground records loaded from ${data.storageMode || "storage"}.`);
}

async function createStoredTask() {
  const title = window.prompt("New task title");
  if (!title || !title.trim()) return;
  playgroundSetStatus("Creating Playground task...");
  await playgroundFetch("/api/admin/playground/tasks", {
    method: "POST",
    body: JSON.stringify({ title: title.trim(), description: "New task created from Playground.", status: "todo", category: "Tasks", priority: "medium" })
  });
  await loadStoredPlayground();
  playgroundSetStatus("Task saved to Playground storage.");
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

function initStoredPlayground() {
  document.querySelector('[aria-label="Create a new task"]')?.addEventListener("click", () => createStoredTask().catch((error) => playgroundSetStatus(error.message, true)));
  document.querySelector('[aria-label="Create a new project"]')?.addEventListener("click", () => createStoredProject().catch((error) => playgroundSetStatus(error.message, true)));
  loadStoredPlayground().catch((error) => playgroundSetStatus(error.message, true));
}

if (document.body.dataset.adminPage === "playground") initStoredPlayground();
