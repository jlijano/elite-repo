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

  const logout = await jsonFetch("/api/auth/logout", { method: "POST", headers: sessionHeaders(token), body: "{}" });
  assert.equal(logout.response.status, 200);

  const revokedProfile = await jsonFetch("/api/profile", { headers: sessionHeaders(token) });
  assert.equal(revokedProfile.response.status, 401);

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
