const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createPlaygroundStore } = require("../playground-management");

let nextId = 1;
const makeId = () => `00000000-0000-4000-9000-${String(nextId++).padStart(12, "0")}`;
const createStore = () => createPlaygroundStore({ makeId, now: () => "2026-06-06T00:00:00.000Z" });

test("playground store seeds tasks, projects, notes, and metrics", async () => {
  const store = createStore();
  const data = await store.listAll();

  assert.equal(data.storageMode, "memory");
  assert.equal(data.tasks.length, 6);
  assert.equal(data.projects.length, 4);
  assert.equal(data.notes.length, 3);
  assert.deepEqual(data.metrics, {
    totalTasks: 6,
    activeProjects: 4,
    inProgress: 1,
    completed: 1
  });
  assert.equal(data.tasks[0].statusKey, data.tasks[0].status);
  assert.ok(Array.isArray(data.tasks[0].customFields));
});

test("playground store persists created tasks, custom fields, and projects in memory mode", async () => {
  const store = createStore();
  const task = await store.createTask({
    title: "Stored task",
    description: "Created during a test.",
    status: "todo",
    category: "QA",
    priority: "high",
    dueLabel: "Today",
    dueDate: null,
    projectId: "00000000-0000-4000-9000-000000000201",
    assigneeIds: ["00000000-0000-4000-8000-000000000002"],
    customFields: [{ name: "Client", value: "Acme" }]
  }, "Tester");
  const project = await store.createProject({
    title: "Stored project",
    description: "Created during a test.",
    status: "planning",
    progress: 0,
    taskCount: 0
  });
  const data = await store.listAll({ search: "acme" });

  assert.ok(data.tasks.some((item) => item.id === task.id && item.title === "Stored task" && item.projectTitle === "Website Redesign"));
  assert.deepEqual(data.tasks.find((item) => item.id === task.id).customFields, [{ name: "Client", value: "Acme" }]);
  assert.ok((await store.listAll()).projects.some((item) => item.id === project.id && item.title === "Stored project"));
  assert.equal((await store.listAll()).metrics.totalTasks, 7);
  assert.equal((await store.listAll()).metrics.activeProjects, 5);
});

test("playground store filters and paginates task records", async () => {
  const store = createStore();
  await store.createTask({ title: "Filtered high task", description: "Find me", status: "todo", category: "QA", priority: "high", dueLabel: "Today", dueDate: null, projectId: "", assigneeIds: [], customFields: [{ name: "Workflow", value: "filtered" }] });
  await store.createTask({ title: "Filtered low task", description: "Skip me", status: "backlog", category: "QA", priority: "low", dueLabel: "Later", dueDate: null, projectId: "", assigneeIds: [] });

  const high = await store.listAll({ priority: "high", search: "workflow", limit: 1 });
  assert.equal(high.tasks.length, 1);
  assert.equal(high.taskPage.total, 1);
  assert.equal(high.tasks[0].title, "Filtered high task");

  const first = await store.listAll({ limit: 2 });
  assert.equal(first.tasks.length, 2);
  assert.equal(first.taskPage.nextCursor, "2");
  const second = await store.listAll({ limit: 2, cursor: first.taskPage.nextCursor });
  assert.equal(second.taskPage.cursor, "2");
});

test("playground store updates task detail, comments, custom fields, and activity", async () => {
  const store = createStore();
  const created = await store.createTask({ title: "Detail task", description: "Before", status: "todo", category: "QA", priority: "medium", dueLabel: "Today", dueDate: null, projectId: "", assigneeIds: [], customFields: [] }, "Tester");
  const updated = await store.updateTask(created.id, { title: "Detail task", description: "After", status: "in_progress", category: "QA", priority: "high", dueLabel: "Tomorrow", dueDate: "2026-06-07", projectId: "00000000-0000-4000-9000-000000000201", assigneeIds: ["user-1"], customFields: [{ name: "Stage", value: "Build" }] }, "Tester");
  const comment = await store.createTaskUpdate(created.id, { body: "Progress note" }, "Tester");
  const detail = await store.getTask(created.id);

  assert.equal(updated.statusKey, "in_progress");
  assert.equal(updated.projectTitle, "Website Redesign");
  assert.deepEqual(updated.customFields, [{ name: "Stage", value: "Build" }]);
  assert.equal(comment.body, "Progress note");
  assert.equal(detail.task.description, "After");
  assert.ok(detail.updates.some((item) => item.body === "Progress note"));
  assert.ok(detail.activity.some((item) => item.action === "task.updated"));
  assert.ok(detail.activity.some((item) => (item.details.changes || []).some((change) => change.field === "customFields")));
});

test("playground page loads the storage-backed script after admin session bootstrap", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "playground.html"), "utf8");
  const adminSessionIndex = html.indexOf('<script src="admin-session.js"></script>');
  const adminIndex = html.indexOf('<script src="admin.js"></script>');
  const playgroundIndex = html.indexOf('<script src="playground.js"></script>');

  assert.ok(html.includes('class="admin-section-list reports-nav playground-nav"'));
  assert.ok(html.includes('<span class="reports-summary-label">Playground</span>'));
  assert.ok(html.includes('aria-label="Playground navigation"'));
  assert.ok(html.includes('href="/playground.html" aria-current="page"><span aria-hidden="true">▦</span>Board'));
  assert.ok(html.includes('href="/playground-tasks.html"><span aria-hidden="true">☑</span>Tasks'));
  assert.ok(adminSessionIndex > -1);
  assert.ok(adminIndex > adminSessionIndex);
  assert.ok(playgroundIndex > adminIndex);
});

test("playground tasks page loads session bootstrap and task list script", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "playground-tasks.html"), "utf8");
  const adminSessionIndex = html.indexOf('<script src="admin-session.js"></script>');
  const taskListIndex = html.indexOf('<script src="playground-tasks.js"></script>');

  assert.ok(html.includes('data-admin-page="playground-tasks"'));
  assert.ok(html.includes('id="taskListNewTaskButton"'));
  assert.ok(html.includes('id="taskListCardNewTaskButton"'));
  assert.ok(html.includes("<th>Custom Fields</th>"));
  assert.ok(html.includes('class="admin-section-list reports-nav playground-nav"'));
  assert.ok(html.includes('<span class="reports-summary-label">Playground</span>'));
  assert.ok(html.includes('href="/playground.html"><span aria-hidden="true">▦</span>Board'));
  assert.ok(html.includes('href="/playground-tasks.html" aria-current="page"><span aria-hidden="true">☑</span>Tasks'));
  assert.ok(html.includes('id="taskListBody"'));
  assert.ok(adminSessionIndex > -1);
  assert.ok(taskListIndex > adminSessionIndex);
});

test("shared admin navigation nests Tasks under Playground", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "admin-session.js"), "utf8");

  assert.ok(script.includes("playgroundPages"));
  assert.ok(script.includes("summaryIcon = \"\""));
  assert.ok(script.includes("playground-nav"));
  assert.ok(script.includes("summaryLabel: \"Playground\""));
  assert.ok(script.includes("Playground navigation"));
  assert.ok(script.includes("/playground-tasks.html"));
  assert.ok(script.includes('const tasksLink = nav.querySelector(\'a.nav-item[href="/playground-tasks.html"]\')'));
  assert.ok(script.includes("tasksLink?.remove()"));
});

test("playground tasks script creates saved tasks with common optional custom fields", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "playground-tasks.js"), "utf8");

  assert.ok(script.includes("/api/admin/playground?"));
  assert.ok(script.includes("taskListBody"));
  assert.ok(script.includes("taskListSearch"));
  assert.ok(script.includes("taskListProject"));
  assert.ok(script.includes("taskListTaskModal"));
  assert.ok(script.includes("taskListTaskTitle"));
  assert.ok(script.includes("taskListCommonFieldTypes"));
  assert.ok(script.includes("taskListCommonFieldType"));
  assert.ok(script.includes("taskListAddCommonField"));
  assert.ok(script.includes("Due Date"));
  assert.ok(script.includes("Dropdown"));
  assert.ok(script.includes("customFields"));
  assert.ok(script.includes("/api/admin/playground/tasks"));
  assert.ok(script.includes("Loaded ${total} saved task"));
});

test("playground script includes task modal, filters, drawer, and stable status keys", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "playground.js"), "utf8");

  assert.ok(script.includes("playgroundTaskModal"));
  assert.ok(script.includes("playgroundTaskDrawer"));
  assert.ok(script.includes("playgroundTaskSearch"));
  assert.ok(script.includes("statusKey"));
  assert.ok(script.includes("/api/admin/playground/tasks/"));
});

test("playground task modal save shows progress and backend errors", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "playground.js"), "utf8");

  assert.ok(script.includes("playgroundTaskFormMessage"));
  assert.ok(script.includes('id="playgroundTaskSave" type="button"'));
  assert.ok(script.includes("requestSubmit()"));
  assert.ok(script.includes("setTaskFormMessage(error.message, true)"));
  assert.ok(script.includes("Saving task changes..."));
  assert.ok(script.includes("Task saved to Playground storage."));
});
