const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createPlaygroundStore } = require("../playground-management");

let nextId = 1;
const makeId = () => `00000000-0000-4000-9000-${String(nextId++).padStart(12, "0")}`;

test("playground store seeds tasks, projects, notes, and metrics", async () => {
  const store = createPlaygroundStore({ makeId, now: () => "2026-06-06T00:00:00.000Z" });
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
});

test("playground store persists created tasks and projects in memory mode", async () => {
  const store = createPlaygroundStore({ makeId, now: () => "2026-06-06T00:00:00.000Z" });
  const task = await store.createTask({
    title: "Stored task",
    description: "Created during a test.",
    status: "todo",
    category: "QA",
    priority: "high",
    dueLabel: "Today",
    dueDate: null
  });
  const project = await store.createProject({
    title: "Stored project",
    description: "Created during a test.",
    status: "planning",
    progress: 0,
    taskCount: 0
  });
  const data = await store.listAll();

  assert.ok(data.tasks.some((item) => item.id === task.id && item.title === "Stored task"));
  assert.ok(data.projects.some((item) => item.id === project.id && item.title === "Stored project"));
  assert.equal(data.metrics.totalTasks, 7);
  assert.equal(data.metrics.activeProjects, 5);
});

test("playground page loads the storage-backed script", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "playground.html"), "utf8");

  assert.ok(html.includes('<script src="admin.js"></script>'));
  assert.ok(html.includes('<script src="playground.js"></script>'));
});
