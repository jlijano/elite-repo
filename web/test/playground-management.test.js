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
});

test("playground store persists created tasks and projects in memory mode", async () => {
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
    assigneeIds: ["00000000-0000-4000-8000-000000000002"]
  }, "Tester");
  const project = await store.createProject({
    title: "Stored project",
    description: "Created during a test.",
    status: "planning",
    progress: 0,
    taskCount: 0
  });
  const data = await store.listAll();

  assert.ok(data.tasks.some((item) => item.id === task.id && item.title === "Stored task" && item.projectTitle === "Website Redesign"));
  assert.ok(data.projects.some((item) => item.id === project.id && item.title === "Stored project"));
  assert.equal(data.metrics.totalTasks, 7);
  assert.equal(data.metrics.activeProjects, 5);
});

test("playground store filters and paginates task records", async () => {
  const store = createStore();
  await store.createTask({ title: "Filtered high task", description: "Find me", status: "todo", category: "QA", priority: "high", dueLabel: "Today", dueDate: null, projectId: "", assigneeIds: ["user-1"] });
  await store.createTask({ title: "Filtered low task", description: "Skip me", status: "backlog", category: "QA", priority: "low", dueLabel: "Later", dueDate: null, projectId: "", assigneeIds: [] });

  const high = await store.listAll({ priority: "high", search: "filtered", limit: 1 });
  assert.equal(high.tasks.length, 1);
  assert.equal(high.taskPage.total, 1);
  assert.equal(high.tasks[0].title, "Filtered high task");

  const first = await store.listAll({ limit: 2 });
  assert.equal(first.tasks.length, 2);
  assert.equal(first.taskPage.nextCursor, "2");
  const second = await store.listAll({ limit: 2, cursor: first.taskPage.nextCursor });
  assert.equal(second.taskPage.cursor, "2");
});

test("playground store updates task detail, comments, and activity", async () => {
  const store = createStore();
  const created = await store.createTask({ title: "Detail task", description: "Before", status: "todo", category: "QA", priority: "medium", dueLabel: "Today", dueDate: null, projectId: "", assigneeIds: [] }, "Tester");
  const updated = await store.updateTask(created.id, { title: "Detail task", description: "After", status: "in_progress", category: "QA", priority: "high", dueLabel: "Tomorrow", dueDate: "2026-06-07", projectId: "00000000-0000-4000-9000-000000000201", assigneeIds: ["user-1"] }, "Tester");
  const comment = await store.createTaskUpdate(created.id, { body: "Progress note" }, "Tester");
  const detail = await store.getTask(created.id);

  assert.equal(updated.statusKey, "in_progress");
  assert.equal(updated.projectTitle, "Website Redesign");
  assert.equal(comment.body, "Progress note");
  assert.equal(detail.task.description, "After");
  assert.ok(detail.updates.some((item) => item.body === "Progress note"));
  assert.ok(detail.activity.some((item) => item.action === "task.updated"));
});

test("playground page loads the storage-backed script", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "playground.html"), "utf8");

  assert.ok(html.includes('<script src="admin.js"></script>'));
  assert.ok(html.includes('<script src="playground.js"></script>'));
});

test("playground script includes task modal, filters, drawer, and stable status keys", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "public", "playground.js"), "utf8");

  assert.ok(script.includes("playgroundTaskModal"));
  assert.ok(script.includes("playgroundTaskDrawer"));
  assert.ok(script.includes("playgroundTaskSearch"));
  assert.ok(script.includes("statusKey"));
  assert.ok(script.includes("/api/admin/playground/tasks/"));
});
