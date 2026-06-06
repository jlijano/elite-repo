const { Pool } = require("pg");

const taskStatuses = new Set(["backlog", "todo", "in_progress", "review", "done"]);
const priorities = new Set(["low", "medium", "high"]);
const projectStatuses = new Set(["planning", "active", "in_progress", "review", "completed", "archived"]);

const seedTasks = [
  { id: "00000000-0000-4000-9000-000000000101", projectId: "00000000-0000-4000-9000-000000000204", title: "Update project notes", description: "Collect ideas and organize next sprint planning notes.", status: "backlog", category: "Planning", priority: "low", dueLabel: "No due date", dueDate: null, assigneeIds: [], customFields: [] },
  { id: "00000000-0000-4000-9000-000000000102", projectId: "00000000-0000-4000-9000-000000000201", title: "Create task filtering UI", description: "Add filters for priority, project, and completion status.", status: "todo", category: "Tasks", priority: "medium", dueLabel: "Jun 14", dueDate: "2026-06-14", assigneeIds: [], customFields: [{ name: "Module", value: "Tasks" }] },
  { id: "00000000-0000-4000-9000-000000000103", projectId: "00000000-0000-4000-9000-000000000202", title: "Build project detail view", description: "Create a focused view for project milestones, tasks, and activity.", status: "todo", category: "Projects", priority: "high", dueLabel: "Jun 18", dueDate: "2026-06-18", assigneeIds: [], customFields: [{ name: "View", value: "Detail" }] },
  { id: "00000000-0000-4000-9000-000000000104", projectId: "00000000-0000-4000-9000-000000000201", title: "Design dashboard layout", description: "Refine the workspace layout and responsive card structure.", status: "in_progress", category: "UI", priority: "high", dueLabel: "Jun 10", dueDate: "2026-06-10", assigneeIds: [], customFields: [] },
  { id: "00000000-0000-4000-9000-000000000105", projectId: "00000000-0000-4000-9000-000000000203", title: "Review kanban interactions", description: "Check drag states, empty states, keyboard navigation, and mobile layout.", status: "review", category: "QA", priority: "medium", dueLabel: "Jun 16", dueDate: "2026-06-16", assigneeIds: [], customFields: [{ name: "Check", value: "Keyboard" }] },
  { id: "00000000-0000-4000-9000-000000000106", projectId: "00000000-0000-4000-9000-000000000203", title: "Prepare release checklist", description: "Document final tasks needed before the workspace release.", status: "done", category: "Release", priority: "low", dueLabel: "Completed", dueDate: null, assigneeIds: [], customFields: [] }
];

const seedProjects = [
  { id: "00000000-0000-4000-9000-000000000201", title: "Website Redesign", description: "Refresh core pages, navigation, and dashboard experience.", status: "in_progress", progress: 72, taskCount: 12 },
  { id: "00000000-0000-4000-9000-000000000202", title: "Client Portal", description: "Build a cleaner workspace for client-facing project updates.", status: "active", progress: 45, taskCount: 9 },
  { id: "00000000-0000-4000-9000-000000000203", title: "Internal Tools", description: "Improve admin workflows and team productivity utilities.", status: "review", progress: 88, taskCount: 7 },
  { id: "00000000-0000-4000-9000-000000000204", title: "Marketing Launch", description: "Coordinate launch assets, approvals, and publishing schedule.", status: "planning", progress: 30, taskCount: 14 }
];

const seedNotes = [
  { id: "00000000-0000-4000-9000-000000000301", content: "Sprint planning notes are ready for review.", label: "Ready" },
  { id: "00000000-0000-4000-9000-000000000302", content: "Kanban layout needs mobile testing.", label: "Layout" },
  { id: "00000000-0000-4000-9000-000000000303", content: "Project cards are now backed by Playground storage.", label: "Stored" }
];

function appError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanString(value, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNullableId(value) {
  const id = cleanString(value, 80);
  return id || null;
}

function cleanStatus(value, allowed, fallback) {
  const status = cleanString(value, 40) || fallback;
  if (!allowed.has(status)) throw appError(400, "Unsupported status value.");
  return status;
}

function cleanPriority(value) {
  const priority = cleanString(value, 20).toLowerCase() || "medium";
  if (!priorities.has(priority)) throw appError(400, "Priority must be low, medium, or high.");
  return priority;
}

function cleanInt(value, fallback = 0, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanAssigneeIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanString(item, 80)).filter(Boolean))].slice(0, 20);
}

function cleanCustomFields(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((field) => ({ name: cleanString(field?.name, 60), value: cleanString(field?.value, 240) }))
    .filter((field) => field.name || field.value)
    .slice(0, 12);
}

function taskPayload(body = {}) {
  const title = cleanString(body.title, 140);
  if (!title) throw appError(400, "Task title is required.");
  const dueDate = cleanString(body.dueDate || body.due_date, 20) || null;
  return {
    title,
    description: cleanString(body.description, 1200),
    status: cleanStatus(body.status, taskStatuses, "todo"),
    category: cleanString(body.category, 80) || "Tasks",
    priority: cleanPriority(body.priority),
    dueLabel: cleanString(body.dueLabel || body.due_label, 80) || (dueDate || "No due date"),
    dueDate,
    projectId: cleanNullableId(body.projectId || body.project_id),
    assigneeIds: cleanAssigneeIds(body.assigneeIds || body.assignee_ids),
    customFields: cleanCustomFields(body.customFields || body.custom_fields)
  };
}

function projectPayload(body = {}) {
  const title = cleanString(body.title, 140);
  if (!title) throw appError(400, "Project title is required.");
  return {
    title,
    description: cleanString(body.description, 700),
    status: cleanStatus(body.status, projectStatuses, "planning"),
    progress: cleanInt(body.progress, 0),
    taskCount: cleanInt(body.taskCount || body.task_count, 0, 0, 999)
  };
}

function notePayload(body = {}) {
  const content = cleanString(body.content, 700);
  if (!content) throw appError(400, "Note content is required.");
  return { content, label: cleanString(body.label, 80) || "Note" };
}

function updatePayload(body = {}) {
  const bodyText = cleanString(body.body, 2000);
  if (!bodyText) throw appError(400, "Update body is required.");
  return { body: bodyText };
}

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function timestamp(value) {
  return new Date(value || new Date()).toISOString();
}

function taskRow(row) {
  return {
    id: row.id,
    projectId: row.project_id || row.projectId || "",
    projectTitle: row.project_title || row.projectTitle || "",
    title: row.title,
    description: row.description || "",
    status: row.status,
    statusKey: row.status,
    category: row.category || "Tasks",
    priority: row.priority || "medium",
    dueLabel: row.due_label || row.dueLabel || "",
    dueDate: dateOnly(row.due_date || row.dueDate),
    assigneeIds: row.assignee_ids || row.assigneeIds || [],
    customFields: row.custom_fields || row.customFields || [],
    completedAt: row.completed_at || row.completedAt ? timestamp(row.completed_at || row.completedAt) : null,
    createdAt: timestamp(row.created_at || row.createdAt),
    updatedAt: timestamp(row.updated_at || row.updatedAt)
  };
}

function projectRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    status: row.status,
    progress: Number(row.progress || 0),
    taskCount: Number(row.task_count || row.taskCount || 0),
    createdAt: timestamp(row.created_at || row.createdAt),
    updatedAt: timestamp(row.updated_at || row.updatedAt)
  };
}

function noteRow(row) {
  return {
    id: row.id,
    content: row.content,
    label: row.label || "Note",
    createdAt: timestamp(row.created_at || row.createdAt),
    updatedAt: timestamp(row.updated_at || row.updatedAt)
  };
}

function taskUpdateRow(row) {
  return {
    id: row.id,
    taskId: row.task_id || row.taskId,
    body: row.body,
    createdBy: row.created_by || row.createdBy || "Admin",
    createdAt: timestamp(row.created_at || row.createdAt)
  };
}

function taskActivityRow(row) {
  return {
    id: row.id,
    taskId: row.task_id || row.taskId,
    action: row.action,
    actor: row.actor || "Admin",
    details: row.details || {},
    createdAt: timestamp(row.created_at || row.createdAt)
  };
}

function metrics(tasks, projects) {
  return {
    totalTasks: tasks.length,
    activeProjects: projects.filter((project) => project.status !== "completed" && project.status !== "archived").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "done").length
  };
}

function normalizeFilters(filters = {}) {
  const limit = cleanInt(filters.limit, 100, 1, 200);
  const cursor = cleanInt(filters.cursor, 0, 0, 1000000);
  const status = cleanString(filters.status, 40);
  const priority = cleanString(filters.priority, 20);
  return {
    limit,
    cursor,
    status: taskStatuses.has(status) ? status : "",
    priority: priorities.has(priority) ? priority : "",
    projectId: cleanNullableId(filters.projectId || filters.project_id),
    assigneeId: cleanNullableId(filters.assigneeId || filters.assignee_id),
    search: cleanString(filters.search, 120).toLowerCase()
  };
}

function customFieldText(task) {
  return (task.customFields || []).map((field) => `${field.name || "Field"} ${field.value || ""}`).join(" ");
}

function filteredTasks(tasks, filters = {}) {
  const clean = normalizeFilters(filters);
  return tasks.filter((task) => {
    if (clean.status && task.status !== clean.status) return false;
    if (clean.priority && task.priority !== clean.priority) return false;
    if (clean.projectId && (task.projectId || "") !== clean.projectId) return false;
    if (clean.assigneeId && !(task.assigneeIds || []).includes(clean.assigneeId)) return false;
    if (clean.search) {
      const haystack = `${task.title} ${task.description} ${task.category} ${customFieldText(task)}`.toLowerCase();
      if (!haystack.includes(clean.search)) return false;
    }
    return true;
  });
}

function pagedTasks(tasks, filters = {}) {
  const clean = normalizeFilters(filters);
  const filtered = filteredTasks(tasks, filters);
  const items = filtered.slice(clean.cursor, clean.cursor + clean.limit);
  const nextCursor = clean.cursor + clean.limit < filtered.length ? String(clean.cursor + clean.limit) : null;
  return { items, pageInfo: { cursor: String(clean.cursor), nextCursor, limit: clean.limit, total: filtered.length } };
}

function changedFields(before, after) {
  const fields = ["title", "description", "status", "category", "priority", "dueLabel", "dueDate", "projectId"];
  const changes = [];
  for (const field of fields) {
    if ((before[field] || "") !== (after[field] || "")) changes.push({ field, from: before[field] || "", to: after[field] || "" });
  }
  if ((before.assigneeIds || []).join(",") !== (after.assigneeIds || []).join(",")) {
    changes.push({ field: "assigneeIds", from: before.assigneeIds || [], to: after.assigneeIds || [] });
  }
  if (JSON.stringify(before.customFields || []) !== JSON.stringify(after.customFields || [])) {
    changes.push({ field: "customFields", from: before.customFields || [], to: after.customFields || [] });
  }
  return changes;
}

function createPostgresStore(options) {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    ssl: options.databaseSsl === "true" ? { rejectUnauthorized: false } : undefined
  });
  let initialized;
  const ready = () => (initialized ||= pool.query(`
    CREATE TABLE IF NOT EXISTS playground_projects (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'in_progress', 'review', 'completed', 'archived')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      task_count INTEGER NOT NULL DEFAULT 0 CHECK (task_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS playground_projects_status_updated_idx ON playground_projects(status, updated_at DESC);
    CREATE TABLE IF NOT EXISTS playground_tasks (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
      category TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      due_label TEXT,
      due_date DATE,
      project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL,
      assignee_ids UUID[] NOT NULL DEFAULT '{}',
      custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL;
    ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] NOT NULL DEFAULT '{}';
    ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS playground_tasks_status_updated_idx ON playground_tasks(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS playground_tasks_project_idx ON playground_tasks(project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS playground_tasks_assignee_ids_idx ON playground_tasks USING GIN(assignee_ids);
    CREATE TABLE IF NOT EXISTS playground_task_updates (
      id UUID PRIMARY KEY,
      task_id UUID NOT NULL REFERENCES playground_tasks(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'Admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS playground_task_updates_task_created_idx ON playground_task_updates(task_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS playground_task_activity (
      id UUID PRIMARY KEY,
      task_id UUID NOT NULL REFERENCES playground_tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'Admin',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS playground_task_activity_task_created_idx ON playground_task_activity(task_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS playground_notes (
      id UUID PRIMARY KEY,
      content TEXT NOT NULL,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `).then(() => seedPostgres()));

  async function seedPostgres() {
    for (const project of seedProjects) {
      await pool.query(
        "INSERT INTO playground_projects (id, title, description, status, progress, task_count) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
        [project.id, project.title, project.description, project.status, project.progress, project.taskCount]
      );
    }
    for (const task of seedTasks) {
      await pool.query(
        "INSERT INTO playground_tasks (id, title, description, status, category, priority, due_label, due_date, project_id, assignee_ids, custom_fields, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, CASE WHEN $4 = 'done' THEN NOW() ELSE NULL END) ON CONFLICT (id) DO NOTHING",
        [task.id, task.title, task.description, task.status, task.category, task.priority, task.dueLabel, task.dueDate, task.projectId, task.assigneeIds, JSON.stringify(task.customFields || [])]
      );
    }
    for (const note of seedNotes) {
      await pool.query(
        "INSERT INTO playground_notes (id, content, label) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        [note.id, note.content, note.label]
      );
    }
  }

  async function addActivity(taskId, action, actor, details = {}) {
    await pool.query("INSERT INTO playground_task_activity (id, task_id, action, actor, details) VALUES ($1, $2, $3, $4, $5)", [options.makeId(), taskId, action, actor || "Admin", details]);
  }

  async function selectTasks(filters = {}) {
    await ready();
    const clean = normalizeFilters(filters);
    const where = [];
    const params = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
    if (clean.status) add("t.status = ?", clean.status);
    if (clean.priority) add("t.priority = ?", clean.priority);
    if (clean.projectId) add("t.project_id = ?", clean.projectId);
    if (clean.assigneeId) add("? = ANY(t.assignee_ids)", clean.assigneeId);
    if (clean.search) {
      params.push(`%${clean.search}%`);
      where.push(`(LOWER(t.title) LIKE $${params.length} OR LOWER(COALESCE(t.description, '')) LIKE $${params.length} OR LOWER(COALESCE(t.category, '')) LIKE $${params.length} OR LOWER(t.custom_fields::text) LIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM playground_tasks t ${clause}`, params);
    const result = await pool.query(
      `SELECT t.*, p.title AS project_title FROM playground_tasks t LEFT JOIN playground_projects p ON p.id = t.project_id ${clause} ORDER BY CASE t.status WHEN 'backlog' THEN 1 WHEN 'todo' THEN 2 WHEN 'in_progress' THEN 3 WHEN 'review' THEN 4 ELSE 5 END, t.created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, clean.limit, clean.cursor]
    );
    const items = result.rows.map(taskRow);
    const total = count.rows[0]?.total || 0;
    const nextCursor = clean.cursor + clean.limit < total ? String(clean.cursor + clean.limit) : null;
    return { items, pageInfo: { cursor: String(clean.cursor), nextCursor, limit: clean.limit, total } };
  }

  async function loadTask(taskId) {
    await ready();
    const task = await pool.query("SELECT t.*, p.title AS project_title FROM playground_tasks t LEFT JOIN playground_projects p ON p.id = t.project_id WHERE t.id = $1", [taskId]);
    if (!task.rows[0]) return null;
    const [updates, activity] = await Promise.all([
      pool.query("SELECT * FROM playground_task_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 100", [taskId]),
      pool.query("SELECT * FROM playground_task_activity WHERE task_id = $1 ORDER BY created_at DESC LIMIT 100", [taskId])
    ]);
    return { task: taskRow(task.rows[0]), updates: updates.rows.map(taskUpdateRow), activity: activity.rows.map(taskActivityRow) };
  }

  return {
    mode: "postgres",
    async listAll(filters = {}) {
      await ready();
      const [taskPage, projectResult, noteResult, metricTaskResult] = await Promise.all([
        selectTasks(filters),
        pool.query("SELECT * FROM playground_projects ORDER BY updated_at DESC LIMIT 200"),
        pool.query("SELECT * FROM playground_notes ORDER BY updated_at DESC LIMIT 100"),
        selectTasks({ limit: 200 })
      ]);
      const projects = projectResult.rows.map(projectRow);
      return { metrics: metrics(metricTaskResult.items, projects), tasks: taskPage.items, taskPage: taskPage.pageInfo, projects, notes: noteResult.rows.map(noteRow), storageMode: "postgres" };
    },
    async getTask(taskId) { return loadTask(taskId); },
    async createTask(payload, actor = "Admin") {
      await ready();
      const result = await pool.query(
        "INSERT INTO playground_tasks (id, title, description, status, category, priority, due_label, due_date, project_id, assignee_ids, custom_fields, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, CASE WHEN $4 = 'done' THEN NOW() ELSE NULL END) RETURNING *",
        [options.makeId(), payload.title, payload.description || null, payload.status, payload.category || null, payload.priority, payload.dueLabel || null, payload.dueDate || null, payload.projectId, payload.assigneeIds, JSON.stringify(payload.customFields || [])]
      );
      const task = taskRow(result.rows[0]);
      await addActivity(task.id, "task.created", actor, { title: task.title });
      return task;
    },
    async updateTask(taskId, payload, actor = "Admin") {
      await ready();
      const before = await loadTask(taskId);
      if (!before) return null;
      const result = await pool.query(
        "UPDATE playground_tasks SET title = $2, description = $3, status = $4, category = $5, priority = $6, due_label = $7, due_date = $8, project_id = $9, assignee_ids = $10, custom_fields = $11::jsonb, completed_at = CASE WHEN $4 = 'done' THEN COALESCE(completed_at, NOW()) ELSE NULL END, updated_at = NOW() WHERE id = $1 RETURNING *",
        [taskId, payload.title, payload.description || null, payload.status, payload.category || null, payload.priority, payload.dueLabel || null, payload.dueDate || null, payload.projectId, payload.assigneeIds, JSON.stringify(payload.customFields || [])]
      );
      const after = taskRow(result.rows[0]);
      const changes = changedFields(before.task, after);
      await addActivity(taskId, "task.updated", actor, { changes });
      return after;
    },
    async createTaskUpdate(taskId, payload, actor = "Admin") {
      await ready();
      const existing = await loadTask(taskId);
      if (!existing) return null;
      const result = await pool.query("INSERT INTO playground_task_updates (id, task_id, body, created_by) VALUES ($1, $2, $3, $4) RETURNING *", [options.makeId(), taskId, payload.body, actor]);
      await addActivity(taskId, "task.update.created", actor, { body: payload.body.slice(0, 180) });
      return taskUpdateRow(result.rows[0]);
    },
    async createProject(payload) {
      await ready();
      const result = await pool.query(
        "INSERT INTO playground_projects (id, title, description, status, progress, task_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [options.makeId(), payload.title, payload.description || null, payload.status, payload.progress, payload.taskCount]
      );
      return projectRow(result.rows[0]);
    },
    async createNote(payload) {
      await ready();
      const result = await pool.query("INSERT INTO playground_notes (id, content, label) VALUES ($1, $2, $3) RETURNING *", [options.makeId(), payload.content, payload.label]);
      return noteRow(result.rows[0]);
    }
  };
}

function createMemoryStore(options) {
  const currentTime = options.now || (() => new Date().toISOString());
  const projects = seedProjects.map((project) => ({ ...project, createdAt: currentTime(), updatedAt: currentTime() }));
  const tasks = seedTasks.map((task) => ({ ...task, completedAt: task.status === "done" ? currentTime() : null, createdAt: currentTime(), updatedAt: currentTime() }));
  const notes = seedNotes.map((note) => ({ ...note, createdAt: currentTime(), updatedAt: currentTime() }));
  const updates = [];
  const activity = [];
  const byDate = (a, b) => b.updatedAt.localeCompare(a.updatedAt);
  const projectTitle = (projectId) => projects.find((project) => project.id === projectId)?.title || "";
  const taskWithProject = (task) => taskRow({ ...task, projectTitle: projectTitle(task.projectId) });
  const addActivity = (taskId, action, actor, details = {}) => {
    activity.push({ id: options.makeId(), taskId, action, actor: actor || "Admin", details, createdAt: currentTime() });
  };
  return {
    mode: "memory",
    async listAll(filters = {}) {
      const renderedTasks = tasks.map(taskWithProject);
      const page = pagedTasks(renderedTasks, filters);
      const renderedProjects = projects.slice().sort(byDate).map(projectRow);
      return { metrics: metrics(renderedTasks, renderedProjects), tasks: page.items, taskPage: page.pageInfo, projects: renderedProjects, notes: notes.slice().sort(byDate).map(noteRow), storageMode: "memory" };
    },
    async getTask(taskId) {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return null;
      return {
        task: taskWithProject(task),
        updates: updates.filter((item) => item.taskId === taskId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(taskUpdateRow),
        activity: activity.filter((item) => item.taskId === taskId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(taskActivityRow)
      };
    },
    async createTask(payload, actor = "Admin") {
      const task = { id: options.makeId(), ...payload, completedAt: payload.status === "done" ? currentTime() : null, createdAt: currentTime(), updatedAt: currentTime() };
      tasks.push(task);
      addActivity(task.id, "task.created", actor, { title: task.title });
      return taskWithProject(task);
    },
    async updateTask(taskId, payload, actor = "Admin") {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return null;
      const before = taskWithProject(task);
      Object.assign(task, payload, { completedAt: payload.status === "done" ? task.completedAt || currentTime() : null, updatedAt: currentTime() });
      const after = taskWithProject(task);
      addActivity(taskId, "task.updated", actor, { changes: changedFields(before, after) });
      return after;
    },
    async createTaskUpdate(taskId, payload, actor = "Admin") {
      if (!tasks.some((task) => task.id === taskId)) return null;
      const update = { id: options.makeId(), taskId, body: payload.body, createdBy: actor || "Admin", createdAt: currentTime() };
      updates.push(update);
      addActivity(taskId, "task.update.created", actor, { body: payload.body.slice(0, 180) });
      return taskUpdateRow(update);
    },
    async createProject(payload) {
      const project = { id: options.makeId(), ...payload, createdAt: currentTime(), updatedAt: currentTime() };
      projects.push(project);
      return projectRow(project);
    },
    async createNote(payload) {
      const note = { id: options.makeId(), ...payload, createdAt: currentTime(), updatedAt: currentTime() };
      notes.push(note);
      return noteRow(note);
    }
  };
}

function createPlaygroundStore(options = {}) {
  if (options.databaseUrl) return createPostgresStore(options);
  return createMemoryStore(options);
}

function attachPlaygroundRoutes(app, options = {}) {
  const requireAdmin = options.requireAdmin;
  if (typeof requireAdmin !== "function") throw new Error("attachPlaygroundRoutes requires requireAdmin middleware.");
  const store = createPlaygroundStore(options);

  function sendError(res, error, fallback) {
    res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
  }

  async function actorLabel(req) {
    const sessionToken = req.get("x-session-token");
    if (!sessionToken || !options.userStore?.getSessionUser) return "Admin";
    const session = await options.userStore.getSessionUser(sessionToken).catch(() => null);
    return session?.user?.name || session?.user?.email || "Admin";
  }

  async function userOptions() {
    if (!options.userStore?.listUsers) return [];
    const users = await options.userStore.listUsers().catch(() => []);
    return users
      .filter((user) => user.status === "active")
      .map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role || "viewer" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  app.get("/api/admin/playground", requireAdmin, async (req, res) => {
    try {
      const data = await store.listAll(req.query || {});
      res.json({ ...data, users: await userOptions() });
    } catch (error) { sendError(res, error, "Could not load Playground records."); }
  });

  app.get("/api/admin/playground/tasks/:taskId", requireAdmin, async (req, res) => {
    try {
      const detail = await store.getTask(req.params.taskId);
      detail ? res.json({ ...detail, users: await userOptions() }) : res.status(404).json({ error: "Task not found." });
    } catch (error) { sendError(res, error, "Could not load Playground task."); }
  });

  app.post("/api/admin/playground/tasks", requireAdmin, async (req, res) => {
    try { res.status(201).json({ task: await store.createTask(taskPayload(req.body || {}), await actorLabel(req)) }); }
    catch (error) { sendError(res, error, "Could not create Playground task."); }
  });

  app.patch("/api/admin/playground/tasks/:taskId", requireAdmin, async (req, res) => {
    try {
      const task = await store.updateTask(req.params.taskId, taskPayload(req.body || {}), await actorLabel(req));
      task ? res.json({ task }) : res.status(404).json({ error: "Task not found." });
    } catch (error) { sendError(res, error, "Could not update Playground task."); }
  });

  app.post("/api/admin/playground/tasks/:taskId/updates", requireAdmin, async (req, res) => {
    try {
      const update = await store.createTaskUpdate(req.params.taskId, updatePayload(req.body || {}), await actorLabel(req));
      update ? res.status(201).json({ update }) : res.status(404).json({ error: "Task not found." });
    } catch (error) { sendError(res, error, "Could not create Playground task update."); }
  });

  app.post("/api/admin/playground/projects", requireAdmin, async (req, res) => {
    try { res.status(201).json({ project: await store.createProject(projectPayload(req.body || {})) }); }
    catch (error) { sendError(res, error, "Could not create Playground project."); }
  });

  app.post("/api/admin/playground/notes", requireAdmin, async (req, res) => {
    try { res.status(201).json({ note: await store.createNote(notePayload(req.body || {})) }); }
    catch (error) { sendError(res, error, "Could not create Playground note."); }
  });

  app.locals.playgroundAttached = true;
  return store;
}

module.exports = { attachPlaygroundRoutes, createPlaygroundStore };
