const express = require("express");
const { Pool } = require("pg");

const originalListen = express.application.listen;
const reservedSlugs = new Set([
  "chat",
  "knowledge",
  "company",
  "department",
  "group",
  "user",
  "board",
  "projects",
  "tasks",
  "notes",
  "automation",
  "settings",
  "builder",
  "reports",
  "logs",
  "review-runs",
  "system-health",
  "user-audit",
  "update-profile",
  "login"
]);

let pool = null;

function slugify(value) {
  const slug = String(value || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);
  return slug || "page";
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /^(true|1|yes)$/i.test(process.env.DATABASE_SSL || "") ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

function requestedSlug(body = {}) {
  if (body.slug !== undefined) return slugify(body.slug);
  if (body.title !== undefined) return slugify(body.title);
  return "";
}

function rejectReservedSlug(res, slug) {
  return res.status(409).json({
    error: `${slug} is a protected application page and cannot be managed or published by Builder.`
  });
}

async function publishedPageSlug(pageId) {
  const db = getPool();
  if (!db) return "";
  const result = await db.query("SELECT slug FROM builder_pages WHERE id = $1 LIMIT 1", [pageId]);
  return result.rows[0]?.slug || "";
}

function attachBuilderPageGuard(app) {
  if (app.__builderPageGuardAttached) return;
  Object.defineProperty(app, "__builderPageGuardAttached", { value: true });
  app.use("/api/builder/pages", express.json({ limit: "2mb" }));
  app.use("/api/builder/pages", async (req, res, next) => {
    try {
      if (req.method === "POST" && req.path === "/") {
        const slug = requestedSlug(req.body || {});
        if (reservedSlugs.has(slug)) return rejectReservedSlug(res, slug);
      }

      if (req.method === "PATCH") {
        const slug = requestedSlug(req.body || {});
        if (slug && reservedSlugs.has(slug)) return rejectReservedSlug(res, slug);
      }

      const publishMatch = req.method === "POST" && req.path.match(/^\/([^/]+)\/publish$/);
      if (publishMatch) {
        const slug = slugify(await publishedPageSlug(decodeURIComponent(publishMatch[1])));
        if (reservedSlugs.has(slug)) return rejectReservedSlug(res, slug);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  });
}

express.application.listen = function patchedListen(...args) {
  attachBuilderPageGuard(this);
  return originalListen.apply(this, args);
};

module.exports = { attachBuilderPageGuard, reservedSlugs, slugify };
