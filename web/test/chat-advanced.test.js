const assert = require("assert");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const backendSource = fs.readFileSync(path.join(repoRoot, "register-chat-advanced.js"), "utf8");
const frontendSource = fs.readFileSync(path.join(repoRoot, "public", "chat-advanced.js"), "utf8");

test("advanced chat backend exposes receipt, delivery, realtime, and presence routes", () => {
  assert.match(backendSource, /app\.post\("\/api\/chats\/:chatId\/read"/);
  assert.match(backendSource, /app\.post\("\/api\/chats\/:chatId\/messages\/:messageId\/delivery"/);
  assert.match(backendSource, /app\.get\("\/api\/chats\/:chatId\/events"/);
  assert.match(backendSource, /Content-Type"\s*,\s*"text\/event-stream"/);
  assert.match(backendSource, /function markRead\(/);
  assert.match(backendSource, /function setDelivery\(/);
  assert.match(backendSource, /function touchPresence\(/);
  assert.match(backendSource, /readReceipts = new Map\(\)/);
  assert.match(backendSource, /deliveries = new Map\(\)/);
  assert.match(backendSource, /presence = new Map\(\)/);
});

test("advanced chat backend augments chat responses with delivery and read receipt metadata", () => {
  assert.match(backendSource, /function augmentMessage\(message = \{\}\)/);
  assert.match(backendSource, /delivery:\s*deliveryFor\(message\.chatId, message\.id, message\)/);
  assert.match(backendSource, /readReceipts:\s*receiptList\(message\.chatId, message\.id\)/);
  assert.match(backendSource, /body\.chat = augmentChat\(body\.chat\)/);
  assert.match(backendSource, /body\.message = augmentMessage\(body\.message\)/);
});

test("advanced chat backend injects the browser chat enhancement script", () => {
  assert.match(backendSource, /chat-advanced\.js\?v=20260607-receipts-delivery-realtime/);
  assert.match(backendSource, /html\.replace\("<\/body>"/);
});

test("advanced chat frontend sends read receipts and listens for realtime updates", () => {
  assert.match(frontendSource, /\/api\/chats\/\$\{encodeURIComponent\(currentChatId\)\}\/read/);
  assert.match(frontendSource, /new EventSource\(`/);
  assert.match(frontendSource, /addEventListener\("message"/);
  assert.match(frontendSource, /addEventListener\("receipt"/);
  assert.match(frontendSource, /addEventListener\("delivery"/);
  assert.match(frontendSource, /addEventListener\("presence"/);
});

test("advanced chat frontend displays delivery states, presence, and message actions", () => {
  assert.match(frontendSource, /Seen by \$\{displayReceiptLabel\(receipts\[0\]\)\}/);
  assert.match(frontendSource, /return \{ text: "Delivered", state: "delivered" \}/);
  assert.match(frontendSource, /return \{ text: "Failed", state: "failed" \}/);
  assert.match(frontendSource, /participant-presence/);
  assert.match(frontendSource, /Message actions/);
  assert.match(frontendSource, /makeButton\("Reply"/);
  assert.match(frontendSource, /makeButton\("Copy"/);
  assert.match(frontendSource, /makeButton\("Archive here"/);
  assert.match(frontendSource, /makeButton\("Download attachment"/);
});
