const fs = require("fs");
const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const originalListen = express.application.listen;
const originalStatic = express.static;
const attachedApps = new WeakSet();
const publicDir = path.join(__dirname, "public");
const notificationBellScript = '<script src="admin-notification-bell.js?v=20260607-system-log"></script>';
const memoryChanges = [];
let pool = null;
let schemaReady = null;

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanString(value, fallback = "", maxLength = 240) {
  const text = typeof value === "number" || typeof value === "boolean" ? String(value) : typeof value === "string" ? value : fallback;
  return text.trim().slice(0, maxLength) || fallback;
}

function normalizeAction(value) {
  const action = cleanString(value, "Updated", 40).toLowerCase();
  if (action.includes("add") || action.includes("create")) return "Added";
  if (action.includes("delete") || action.includes("archive") || action.includes("remove") || action.includes("purge")) return "Deleted";
  return "Updated";
}

function changeRow(row = {}) {
  return {
    id: row.id,
    action: normalizeAction(row.action),
    module: row.module || "System",
    summary: row.summary || "System change",
    actor: row.actor || "System",
    createdAt: new Date(row.created_at || row.createdAt || Date.now()).toISOString()
  };
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return null;
  if (!schemaReady) {
    schemaReady = db.query(`
      CREATE TABLE IF NOT EXISTS system_change_log (
        id UUID PRIMARY KEY,
        action TEXT NOT NULL CHECK (action IN ('Added', 'Updated', 'Deleted')),
        module TEXT NOT NULL,
        summary TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'System',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS system_change_log_created_at_idx ON system_change_log(created_at DESC);
    `);
  }
  await schemaReady;
  return db;
}

async function recordSystemChange(change = {}) {
  const entry = {
    id: makeId(),
    action: normalizeAction(change.action),
    module: cleanString(change.module, "System", 120),
    summary: cleanString(change.summary, "System change", 280),
    actor: cleanString(change.actor, "System", 160),
    createdAt: new Date().toISOString()
  };
  const db = await ensureSchema();
  if (!db) {
    memoryChanges.unshift(entry);
    memoryChanges.splice(100);
    return entry;
  }
  const result = await db.query(
    "INSERT INTO system_change_log (id, action, module, summary, actor) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [entry.id, entry.action, entry.module, entry.summary, entry.actor]
  );
  return changeRow(result.rows[0]);
}

async function listSystemChanges(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const db = await ensureSchema();
  if (!db) return memoryChanges.slice(0, safeLimit).map(changeRow);
  const result = await db.query("SELECT * FROM system_change_log ORDER BY created_at DESC LIMIT $1", [safeLimit]);
  return result.rows.map(changeRow);
}

function suppliedToken(req, headerName) {
  return req.get(headerName) || req.get("authorization")?.replace(/^Bearer\s+/i, "");
}

async function requireAdmin(req, res, next) {
  try {
    const token = req.get("x-session-token");
    const userStore = req.app?.locals?.userManagementStore;
    const session = token && userStore?.getSessionUser ? await userStore.getSessionUser(token).catch(() => null) : null;
    if (["owner", "admin"].includes(session?.user?.role)) return next();
    if (process.env.ADMIN_TOKEN && suppliedToken(req, "x-admin-token") === process.env.ADMIN_TOKEN) return next();
    return res.status(403).json({ error: "Admin access is required." });
  } catch (error) {
    return next(error);
  }
}

function attachSystemChangeRoutes(app) {
  app.locals.systemChangeLog = {
    record: (change) => recordSystemChange(change).catch((error) => {
      console.warn("System change log write failed:", error.message);
      return null;
    }),
    list: listSystemChanges
  };

  app.get("/api/admin/system-change-log", requireAdmin, async (req, res, next) => {
    try {
      res.json({ changes: await listSystemChanges(req.query.limit) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/system-change-log", requireAdmin, async (req, res, next) => {
    try {
      const change = await recordSystemChange(req.body || {});
      res.status(201).json({ change });
    } catch (error) {
      next(error);
    }
  });
}

function shouldInjectBell(html) {
  return typeof html === "string" && html.includes("admin-header") && html.includes("profile-menu") && !html.includes("admin-notification-bell.js");
}

function injectNotificationBell(html) {
  if (!shouldInjectBell(html)) return html;
  return html.replace("</body>", `    ${notificationBellScript}\n  </body>`);
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);

  return function systemChangeStatic(req, res, next) {
    const requestPath = (req.path || req.url.split("?")[0] || "").replace(/^\//, "");
    const shouldEnhanceHtml = ["GET", "HEAD"].includes(req.method) && requestPath.endsWith(".html");
    if (!shouldEnhanceHtml) return staticMiddleware(req, res, next);

    fs.readFile(path.join(root, requestPath), "utf8", (error, html) => {
      if (error) return staticMiddleware(req, res, next);
      res.type("html");
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
      res.send(injectNotificationBell(html));
    });
  };
};

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this)) {
    attachSystemChangeRoutes(this);
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};
