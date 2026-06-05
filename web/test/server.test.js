const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const adminToken = "test-admin-token";
const reviewToken = "test-review-token";
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

async function createReviewedMessage(message = "Review me") {
  const created = await jsonFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify({ title: "Review test chat" })
  });
  assert.equal(created.response.status, 201);
  const saved = await jsonFetch(`/api/chats/${created.data.chat.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content: message })
  });
  assert.equal(saved.response.status, 201);
  return created.data.chat.id;
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: webDir,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_TOKEN: adminToken,
      REVIEW_RUN_TOKEN: reviewToken,
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

test("reports health and storage-only status", async () => {
  const health = await jsonFetch("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.data.ok, true);

  const status = await jsonFetch("/api/status");
  assert.equal(status.response.status, 200);
  assert.equal(status.data.storageMode, "memory");
  assert.equal(status.data.aiAvailable, false);
});

test("stores chat messages and returns the pending-review chat fallback", async () => {
  const created = await jsonFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify({ title: "Backend test chat" })
  });
  assert.equal(created.response.status, 201);
  const chatId = created.data.chat.id;

  const saved = await jsonFetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content: "Manual storage check", context: { source: "test", token: "secret" } })
  });
  assert.equal(saved.response.status, 201);
  assert.equal(saved.data.message.context.token, "[REDACTED]");

  const chatReply = await jsonFetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ chatId, message: "Route this request" })
  });
  assert.equal(chatReply.response.status, 200);
  assert.equal(chatReply.data.pendingReview, true);
  assert.equal(chatReply.data.aiAvailable, false);
  assert.equal(chatReply.data.messages.length, 2);

  const loaded = await jsonFetch(`/api/chats/${chatId}`);
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.data.chat.messages.length, 3);
});

test("protects review/admin routes and supports knowledge approval", async () => {
  await createReviewedMessage("Knowledge approval test message");

  const blockedReview = await jsonFetch("/api/reviews/run", { method: "POST", body: "{}" });
  assert.equal(blockedReview.response.status, 401);

  const review = await jsonFetch("/api/reviews/run", {
    method: "POST",
    headers: { "x-review-token": reviewToken },
    body: "{}"
  });
  assert.equal(review.response.status, 201);
  assert.equal(review.data.run.status, "completed");
  assert.ok(review.data.run.messagesReviewed >= 1);
  assert.ok(review.data.run.knowledgeEntriesCreated >= 1);

  const blockedAdmin = await jsonFetch("/api/admin/summary");
  assert.equal(blockedAdmin.response.status, 401);

  const summary = await jsonFetch("/api/admin/summary", { headers: { "x-admin-token": adminToken } });
  assert.equal(summary.response.status, 200);
  assert.ok(summary.data.summary.pendingKnowledge >= 1);

  const pending = await jsonFetch("/api/admin/knowledge?status=pending_review", { headers: { "x-admin-token": adminToken } });
  assert.equal(pending.response.status, 200);
  assert.ok(pending.data.entries.length >= 1);

  const entryId = pending.data.entries[0].id;
  const approved = await jsonFetch(`/api/admin/knowledge/${entryId}`, {
    method: "PATCH",
    headers: { "x-admin-token": adminToken },
    body: JSON.stringify({ status: "approved" })
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.data.entry.status, "approved");

  const approvedList = await jsonFetch("/api/knowledge?status=approved");
  assert.equal(approvedList.response.status, 200);
  assert.ok(approvedList.data.entries.some((entry) => entry.id === entryId));
});
