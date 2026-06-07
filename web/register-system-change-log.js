const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");

const originalListen = express.application.listen;
const originalStatic = express.static;
const attachedApps = new WeakSet();
const notificationBellScript = '<script src="admin-notification-bell.js?v=20260608-count-badge"></script>';
const memoryChanges = [];
let pool = null;
let schemaReady = null;

function makeId() {
  return crypto.randomUUID();
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

function titleCase(value) {
  return cleanString(value, "System", 80)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function singularResource(value) {
  const resource = String(value || "system");
  const singular = resource.endsWith("ies") ? `${resource.slice(0, -3)}y` : resource.replace(/s$/, "");
  return titleCase(singular);
}

function isoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function changeRow(row = {}) {
  return {
    id: row.id,
    action: normalizeAction(row.action),
    module: row.module || "System",
    summary: row.summary || "System change",
    actor: row.actor || "System",
    createdAt: new Date(row.created_at || row.createdAt || Date.now()).toISOString(),
    archivedAt: isoOrNull(row.archived_at || row.archivedAt),
    implementedAt: isoOrNull(row.implemented_at || row.implementedAt),
    revertRequestedAt: isoOrNull(row.revert_requested_at || row.revertRequestedAt)
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
      ALTER TABLE system_change_log
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS implemented_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS revert_requested_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS system_change_log_created_at_idx ON system_change_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS system_change_log_active_created_at_idx ON system_change_log(archived_at, created_at DESC);
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
    createdAt: new Date().toISOString(),
    archivedAt: null,
    implementedAt: null,
    revertRequestedAt: null
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

async function listSystemChanges(limit = 50, options = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const includeArchived = Boolean(options.includeArchived);
  const db = await ensureSchema();
  if (!db) {
    return memoryChanges
      .filter((change) => includeArchived || !change.archivedAt)
      .slice(0, safeLimit)
      .map(changeRow);
  }
  const sql = includeArchived
    ? "SELECT * FROM system_change_log ORDER BY created_at DESC LIMIT $1"
    : "SELECT * FROM system_change_log WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT $1";
  const result = await db.query(sql, [safeLimit]);
  return result.rows.map(changeRow);
}

async function markSystemChange(changeId, field) {
  const allowedFields = new Set(["archived_at", "implemented_at", "revert_requested_at"]);
  if (!allowedFields.has(field)) return null;
  const db = await ensureSchema();
  if (!db) {
    const change = memoryChanges.find((item) => item.id === changeId);
    if (!change) return null;
    if (field === "archived_at") change.archivedAt = new Date().toISOString();
    if (field === "implemented_at") change.implementedAt = new Date().toISOString();
    if (field === "revert_requested_at") change.revertRequestedAt = new Date().toISOString();
    return changeRow(change);
  }
  const result = await db.query(`UPDATE system_change_log SET ${field} = NOW() WHERE id = $1 RETURNING *`, [changeId]);
  return result.rows[0] ? changeRow(result.rows[0]) : null;
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

function mutationChangeFromRequest(req) {
  if (!req.path.startsWith("/api/admin/") || req.path.startsWith("/api/admin/system-change-log")) return null;
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return null;

  const parts = req.path.split("/").filter(Boolean);
  if (parts[2] === "playground") {
    const resource = parts[3] || "playground";
    const actionSegment = parts[5] || "";
    const action = req.method === "POST" && !parts[4] ? "Added" : actionSegment === "archive" ? "Deleted" : "Updated";
    const summary = req.body?.title || req.body?.label || req.body?.content || req.body?.trigger || parts[4] || singularResource(resource);
    return { action, module: singularResource(resource), summary };
  }

  const moduleName = parts[2] === "entra" ? singularResource(parts[3]) : singularResource(parts[2]);
  const summary = req.body?.name || req.body?.title || req.body?.email || req.params?.userId || moduleName;
  const action = req.method === "DELETE" ? "Deleted" : req.method === "POST" ? "Added" : "Updated";
  return { action, module: moduleName, summary };
}

function attachSystemChangeCapture(app) {
  app.use((req, res, next) => {
    const change = mutationChangeFromRequest(req);
    if (!change) return next();
    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 400) return;
      const actor = req.adminActor?.name || req.adminActor?.email || "Admin";
      recordSystemChange({ ...change, actor }).catch((error) => {
        console.warn("System change log write failed:", error.message);
      });
    });
    return next();
  });
}

function attachSystemChangeRoutes(app) {
  app.locals.systemChangeLog = {
    record: (change) => recordSystemChange(change).catch((error) => {
      console.warn("System change log write failed:", error.message);
      return null;
    }),
    list: listSystemChanges
  };

  attachSystemChangeCapture(app);

  app.get("/api/admin/system-change-log", requireAdmin, async (req, res, next) => {
    try {
      res.json({ changes: await listSystemChanges(req.query.limit, { includeArchived: req.query.includeArchived === "true" }) });
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

  app.post("/api/admin/system-change-log/:changeId/archive", requireAdmin, async (req, res, next) => {
    try {
      const change = await markSystemChange(req.params.changeId, "archived_at");
      change ? res.json({ change }) : res.status(404).json({ error: "System change log entry not found." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/system-change-log/:changeId/implement", requireAdmin, async (req, res, next) => {
    try {
      const change = await markSystemChange(req.params.changeId, "implemented_at");
      change ? res.json({ change }) : res.status(404).json({ error: "System change log entry not found." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/system-change-log/:changeId/revert-request", requireAdmin, async (req, res, next) => {
    try {
      const change = await markSystemChange(req.params.changeId, "revert_requested_at");
      change ? res.json({ change }) : res.status(404).json({ error: "System change log entry not found." });
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

function sendEnhancedReportsScript(res, root) {
  const reportsPath = path.join(root, "reports.js");
  const systemUiPath = path.join(root, "system-change-log-ui.js");
  const parts = [fs.readFileSync(reportsPath, "utf8")];
  if (fs.existsSync(systemUiPath)) parts.push(fs.readFileSync(systemUiPath, "utf8"));
  res.type("application/javascript");
  res.set("Cache-Control", "public, max-age=0, must-revalidate");
  res.send(parts.join("\n\n"));
}

express.static = function patchedStatic(root, options) {
  const staticMiddleware = originalStatic.call(this, root, options);

  return function systemChangeStatic(req, res, next) {
    const requestPath = (req.path || req.url.split("?")[0] || "").replace(/^\//, "");
    if (["GET", "HEAD"].includes(req.method) && requestPath === "reports.js") {
      try {
        return sendEnhancedReportsScript(res, root);
      } catch (error) {
        return next(error);
      }
    }

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
