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
const sessionHeaders = (token) => ({ "x-session-token": token });

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

test("logs in with a real user session and protects profile updates", async () => {
  const created = await jsonFetch("/api/admin/users", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: "Phase Four Admin",
      email: "phase4@example.com",
      role: "admin",
      status: "active",
      password: "phase four password"
    })
  });
  assert.equal(created.response.status, 201);

  const badLogin = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "phase4@example.com", password: "wrong password" })
  });
  assert.equal(badLogin.response.status, 401);

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "phase4@example.com", password: "phase four password" })
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.data.sessionToken);
  assert.equal(login.data.user.email, "phase4@example.com");
  assert.equal(Object.hasOwn(login.data.user, "passwordHash"), false);

  const token = login.data.sessionToken;
  const profile = await jsonFetch("/api/profile", { headers: sessionHeaders(token) });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.data.user.name, "Phase Four Admin");

  const updatedProfile = await jsonFetch("/api/profile", {
    method: "PATCH",
    headers: sessionHeaders(token),
    body: JSON.stringify({ name: "Phase Four Owner", photoUrl: "https://example.com/owner.jpg" })
  });
  assert.equal(updatedProfile.response.status, 200);
  assert.equal(updatedProfile.data.user.name, "Phase Four Owner");
  assert.equal(updatedProfile.data.user.photoUrl, "https://example.com/owner.jpg");

  const wrongPassword = await jsonFetch("/api/profile", {
    method: "PATCH",
    headers: sessionHeaders(token),
    body: JSON.stringify({ currentPassword: "not the current password", newPassword: "next phase password" })
  });
  assert.equal(wrongPassword.response.status, 401);

  const passwordChanged = await jsonFetch("/api/profile", {
    method: "PATCH",
    headers: sessionHeaders(token),
    body: JSON.stringify({ currentPassword: "phase four password", newPassword: "next phase password" })
  });
  assert.equal(passwordChanged.response.status, 200);
  assert.ok(passwordChanged.data.user.passwordUpdatedAt);

  const adminList = await jsonFetch("/api/admin/users", { headers: sessionHeaders(token) });
  assert.equal(adminList.response.status, 200);
  assert.equal(adminList.data.users.some((user) => user.email === "phase4@example.com"), true);

  const chat = await jsonFetch("/api/chats", { method: "POST", body: JSON.stringify({ title: "Admin session chat" }) });
  assert.equal(chat.response.status, 201);

  const adminSummary = await jsonFetch("/api/admin/summary", { headers: sessionHeaders(token) });
  assert.equal(adminSummary.response.status, 200);
  assert.equal(Number.isInteger(adminSummary.data.summary.chats), true);

  const adminChats = await jsonFetch("/api/admin/chats", { headers: sessionHeaders(token) });
  assert.equal(adminChats.response.status, 200);
  assert.equal(adminChats.data.chats.some((item) => item.id === chat.data.chat.id), true);

  const adminChatDetail = await jsonFetch(`/api/admin/chats/${chat.data.chat.id}`, { headers: sessionHeaders(token) });
  assert.equal(adminChatDetail.response.status, 200);
  assert.equal(adminChatDetail.data.chat.id, chat.data.chat.id);

  const adminKnowledge = await jsonFetch("/api/admin/knowledge", { headers: sessionHeaders(token) });
  assert.equal(adminKnowledge.response.status, 200);
  assert.equal(Array.isArray(adminKnowledge.data.entries), true);

  const adminReviewRuns = await jsonFetch("/api/admin/review-runs", { headers: sessionHeaders(token) });
  assert.equal(adminReviewRuns.response.status, 200);
  assert.equal(Array.isArray(adminReviewRuns.data.runs), true);

  const adminReviewRun = await jsonFetch("/api/admin/reviews/run", { method: "POST", headers: sessionHeaders(token), body: "{}" });
  assert.equal(adminReviewRun.response.status, 201);
  assert.equal(adminReviewRun.data.run.status, "completed");

  const logout = await jsonFetch("/api/auth/logout", { method: "POST", headers: sessionHeaders(token), body: "{}" });
  assert.equal(logout.response.status, 200);

  const revokedProfile = await jsonFetch("/api/profile", { headers: sessionHeaders(token) });
  assert.equal(revokedProfile.response.status, 401);

  const revokedAdminSummary = await jsonFetch("/api/admin/summary", { headers: sessionHeaders(token) });
  assert.equal(revokedAdminSummary.response.status, 401);

  const oldPasswordLogin = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "phase4@example.com", password: "phase four password" })
  });
  assert.equal(oldPasswordLogin.response.status, 401);

  const newPasswordLogin = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "phase4@example.com", password: "next phase password" })
  });
  assert.equal(newPasswordLogin.response.status, 200);
});

test("blocks non-admin sessions from legacy admin APIs", async () => {
  const created = await jsonFetch("/api/admin/users", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: "Phase Five Member",
      email: "phase5-member@example.com",
      role: "member",
      status: "active",
      password: "member phase password"
    })
  });
  assert.equal(created.response.status, 201);

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "phase5-member@example.com", password: "member phase password" })
  });
  assert.equal(login.response.status, 200);

  const blocked = await jsonFetch("/api/admin/summary", { headers: sessionHeaders(login.data.sessionToken) });
  assert.equal(blocked.response.status, 401);
});
