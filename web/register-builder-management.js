const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");
const userManagement = require("./user-management");

const originalListen = express.application.listen;
const attachedApps = new WeakSet();
const schemaPath = path.join(__dirname, "db", "schema.sql");
const sessionTokenStorageHeader = "x-session-token";
const allowedBlockTypes = new Set([
  "section.hero",
  "section.services",
  "section.cta",
  "section.faq",
  "section.testimonials",
  "section.gallery",
  "section.form",
  "section.footer"
]);

let pool = null;
let schemaReady = null;
const memoryStore = createMemoryStore();

const starterContent = {
  version: 1,
  blocks: [
    {
      id: makeId(),
      type: "section.hero",
      name: "Hero",
      content: {
        eyebrow: "Manual Builder",
        heading: "Build pages visually",
        body: "Create, preview, save, and publish structured website pages without editing raw HTML or CSS.",
        primaryButton: "Start a draft",
        secondaryButton: "Preview page"
      },
      style: { background: "#101010", text: "#ffffff", align: "left" },
      responsive: { desktop: {}, tablet: {}, mobile: { columns: 1 } },
      children: []
    },
    {
      id: makeId(),
      type: "section.services",
      name: "Service Cards",
      content: {
        heading: "Services",
        items: ["Homepage design", "Landing pages", "Contact forms"]
      },
      style: { background: "#ffffff", text: "#202123", columns: 3 },
      responsive: { desktop: {}, tablet: { columns: 2 }, mobile: { columns: 1 } },
      children: []
    }
  ]
};

const pageTemplates = [
  template("homepage", "Homepage", "Page templates", starterContent.blocks),
  template("about", "About page", "Page templates", [heroBlock("About us"), textBlock("Our story", "Share the company background, promise, and proof points."), ctaBlock()]),
  template("services", "Services page", "Page templates", [heroBlock("Services"), servicesBlock(), faqBlock()]),
  template("contact", "Contact page", "Page templates", [heroBlock("Contact us"), formBlock("Contact request"), footerBlock()]),
  template("appraisal", "Appraisal page", "Page templates", [heroBlock("Request an appraisal"), formBlock("Appraisal request"), faqBlock()]),
  template("hero", "Hero section", "Sections", [heroBlock("Hero headline")]),
  template("faq", "FAQ section", "Sections", [faqBlock()]),
  template("testimonial", "Testimonials", "Sections", [testimonialBlock()]),
  template("gallery", "Gallery", "Sections", [galleryBlock()]),
  template("footer", "Footer", "Sections", [footerBlock()])
];

function makeId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function appError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanString(value, fallback = "", maxLength = 240) {
  const text = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;
  return text.trim().slice(0, maxLength) || fallback;
}

function slugify(value, fallback = "page") {
  const slug = cleanString(value, fallback, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function template(id, name, category, blocks) {
  return { id, name, category, content: { version: 1, blocks: clone(blocks) } };
}

function heroBlock(heading) {
  return { id: makeId(), type: "section.hero", name: "Hero", content: { eyebrow: "Welcome", heading, body: "Edit this section manually from the Builder inspector.", primaryButton: "Get started", secondaryButton: "Learn more" }, style: { background: "#101010", text: "#ffffff", align: "left" }, responsive: { desktop: {}, tablet: {}, mobile: { columns: 1 } }, children: [] };
}

function textBlock(heading, body) {
  return { id: makeId(), type: "section.cta", name: "Content", content: { heading, body, primaryButton: "Contact us", secondaryButton: "" }, style: { background: "#f7f7f4", text: "#202123", align: "left" }, responsive: { desktop: {}, tablet: {}, mobile: {} }, children: [] };
}

function servicesBlock() {
  return { id: makeId(), type: "section.services", name: "Service Cards", content: { heading: "Services", items: ["Planning", "Design", "Publishing"] }, style: { background: "#ffffff", text: "#202123", columns: 3 }, responsive: { desktop: {}, tablet: { columns: 2 }, mobile: { columns: 1 } }, children: [] };
}

function ctaBlock() {
  return { id: makeId(), type: "section.cta", name: "Call to Action", content: { heading: "Ready to start?", body: "Use the manual editor to refine this section.", primaryButton: "Contact us" }, style: { background: "#10a37f", text: "#ffffff", align: "center" }, responsive: { desktop: {}, tablet: {}, mobile: {} }, children: [] };
}

function faqBlock() {
  return { id: makeId(), type: "section.faq", name: "FAQ", content: { heading: "Frequently asked questions", items: ["What can I edit?", "How do drafts work?", "Can I roll back published pages?"] }, style: { background: "#ffffff", text: "#202123" }, responsive: { desktop: {}, tablet: {}, mobile: {} }, children: [] };
}

function testimonialBlock() {
  return { id: makeId(), type: "section.testimonials", name: "Testimonials", content: { heading: "What clients say", items: ["Professional and easy to update.", "The page workflow is clear."] }, style: { background: "#f2f2ee", text: "#202123" }, responsive: { desktop: {}, tablet: {}, mobile: {} }, children: [] };
}

function galleryBlock() {
  return { id: makeId(), type: "section.gallery", name: "Gallery", content: { heading: "Gallery", items: ["Add media from the library", "Reuse published assets", "Track usage safely"] }, style: { background: "#ffffff", text: "#202123", columns: 3 }, responsive: { desktop: {}, tablet: { columns: 2 }, mobile: { columns: 1 } }, children: [] };
}

function formBlock(name) {
  return { id: makeId(), type: "section.form", name, content: { heading: name, fields: ["Name", "Email", "Phone", "Message"], successMessage: "Thanks. We received your request." }, style: { background: "#f7f7f4", text: "#202123" }, responsive: { desktop: {}, tablet: {}, mobile: {} }, children: [] };
}

function footerBlock() {
  return { id: makeId(), type: "section.footer", name: "Footer", content: { heading: "Switchboard", body: "Footer links and contact details." }, style: { background: "#050505", text: "#ffffff", align: "left" }, responsive: { desktop: {}, tablet: {}, mobile: {} }, children: [] };
}

function suppliedToken(req, headerName) {
  return req.get(headerName) || req.get("authorization")?.replace(/^Bearer\s+/i, "");
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
  const sessionToken = req.get(sessionTokenStorageHeader);
  if (!sessionToken) return null;
  return currentUserStore(req).getSessionUser(sessionToken).catch(() => null);
}

async function requireBuilderAccess(req, res, next) {
  try {
    const session = await getSession(req);
    if (["owner", "admin"].includes(session?.user?.role)) {
      req.builderActor = session.user;
      return next();
    }
    if (process.env.ADMIN_TOKEN && suppliedToken(req, "x-admin-token") === process.env.ADMIN_TOKEN) {
      req.builderActor = null;
      return next();
    }
    return res.status(403).json({ error: "Builder access requires an owner or admin session." });
  } catch (error) {
    return next(error);
  }
}

function actorId(req) {
  return req.builderActor?.id || null;
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

async function ensureSchema() {
  const db = getPool();
  if (!db) return null;
  if (!schemaReady) {
    schemaReady = (async () => {
      if (fs.existsSync(schemaPath)) await db.query(fs.readFileSync(schemaPath, "utf8"));
      await db.query(builderSchemaSql);
    })();
  }
  await schemaReady;
  return db;
}

const builderSchemaSql = `
CREATE TABLE IF NOT EXISTS builder_pages (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_homepage BOOLEAN NOT NULL DEFAULT FALSE,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_version_id UUID,
  created_by_user_id UUID,
  updated_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS builder_page_drafts (
  page_id UUID PRIMARY KEY REFERENCES builder_pages(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}'::jsonb,
  autosave_content JSONB,
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS builder_page_versions (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES builder_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_html TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, version_number)
);
CREATE TABLE IF NOT EXISTS builder_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS builder_media_assets (
  id UUID PRIMARY KEY,
  file_name TEXT NOT NULL,
  alt_text TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS builder_forms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  form_type TEXT NOT NULL DEFAULT 'contact',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS builder_form_fields (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES builder_forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS builder_form_submissions (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES builder_forms(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS builder_navigation_items (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL,
  page_id UUID REFERENCES builder_pages(id) ON DELETE SET NULL,
  href TEXT,
  parent_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'published'
);
CREATE TABLE IF NOT EXISTS builder_audit_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS builder_pages_status_updated_idx ON builder_pages(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS builder_versions_page_created_idx ON builder_page_versions(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS builder_media_active_idx ON builder_media_assets(deleted_at, updated_at DESC);
`;

function pageRow(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    isHomepage: Boolean(row.is_homepage ?? row.isHomepage),
    seo: row.seo || {},
    publishedVersionId: row.published_version_id || row.publishedVersionId || null,
    createdAt: new Date(row.created_at || row.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt || Date.now()).toISOString(),
    archivedAt: row.archived_at || row.archivedAt ? new Date(row.archived_at || row.archivedAt).toISOString() : null
  };
}

function draftRow(row) {
  return {
    pageId: row.page_id || row.pageId,
    content: normalizeContent(row.content || starterContent),
    autosaveContent: row.autosave_content || row.autosaveContent || null,
    updatedAt: new Date(row.updated_at || row.updatedAt || Date.now()).toISOString()
  };
}

function versionRow(row) {
  return {
    id: row.id,
    pageId: row.page_id || row.pageId,
    versionNumber: Number(row.version_number || row.versionNumber || 1),
    content: normalizeContent(row.content || starterContent),
    seo: row.seo || {},
    renderedHtml: row.rendered_html || row.renderedHtml || "",
    warnings: row.warnings || [],
    createdAt: new Date(row.created_at || row.createdAt || Date.now()).toISOString()
  };
}

function mediaRow(row) {
  return {
    id: row.id,
    fileName: row.file_name || row.fileName,
    altText: row.alt_text || row.altText || "",
    mimeType: row.mime_type || row.mimeType,
    fileSize: Number(row.file_size || row.fileSize || 0),
    contentUrl: row.content_url || row.contentUrl,
    metadata: row.metadata || {},
    usageRefs: row.usage_refs || row.usageRefs || [],
    createdAt: new Date(row.created_at || row.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt || Date.now()).toISOString()
  };
}

function normalizeBlock(block = {}) {
  const type = cleanString(block.type, "", 80);
  if (!allowedBlockTypes.has(type)) throw appError(400, `Unsupported builder block type: ${type || "blank"}.`);
  return {
    id: cleanString(block.id, makeId(), 80),
    type,
    name: cleanString(block.name, type.replace("section.", ""), 120),
    content: cleanContent(block.content || {}),
    style: cleanStyle(block.style || {}),
    responsive: cleanResponsive(block.responsive || {}),
    children: Array.isArray(block.children) ? block.children.slice(0, 20).map(normalizeBlock) : []
  };
}

function cleanContent(content) {
  const result = {};
  for (const [key, value] of Object.entries(content).slice(0, 40)) {
    if (Array.isArray(value)) result[key] = value.slice(0, 20).map((item) => cleanString(item, "", 300));
    else if (typeof value === "object" && value) result[key] = cleanContent(value);
    else result[key] = cleanString(value, "", 1200);
  }
  return result;
}

function cleanStyle(style) {
  const result = {};
  for (const [key, value] of Object.entries(style).slice(0, 30)) {
    if (["background", "text", "align", "columns", "padding", "container", "fontSize"].includes(key)) result[key] = cleanString(value, "", 80);
  }
  return result;
}

function cleanResponsive(value) {
  const result = {};
  for (const key of ["desktop", "tablet", "mobile"]) {
    result[key] = value[key] && typeof value[key] === "object" ? cleanStyle(value[key]) : {};
  }
  return result;
}

function normalizeContent(content = {}) {
  const blocks = Array.isArray(content.blocks) ? content.blocks.slice(0, 80).map(normalizeBlock) : [];
  return { version: 1, blocks };
}

function cleanSeo(seo = {}) {
  return {
    title: cleanString(seo.title, "", 70),
    description: cleanString(seo.description, "", 180),
    canonicalUrl: cleanString(seo.canonicalUrl, "", 240),
    ogTitle: cleanString(seo.ogTitle, "", 90),
    ogDescription: cleanString(seo.ogDescription, "", 180),
    ogImage: cleanString(seo.ogImage, "", 240),
    robots: cleanString(seo.robots, "index,follow", 60)
  };
}

function validatePublish(page, content) {
  const warnings = [];
  if (!page.title || page.title.length < 3) warnings.push("Page title is missing or too short.");
  if (!page.seo?.title) warnings.push("SEO title is missing.");
  if (!page.seo?.description) warnings.push("Meta description is missing.");
  if (!content.blocks.length) warnings.push("Page is empty.");
  for (const block of content.blocks) {
    if (block.type.includes("gallery") && !block.content.items?.length) warnings.push(`${block.name} has no gallery items.`);
    if (block.type.includes("hero") && !block.content.heading) warnings.push(`${block.name} is missing a heading.`);
    if (JSON.stringify(block.content).includes("javascript:")) warnings.push(`${block.name} includes an unsafe link value.`);
  }
  return warnings;
}

function htmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderBlock(block) {
  const bg = htmlEscape(block.style.background || "#ffffff");
  const text = htmlEscape(block.style.text || "#202123");
  const align = htmlEscape(block.style.align || "left");
  const heading = htmlEscape(block.content.heading || block.name);
  const body = htmlEscape(block.content.body || "");
  const items = Array.isArray(block.content.items) ? block.content.items : [];
  if (block.type === "section.services" || block.type === "section.gallery" || block.type === "section.testimonials" || block.type === "section.faq") {
    return `<section class="builder-published-section ${htmlEscape(block.type.replace(".", "-"))}" style="background:${bg};color:${text};text-align:${align}"><div class="builder-published-container"><h2>${heading}</h2><div class="builder-published-grid">${items.map((item) => `<article><h3>${htmlEscape(item)}</h3><p>${block.type === "section.faq" ? "Edit this answer in Builder." : "Structured reusable content block."}</p></article>`).join("")}</div></div></section>`;
  }
  if (block.type === "section.form") {
    return `<section class="builder-published-section" style="background:${bg};color:${text};text-align:${align}"><div class="builder-published-container"><h2>${heading}</h2><form class="builder-published-form">${(block.content.fields || []).map((field) => `<label>${htmlEscape(field)}<input type="text" name="${htmlEscape(slugify(field))}" /></label>`).join("")}<button type="button">Submit</button></form></div></section>`;
  }
  return `<section class="builder-published-section ${htmlEscape(block.type.replace(".", "-"))}" style="background:${bg};color:${text};text-align:${align}"><div class="builder-published-container"><p>${htmlEscape(block.content.eyebrow || "")}</p><h1>${heading}</h1><p>${body}</p>${block.content.primaryButton ? `<a href="#">${htmlEscape(block.content.primaryButton)}</a>` : ""}</div></section>`;
}

function renderPageHtml(page, content) {
  const body = content.blocks.map(renderBlock).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlEscape(page.seo?.title || page.title)}</title><meta name="description" content="${htmlEscape(page.seo?.description || "")}"><style>body{margin:0;font-family:Inter,system-ui,sans-serif;color:#202123}.builder-published-section{padding:72px 24px}.builder-published-container{width:min(1120px,100%);margin:auto}.builder-published-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.builder-published-grid article,.builder-published-form{border:1px solid #ddd;border-radius:8px;padding:16px;background:rgba(255,255,255,.72)}.builder-published-form{display:grid;gap:12px}.builder-published-form label{display:grid;gap:6px}.builder-published-form input{min-height:40px;padding:0 10px}a,button{display:inline-flex;min-height:40px;align-items:center;padding:0 14px;border-radius:8px;border:1px solid currentColor;color:inherit;text-decoration:none;font-weight:800}@media(max-width:720px){.builder-published-section{padding:44px 16px}}</style></head><body>${body}</body></html>`;
}

function createMemoryStore() {
  const pages = new Map();
  const drafts = new Map();
  const versions = new Map();
  const media = new Map();
  const audit = [];
  const homeId = makeId();
  pages.set(homeId, pageRow({ id: homeId, title: "Home", slug: "home", status: "draft", isHomepage: true, seo: { title: "Home", description: "Draft homepage" }, createdAt: now(), updatedAt: now() }));
  drafts.set(homeId, { pageId: homeId, content: clone(starterContent), autosaveContent: null, updatedAt: now() });
  return {
    async listPages() { return [...pages.values()].filter((page) => !page.archivedAt); },
    async createPage(payload, actor) {
      const page = pageRow({ id: makeId(), title: cleanString(payload.title, "Untitled page", 120), slug: slugify(payload.slug || payload.title), status: "draft", isHomepage: false, seo: cleanSeo(payload.seo), createdAt: now(), updatedAt: now() });
      if ([...pages.values()].some((item) => item.slug === page.slug)) throw appError(409, "A page with this slug already exists.");
      pages.set(page.id, page);
      drafts.set(page.id, { pageId: page.id, content: normalizeContent(payload.content || starterContent), autosaveContent: null, updatedAt: now() });
      audit.unshift({ id: makeId(), actorUserId: actor, action: "page.created", targetType: "page", targetId: page.id, details: { title: page.title }, createdAt: now() });
      return page;
    },
    async getPage(pageId) { return pages.get(pageId) || null; },
    async updatePage(pageId, payload) {
      const page = pages.get(pageId);
      if (!page) return null;
      if (payload.title) page.title = cleanString(payload.title, page.title, 120);
      if (payload.slug) page.slug = slugify(payload.slug, page.slug);
      if (payload.seo) page.seo = cleanSeo(payload.seo);
      page.updatedAt = now();
      pages.set(pageId, page);
      return page;
    },
    async getDraft(pageId) { return drafts.get(pageId) || null; },
    async saveDraft(pageId, content) { const draft = { pageId, content: normalizeContent(content), autosaveContent: null, updatedAt: now() }; drafts.set(pageId, draft); return draft; },
    async autosaveDraft(pageId, content) { const draft = drafts.get(pageId); if (!draft) return null; draft.autosaveContent = normalizeContent(content); draft.updatedAt = now(); return draft; },
    async publish(pageId, actor) {
      const page = pages.get(pageId);
      const draft = drafts.get(pageId);
      if (!page || !draft) return null;
      const warnings = validatePublish(page, draft.content);
      const versionList = versions.get(pageId) || [];
      const version = versionRow({ id: makeId(), pageId, versionNumber: versionList.length + 1, content: draft.content, seo: page.seo, renderedHtml: renderPageHtml(page, draft.content), warnings, createdAt: now() });
      versionList.unshift(version);
      versions.set(pageId, versionList);
      page.status = "published";
      page.publishedVersionId = version.id;
      page.updatedAt = now();
      pages.set(pageId, page);
      audit.unshift({ id: makeId(), actorUserId: actor, action: "page.published", targetType: "page", targetId: pageId, details: { versionNumber: version.versionNumber, warnings }, createdAt: now() });
      return { page, version, warnings };
    },
    async listVersions(pageId) { return versions.get(pageId) || []; },
    async rollback(pageId, versionId) { const list = versions.get(pageId) || []; const version = list.find((item) => item.id === versionId); if (!version) return null; return this.saveDraft(pageId, version.content); },
    async publishedBySlug(slug) { const page = [...pages.values()].find((item) => item.slug === slug && item.status === "published"); if (!page) return null; return (versions.get(page.id) || []).find((item) => item.id === page.publishedVersionId) || null; },
    async listMedia() { return [...media.values()]; },
    async createMedia(payload) { const asset = mediaRow({ id: makeId(), fileName: cleanString(payload.fileName, "Asset", 160), altText: cleanString(payload.altText, "", 180), mimeType: cleanString(payload.mimeType, "application/octet-stream", 120), fileSize: Number(payload.fileSize || 0), contentUrl: cleanString(payload.contentUrl, "", 1200), metadata: payload.metadata || {}, usageRefs: [], createdAt: now(), updatedAt: now() }); media.set(asset.id, asset); return asset; },
    async listAudit() { return audit.slice(0, 100); }
  };
}

function postgresStore(db) {
  return {
    async listPages() { const result = await db.query("SELECT * FROM builder_pages WHERE archived_at IS NULL ORDER BY is_homepage DESC, updated_at DESC"); return result.rows.map(pageRow); },
    async createPage(payload, actor) {
      const pageId = makeId();
      const page = { title: cleanString(payload.title, "Untitled page", 120), slug: slugify(payload.slug || payload.title), seo: cleanSeo(payload.seo) };
      const result = await db.query("INSERT INTO builder_pages (id, title, slug, seo, created_by_user_id, updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$5) RETURNING *", [pageId, page.title, page.slug, page.seo, actor]);
      await db.query("INSERT INTO builder_page_drafts (page_id, content, updated_by_user_id) VALUES ($1,$2,$3)", [pageId, normalizeContent(payload.content || starterContent), actor]);
      await auditPostgres(db, actor, "page.created", "page", pageId, { title: page.title });
      return pageRow(result.rows[0]);
    },
    async getPage(pageId) { const result = await db.query("SELECT * FROM builder_pages WHERE id = $1", [pageId]); return result.rows[0] ? pageRow(result.rows[0]) : null; },
    async updatePage(pageId, payload, actor) {
      const existing = await this.getPage(pageId);
      if (!existing) return null;
      const title = Object.hasOwn(payload, "title") ? cleanString(payload.title, existing.title, 120) : existing.title;
      const slug = Object.hasOwn(payload, "slug") ? slugify(payload.slug, existing.slug) : existing.slug;
      const seo = Object.hasOwn(payload, "seo") ? cleanSeo(payload.seo) : existing.seo;
      const result = await db.query("UPDATE builder_pages SET title=$2, slug=$3, seo=$4, updated_by_user_id=$5, updated_at=NOW() WHERE id=$1 RETURNING *", [pageId, title, slug, seo, actor]);
      return pageRow(result.rows[0]);
    },
    async getDraft(pageId) { const result = await db.query("SELECT * FROM builder_page_drafts WHERE page_id = $1", [pageId]); return result.rows[0] ? draftRow(result.rows[0]) : null; },
    async saveDraft(pageId, content, actor) { const result = await db.query("UPDATE builder_page_drafts SET content=$2, autosave_content=NULL, updated_by_user_id=$3, updated_at=NOW() WHERE page_id=$1 RETURNING *", [pageId, normalizeContent(content), actor]); return result.rows[0] ? draftRow(result.rows[0]) : null; },
    async autosaveDraft(pageId, content, actor) { const result = await db.query("UPDATE builder_page_drafts SET autosave_content=$2, updated_by_user_id=$3, updated_at=NOW() WHERE page_id=$1 RETURNING *", [pageId, normalizeContent(content), actor]); return result.rows[0] ? draftRow(result.rows[0]) : null; },
    async publish(pageId, actor) {
      const page = await this.getPage(pageId);
      const draft = await this.getDraft(pageId);
      if (!page || !draft) return null;
      const warnings = validatePublish(page, draft.content);
      const versionNumber = Number((await db.query("SELECT COALESCE(MAX(version_number),0)+1 AS next FROM builder_page_versions WHERE page_id=$1", [pageId])).rows[0].next);
      const renderedHtml = renderPageHtml(page, draft.content);
      const versionId = makeId();
      const versionResult = await db.query("INSERT INTO builder_page_versions (id, page_id, version_number, content, seo, rendered_html, warnings, published_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [versionId, pageId, versionNumber, draft.content, page.seo, renderedHtml, warnings, actor]);
      const pageResult = await db.query("UPDATE builder_pages SET status='published', published_version_id=$2, updated_by_user_id=$3, updated_at=NOW() WHERE id=$1 RETURNING *", [pageId, versionId, actor]);
      await auditPostgres(db, actor, "page.published", "page", pageId, { versionNumber, warnings });
      return { page: pageRow(pageResult.rows[0]), version: versionRow(versionResult.rows[0]), warnings };
    },
    async listVersions(pageId) { const result = await db.query("SELECT * FROM builder_page_versions WHERE page_id=$1 ORDER BY version_number DESC", [pageId]); return result.rows.map(versionRow); },
    async rollback(pageId, versionId, actor) { const result = await db.query("SELECT * FROM builder_page_versions WHERE page_id=$1 AND id=$2", [pageId, versionId]); if (!result.rows[0]) return null; return this.saveDraft(pageId, result.rows[0].content, actor); },
    async publishedBySlug(slug) { const result = await db.query("SELECT v.* FROM builder_pages p JOIN builder_page_versions v ON v.id=p.published_version_id WHERE p.slug=$1 AND p.status='published'", [slugify(slug)]); return result.rows[0] ? versionRow(result.rows[0]) : null; },
    async listMedia() { const result = await db.query("SELECT * FROM builder_media_assets WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200"); return result.rows.map(mediaRow); },
    async createMedia(payload, actor) { const result = await db.query("INSERT INTO builder_media_assets (id, file_name, alt_text, mime_type, file_size, content_url, metadata, created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [makeId(), cleanString(payload.fileName, "Asset", 160), cleanString(payload.altText, "", 180), cleanString(payload.mimeType, "application/octet-stream", 120), Number(payload.fileSize || 0), cleanString(payload.contentUrl, "", 1200), payload.metadata || {}, actor]); return mediaRow(result.rows[0]); },
    async listAudit() { const result = await db.query("SELECT * FROM builder_audit_events ORDER BY created_at DESC LIMIT 100"); return result.rows.map((row) => ({ id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, details: row.details || {}, createdAt: new Date(row.created_at).toISOString() })); }
  };
}

async function auditPostgres(db, actor, action, targetType, targetId, details = {}) {
  await db.query("INSERT INTO builder_audit_events (id, actor_user_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5,$6)", [makeId(), actor, action, targetType, targetId, details]).catch(() => {});
}

async function store() {
  const db = await ensureSchema();
  return db ? postgresStore(db) : memoryStore;
}

function attachBuilderRoutes(app) {
  app.get("/api/builder/block-registry", requireBuilderAccess, (req, res) => {
    res.json({ blocks: [...allowedBlockTypes].map((type) => ({ type, label: type.replace("section.", "") })) });
  });
  app.get("/api/builder/templates", requireBuilderAccess, (req, res) => res.json({ templates: pageTemplates }));
  app.get("/api/builder/pages", requireBuilderAccess, async (req, res, next) => { try { res.json({ pages: await (await store()).listPages() }); } catch (error) { next(error); } });
  app.post("/api/builder/pages", requireBuilderAccess, async (req, res, next) => { try { res.status(201).json({ page: await (await store()).createPage(req.body || {}, actorId(req)) }); } catch (error) { next(error); } });
  app.patch("/api/builder/pages/:pageId", requireBuilderAccess, async (req, res, next) => { try { const page = await (await store()).updatePage(req.params.pageId, req.body || {}, actorId(req)); page ? res.json({ page }) : res.status(404).json({ error: "Builder page not found." }); } catch (error) { next(error); } });
  app.get("/api/builder/pages/:pageId/draft", requireBuilderAccess, async (req, res, next) => { try { const db = await store(); const [page, draft] = await Promise.all([db.getPage(req.params.pageId), db.getDraft(req.params.pageId)]); page && draft ? res.json({ page, draft }) : res.status(404).json({ error: "Builder draft not found." }); } catch (error) { next(error); } });
  app.put("/api/builder/pages/:pageId/draft", requireBuilderAccess, async (req, res, next) => { try { const draft = await (await store()).saveDraft(req.params.pageId, req.body?.content || {}, actorId(req)); draft ? res.json({ draft }) : res.status(404).json({ error: "Builder draft not found." }); } catch (error) { next(error); } });
  app.post("/api/builder/pages/:pageId/autosave", requireBuilderAccess, async (req, res, next) => { try { const draft = await (await store()).autosaveDraft(req.params.pageId, req.body?.content || {}, actorId(req)); draft ? res.json({ draft }) : res.status(404).json({ error: "Builder draft not found." }); } catch (error) { next(error); } });
  app.post("/api/builder/pages/:pageId/publish", requireBuilderAccess, async (req, res, next) => { try { const result = await (await store()).publish(req.params.pageId, actorId(req)); result ? res.status(201).json(result) : res.status(404).json({ error: "Builder page not found." }); } catch (error) { next(error); } });
  app.get("/api/builder/pages/:pageId/versions", requireBuilderAccess, async (req, res, next) => { try { res.json({ versions: await (await store()).listVersions(req.params.pageId) }); } catch (error) { next(error); } });
  app.post("/api/builder/pages/:pageId/rollback", requireBuilderAccess, async (req, res, next) => { try { const draft = await (await store()).rollback(req.params.pageId, req.body?.versionId, actorId(req)); draft ? res.json({ draft }) : res.status(404).json({ error: "Published version not found." }); } catch (error) { next(error); } });
  app.get("/api/builder/media", requireBuilderAccess, async (req, res, next) => { try { res.json({ media: await (await store()).listMedia() }); } catch (error) { next(error); } });
  app.post("/api/builder/media", requireBuilderAccess, async (req, res, next) => { try { res.status(201).json({ asset: await (await store()).createMedia(req.body || {}, actorId(req)) }); } catch (error) { next(error); } });
  app.get("/api/builder/audit-events", requireBuilderAccess, async (req, res, next) => { try { res.json({ events: await (await store()).listAudit() }); } catch (error) { next(error); } });
  app.get("/api/builder/published/:slug", async (req, res, next) => { try { const version = await (await store()).publishedBySlug(req.params.slug); version ? res.json({ version }) : res.status(404).json({ error: "Published page not found." }); } catch (error) { next(error); } });
  app.get("/builder/pages/:slug", async (req, res, next) => { try { const version = await (await store()).publishedBySlug(req.params.slug); if (!version) return res.status(404).send("Published page not found."); res.type("html").send(version.renderedHtml); } catch (error) { next(error); } });
}

express.application.listen = function patchedBuilderListen(...args) {
  if (!attachedApps.has(this)) {
    attachBuilderRoutes(this);
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};
