const fs = require("fs");
const path = require("path");
const express = require("express");
const userManagement = require("./user-management");

const privacyEventsByChat = new Map();
const maxEventsPerChat = 200;
let userManagementStore = null;

const originalAttachUserManagementRoutes = userManagement.attachUserManagementRoutes;
userManagement.attachUserManagementRoutes = function patchedAttachUserManagementRoutes(...args) {
  userManagementStore = originalAttachUserManagementRoutes.apply(this, args);
  return userManagementStore;
};

function now() {
  return new Date().toISOString();
}

function cleanString(value, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEventType(value) {
  const eventType = cleanString(value, 80).toLowerCase();
  return ["screenshot", "print", "copy", "context-menu", "save", "media-download"].includes(eventType) ? eventType : "screenshot";
}

function cleanParticipantContext(context = {}) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  return {
    participantId: cleanString(context.participantId, 120),
    participantType: context.participantType === "original" ? "original" : "shared",
    participantLabel: cleanString(context.participantLabel, 80) || "Shared link",
    deviceType: ["desktop", "mobile", "tablet"].includes(context.deviceType) ? context.deviceType : "desktop",
    shareCount: Number.isFinite(Number(context.shareCount)) ? Math.max(0, Math.min(9999, Number(context.shareCount))) : 0
  };
}

function publicEvent(event) {
  return {
    id: event.id,
    chatId: event.chatId,
    eventType: event.eventType,
    participantType: event.participantType,
    participantLabel: event.participantLabel,
    deviceType: event.deviceType,
    createdAt: event.createdAt
  };
}

function privateEvent(event) {
  return {
    ...publicEvent(event),
    actorKnown: Boolean(event.actorUserId),
    actorUserId: event.actorUserId || null,
    actorName: event.actorName || null,
    actorEmail: event.actorEmail || null,
    actorLabel: event.actorName || event.actorEmail || event.participantLabel || "Anonymous participant"
  };
}

function pushPrivacyEvent(chatId, event) {
  const bucket = privacyEventsByChat.get(chatId) || [];
  bucket.push(event);
  while (bucket.length > maxEventsPerChat) bucket.shift();
  privacyEventsByChat.set(chatId, bucket);
}

async function sessionUser(req) {
  const token = cleanString(req.get("x-session-token"), 200);
  if (!token || !userManagementStore?.getSessionUser) return null;
  const session = await userManagementStore.getSessionUser(token).catch(() => null);
  return session?.user || null;
}

function attachPrivacyRoutes(app) {
  if (app.locals.privacyMediaControlsAttached) return;
  app.locals.privacyMediaControlsAttached = true;

  app.post("/api/chats/:chatId/privacy-events", async (req, res) => {
    try {
      const user = await sessionUser(req);
      const context = cleanParticipantContext(req.body?.context || {});
      const event = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        chatId: cleanString(req.params.chatId, 120),
        eventType: cleanEventType(req.body?.eventType),
        participantType: context.participantType,
        participantLabel: context.participantLabel,
        deviceType: context.deviceType,
        shareCount: context.shareCount,
        actorUserId: user?.id || null,
        actorName: user?.name || null,
        actorEmail: user?.email || null,
        createdAt: now()
      };
      pushPrivacyEvent(event.chatId, event);
      res.status(201).json({ event: user ? privateEvent(event) : publicEvent(event) });
    } catch (error) {
      res.status(500).json({ error: "Could not record privacy event." });
    }
  });

  app.get("/api/chats/:chatId/privacy-events", async (req, res) => {
    try {
      const user = await sessionUser(req);
      if (!user) return res.status(401).json({ error: "Login required to view privacy event identities." });
      const chatId = cleanString(req.params.chatId, 120);
      const events = (privacyEventsByChat.get(chatId) || []).slice(-50).map(privateEvent);
      res.json({ events });
    } catch (error) {
      res.status(500).json({ error: "Could not load privacy events." });
    }
  });
}

const originalListen = express.application.listen;
express.application.listen = function patchedListen(...args) {
  attachPrivacyRoutes(this);
  return originalListen.apply(this, args);
};

const originalStatic = express.static;
express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic(root, options);
  return function privacyStaticMiddleware(req, res, next) {
    const requestPath = String(req.path || req.url || "").split("?")[0];
    if (req.method === "GET" && (requestPath === "/" || requestPath === "/index.html")) {
      const indexPath = path.join(root, "index.html");
      fs.readFile(indexPath, "utf8", (error, html) => {
        if (error) return staticMiddleware(req, res, next);
        const script = '<script src="privacy-media-controls.js?v=20260607-privacy-media"></script>';
        const output = html.includes("privacy-media-controls.js") ? html : html.replace("</body>", `    ${script}\n  </body>`);
        res.type("html").send(output);
      });
      return undefined;
    }
    return staticMiddleware(req, res, next);
  };
};
