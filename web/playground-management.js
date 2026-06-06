const { Pool } = require("pg");

const taskStatuses = new Set(["backlog", "todo", "in_progress", "review", "done"]);
const priorities = new Set(["low", "medium", "high"]);
const projectStatuses = new Set(["planning", "active", "in_progress", "review", "completed", "archived"]);

const seedTasks = [
  { id: "00000000-0000-4000-9000-000000000101", title: "Update project notes", description: "Collect ideas and organize next sprint planning notes.", status: "backlog", category: "Planning", priority: "low", dueLabel: "No due date", dueDate: null },
  { id: "00000000-0000-4000-9000-000000000102", title: "Create task filtering UI", description: "Add filters for priority, project, and completion status.", status: "todo", category: "Tasks", priority: "medium", dueLabel: "Jun 14", dueDate: "2026-06-14" },
  { id: "00000000-0000-4000-9000-000000000103", title: "Build project detail view", description: "Create a focused view for project milestones, tasks, and activity.", status: "todo", category: "Projects", priority: "high", dueLabel: "Jun 18", dueDate: "2026-06-18" },
  { id: "00000000-0000-4000-9000-000000000104", title: "Design dashboard layout", description: "Refine the workspace layout and responsive card structure.", status: "in_progress", category: "UI", priority: "high", dueLabel: "Jun 10", dueDate: "2026-06-10" },
  { id: "00000000-0000-4000-9000-000000000105", title: "Review kanban interactions", description: "Check drag states, empty states, keyboard navigation, and mobile layout.", status: "review", category: "QA", priority: "medium", dueLabel: "Jun 16", dueDate: "2026-06-16" },
  { id: "00000000-0000-4000-9000-000000000106", title: "Prepare release checklist", description: "Document final tasks needed before the workspace release.", status: "done", category: "Release", priority: "low", dueLabel: "Completed", dueDate: null }
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

function taskPayload(body = {}) {
  const title = cleanString(body.title, 140);
  if (!title) throw appError(400, "Task title is required.");
  return {
    title,
    description: cleanString(body.description, 700),
    status: cleanStatus(body.status, taskStatuses, "todo"),
    category: cleanString(body.category, 80) || "Tasks",
    priority: cleanPriority(body.priority),
    dueLabel: cleanString(body.dueLabel || body.due_label, 80),
    dueDate: cleanString(body.dueDate || body.due_date, 20) || null
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

function taskRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    status: row.status,
    category: row.category || "Tasks",
    priority: row.priority || "medium",
    dueLabel: row.due_label || row.dueLabel || "",
    dueDate: row.due_date || row.dueDate || null,
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
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
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
  };
}

function noteRow(row) {
  return {
    id: row.id,
    content: row.content,
    label: row.label || "Note",
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
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

function createPostgresStore(options) {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    ssl: options.databaseSsl === "true" ? { rejectUnauthorized: false } : undefined
  });
  let initialized;
  const ready = () => (initialized ||= pool.query(`
    CREATE TABLE IF NOT EXISTS playground_tasks (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
      category TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      due_label TEXT,
      due_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS playground_tasks_status_updated_idx ON playground_tasks(status, updated_at DESC);
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
    CREATE TABLE IF NOT EXISTS playground_notes (
      id UUID PRIMARY KEY,
      content TEXT NOT NULL,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `).then(() => seedPostgres()));

  async function seedPostgres() {
    for (const task of seedTasks) {
      await pool.query(
        "INSERT INTO playground_tasks (id, title, description, status, category, priority, due_label, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING",
        [task.id, task.title, task.description, task.status, task.category, task.priority, task.dueLabel, task.dueDate]
      );
    }
    for (const project of seedProjects) {
      await pool.query(
        "INSERT INTO playground_projects (id, title, description, status, progress, task_count) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
        [project.id, project.title, project.description, project.status, project.progress, project.taskCount]
      );
    }
    for (const note of seedNotes) {
      await pool.query(
        "INSERT INTO playground_notes (id, content, label) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        [note.id, note.content, note.label]
      );
    }
  }

  return {
    mode: "postgres",
    async listAll() {
      await ready();
      const [taskResult, projectResult, noteResult] = await Promise.all([
        pool.query("SELECT * FROM playground_tasks ORDER BY CASE status WHEN 'backlog' THEN 1 WHEN 'todo' THEN 2 WHEN 'in_progress' THEN 3 WHEN 'review' THEN 4 ELSE 5 END, created_at ASC"),
        pool.query("SELECT * FROM playground_projects ORDER BY updated_at DESC LIMIT 200"),
        pool.query("SELECT * FROM playground_notes ORDER BY updated_at DESC LIMIT 100")
      ]);
      const tasks = taskResult.rows.map(taskRow);
      const projects = projectResult.rows.map(projectRow);
      return { metrics: metrics(tasks, projects), tasks, projects, notes: noteResult.rows.map(noteRow), storageMode: "postgres" };
    },
    async createTask(payload) {
      await ready();
      const result = await pool.query(
        "INSERT INTO playground_tasks (id, title, description, status, category, priority, due_label, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [options.makeId(), payload.title, payload.description || null, payload.status, payload.category || null, payload.priority, payload.dueLabel || null, payload.dueDate || null]
      );
      return taskRow(result.rows[0]);
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
  const tasks = seedTasks.map((task) => ({ ...task, createdAt: currentTime(), updatedAt: currentTime() }));
  const projects = seedProjects.map((project) => ({ ...project, createdAt: currentTime(), updatedAt: currentTime() }));
  const notes = seedNotes.map((note) => ({ ...note, createdAt: currentTime(), updatedAt: currentTime() }));
  const byDate = (a, b) => b.updatedAt.localeCompare(a.updatedAt);
  return {
    mode: "memory",
    async listAll() {
      const renderedTasks = tasks.map(taskRow);
      const renderedProjects = projects.slice().sort(byDate).map(projectRow);
      return { metrics: metrics(renderedTasks, renderedProjects), tasks: renderedTasks, projects: renderedProjects, notes: notes.slice().sort(byDate).map(noteRow), storageMode: "memory" };
    },
    async createTask(payload) {
      const task = { id: options.makeId(), ...payload, createdAt: currentTime(), updatedAt: currentTime() };
      tasks.push(task);
      return taskRow(task);
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

  app.get("/api/admin/playground", requireAdmin, async (req, res) => {
    try { res.json(await store.listAll()); }
    catch (error) { sendError(res, error, "Could not load Playground records."); }
  });

  app.post("/api/admin/playground/tasks", requireAdmin, async (req, res) => {
    try { res.status(201).json({ task: await store.createTask(taskPayload(req.body || {})) }); }
    catch (error) { sendError(res, error, "Could not create Playground task."); }
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
