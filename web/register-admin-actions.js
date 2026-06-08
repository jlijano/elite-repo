const fs = require("fs");
const path = require("path");
const express = require("express");
const { Pool } = require("pg");
const userManagement = require("./user-management");

const originalListen = express.application.listen;
const originalStatic = express.static;
const attachedApps = new WeakSet();
const publicDir = path.join(__dirname, "public");
const schemaPath = path.join(__dirname, "db", "schema.sql");
const maxLogoUrlLength = 2000;
const maxLogoDataUrlLength = 750000;
const logoDataUrlPattern = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i;

let pool = null;
let schemaReady = null;

function suppliedToken(req, headerName) {
  return req.get(headerName) || req.get("authorization")?.replace(/^Bearer\s+/i, "");
}

function adminTokenMatches(req) {
  return Boolean(process.env.ADMIN_TOKEN && suppliedToken(req, "x-admin-token") === process.env.ADMIN_TOKEN);
}

const fallbackUserStore = userManagement.createUserManagementStore({
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL,
  schemaPath
});

function currentUserStore(req) {
  return req?.app?.locals?.userManagementStore || fallbackUserStore;
}

async function getSession(req) {
  const sessionToken = req.get("x-session-token");
  if (!sessionToken) return null;
  return currentUserStore(req).getSessionUser(sessionToken);
}

async function requireAdmin(req, res, next) {
  try {
    const session = await getSession(req);
    if (["owner", "admin"].includes(session?.user?.role) || adminTokenMatches(req)) {
      req.adminActor = session?.user || null;
      return next();
    }
    return res.status(403).json({ error: "Admin access is required." });
  } catch (error) {
    return next(error);
  }
}

async function requireGlobalAdmin(req, res, next) {
  try {
    const session = await getSession(req);
    if (session?.user?.role === "owner" || adminTokenMatches(req)) {
      req.adminActor = session?.user || null;
      return next();
    }
    return res.status(403).json({ error: "Super or global admin access is required." });
  } catch (error) {
    return next(error);
  }
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /^(true|1|yes)$/i.test(process.env.DATABASE_SSL || "")
        ? { rejectUnauthorized: false }
        : undefined
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return null;
  if (!schemaReady) {
    schemaReady = (async () => {
      if (fs.existsSync(schemaPath)) {
        await db.query(fs.readFileSync(schemaPath, "utf8"));
      }
      await db.query("ALTER TABLE entra_companies ADD COLUMN IF NOT EXISTS logo_url TEXT");
    })();
  }
  await schemaReady;
  return db;
}

function cleanLogoUrl(value) {
  const logo = typeof value === "string" ? value.trim() : "";
  if (!logo) return "";
  if (/^https?:\/\//i.test(logo)) {
    if (logo.length > maxLogoUrlLength) throw Object.assign(new Error("Company logo URL is too long."), { status: 400 });
    return logo;
  }
  if (logoDataUrlPattern.test(logo)) {
    const compactLogo = logo.replace(/\s/g, "");
    if (compactLogo.length > maxLogoDataUrlLength) {
      throw Object.assign(new Error("Uploaded company logo is too large."), { status: 400 });
    }
    return compactLogo;
  }
  throw Object.assign(new Error("Company logo must be an http:// or https:// URL, or an uploaded PNG, JPG, GIF, or WebP image."), { status: 400 });
}

function actorDetails(req) {
  const actor = req.adminActor || {};
  return {
    actorUserId: actor.id || null,
    actorName: actor.name || null,
    actorEmail: actor.email || null
  };
}

async function writeAudit(db, action, details = {}) {
  await db.query(
    `INSERT INTO user_audit_events (actor_user_id, actor_name, actor_email, target_user_id, target_name, target_email, action, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      details.actorUserId || null,
      details.actorName || null,
      details.actorEmail || null,
      details.targetUserId || null,
      details.targetName || null,
      details.targetEmail || null,
      action,
      details
    ]
  );
}

async function writeAuditSafely(db, action, details = {}) {
  try {
    await writeAudit(db, action, details);
  } catch (error) {
    // The delete already succeeded; audit storage should not resurrect it.
  }
}

function databaseRequired(res) {
  res.status(501).json({ error: "Permanent delete and company logo storage require persistent database storage." });
}

function attachmentIndexFromRequest(req) {
  const index = Number(req.params.attachmentIndex);
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function safeMessageContext(row = {}) {
  const context = row.context && typeof row.context === "object" && !Array.isArray(row.context) ? row.context : {};
  return { ...context };
}

function attachmentSummary(attachment = {}) {
  return {
    name: attachment.name || "Attachment",
    type: attachment.type || "",
    size: Number(attachment.size || 0)
  };
}

function attachAdminActionRoutes(app) {
  app.get("/api/admin/entra/company-logos", requireAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const result = await db.query("SELECT id, logo_url FROM entra_companies WHERE logo_url IS NOT NULL AND logo_url <> ''");
      return res.json({
        logos: result.rows.map((row) => ({ id: row.id, logoUrl: row.logo_url || "" }))
      });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/admin/entra/companies/:companyId/logo", requireAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const logoUrl = cleanLogoUrl(req.body?.logoUrl);
      const result = await db.query(
        "UPDATE entra_companies SET logo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, logo_url",
        [logoUrl, req.params.companyId]
      );
      if (!result.rowCount) return res.status(404).json({ error: "Company not found." });
      await writeAudit(db, "entra.company.logo_updated", {
        ...actorDetails(req),
        targetName: result.rows[0].name,
        companyId: result.rows[0].id,
        hasLogo: Boolean(logoUrl),
        source: "entra"
      });
      return res.json({
        company: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          logoUrl: result.rows[0].logo_url || ""
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/chats/:chatId", requireGlobalAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const result = await db.query("DELETE FROM chats WHERE id = $1 RETURNING id, title", [req.params.chatId]);
      if (!result.rowCount) return res.status(404).json({ error: "Chat not found." });
      await writeAuditSafely(db, "chat.purged", {
        ...actorDetails(req),
        targetName: result.rows[0].title,
        chatId: result.rows[0].id,
        source: "global-admin-chat"
      });
      return res.json({
        ok: true,
        deleted: { id: result.rows[0].id, title: result.rows[0].title }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/chats/:chatId/messages/:messageId/attachments/:attachmentIndex", requireAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const attachmentIndex = attachmentIndexFromRequest(req);
      if (attachmentIndex < 0) return res.status(400).json({ error: "A valid attachment index is required." });

      const existing = await db.query(
        "SELECT id, chat_id, context FROM chat_messages WHERE chat_id = $1 AND id = $2",
        [req.params.chatId, req.params.messageId]
      );
      if (!existing.rowCount) return res.status(404).json({ error: "Message not found." });

      const context = safeMessageContext(existing.rows[0]);
      const attachments = Array.isArray(context.attachments) ? [...context.attachments] : [];
      if (attachmentIndex >= attachments.length) return res.status(404).json({ error: "Attachment not found." });

      const [deleted] = attachments.splice(attachmentIndex, 1);
      context.attachments = attachments;
      await db.query(
        "UPDATE chat_messages SET context = $3 WHERE chat_id = $1 AND id = $2",
        [req.params.chatId, req.params.messageId, context]
      );
      await db.query("UPDATE chats SET updated_at = NOW() WHERE id = $1", [req.params.chatId]);
      await writeAuditSafely(db, "chat.attachment.deleted", {
        ...actorDetails(req),
        targetName: deleted?.name || "Attachment",
        chatId: req.params.chatId,
        messageId: req.params.messageId,
        attachmentIndex,
        source: "chat-admin-attachments"
      });
      return res.json({ ok: true, deleted: attachmentSummary(deleted) });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/entra/companies/:companyId", requireGlobalAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const result = await db.query("DELETE FROM entra_companies WHERE id = $1 RETURNING id, name", [req.params.companyId]);
      if (!result.rowCount) return res.status(404).json({ error: "Company not found." });
      await writeAudit(db, "entra.company.purged", {
        ...actorDetails(req),
        targetName: result.rows[0].name,
        companyId: result.rows[0].id,
        source: "entra"
      });
      return res.json({ ok: true, deleted: { id: result.rows[0].id, name: result.rows[0].name } });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/entra/departments/:departmentId", requireGlobalAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const result = await db.query("DELETE FROM entra_departments WHERE id = $1 RETURNING id, name", [req.params.departmentId]);
      if (!result.rowCount) return res.status(404).json({ error: "Department not found." });
      await writeAudit(db, "entra.department.purged", {
        ...actorDetails(req),
        targetName: result.rows[0].name,
        departmentId: result.rows[0].id,
        source: "entra"
      });
      return res.json({ ok: true, deleted: { id: result.rows[0].id, name: result.rows[0].name } });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/entra/groups/:groupId", requireGlobalAdmin, async (req, res, next) => {
    try {
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const result = await db.query("DELETE FROM entra_groups WHERE id = $1 RETURNING id, name", [req.params.groupId]);
      if (!result.rowCount) return res.status(404).json({ error: "Group not found." });
      await writeAudit(db, "entra.group.purged", {
        ...actorDetails(req),
        targetName: result.rows[0].name,
        groupId: result.rows[0].id,
        source: "entra"
      });
      return res.json({ ok: true, deleted: { id: result.rows[0].id, name: result.rows[0].name } });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/admin/users/:userId", requireGlobalAdmin, async (req, res, next) => {
    try {
      const actor = req.adminActor;
      if (actor?.id === req.params.userId) {
        return res.status(400).json({ error: "You cannot permanently delete your own signed-in account." });
      }
      const db = await ensureSchema();
      if (!db) return databaseRequired(res);
      const result = await db.query("DELETE FROM users WHERE id = $1 RETURNING id, name, email", [req.params.userId]);
      if (!result.rowCount) return res.status(404).json({ error: "User not found." });
      await writeAudit(db, "user.purged", {
        ...actorDetails(req),
        targetUserId: null,
        targetName: result.rows[0].name,
        targetEmail: result.rows[0].email,
        purgedUserId: result.rows[0].id,
        source: "user-management"
      });
      return res.json({
        ok: true,
        deleted: { id: result.rows[0].id, name: result.rows[0].name, email: result.rows[0].email }
      });
    } catch (error) {
      return next(error);
    }
  });
}

function sendEnhancedJavaScript(res, root, requestedFile, prefixFile, suffixFiles = []) {
  const sourcePath = path.join(root, requestedFile);
  const parts = [];
  const appendPublicFile = (fileName) => {
    const filePath = fileName ? path.join(publicDir, fileName) : "";
    if (filePath && fs.existsSync(filePath)) parts.push(fs.readFileSync(filePath, "utf8"));
  };

  appendPublicFile(prefixFile);
  parts.push(fs.readFileSync(sourcePath, "utf8"));
  for (const fileName of [suffixFiles].flat().filter(Boolean)) appendPublicFile(fileName);
  res.type("application/javascript").send(parts.join("\n\n"));
}

express.static = function patchedStatic(root, options = {}) {
  const middleware = originalStatic.call(this, root, options);
  return function adminActionStatic(req, res, next) {
    if (!["GET", "HEAD"].includes(req.method)) return middleware(req, res, next);
    try {
      const pathname = decodeURIComponent(req.path || req.url || "");
      if (pathname === "/entra-management.js" && fs.existsSync(path.join(root, "entra-management.js"))) {
        return sendEnhancedJavaScript(res, root, "entra-management.js", "entra-admin-enhancements.js", ["entra-company-save-error-polish.js", "action-icon-polish.js"]);
      }
      if (pathname === "/admin.js" && fs.existsSync(path.join(root, "admin.js"))) {
        return sendEnhancedJavaScript(res, root, "admin.js", null, ["chat-purge-enhancements.js", "chat-attachment-management.js", "user-purge-enhancements.js", "user-management-polish.js", "action-icon-polish.js"]);
      }
    } catch (error) {
      return next(error);
    }
    return middleware(req, res, next);
  };
};

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this)) {
    attachAdminActionRoutes(this);
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};