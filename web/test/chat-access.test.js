const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const webDir = path.resolve(__dirname, "..");
const publicDir = path.join(webDir, "public");
const indexHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
const chatAccessCss = fs.readFileSync(path.join(publicDir, "chat-access.css"), "utf8");

test("chat page exposes login and share controls", () => {
  assert.match(indexHtml, /href="chat-access\.css"/);
  assert.match(indexHtml, /id="loginLink"/);
  assert.match(indexHtml, /href="\/login\.html"/);
  assert.match(indexHtml, /id="shareChatButton"/);
});

test("chat app gates anonymous users and supports share links", () => {
  [
    "const sharedChatId = shareParams.get(\"chat\")",
    "const sharedChatToken = shareParams.get(\"share\")",
    "function renderLoginGate()",
    "function loadSharedChat()",
    "function shareCurrentChat()",
    "/api/chats/${encodeURIComponent(currentChatId)}/share",
    "Log in to view chats",
    "Chats are private"
  ].forEach((needle) => assert.match(appJs, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("chat access stylesheet hides private surfaces in locked and shared modes", () => {
  [
    "body[data-chat-access=\"locked\"] .sidebar",
    "body[data-chat-access=\"shared\"] .sidebar",
    "body[data-chat-access=\"locked\"] .composer",
    "body[data-chat-access=\"shared\"] .composer",
    ".access-card",
    ".share-chat-button"
  ].forEach((needle) => assert.match(chatAccessCss, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});
