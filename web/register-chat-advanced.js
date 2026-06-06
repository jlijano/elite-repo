const fs = require("fs");
const path = require("path");
const express = require("express");

const originalExpress = express;
const originalListen = originalExpress.application.listen;
const readReceipts = new Map();
const deliveries = new Map();
const presence = new Map();
const clients = new Map();
const onlineTimeoutMs = 30000;

function now() {
  return new Date().toISOString();
}

function redact(value) {
  return String(value || "").replace(/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[REDACTED]");
}

function cleanParticipant(context = {}) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const participantId = typeof context.participantId === "string" ? redact(context.participantId).slice(0, 120) : "";
  if (!participantId) return null;
  const participantType = context.participantType === "original" ? "original" : "shared";
  const participantLabel = typeof context.participantLabel === "string" && context.participantLabel.trim()
    ? redact(context.participantLabel.trim()).slice(0, 80)
    : participantType === "original" ? "Original" : "Shared link";
  const deviceType = ["desktop", "mobile", "tablet"].includes(context.deviceType) ? context.deviceType : "desktop";
  const bubbleColor = /^#[0-9a-f]{6}$/i.test(context.bubbleColor || "") ? String(context.bubbleColor).toLowerCase() : "#2f2f2f";
  return { participantId, participantType, participantLabel, deviceType, bubbleColor };
}

function chatMap(bucket, chatId) {
  if (!bucket.has(chatId)) bucket.set(chatId, new Map());
  return bucket.get(chatId);
}

function messageMap(bucket, chatId, messageId) {
  const byChat = chatMap(bucket, chatId);
  if (!byChat.has(messageId)) byChat.set(messageId, new Map());
  return byChat.get(messageId);
}

function publicPresence(record = {}) {
  const lastActiveAt = record.lastActiveAt || now();
  return {
    participantId: record.participantId,
    participantType: record.participantType,
    participantLabel: record.participantLabel,
    deviceType: record.deviceType,
    bubbleColor: record.bubbleColor,
    lastActiveAt,
    isOnline: Date.now() - new Date(lastActiveAt).getTime() < onlineTimeoutMs
  };
}

function touchPresence(chatId, context = {}) {
  const participant = cleanParticipant(context);
  if (!chatId || !participant) return null;
  const byChat = chatMap(presence, chatId);
  const next = { ...(byChat.get(participant.participantId) || {}), ...participant, lastActiveAt: now() };
  byChat.set(participant.participantId, next);
  return publicPresence(next);
}

function presenceList(chatId) {
  return [...(presence.get(chatId)?.values() || [])].map(publicPresence);
}

function deliveryFor(chatId, messageId, message = {}) {
  const stored = deliveries.get(chatId)?.get(messageId);
  const fromContext = message.context?.delivery;
  const seen = receiptList(chatId, messageId).length > 0;
  if (seen) return { status: "seen", updatedAt: now(), seenAt: now() };
  if (stored) return stored;
  if (fromContext && typeof fromContext === "object") return fromContext;
  return message.role === "user" ? { status: "delivered", updatedAt: message.createdAt || now(), deliveredAt: message.createdAt || now() } : null;
}

function setDelivery(chatId, messageId, status = "delivered") {
  if (!chatId || !messageId) return null;
  const normalized = ["sent", "delivered", "seen", "failed"].includes(status) ? status : "delivered";
  const record = { status: normalized, updatedAt: now() };
  if (normalized === "sent") record.sentAt = record.updatedAt;
  if (normalized === "delivered") record.deliveredAt = record.updatedAt;
  if (normalized === "seen") record.seenAt = record.updatedAt;
  if (normalized === "failed") record.failedAt = record.updatedAt;
  chatMap(deliveries, chatId).set(messageId, record);
  return record;
}

function receiptList(chatId, messageId) {
  return [...(readReceipts.get(chatId)?.get(messageId)?.values() || [])];
}

function markRead(chatId, messageIds = [], context = {}) {
  const participant = touchPresence(chatId, context);
  if (!participant || !Array.isArray(messageIds)) return [];
  const readAt = now();
  const receipts = [];
  for (const messageId of messageIds.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 200)) {
    const byMessage = messageMap(readReceipts, chatId, messageId);
    const receipt = { ...participant, readAt };
    byMessage.set(participant.participantId, receipt);
    setDelivery(chatId, messageId, "seen");
    receipts.push({ messageId, receipt });
  }
  return receipts;
}

function augmentMessage(message = {}) {
  if (!message?.id || !message?.chatId) return message;
  return {
    ...message,
    delivery: deliveryFor(message.chatId, message.id, message),
    readReceipts: receiptList(message.chatId, message.id)
  };
}

function augmentChat(chat = {}) {
  if (!chat?.id) return chat;
  return {
    ...chat,
    messages: Array.isArray(chat.messages) ? chat.messages.map(augmentMessage) : [],
    participants: mergeParticipants(chat.participants || [], presenceList(chat.id))
  };
}

function mergeParticipants(base = [], extra = []) {
  const merged = new Map();
  for (const item of base) if (item?.participantId) merged.set(item.participantId, item);
  for (const item of extra) if (item?.participantId) merged.set(item.participantId, { ...(merged.get(item.participantId) || {}), ...item });
  return [...merged.values()];
}

function sendEvent(chatId, type, payload = {}) {
  const set = clients.get(chatId);
  if (!set) return;
  const event = `event: ${type}\ndata: ${JSON.stringify({ type, chatId, ...payload })}\n\n`;
  for (const res of set) res.write(event);
}

function installMiddleware(app) {
  if (app.__advancedChatInstalled) return;
  app.__advancedChatInstalled = true;

  app.use((req, res, next) => {
    if (req.method === "GET" && (req.path === "/" || req.path === "/index.html")) {
      const indexPath = path.join(__dirname, "public", "index.html");
      fs.readFile(indexPath, "utf8", (error, html) => {
        if (error) return next();
        const script = '<script src="/chat-advanced.js?v=20260607-receipts-delivery-realtime"></script>';
        res.type("html").send(html.includes("chat-advanced.js") ? html : html.replace("</body>", `${script}\n  </body>`));
      });
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        const chatId = req.params?.chatId || body?.chatId || body?.message?.chatId || body?.chat?.id;
        const context = req.body?.context || {};
        if (chatId && context) touchPresence(chatId, context);
        if (body?.chat) body.chat = augmentChat(body.chat);
        if (body?.message) {
          setDelivery(body.message.chatId || chatId, body.message.id, "delivered");
          body.message = augmentMessage(body.message);
          sendEvent(body.message.chatId || chatId, "message", { message: body.message, participants: presenceList(body.message.chatId || chatId) });
        }
        if (Array.isArray(body?.messages)) {
          body.messages = body.messages.map((message) => {
            setDelivery(message.chatId || chatId, message.id, "delivered");
            return augmentMessage(message);
          });
          for (const message of body.messages) sendEvent(message.chatId || chatId, "message", { message, participants: presenceList(message.chatId || chatId) });
        }
        if (chatId && (req.path.includes("/participants") || req.path.includes("/typing"))) sendEvent(chatId, "presence", { participants: presenceList(chatId), typingParticipants: body?.typingParticipants || [] });
      } catch (error) {
        // Keep the original route response intact if augmentation fails.
      }
      return originalJson(body);
    };
    next();
  });
}

function installRoutes(app) {
  if (app.__advancedChatRoutesInstalled) return;
  app.__advancedChatRoutesInstalled = true;

  app.get("/api/chats/:chatId/events", (req, res) => {
    const { chatId } = req.params;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    if (!clients.has(chatId)) clients.set(chatId, new Set());
    clients.get(chatId).add(res);
    res.write(`event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", chatId, participants: presenceList(chatId) })}\n\n`);
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25000);
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.get(chatId)?.delete(res);
      if (clients.get(chatId)?.size === 0) clients.delete(chatId);
    });
  });

  app.post("/api/chats/:chatId/read", (req, res) => {
    const receipts = markRead(req.params.chatId, req.body?.messageIds || [], req.body?.context || {});
    const participants = presenceList(req.params.chatId);
    sendEvent(req.params.chatId, "receipt", { receipts, participants });
    res.json({ receipts, participants });
  });

  app.post("/api/chats/:chatId/messages/:messageId/delivery", (req, res) => {
    const participant = touchPresence(req.params.chatId, req.body?.context || {});
    const delivery = setDelivery(req.params.chatId, req.params.messageId, req.body?.status || "delivered");
    sendEvent(req.params.chatId, "delivery", { messageId: req.params.messageId, delivery, participant });
    res.json({ messageId: req.params.messageId, delivery, participant });
  });
}

function patchedExpress(...args) {
  const app = originalExpress(...args);
  installMiddleware(app);
  return app;
}

Object.setPrototypeOf(patchedExpress, originalExpress);
Object.assign(patchedExpress, originalExpress);
patchedExpress.application.listen = function patchedListen(...args) {
  installRoutes(this);
  return originalListen.apply(this, args);
};

require.cache[require.resolve("express")].exports = patchedExpress;
