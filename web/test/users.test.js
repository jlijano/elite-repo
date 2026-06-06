const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const adminToken = "test-admin-token";
let baseUrl;
let serverProcess;

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error("Server did not become healthy.");
}

async function jsonFetch(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

const adminHeaders = () => ({ "x-admin-token": adminToken });

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["--require", "./register-user-management.js", "server.js"], {
    cwd: webDir,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_TOKEN: adminToken,
      REVIEW_RUN_INTERVAL_MS: "0",
      OPENAI_API_KEY: "",
      DATABASE_URL: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  serverProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitForHealth(baseUrl);
});

after(() => {
  serverProcess?.kill();
});

test("protects user management routes with the admin token", async () => {
  const blocked = await jsonFetch("/api/admin/users");
  assert.equal(blocked.response.status, 401);

  const allowed = await jsonFetch("/api/admin/users", { headers: adminHeaders() });
  assert.equal(allowed.response.status, 200);
  assert.deepEqual(allowed.data.users, []);
});

test("creates, lists, loads, and updates users without exposing password hashes", async () => {
  const created = await jsonFetch("/api/admin/users", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: "Ada Lovelace",
      email: "ADA@Example.com",
      photoUrl: "https://example.com/ada.jpg",
      role: "admin",
      status: "active",
      password: "correct horse battery staple"
    })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.user.name, "Ada Lovelace");
  assert.equal(created.data.user.email, "ada@example.com");
  assert.equal(created.data.user.role, "admin");
  assert.equal(created.data.user.status, "active");
  assert.equal(Object.hasOwn(created.data.user, "passwordHash"), false);
  assert.ok(created.data.user.passwordUpdatedAt);

  const userId = created.data.user.id;
  const list = await jsonFetch("/api/admin/users", { headers: adminHeaders() });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.users.some((user) => user.id === userId), true);

  const loaded = await jsonFetch(`/api/admin/users/${userId}`, { headers: adminHeaders() });
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.data.user.email, "ada@example.com");

  const updated = await jsonFetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ name: "Ada Byron", role: "owner" })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.user.name, "Ada Byron");
  assert.equal(updated.data.user.role, "owner");
});

test("rejects duplicate user emails", async () => {
  const first = await jsonFetch("/api/admin/users", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ name: "Grace Hopper", email: "grace@example.com", role: "member" })
  });
  assert.equal(first.response.status, 201);

  const duplicate = await jsonFetch("/api/admin/users", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ name: "Another Grace", email: "GRACE@example.com", role: "viewer" })
  });
  assert.equal(duplicate.response.status, 409);
});

test("disables, reactivates, and audits user changes", async () => {
  const created = await jsonFetch("/api/admin/users", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ name: "Katherine Johnson", email: "katherine@example.com", role: "member" })
  });
  assert.equal(created.response.status, 201);
  const userId = created.data.user.id;

  const disabled = await jsonFetch(`/api/admin/users/${userId}/disable`, {
    method: "POST",
    headers: adminHeaders(),
    body: "{}"
  });
  assert.equal(disabled.response.status, 200);
  assert.equal(disabled.data.user.status, "disabled");

  const reactivated = await jsonFetch(`/api/admin/users/${userId}/reactivate`, {
    method: "POST",
    headers: adminHeaders(),
    body: "{}"
  });
  assert.equal(reactivated.response.status, 200);
  assert.equal(reactivated.data.user.status, "active");

  const audit = await jsonFetch(`/api/admin/user-audit-events?targetUserId=${encodeURIComponent(userId)}`, { headers: adminHeaders() });
  assert.equal(audit.response.status, 200);
  assert.equal(audit.data.events.some((event) => event.action === "user.created"), true);
  assert.equal(audit.data.events.some((event) => event.action === "user.disabled"), true);
  assert.equal(audit.data.events.some((event) => event.action === "user.reactivated"), true);
});
