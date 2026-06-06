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

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["-r", "./register-admin-actions.js", "server.js"], {
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

test("keeps chat purge global-admin only", async () => {
  const created = await jsonFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify({ title: "Purge smoke chat" })
  });
  assert.equal(created.response.status, 201);
  const chatId = created.data.chat.id;

  const blocked = await jsonFetch(`/api/admin/chats/${chatId}`, { method: "DELETE" });
  assert.equal(blocked.response.status, 403);
  assert.match(blocked.data.error, /global admin/i);

  const memoryBlocked = await jsonFetch(`/api/admin/chats/${chatId}`, {
    method: "DELETE",
    headers: { "x-admin-token": adminToken }
  });
  assert.equal(memoryBlocked.response.status, 501);
  assert.match(memoryBlocked.data.error, /persistent database storage/i);

  const stillPresent = await jsonFetch(`/api/chats/${chatId}`);
  assert.equal(stillPresent.response.status, 200);
  assert.equal(stillPresent.data.chat.id, chatId);
});
