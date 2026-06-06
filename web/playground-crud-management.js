const { Pool } = require("pg");

const RESOURCE_NAMES = ["boards", "projects", "tasks", "notes", "automations"];
const TASK_STATUSES = new Set(["backlog", "todo", "in_progress", "review", "done"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const PROJECT_STATUSES = new Set(["planning", "active", "in_progress", "review", "completed", "archived"]);
const AUTOMATION_STATUSES = new Set(["draft", "manual", "active", "paused", "archived"]);
const AUTOMATION_ACTIONS = new Set(["suggest", "move_task", "assign_owner", "create_note", "notify_admin"]);

const seedBoards = [
  { id: "00000000-0000-4000-9000-000000000401", title: "Main Board", description: "Default Playground work board.", status: "active", sortOrder: 1 },
  { id: "00000000-0000-4000-9000-000000000402", title: "Sprint Planning", description: "Planning board for upcoming work.", status: "active", sortOrder: 2 }
];
const seedProjects = [
  { id: "00000000-0000-4000-9000-000000000201", boardId: seedBoards[0].id, title: "Website Redesign", description: "Refresh core pages, navigation, and dashboard experience.", status: "in_progress", progress: 72, taskCount: 12 },
  { id: "00000000-0000-4000-9000-000000000202", boardId: seedBoards[0].id, title: "Client Portal", description: "Build a cleaner workspace for client-facing project updates.", status: "active", progress: 45, taskCount: 9 },
  { id: "00000000-0000-4000-9000-000000000203", boardId: seedBoards[1].id, title: "Internal Tools", description: "Improve admin workflows and team productivity utilities.", status: "review", progress: 88, taskCount: 7 },
  { id: "00000000-0000-4000-9000-000000000204", boardId: seedBoards[1].id, title: "Marketing Launch", description: "Coordinate launch assets, approvals, and publishing schedule.", status: "planning", progress: 30, taskCount: 14 }
];
const seedTasks = [
  { id: "00000000-0000-4000-9000-000000000101", boardId: seedBoards[1].id, projectId: seedProjects[3].id, title: "Update project notes", description: "Collect ideas and organize next sprint planning notes.", status: "backlog", category: "Planning", priority: "low", dueLabel: "No due date", dueDate: null, assigneeIds: [], customFields: [] },
  { id: "00000000-0000-4000-9000-000000000102", boardId: seedBoards[0].id, projectId: seedProjects[0].id, title: "Create task filtering UI", description: "Add filters for priority, project, and completion status.", status: "todo", category: "Tasks", priority: "medium", dueLabel: "Jun 14", dueDate: "2026-06-14", assigneeIds: [], customFields: [{ id: "field-1", type: "text", name: "Module", value: "Tasks" }] },
  { id: "00000000-0000-4000-9000-000000000103", boardId: seedBoards[0].id, projectId: seedProjects[1].id, title: "Build project detail view", description: "Create a focused view for project milestones, tasks, and activity.", status: "todo", category: "Projects", priority: "high", dueLabel: "Jun 18", dueDate: "2026-06-18", assigneeIds: [], customFields: [{ id: "field-1", type: "text", name: "View", value: "Detail" }] },
  { id: "00000000-0000-4000-9000-000000000104", boardId: seedBoards[0].id, projectId: seedProjects[0].id, title: "Design dashboard layout", description: "Refine the workspace layout and responsive card structure.", status: "in_progress", category: "UI", priority: "high", dueLabel: "Jun 10", dueDate: "2026-06-10", assigneeIds: [], customFields: [] },
  { id: "00000000-0000-4000-9000-000000000105", boardId: seedBoards[1].id, projectId: seedProjects[2].id, title: "Review kanban interactions", description: "Check drag states, empty states, keyboard navigation, and mobile layout.", status: "review", category: "QA", priority: "medium", dueLabel: "Jun 16", dueDate: "2026-06-16", assigneeIds: [], customFields: [{ id: "field-1", type: "text", name: "Check", value: "Keyboard" }] },
  { id: "00000000-0000-4000-9000-000000000106", boardId: seedBoards[1].id, projectId: seedProjects[2].id, title: "Prepare release checklist", description: "Document final tasks needed before the workspace release.", status: "done", category: "Release", priority: "low", dueLabel: "Completed", dueDate: null, assigneeIds: [], customFields: [] }
];
const seedNotes = [
  { id: "00000000-0000-4000-9000-000000000301", boardId: seedBoards[1].id, projectId: seedProjects[3].id, content: "Sprint planning notes are ready for review.", label: "Ready", status: "active" },
  { id: "00000000-0000-4000-9000-000000000302", boardId: seedBoards[0].id, projectId: seedProjects[0].id, content: "Kanban layout needs mobile testing.", label: "Layout", status: "active" },
  { id: "00000000-0000-4000-9000-000000000303", boardId: seedBoards[0].id, projectId: seedProjects[1].id, content: "Project cards are now backed by Playground storage.", label: "Stored", status: "active" }
];
const seedAutomations = [
  { id: "00000000-0000-4000-9000-000000000501", boardId: seedBoards[0].id, title: "Move overdue tasks to Review", description: "Flag high-priority tasks whose due date has passed.", trigger: "Due date passes", action: "suggest", status: "draft" },
  { id: "00000000-0000-4000-9000-000000000502", boardId: seedBoards[1].id, title: "Assign unowned tasks", description: "Surface tasks without assignees for owner assignment.", trigger: "Task has no assignee", action: "assign_owner", status: "manual" }
];

function appError(status, message) { const error = new Error(message); error.status = status; return error; }
function cleanString(value, maxLength = 160) { return typeof value === "number" || typeof value === "boolean" ? String(value).trim().slice(0, maxLength) : typeof value === "string" ? value.trim().slice(0, maxLength) : ""; }
function cleanId(value) { return cleanString(value, 80) || null; }
function cleanStatus(value, allowed, fallback) { const status = cleanString(value, 40) || fallback; if (!allowed.has(status)) throw appError(400, "Unsupported status value."); return status; }
function cleanInt(value, fallback = 0, min = 0, max = 100) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback; }
function cleanArray(value) { return Array.isArray(value) ? [...new Set(value.map((item) => cleanString(item, 80)).filter(Boolean))].slice(0, 20) : []; }
function cleanJsonArray(value) { return Array.isArray(value) ? value.slice(0, 20) : []; }
function timestamp(value) { return new Date(value || Date.now()).toISOString(); }
function dateOnly(value) { return value ? (typeof value === "string" ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10)) : null; }
function isArchived(record) { return (record.recordStatus || record.status) === "archived"; }
function byUpdated(a, b) { return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); }
function validResource(resource) { if (!RESOURCE_NAMES.includes(resource)) throw appError(404, "Unknown Playground resource."); return resource; }

function boardPayload(body = {}) {
  const title = cleanString(body.title || body.name, 140);
  if (!title) throw appError(400, "Board title is required.");
  return { title, description: cleanString(body.description, 700), status: cleanStatus(body.status || body.recordStatus, new Set(["active", "archived"]), "active"), sortOrder: cleanInt(body.sortOrder || body.sort_order, 0, 0, 9999) };
}
function projectPayload(body = {}) {
  const title = cleanString(body.title, 140);
  if (!title) throw appError(400, "Project title is required.");
  return { boardId: cleanId(body.boardId || body.board_id), title, description: cleanString(body.description, 700), status: cleanStatus(body.status, PROJECT_STATUSES, "planning"), progress: cleanInt(body.progress, 0), taskCount: cleanInt(body.taskCount || body.task_count, 0, 0, 999) };
}
function taskPayload(body = {}) {
  const title = cleanString(body.title, 140);
  if (!title) throw appError(400, "Task title is required.");
  const dueDate = cleanString(body.dueDate || body.due_date, 20) || null;
  const priority = cleanString(body.priority, 20).toLowerCase() || "medium";
  if (!PRIORITIES.has(priority)) throw appError(400, "Priority must be low, medium, or high.");
  return { boardId: cleanId(body.boardId || body.board_id), projectId: cleanId(body.projectId || body.project_id), title, description: cleanString(body.description, 1200), status: cleanStatus(body.status, TASK_STATUSES, "todo"), recordStatus: cleanStatus(body.recordStatus || body.record_status, new Set(["active", "archived"]), "active"), category: cleanString(body.category, 80) || "Tasks", priority, dueLabel: cleanString(body.dueLabel || body.due_label, 80) || (dueDate || "No due date"), dueDate, assigneeIds: cleanArray(body.assigneeIds || body.assignee_ids), customFields: cleanJsonArray(body.customFields || body.custom_fields) };
}
function notePayload(body = {}) {
  const content = cleanString(body.content, 1000);
  if (!content) throw appError(400, "Note content is required.");
  return { boardId: cleanId(body.boardId || body.board_id), projectId: cleanId(body.projectId || body.project_id), content, label: cleanString(body.label, 80) || "Note", status: cleanStatus(body.status || body.recordStatus, new Set(["active", "archived"]), "active") };
}
function automationPayload(body = {}) {
  const title = cleanString(body.title, 140);
  if (!title) throw appError(400, "Automation title is required.");
  return { boardId: cleanId(body.boardId || body.board_id), title, description: cleanString(body.description, 800), trigger: cleanString(body.trigger, 180) || "Manual review", action: cleanStatus(body.action, AUTOMATION_ACTIONS, "suggest"), status: cleanStatus(body.status, AUTOMATION_STATUSES, "draft") };
}
function payloadFor(resource, body) {
  return ({ boards: boardPayload, projects: projectPayload, tasks: taskPayload, notes: notePayload, automations: automationPayload })[validResource(resource)](body);
}

function boardRow(row) { return { id: row.id, title: row.title, description: row.description || "", status: row.status || "active", sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0), createdAt: timestamp(row.created_at || row.createdAt), updatedAt: timestamp(row.updated_at || row.updatedAt) }; }
function projectRow(row) { return { id: row.id, boardId: row.board_id || row.boardId || "", boardTitle: row.board_title || row.boardTitle || "", title: row.title, description: row.description || "", status: row.status || "planning", progress: Number(row.progress || 0), taskCount: Number(row.task_count ?? row.taskCount ?? 0), createdAt: timestamp(row.created_at || row.createdAt), updatedAt: timestamp(row.updated_at || row.updatedAt) }; }
function taskRow(row) { return { id: row.id, boardId: row.board_id || row.boardId || "", boardTitle: row.board_title || row.boardTitle || "", projectId: row.project_id || row.projectId || "", projectTitle: row.project_title || row.projectTitle || "", title: row.title, description: row.description || "", status: row.status || "todo", statusKey: row.status || "todo", recordStatus: row.record_status || row.recordStatus || "active", category: row.category || "Tasks", priority: row.priority || "medium", dueLabel: row.due_label || row.dueLabel || "", dueDate: dateOnly(row.due_date || row.dueDate), assigneeIds: row.assignee_ids || row.assigneeIds || [], customFields: row.custom_fields || row.customFields || [], completedAt: row.completed_at || row.completedAt ? timestamp(row.completed_at || row.completedAt) : null, createdAt: timestamp(row.created_at || row.createdAt), updatedAt: timestamp(row.updated_at || row.updatedAt) }; }
function noteRow(row) { return { id: row.id, boardId: row.board_id || row.boardId || "", boardTitle: row.board_title || row.boardTitle || "", projectId: row.project_id || row.projectId || "", projectTitle: row.project_title || row.projectTitle || "", content: row.content, label: row.label || "Note", status: row.status || "active", createdAt: timestamp(row.created_at || row.createdAt), updatedAt: timestamp(row.updated_at || row.updatedAt) }; }
function automationRow(row) { return { id: row.id, boardId: row.board_id || row.boardId || "", boardTitle: row.board_title || row.boardTitle || "", title: row.title, description: row.description || "", trigger: row.trigger || "Manual review", action: row.action || "suggest", status: row.status || "draft", createdAt: timestamp(row.created_at || row.createdAt), updatedAt: timestamp(row.updated_at || row.updatedAt) }; }
function updateRow(row) { return { id: row.id, taskId: row.task_id || row.taskId, body: row.body, createdBy: row.created_by || row.createdBy || "Admin", createdAt: timestamp(row.created_at || row.createdAt) }; }
function activityRow(row) { return { id: row.id, taskId: row.task_id || row.taskId, action: row.action, actor: row.actor || "Admin", details: row.details || {}, createdAt: timestamp(row.created_at || row.createdAt) }; }
function metrics(data) { return { boards: data.boards.filter((item) => !isArchived(item)).length, projects: data.projects.filter((item) => !isArchived(item)).length, tasks: data.tasks.filter((item) => !isArchived(item)).length, notes: data.notes.filter((item) => !isArchived(item)).length, automations: data.automations.filter((item) => !isArchived(item)).length, totalTasks: data.tasks.length, activeProjects: data.projects.filter((project) => !["completed", "archived"].includes(project.status)).length, inProgress: data.tasks.filter((task) => task.status === "in_progress" && !isArchived(task)).length, completed: data.tasks.filter((task) => task.status === "done" && !isArchived(task)).length }; }

function createMemoryStore(options) {
  const now = options.now || (() => new Date().toISOString());
  const stamp = (record) => ({ ...record, createdAt: now(), updatedAt: now() });
  const boards = seedBoards.map(stamp), projects = seedProjects.map(stamp), tasks = seedTasks.map((task) => ({ ...stamp(task), recordStatus: "active", completedAt: task.status === "done" ? now() : null }));
  const notes = seedNotes.map(stamp), automations = seedAutomations.map(stamp), updates = [], activity = [];
  const projectTitle = (id) => projects.find((item) => item.id === id)?.title || "";
  const boardTitle = (id) => boards.find((item) => item.id === id)?.title || "";
  const decorate = (resource, record) => ({ ...record, boardTitle: boardTitle(record.boardId), projectTitle: projectTitle(record.projectId) });
  const collections = { boards, projects, tasks, notes, automations };
  const rows = { boards: boardRow, projects: projectRow, tasks: taskRow, notes: noteRow, automations: automationRow };
  const list = (resource, includeArchived) => collections[resource].filter((item) => includeArchived || !isArchived(item)).map((item) => rows[resource](decorate(resource, item))).sort(byUpdated);
  const writeActivity = (taskId, action, actor, details = {}) => activity.push({ id: options.makeId(), taskId, action, actor: actor || "Admin", details, createdAt: now() });
  return {
    mode: "memory",
    async listAll(filters = {}) { const includeArchived = String(filters.includeArchived || filters.archived || "") === "true"; const data = Object.fromEntries(RESOURCE_NAMES.map((name) => [name, list(name, includeArchived)])); return { ...data, metrics: metrics(data), taskPage: { cursor: "0", nextCursor: null, limit: data.tasks.length, total: data.tasks.length }, storageMode: "memory" }; },
    async getTask(id) { const task = tasks.find((item) => item.id === id); return task ? { task: taskRow(decorate("tasks", task)), updates: updates.filter((item) => item.taskId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(updateRow), activity: activity.filter((item) => item.taskId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(activityRow) } : null; },
    async create(resource, body, actor = "Admin") { const payload = payloadFor(resource, body); const record = { id: options.makeId(), ...payload, createdAt: now(), updatedAt: now() }; if (resource === "tasks") record.completedAt = record.status === "done" ? now() : null; collections[resource].push(record); if (resource === "tasks") writeActivity(record.id, "task.created", actor, { title: record.title }); return rows[resource](decorate(resource, record)); },
    async update(resource, id, body, actor = "Admin") { const record = collections[resource].find((item) => item.id === id); if (!record) return null; const payload = payloadFor(resource, body); Object.assign(record, payload, { updatedAt: now() }); if (resource === "tasks") { record.completedAt = record.status === "done" ? record.completedAt || now() : null; writeActivity(id, "task.updated", actor, { title: record.title }); } return rows[resource](decorate(resource, record)); },
    async setStatus(resource, id, status, actor = "Admin") { const record = collections[resource].find((item) => item.id === id); if (!record) return null; if (resource === "tasks") record.recordStatus = status; else record.status = status === "archived" ? "archived" : resource === "automations" ? "draft" : "active"; record.updatedAt = now(); if (resource === "tasks") writeActivity(id, `task.${status}`, actor, {}); return rows[resource](decorate(resource, record)); },
    async createTaskUpdate(id, body, actor = "Admin") { if (!tasks.some((task) => task.id === id)) return null; const update = { id: options.makeId(), taskId: id, body: cleanString(body.body, 2000), createdBy: actor || "Admin", createdAt: now() }; if (!update.body) throw appError(400, "Update body is required."); updates.push(update); writeActivity(id, "task.update.created", actor, { body: update.body.slice(0, 180) }); return updateRow(update); }
  };
}

function createPostgresStore(options) {
  const pool = new Pool({ connectionString: options.databaseUrl, ssl: options.databaseSsl === "true" ? { rejectUnauthorized: false } : undefined });
  let initialized;
  async function ready() {
    initialized ||= pool.query(`
      CREATE TABLE IF NOT EXISTS playground_boards (id UUID PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'active', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS playground_projects (id UUID PRIMARY KEY, board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'planning', progress INTEGER NOT NULL DEFAULT 0, task_count INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS playground_tasks (id UUID PRIMARY KEY, board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL, project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'todo', record_status TEXT NOT NULL DEFAULT 'active', category TEXT, priority TEXT NOT NULL DEFAULT 'medium', due_label TEXT, due_date DATE, assignee_ids UUID[] NOT NULL DEFAULT '{}', custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS playground_notes (id UUID PRIMARY KEY, board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL, project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL, content TEXT NOT NULL, label TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS playground_automations (id UUID PRIMARY KEY, board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, trigger TEXT, action TEXT NOT NULL DEFAULT 'suggest', status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS playground_task_updates (id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES playground_tasks(id) ON DELETE CASCADE, body TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT 'Admin', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS playground_task_activity (id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES playground_tasks(id) ON DELETE CASCADE, action TEXT NOT NULL, actor TEXT NOT NULL DEFAULT 'Admin', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      ALTER TABLE playground_projects ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL;
      ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL;
      ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL;
      ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] NOT NULL DEFAULT '{}';
      ALTER TABLE playground_tasks ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE playground_notes ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL;
      ALTER TABLE playground_notes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL;
      ALTER TABLE playground_notes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      CREATE INDEX IF NOT EXISTS playground_boards_status_idx ON playground_boards(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS playground_projects_status_idx ON playground_projects(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS playground_tasks_status_idx ON playground_tasks(record_status, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS playground_notes_status_idx ON playground_notes(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS playground_automations_status_idx ON playground_automations(status, updated_at DESC);
    `).then(seed);
    return initialized;
  }
  async function seed() {
    for (const board of seedBoards) await pool.query("INSERT INTO playground_boards (id,title,description,status,sort_order) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [board.id, board.title, board.description, board.status, board.sortOrder]);
    for (const project of seedProjects) await pool.query("INSERT INTO playground_projects (id,board_id,title,description,status,progress,task_count) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING", [project.id, project.boardId, project.title, project.description, project.status, project.progress, project.taskCount]);
    for (const task of seedTasks) await pool.query("INSERT INTO playground_tasks (id,board_id,project_id,title,description,status,category,priority,due_label,due_date,assignee_ids,custom_fields,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,CASE WHEN $6='done' THEN NOW() ELSE NULL END) ON CONFLICT (id) DO NOTHING", [task.id, task.boardId, task.projectId, task.title, task.description, task.status, task.category, task.priority, task.dueLabel, task.dueDate, task.assigneeIds, JSON.stringify(task.customFields)]);
    for (const note of seedNotes) await pool.query("INSERT INTO playground_notes (id,board_id,project_id,content,label,status) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING", [note.id, note.boardId, note.projectId, note.content, note.label, note.status]);
    for (const automation of seedAutomations) await pool.query("INSERT INTO playground_automations (id,board_id,title,description,trigger,action,status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING", [automation.id, automation.boardId, automation.title, automation.description, automation.trigger, automation.action, automation.status]);
  }
  async function queryRows(resource, includeArchived) {
    await ready();
    const clauses = { boards: includeArchived ? "" : "WHERE b.status <> 'archived'", projects: includeArchived ? "" : "WHERE p.status <> 'archived'", tasks: includeArchived ? "" : "WHERE t.record_status <> 'archived'", notes: includeArchived ? "" : "WHERE n.status <> 'archived'", automations: includeArchived ? "" : "WHERE a.status <> 'archived'" };
    const sql = {
      boards: `SELECT b.* FROM playground_boards b ${clauses.boards} ORDER BY b.sort_order ASC, b.updated_at DESC`,
      projects: `SELECT p.*, b.title AS board_title FROM playground_projects p LEFT JOIN playground_boards b ON b.id=p.board_id ${clauses.projects} ORDER BY p.updated_at DESC`,
      tasks: `SELECT t.*, b.title AS board_title, p.title AS project_title FROM playground_tasks t LEFT JOIN playground_boards b ON b.id=t.board_id LEFT JOIN playground_projects p ON p.id=t.project_id ${clauses.tasks} ORDER BY t.updated_at DESC`,
      notes: `SELECT n.*, b.title AS board_title, p.title AS project_title FROM playground_notes n LEFT JOIN playground_boards b ON b.id=n.board_id LEFT JOIN playground_projects p ON p.id=n.project_id ${clauses.notes} ORDER BY n.updated_at DESC`,
      automations: `SELECT a.*, b.title AS board_title FROM playground_automations a LEFT JOIN playground_boards b ON b.id=a.board_id ${clauses.automations} ORDER BY a.updated_at DESC`
    }[resource];
    return pool.query(sql).then((result) => result.rows);
  }
  async function addActivity(taskId, action, actor, details = {}) { await pool.query("INSERT INTO playground_task_activity (id,task_id,action,actor,details) VALUES ($1,$2,$3,$4,$5)", [options.makeId(), taskId, action, actor || "Admin", details]); }
  const rowFns = { boards: boardRow, projects: projectRow, tasks: taskRow, notes: noteRow, automations: automationRow };
  return {
    mode: "postgres",
    async listAll(filters = {}) { const includeArchived = String(filters.includeArchived || filters.archived || "") === "true"; const entries = await Promise.all(RESOURCE_NAMES.map(async (name) => [name, (await queryRows(name, includeArchived)).map(rowFns[name])])); const data = Object.fromEntries(entries); return { ...data, metrics: metrics(data), taskPage: { cursor: "0", nextCursor: null, limit: data.tasks.length, total: data.tasks.length }, storageMode: "postgres" }; },
    async getTask(id) { await ready(); const task = await pool.query("SELECT t.*, b.title AS board_title, p.title AS project_title FROM playground_tasks t LEFT JOIN playground_boards b ON b.id=t.board_id LEFT JOIN playground_projects p ON p.id=t.project_id WHERE t.id=$1", [id]); if (!task.rows[0]) return null; const [updates, activity] = await Promise.all([pool.query("SELECT * FROM playground_task_updates WHERE task_id=$1 ORDER BY created_at DESC LIMIT 100", [id]), pool.query("SELECT * FROM playground_task_activity WHERE task_id=$1 ORDER BY created_at DESC LIMIT 100", [id])]); return { task: taskRow(task.rows[0]), updates: updates.rows.map(updateRow), activity: activity.rows.map(activityRow) }; },
    async create(resource, body, actor = "Admin") { await ready(); const payload = payloadFor(resource, body); const id = options.makeId(); const queries = { boards: ["INSERT INTO playground_boards (id,title,description,status,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *", [id,payload.title,payload.description,payload.status,payload.sortOrder]], projects: ["INSERT INTO playground_projects (id,board_id,title,description,status,progress,task_count) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [id,payload.boardId,payload.title,payload.description,payload.status,payload.progress,payload.taskCount]], tasks: ["INSERT INTO playground_tasks (id,board_id,project_id,title,description,status,record_status,category,priority,due_label,due_date,assignee_ids,custom_fields,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,CASE WHEN $6='done' THEN NOW() ELSE NULL END) RETURNING *", [id,payload.boardId,payload.projectId,payload.title,payload.description,payload.status,payload.recordStatus,payload.category,payload.priority,payload.dueLabel,payload.dueDate,payload.assigneeIds,JSON.stringify(payload.customFields)]], notes: ["INSERT INTO playground_notes (id,board_id,project_id,content,label,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [id,payload.boardId,payload.projectId,payload.content,payload.label,payload.status]], automations: ["INSERT INTO playground_automations (id,board_id,title,description,trigger,action,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [id,payload.boardId,payload.title,payload.description,payload.trigger,payload.action,payload.status]] }[resource]; const result = await pool.query(...queries); if (resource === "tasks") await addActivity(id, "task.created", actor, { title: payload.title }); return (await this.listAll({ includeArchived: true }))[resource].find((item) => item.id === result.rows[0].id); },
    async update(resource, id, body, actor = "Admin") { await ready(); const payload = payloadFor(resource, body); const queries = { boards: ["UPDATE playground_boards SET title=$2,description=$3,status=$4,sort_order=$5,updated_at=NOW() WHERE id=$1 RETURNING *", [id,payload.title,payload.description,payload.status,payload.sortOrder]], projects: ["UPDATE playground_projects SET board_id=$2,title=$3,description=$4,status=$5,progress=$6,task_count=$7,updated_at=NOW() WHERE id=$1 RETURNING *", [id,payload.boardId,payload.title,payload.description,payload.status,payload.progress,payload.taskCount]], tasks: ["UPDATE playground_tasks SET board_id=$2,project_id=$3,title=$4,description=$5,status=$6,record_status=$7,category=$8,priority=$9,due_label=$10,due_date=$11,assignee_ids=$12,custom_fields=$13::jsonb,completed_at=CASE WHEN $6='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$1 RETURNING *", [id,payload.boardId,payload.projectId,payload.title,payload.description,payload.status,payload.recordStatus,payload.category,payload.priority,payload.dueLabel,payload.dueDate,payload.assigneeIds,JSON.stringify(payload.customFields)]], notes: ["UPDATE playground_notes SET board_id=$2,project_id=$3,content=$4,label=$5,status=$6,updated_at=NOW() WHERE id=$1 RETURNING *", [id,payload.boardId,payload.projectId,payload.content,payload.label,payload.status]], automations: ["UPDATE playground_automations SET board_id=$2,title=$3,description=$4,trigger=$5,action=$6,status=$7,updated_at=NOW() WHERE id=$1 RETURNING *", [id,payload.boardId,payload.title,payload.description,payload.trigger,payload.action,payload.status]] }[resource]; const result = await pool.query(...queries); if (!result.rows[0]) return null; if (resource === "tasks") await addActivity(id, "task.updated", actor, { title: payload.title }); return (await this.listAll({ includeArchived: true }))[resource].find((item) => item.id === id); },
    async setStatus(resource, id, status, actor = "Admin") { await ready(); const update = resource === "tasks" ? ["UPDATE playground_tasks SET record_status=$2,updated_at=NOW() WHERE id=$1 RETURNING *", [id,status]] : resource === "automations" ? ["UPDATE playground_automations SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *", [id,status === "archived" ? "archived" : "draft"]] : ["UPDATE playground_" + resource + " SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *", [id,status === "archived" ? "archived" : "active"]]; const result = await pool.query(...update); if (!result.rows[0]) return null; if (resource === "tasks") await addActivity(id, `task.${status}`, actor, {}); return (await this.listAll({ includeArchived: true }))[resource].find((item) => item.id === id); },
    async createTaskUpdate(id, body, actor = "Admin") { await ready(); const text = cleanString(body.body, 2000); if (!text) throw appError(400, "Update body is required."); const existing = await this.getTask(id); if (!existing) return null; const result = await pool.query("INSERT INTO playground_task_updates (id,task_id,body,created_by) VALUES ($1,$2,$3,$4) RETURNING *", [options.makeId(), id, text, actor]); await addActivity(id, "task.update.created", actor, { body: text.slice(0, 180) }); return updateRow(result.rows[0]); }
  };
}

function createPlaygroundCrudStore(options = {}) { return options.databaseUrl ? createPostgresStore(options) : createMemoryStore(options); }

function attachPlaygroundRoutes(app, options = {}) {
  const requireAdmin = options.requireAdmin;
  if (typeof requireAdmin !== "function") throw new Error("attachPlaygroundRoutes requires requireAdmin middleware.");
  const store = createPlaygroundCrudStore(options);
  const sendError = (res, error, fallback) => res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
  const actorLabel = async (req) => { const token = req.get("x-session-token"); if (!token || !options.userStore?.getSessionUser) return "Admin"; const session = await options.userStore.getSessionUser(token).catch(() => null); return session?.user?.name || session?.user?.email || "Admin"; };
  const userOptions = async () => { if (!options.userStore?.listUsers) return []; const users = await options.userStore.listUsers().catch(() => []); return users.filter((user) => user.status === "active").map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role || "viewer" })).sort((a, b) => a.name.localeCompare(b.name)); };
  app.get("/api/admin/playground", requireAdmin, async (req, res) => { try { res.json({ ...(await store.listAll(req.query || {})), users: await userOptions() }); } catch (error) { sendError(res, error, "Could not load Playground records."); } });
  app.get("/api/admin/playground/tasks/:taskId", requireAdmin, async (req, res) => { try { const detail = await store.getTask(req.params.taskId); detail ? res.json({ ...detail, users: await userOptions() }) : res.status(404).json({ error: "Task not found." }); } catch (error) { sendError(res, error, "Could not load Playground task."); } });
  app.post("/api/admin/playground/tasks/:taskId/updates", requireAdmin, async (req, res) => { try { const update = await store.createTaskUpdate(req.params.taskId, req.body || {}, await actorLabel(req)); update ? res.status(201).json({ update }) : res.status(404).json({ error: "Task not found." }); } catch (error) { sendError(res, error, "Could not create Playground task update."); } });
  app.post("/api/admin/playground/:resource", requireAdmin, async (req, res) => { try { const resource = validResource(req.params.resource); const record = await store.create(resource, req.body || {}, await actorLabel(req)); res.status(201).json({ [resource.slice(0, -1)]: record, record }); } catch (error) { sendError(res, error, "Could not create Playground record."); } });
  app.patch("/api/admin/playground/:resource/:recordId", requireAdmin, async (req, res) => { try { const resource = validResource(req.params.resource); const record = await store.update(resource, req.params.recordId, req.body || {}, await actorLabel(req)); record ? res.json({ [resource.slice(0, -1)]: record, record }) : res.status(404).json({ error: "Record not found." }); } catch (error) { sendError(res, error, "Could not update Playground record."); } });
  app.post("/api/admin/playground/:resource/:recordId/:action", requireAdmin, async (req, res) => { try { const resource = validResource(req.params.resource); const status = req.params.action === "archive" ? "archived" : req.params.action === "reactivate" ? "active" : ""; if (!status) throw appError(404, "Unknown Playground action."); const record = await store.setStatus(resource, req.params.recordId, status, await actorLabel(req)); record ? res.json({ [resource.slice(0, -1)]: record, record }) : res.status(404).json({ error: "Record not found." }); } catch (error) { sendError(res, error, "Could not update Playground record status."); } });
  app.locals.playgroundAttached = true;
  return store;
}

module.exports = { attachPlaygroundRoutes, createPlaygroundCrudStore };
