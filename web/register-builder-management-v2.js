const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");
const userManagement = require("./user-management");

const originalListen = express.application.listen;
const attachedApps = new WeakSet();
const schemaPath = path.join(__dirname, "db", "schema.sql");
const builderSchemaPath = path.join(__dirname, "db", "builder-schema.sql");

let pool = null;
let schemaReady = null;
let memoryStore = null;

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

const blockRegistry = [
  blockDefinition("section.hero", "Hero", ["eyebrow", "heading", "body", "primaryButton", "secondaryButton"]),
  blockDefinition("section.services", "Services", ["heading", "items"]),
  blockDefinition("section.cta", "Call to action", ["heading", "body", "buttonLabel", "buttonUrl"]),
  blockDefinition("section.faq", "FAQ", ["heading", "items"]),
  blockDefinition("section.testimonials", "Testimonials", ["heading", "items"]),
  blockDefinition("section.gallery", "Gallery", ["heading", "images"]),
  blockDefinition("section.form", "Form", ["heading", "fields", "submitLabel"]),
  blockDefinition("section.footer", "Footer", ["heading", "links", "body"])
];

const starterContent = {
  version: 1,
  blocks: [
    heroBlock("Build pages visually"),
    servicesBlock(),
    ctaBlock()
  ]
};

const templates = [
  template("homepage", "Homepage", "Page templates", starterContent.blocks),
  template("about", "About page", "Page templates", [heroBlock("About us"), testimonialBlock(), ctaBlock()]),
  template("services", "Services page", "Page templates", [heroBlock("Services"), servicesBlock(), faqBlock()]),
  template("contact", "Contact page", "Page templates", [heroBlock("Contact us"), formBlock("Contact request"), footerBlock()]),
  template("appraisal", "Appraisal page", "Page templates", [heroBlock("Request an appraisal"), formBlock("Appraisal request"), faqBlock()]),
  template("hero", "Hero section", "Sections", [heroBlock("Hero headline")]),
  template("faq", "FAQ section", "Sections", [faqBlock()]),
  template("testimonial", "Testimonials", "Sections", [testimonialBlock()]),
  template("gallery", "Gallery", "Sections", [galleryBlock()]),
  template("footer", "Footer", "Sections", [footerBlock()])
];

const fallbackUserStore = userManagement.createUserManagementStore({
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL,
  schemaPath
});

function makeId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  const slug = String(value || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);
  return slug || "page";
}

function blockDefinition(type, label, editableFields) {
  return { type, label, editableFields, supports: ["move", "duplicate", "delete", "responsive", "style"] };
}

function block(type, name, content, style = {}, responsive = {}) {
  return { id: makeId(), type, name, content, style, responsive, children: [] };
}

function heroBlock(heading) {
  return block("section.hero", "Hero", {
    eyebrow: "Manual Builder",
    heading,
    body: "Create, preview, save, and publish structured website pages without raw HTML editing.",
    primaryButton: "Get started",
    secondaryButton: "Learn more"
  }, { background: "#101010", text: "#ffffff", align: "left" }, { mobile: { columns: 1 } });
}

function servicesBlock() {
  return block("section.services", "Service Cards", {
    heading: "Services",
    items: ["Homepage design", "Landing pages", "Contact forms"]
  }, { background: "#ffffff", text: "#202123", columns: 3 }, { tablet: { columns: 2 }, mobile: { columns: 1 } });
}

function ctaBlock() {
  return block("section.cta", "CTA", {
    heading: "Ready to publish?",
    body: "Review warnings, preview the page, and publish a versioned snapshot.",
    buttonLabel: "Contact us",
    buttonUrl: "/contact"
  }, { background: "#f3f4f6", text: "#202123", align: "center" });
}

function faqBlock() {
  return block("section.faq", "FAQ", {
    heading: "Frequently asked questions",
    items: ["Can I edit without code? Yes.", "Can I preview mobile pages? Yes."]
  });
}

function testimonialBlock() {
  return block("section.testimonials", "Testimonials", {
    heading: "Customer proof",
    items: ["Fast to update.", "Simple for non-technical editors."]
  });
}

function galleryBlock() {
  return block("section.gallery", "Gallery", { heading: "Gallery", images: [] });
}

function formBlock(heading) {
  return block("section.form", "Form", {
    heading,
    submitLabel: "Submit",
    fields: [
      { id: makeId(), label: "Name", type: "text", required: true },
      { id: makeId(), label: "Email", type: "email", required: true },
      { id: makeId(), label: "Message", type: "textarea", required: false }
    ]
  });
}

function footerBlock() {
  return block("section.footer", "Footer", {
    heading: "Elite",
    body: "Reusable footer section.",
    links: ["Home", "Services", "Contact"]
  }, { background: "#202123", text: "#ffffff" });
}

function template(id, name, category, blocks) {
  return { id, name, category, content: { version: 1, blocks: clone(blocks) } };
}

function emptyContent() {
  return { version: 1, blocks: [] };
}

function normalizeContent(content) {
  const normalized = content && typeof content === "object" ? clone(content) : emptyContent();
  normalized.version = Number(normalized.version || 1);
  normalized.blocks = Array.isArray(normalized.blocks) ? normalized.blocks.filter((item) => allowedBlockTypes.has(item.type)) : [];
  normalized.blocks.forEach((item) => {
    item.id = item.id || makeId();
    item.name = item.name || blockRegistry.find((entry) => entry.type === item.type)?.label || "Block";
    item.content = item.content && typeof item.content === "object" ? item.content : {};
    item.style = item.style && typeof item.style === "object" ? item.style : {};
    item.responsive = item.responsive && typeof item.responsive === "object" ? item.responsive : {};
    item.children = Array.isArray(item.children) ? item.children.filter((child) => allowedBlockTypes.has(child.type)) : [];
  });
  return normalized;
}

function normalizeSeo(seo = {}) {
  return {
    title: String(seo.title || "").slice(0, 90),
    description: String(seo.description || "").slice(0, 220),
    canonicalUrl: String(seo.canonicalUrl || "").slice(0, 400),
    ogTitle: String(seo.ogTitle || "").slice(0, 120),
    ogDescription: String(seo.ogDescription || "").slice(0, 220),
    ogImage: String(seo.ogImage || "").slice(0, 400),
    robots: String(seo.robots || "index,follow").slice(0, 80)
  };
}

function pageSummary(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    isHomepage: Boolean(row.is_homepage ?? row.isHomepage),
    seo: normalizeSeo(row.seo || {}),
    publishedVersionId: row.published_version_id || row.publishedVersionId || null,
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
  };
}

function suppliedToken(req, headerName) {
  return req.get(headerName) || req.get("authorization")?.replace(/^Bearer\s+/i, "");
}

function adminTokenMatches(req) {
  return Boolean(process.env.ADMIN_TOKEN && suppliedToken(req, "x-admin-token") === process.env.ADMIN_TOKEN);
}

function currentUserStore(req) {
  return req?.app?.locals?.userManagementStore || fallbackUserStore;
}

async function getSession(req) {
  const sessionToken = req.get("x-session-token");
  if (!sessionToken) return null;
  return currentUserStore(req).getSessionUser(sessionToken);
}

async function requireBuilderAdmin(req, res, next) {
  try {
    const session = await getSession(req);
    if (["owner", "admin"].includes(session?.user?.role) || adminTokenMatches(req)) {
      req.builderActor = session?.user || null;
      return next();
    }
    return res.status(403).json({ error: "Builder admin access is required." });
  } catch (error) {
    return next(error);
  }
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
      if (fs.existsSync(builderSchemaPath)) await db.query(fs.readFileSync(builderSchemaPath, "utf8"));
      for (const item of templates) {
        await db.query(
          `INSERT INTO builder_templates (id, name, category, content, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, content = EXCLUDED.content, updated_at = NOW()`,
          [item.id, item.name, item.category, item.content]
        );
      }
    })();
  }
  await schemaReady;
  return db;
}

function getMemoryStore() {
  if (!memoryStore) memoryStore = createMemoryStore();
  return memoryStore;
}

async function store() {
  const db = await ensureSchema();
  return db ? createPgStore(db) : getMemoryStore();
}

function createMemoryStore() {
  const pages = new Map();
  const drafts = new Map();
  const versions = new Map();
  const media = new Map();
  const forms = new Map();
  const submissions = new Map();
  const navigation = [];
  const audit = [];

  function writeAudit(action, actor, details = {}) {
    audit.unshift({ id: makeId(), action, actorUserId: actor?.id || null, actorName: actor?.name || null, details, createdAt: now() });
  }

  const homeId = makeId();
  pages.set(homeId, {
    id: homeId,
    title: "Home",
    slug: "home",
    status: "draft",
    isHomepage: true,
    seo: normalizeSeo({ title: "Home", description: "Homepage draft." }),
    createdAt: now(),
    updatedAt: now()
  });
  drafts.set(homeId, { pageId: homeId, content: clone(starterContent), autosaveContent: null, updatedAt: now() });

  return {
    async blockRegistry() { return blockRegistry; },
    async templates() { return templates; },
    async pages() { return [...pages.values()].map(pageSummary); },
    async createPage(input, actor) {
      const id = makeId();
      const slug = uniqueSlug(slugify(input.slug || input.title), [...pages.values()].map((page) => page.slug));
      const page = { id, title: String(input.title || "Untitled page"), slug, status: "draft", isHomepage: false, seo: normalizeSeo(input.seo || {}), createdAt: now(), updatedAt: now() };
      pages.set(id, page);
      drafts.set(id, { pageId: id, content: normalizeContent(input.content || emptyContent()), autosaveContent: null, updatedAt: now() });
      writeAudit("builder.page.created", actor, { pageId: id, slug });
      return pageSummary(page);
    },
    async updatePage(id, input, actor) {
      const page = pages.get(id);
      if (!page) return null;
      if (input.title !== undefined) page.title = String(input.title || page.title);
      if (input.slug !== undefined) page.slug = uniqueSlug(slugify(input.slug), [...pages.values()].filter((item) => item.id !== id).map((item) => item.slug));
      if (input.status !== undefined && ["draft", "published", "archived"].includes(input.status)) page.status = input.status;
      if (input.isHomepage !== undefined) {
        for (const item of pages.values()) item.isHomepage = false;
        page.isHomepage = Boolean(input.isHomepage);
      }
      if (input.seo !== undefined) page.seo = normalizeSeo(input.seo);
      page.updatedAt = now();
      writeAudit("builder.page.updated", actor, { pageId: id });
      return pageSummary(page);
    },
    async draft(id) { return drafts.get(id) || null; },
    async saveDraft(id, content, actor, autosave = false) {
      if (!pages.has(id)) return null;
      const current = drafts.get(id) || { pageId: id, content: emptyContent(), autosaveContent: null };
      if (autosave) current.autosaveContent = normalizeContent(content);
      else current.content = normalizeContent(content);
      current.updatedAt = now();
      drafts.set(id, current);
      writeAudit(autosave ? "builder.draft.autosaved" : "builder.draft.saved", actor, { pageId: id });
      return current;
    },
    async publish(id, actor) {
      const page = pages.get(id);
      const draft = drafts.get(id);
      if (!page || !draft) return null;
      const content = normalizeContent(draft.content);
      const warnings = publishWarnings(page, content);
      if (warnings.some((warning) => warning.severity === "error")) return { page: pageSummary(page), warnings, published: false };
      const versionList = versions.get(id) || [];
      const version = { id: makeId(), pageId: id, versionNumber: versionList.length + 1, content, seo: normalizeSeo(page.seo), renderedHtml: renderPageHtml(page, content), warnings, publishedByUserId: actor?.id || null, createdAt: now() };
      versionList.unshift(version);
      versions.set(id, versionList);
      page.status = "published";
      page.publishedVersionId = version.id;
      page.updatedAt = now();
      writeAudit("builder.page.published", actor, { pageId: id, versionId: version.id });
      return { page: pageSummary(page), version, warnings, published: true };
    },
    async versions(id) { return versions.get(id) || []; },
    async rollback(pageId, versionId, actor) {
      const version = (versions.get(pageId) || []).find((item) => item.id === versionId);
      if (!version) return null;
      drafts.set(pageId, { pageId, content: normalizeContent(version.content), autosaveContent: null, updatedAt: now() });
      writeAudit("builder.page.rollback", actor, { pageId, versionId });
      return drafts.get(pageId);
    },
    async published(slug) {
      const page = [...pages.values()].find((item) => item.slug === slugify(slug) && item.status === "published");
      const version = page ? (versions.get(page.id) || []).find((item) => item.id === page.publishedVersionId) : null;
      return page && version ? { page: pageSummary(page), version } : null;
    },
    async mediaList() { return [...media.values()]; },
    async createMedia(input, actor) {
      const asset = { id: makeId(), name: String(input.name || "Asset"), url: String(input.url || ""), type: String(input.type || "image"), altText: String(input.altText || ""), metadata: input.metadata || {}, usedByPageIds: [], createdAt: now(), updatedAt: now() };
      media.set(asset.id, asset);
      writeAudit("builder.media.created", actor, { assetId: asset.id });
      return asset;
    },
    async updateMedia(id, input, actor) {
      const asset = media.get(id);
      if (!asset) return null;
      Object.assign(asset, pick(input, ["name", "url", "type", "altText", "metadata"]), { updatedAt: now() });
      writeAudit("builder.media.updated", actor, { assetId: id });
      return asset;
    },
    async deleteMedia(id, actor) {
      const asset = media.get(id);
      if (!asset || asset.usedByPageIds?.length) return { deleted: false, asset };
      media.delete(id);
      writeAudit("builder.media.deleted", actor, { assetId: id });
      return { deleted: true, asset };
    },
    async navigation() { return navigation; },
    async saveNavigation(items, actor) {
      navigation.splice(0, navigation.length, ...items.map((item, index) => ({ id: item.id || makeId(), label: String(item.label || "Link"), pageId: item.pageId || null, url: String(item.url || ""), parentId: item.parentId || null, sortOrder: Number(item.sortOrder ?? index), visible: item.visible !== false })));
      writeAudit("builder.navigation.saved", actor, { count: navigation.length });
      return navigation;
    },
    async formsList() { return [...forms.values()]; },
    async createForm(input, actor) {
      const form = { id: makeId(), name: String(input.name || "Builder form"), fields: Array.isArray(input.fields) ? input.fields : [], notificationEmail: String(input.notificationEmail || ""), captchaEnabled: input.captchaEnabled !== false, createdAt: now(), updatedAt: now() };
      forms.set(form.id, form);
      submissions.set(form.id, []);
      writeAudit("builder.form.created", actor, { formId: form.id });
      return form;
    },
    async submissions(formId) { return submissions.get(formId) || []; },
    async createSubmission(formId, payload) {
      const submission = { id: makeId(), formId, payload: payload || {}, status: "new", createdAt: now() };
      const list = submissions.get(formId) || [];
      list.unshift(submission);
      submissions.set(formId, list);
      return submission;
    },
    async auditEvents() { return audit.slice(0, 100); }
  };
}

function createPgStore(db) {
  return {
    async blockRegistry() { return blockRegistry; },
    async templates() {
      const rows = await db.query("SELECT id, name, category, content FROM builder_templates ORDER BY category, name");
      return rows.rows;
    },
    async pages() {
      const rows = await db.query("SELECT * FROM builder_pages ORDER BY is_homepage DESC, updated_at DESC");
      return rows.rows.map(pageSummary);
    },
    async createPage(input, actor) {
      const id = makeId();
      const slug = slugify(input.slug || input.title);
      const seo = normalizeSeo(input.seo || {});
      const content = normalizeContent(input.content || emptyContent());
      await db.query("INSERT INTO builder_pages (id, title, slug, seo, created_by_user_id, updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$5)", [id, String(input.title || "Untitled page"), slug, seo, actor?.id || null]);
      await db.query("INSERT INTO builder_page_drafts (page_id, content, updated_by_user_id) VALUES ($1,$2,$3)", [id, content, actor?.id || null]);
      await auditPg(db, "builder.page.created", actor, { pageId: id, slug });
      return (await this.pages()).find((page) => page.id === id);
    },
    async updatePage(id, input, actor) {
      const current = await db.query("SELECT * FROM builder_pages WHERE id=$1", [id]);
      if (!current.rowCount) return null;
      const page = current.rows[0];
      const updated = {
        title: input.title !== undefined ? String(input.title || page.title) : page.title,
        slug: input.slug !== undefined ? slugify(input.slug) : page.slug,
        status: input.status !== undefined && ["draft", "published", "archived"].includes(input.status) ? input.status : page.status,
        isHomepage: input.isHomepage !== undefined ? Boolean(input.isHomepage) : page.is_homepage,
        seo: input.seo !== undefined ? normalizeSeo(input.seo) : page.seo
      };
      if (updated.isHomepage) await db.query("UPDATE builder_pages SET is_homepage = FALSE WHERE id <> $1", [id]);
      const rows = await db.query("UPDATE builder_pages SET title=$2, slug=$3, status=$4, is_homepage=$5, seo=$6, updated_by_user_id=$7, updated_at=NOW() WHERE id=$1 RETURNING *", [id, updated.title, updated.slug, updated.status, updated.isHomepage, updated.seo, actor?.id || null]);
      await auditPg(db, "builder.page.updated", actor, { pageId: id });
      return pageSummary(rows.rows[0]);
    },
    async draft(id) {
      const rows = await db.query("SELECT page_id AS \"pageId\", content, autosave_content AS \"autosaveContent\", updated_at AS \"updatedAt\" FROM builder_page_drafts WHERE page_id=$1", [id]);
      return rows.rows[0] || null;
    },
    async saveDraft(id, content, actor, autosave = false) {
      const normalized = normalizeContent(content);
      const sql = autosave
        ? "UPDATE builder_page_drafts SET autosave_content=$2, updated_by_user_id=$3, updated_at=NOW() WHERE page_id=$1 RETURNING page_id AS \"pageId\", content, autosave_content AS \"autosaveContent\", updated_at AS \"updatedAt\""
        : "UPDATE builder_page_drafts SET content=$2, updated_by_user_id=$3, updated_at=NOW() WHERE page_id=$1 RETURNING page_id AS \"pageId\", content, autosave_content AS \"autosaveContent\", updated_at AS \"updatedAt\"";
      const rows = await db.query(sql, [id, normalized, actor?.id || null]);
      await auditPg(db, autosave ? "builder.draft.autosaved" : "builder.draft.saved", actor, { pageId: id });
      return rows.rows[0] || null;
    },
    async publish(id, actor) {
      const pageRows = await db.query("SELECT * FROM builder_pages WHERE id=$1", [id]);
      const draftRows = await db.query("SELECT content FROM builder_page_drafts WHERE page_id=$1", [id]);
      if (!pageRows.rowCount || !draftRows.rowCount) return null;
      const page = pageRows.rows[0];
      const content = normalizeContent(draftRows.rows[0].content);
      const warnings = publishWarnings(pageSummary(page), content);
      if (warnings.some((warning) => warning.severity === "error")) return { page: pageSummary(page), warnings, published: false };
      const countRows = await db.query("SELECT COALESCE(MAX(version_number),0) + 1 AS next FROM builder_page_versions WHERE page_id=$1", [id]);
      const versionId = makeId();
      const versionNumber = Number(countRows.rows[0].next || 1);
      const renderedHtml = renderPageHtml(pageSummary(page), content);
      const versionRows = await db.query("INSERT INTO builder_page_versions (id,page_id,version_number,content,seo,rendered_html,warnings,published_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [versionId, id, versionNumber, content, normalizeSeo(page.seo), renderedHtml, warnings, actor?.id || null]);
      await db.query("UPDATE builder_pages SET status='published', published_version_id=$2, updated_at=NOW(), updated_by_user_id=$3 WHERE id=$1", [id, versionId, actor?.id || null]);
      await auditPg(db, "builder.page.published", actor, { pageId: id, versionId });
      const updatedPage = (await this.pages()).find((item) => item.id === id);
      return { page: updatedPage, version: versionRows.rows[0], warnings, published: true };
    },
    async versions(id) {
      const rows = await db.query("SELECT * FROM builder_page_versions WHERE page_id=$1 ORDER BY version_number DESC", [id]);
      return rows.rows;
    },
    async rollback(pageId, versionId, actor) {
      const rows = await db.query("SELECT content FROM builder_page_versions WHERE page_id=$1 AND id=$2", [pageId, versionId]);
      if (!rows.rowCount) return null;
      await db.query("UPDATE builder_page_drafts SET content=$2, autosave_content=NULL, updated_by_user_id=$3, updated_at=NOW() WHERE page_id=$1", [pageId, normalizeContent(rows.rows[0].content), actor?.id || null]);
      await auditPg(db, "builder.page.rollback", actor, { pageId, versionId });
      return this.draft(pageId);
    },
    async published(slug) {
      const rows = await db.query("SELECT p.*, v.* FROM builder_pages p JOIN builder_page_versions v ON v.id = p.published_version_id WHERE p.slug=$1 AND p.status='published' LIMIT 1", [slugify(slug)]);
      if (!rows.rowCount) return null;
      const row = rows.rows[0];
      return { page: pageSummary(row), version: { id: row.published_version_id, content: row.content, renderedHtml: row.rendered_html, seo: row.seo } };
    },
    async mediaList() {
      const rows = await db.query("SELECT id, name, url, type, alt_text AS \"altText\", metadata, used_by_page_ids AS \"usedByPageIds\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM builder_media_assets ORDER BY updated_at DESC");
      return rows.rows;
    },
    async createMedia(input, actor) {
      const id = makeId();
      const rows = await db.query("INSERT INTO builder_media_assets (id,name,url,type,alt_text,metadata,uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, url, type, alt_text AS \"altText\", metadata, used_by_page_ids AS \"usedByPageIds\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [id, String(input.name || "Asset"), String(input.url || ""), String(input.type || "image"), String(input.altText || ""), input.metadata || {}, actor?.id || null]);
      await auditPg(db, "builder.media.created", actor, { assetId: id });
      return rows.rows[0];
    },
    async updateMedia(id, input, actor) {
      const current = await db.query("SELECT * FROM builder_media_assets WHERE id=$1", [id]);
      if (!current.rowCount) return null;
      const asset = current.rows[0];
      const rows = await db.query("UPDATE builder_media_assets SET name=$2,url=$3,type=$4,alt_text=$5,metadata=$6,updated_at=NOW() WHERE id=$1 RETURNING id, name, url, type, alt_text AS \"altText\", metadata, used_by_page_ids AS \"usedByPageIds\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [id, input.name ?? asset.name, input.url ?? asset.url, input.type ?? asset.type, input.altText ?? asset.alt_text, input.metadata ?? asset.metadata]);
      await auditPg(db, "builder.media.updated", actor, { assetId: id });
      return rows.rows[0];
    },
    async deleteMedia(id, actor) {
      const current = await db.query("SELECT used_by_page_ids FROM builder_media_assets WHERE id=$1", [id]);
      if (!current.rowCount) return { deleted: false, asset: null };
      if ((current.rows[0].used_by_page_ids || []).length) return { deleted: false, asset: current.rows[0] };
      await db.query("DELETE FROM builder_media_assets WHERE id=$1", [id]);
      await auditPg(db, "builder.media.deleted", actor, { assetId: id });
      return { deleted: true };
    },
    async navigation() {
      const rows = await db.query("SELECT id,label,page_id AS \"pageId\",url,parent_id AS \"parentId\",sort_order AS \"sortOrder\",visible FROM builder_navigation_items ORDER BY sort_order ASC");
      return rows.rows;
    },
    async saveNavigation(items, actor) {
      await db.query("DELETE FROM builder_navigation_items");
      for (const [index, item] of items.entries()) {
        await db.query("INSERT INTO builder_navigation_items (id,label,page_id,url,parent_id,sort_order,visible,updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [item.id || makeId(), String(item.label || "Link"), item.pageId || null, String(item.url || ""), item.parentId || null, Number(item.sortOrder ?? index), item.visible !== false, actor?.id || null]);
      }
      await auditPg(db, "builder.navigation.saved", actor, { count: items.length });
      return this.navigation();
    },
    async formsList() {
      const rows = await db.query("SELECT id,name,notification_email AS \"notificationEmail\",captcha_enabled AS \"captchaEnabled\",created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM builder_forms ORDER BY updated_at DESC");
      return rows.rows;
    },
    async createForm(input, actor) {
      const id = makeId();
      const rows = await db.query("INSERT INTO builder_forms (id,name,notification_email,captcha_enabled,created_by_user_id,updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id,name,notification_email AS \"notificationEmail\",captcha_enabled AS \"captchaEnabled\",created_at AS \"createdAt\",updated_at AS \"updatedAt\"", [id, String(input.name || "Builder form"), String(input.notificationEmail || ""), input.captchaEnabled !== false, actor?.id || null]);
      await auditPg(db, "builder.form.created", actor, { formId: id });
      return rows.rows[0];
    },
    async submissions(formId) {
      const rows = await db.query("SELECT id,form_id AS \"formId\",payload,status,created_at AS \"createdAt\" FROM builder_form_submissions WHERE form_id=$1 ORDER BY created_at DESC", [formId]);
      return rows.rows;
    },
    async createSubmission(formId, payload) {
      const id = makeId();
      const rows = await db.query("INSERT INTO builder_form_submissions (id,form_id,payload,status) VALUES ($1,$2,$3,'new') RETURNING id,form_id AS \"formId\",payload,status,created_at AS \"createdAt\"", [id, formId, payload || {}]);
      return rows.rows[0];
    },
    async auditEvents() {
      const rows = await db.query("SELECT id,action,actor_user_id AS \"actorUserId\",actor_name AS \"actorName\",details,created_at AS \"createdAt\" FROM builder_audit_events ORDER BY created_at DESC LIMIT 100");
      return rows.rows;
    }
  };
}

function pick(input, fields) {
  const result = {};
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = input[field];
  return result;
}

function uniqueSlug(baseSlug, existing) {
  let slug = baseSlug;
  let index = 2;
  while (existing.includes(slug)) slug = `${baseSlug}-${index++}`;
  return slug;
}

async function auditPg(db, action, actor, details = {}) {
  await db.query("INSERT INTO builder_audit_events (id, action, actor_user_id, actor_name, actor_email, details) VALUES ($1,$2,$3,$4,$5,$6)", [makeId(), action, actor?.id || null, actor?.name || null, actor?.email || null, details]);
}

function publishWarnings(page, content) {
  const warnings = [];
  const seo = normalizeSeo(page.seo || {});
  if (!content.blocks.length) warnings.push({ severity: "error", code: "empty_page", message: "Page has no blocks." });
  if (!seo.title) warnings.push({ severity: "warning", code: "seo_title_missing", message: "SEO title is missing." });
  if (!seo.description) warnings.push({ severity: "warning", code: "seo_description_missing", message: "Meta description is missing." });
  if (!page.slug) warnings.push({ severity: "error", code: "slug_missing", message: "URL slug is missing." });
  for (const item of content.blocks) {
    const text = JSON.stringify(item.content || {});
    if (/javascript:/i.test(text)) warnings.push({ severity: "error", code: "unsafe_url", message: `${item.name || item.type} contains an unsafe URL.` });
    if (item.type === "section.hero" && !item.content?.heading) warnings.push({ severity: "warning", code: "hero_heading_missing", message: "Hero heading is missing." });
  }
  return warnings;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function safeUrl(value) {
  const url = String(value || "#").trim();
  if (/^javascript:/i.test(url)) return "#";
  return escapeHtml(url || "#");
}

function renderList(items, className) {
  return `<div class=\"${className}\">${(Array.isArray(items) ? items : []).map((item) => `<article>${escapeHtml(item)}</article>`).join("")}</div>`;
}

function renderBlock(item) {
  const content = item.content || {};
  const style = item.style || {};
  const css = `background:${escapeHtml(style.background || "#ffffff")};color:${escapeHtml(style.text || "#202123")};text-align:${escapeHtml(style.align || "left")}`;
  if (item.type === "section.hero") return `<section class=\"builder-public-section builder-public-hero\" style=\"${css}\"><p>${escapeHtml(content.eyebrow)}</p><h1>${escapeHtml(content.heading)}</h1><div>${escapeHtml(content.body)}</div><a href=\"#\">${escapeHtml(content.primaryButton)}</a></section>`;
  if (item.type === "section.services") return `<section class=\"builder-public-section\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2>${renderList(content.items, "builder-public-grid")}</section>`;
  if (item.type === "section.cta") return `<section class=\"builder-public-section builder-public-cta\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2><p>${escapeHtml(content.body)}</p><a href=\"${safeUrl(content.buttonUrl)}\">${escapeHtml(content.buttonLabel)}</a></section>`;
  if (item.type === "section.faq") return `<section class=\"builder-public-section\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2>${renderList(content.items, "builder-public-list")}</section>`;
  if (item.type === "section.testimonials") return `<section class=\"builder-public-section\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2>${renderList(content.items, "builder-public-grid")}</section>`;
  if (item.type === "section.gallery") return `<section class=\"builder-public-section\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2><div class=\"builder-public-gallery\">${(content.images || []).map((image) => `<img src=\"${safeUrl(image.url || image)}\" alt=\"${escapeHtml(image.alt || "")}\">`).join("")}</div></section>`;
  if (item.type === "section.form") return `<section class=\"builder-public-section\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2><form>${(content.fields || []).map((field) => `<label>${escapeHtml(field.label)}<input type=\"${escapeHtml(field.type || "text")}\" ${field.required ? "required" : ""}></label>`).join("")}<button type=\"button\">${escapeHtml(content.submitLabel || "Submit")}</button></form></section>`;
  if (item.type === "section.footer") return `<footer class=\"builder-public-section\" style=\"${css}\"><h2>${escapeHtml(content.heading)}</h2><p>${escapeHtml(content.body)}</p>${renderList(content.links, "builder-public-links")}</footer>`;
  return "";
}

function renderPageHtml(page, content) {
  const seo = normalizeSeo(page.seo || {});
  return `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>${escapeHtml(seo.title || page.title)}</title><meta name=\"description\" content=\"${escapeHtml(seo.description)}\"><meta name=\"robots\" content=\"${escapeHtml(seo.robots)}\"><style>body{margin:0;font-family:Inter,Arial,sans-serif;color:#202123}.builder-public-section{padding:72px max(24px,8vw)}.builder-public-hero h1{font-size:clamp(2rem,4vw,4rem);margin:12px 0}.builder-public-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.builder-public-grid article,.builder-public-list article{border:1px solid #ddd;padding:18px}.builder-public-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.builder-public-gallery img{width:100%;height:180px;object-fit:cover}.builder-public-section a,.builder-public-section button{display:inline-block;padding:12px 16px;border-radius:6px;border:0;background:#202123;color:#fff;text-decoration:none}form{display:grid;gap:12px;max-width:640px}label{display:grid;gap:6px}input{padding:11px;border:1px solid #bbb;border-radius:6px}</style></head><body>${normalizeContent(content).blocks.map(renderBlock).join("")}</body></html>`;
}

function attachBuilderRoutes(app) {
  if (attachedApps.has(app)) return;
  attachedApps.add(app);
  app.use(express.json({ limit: "2mb" }));

  const admin = express.Router();
  admin.use(requireBuilderAdmin);
  admin.get("/block-registry", async (req, res, next) => route(req, res, next, async (api) => ({ blocks: await api.blockRegistry() })));
  admin.get("/templates", async (req, res, next) => route(req, res, next, async (api) => ({ templates: await api.templates() })));
  admin.get("/pages", async (req, res, next) => route(req, res, next, async (api) => ({ pages: await api.pages() })));
  admin.post("/pages", async (req, res, next) => route(req, res, next, async (api) => ({ page: await api.createPage(req.body || {}, req.builderActor) }), 201));
  admin.patch("/pages/:pageId", async (req, res, next) => route(req, res, next, async (api) => ({ page: await api.updatePage(req.params.pageId, req.body || {}, req.builderActor) })));
  admin.get("/pages/:pageId/draft", async (req, res, next) => route(req, res, next, async (api) => ({ draft: await api.draft(req.params.pageId) })));
  admin.put("/pages/:pageId/draft", async (req, res, next) => route(req, res, next, async (api) => ({ draft: await api.saveDraft(req.params.pageId, req.body.content || emptyContent(), req.builderActor, false) })));
  admin.post("/pages/:pageId/autosave", async (req, res, next) => route(req, res, next, async (api) => ({ draft: await api.saveDraft(req.params.pageId, req.body.content || emptyContent(), req.builderActor, true) })));
  admin.post("/pages/:pageId/publish", async (req, res, next) => route(req, res, next, async (api) => await api.publish(req.params.pageId, req.builderActor)));
  admin.get("/pages/:pageId/versions", async (req, res, next) => route(req, res, next, async (api) => ({ versions: await api.versions(req.params.pageId) })));
  admin.post("/pages/:pageId/rollback", async (req, res, next) => route(req, res, next, async (api) => ({ draft: await api.rollback(req.params.pageId, req.body.versionId, req.builderActor) })));
  admin.get("/media", async (req, res, next) => route(req, res, next, async (api) => ({ media: await api.mediaList() })));
  admin.post("/media", async (req, res, next) => route(req, res, next, async (api) => ({ asset: await api.createMedia(req.body || {}, req.builderActor) }), 201));
  admin.patch("/media/:assetId", async (req, res, next) => route(req, res, next, async (api) => ({ asset: await api.updateMedia(req.params.assetId, req.body || {}, req.builderActor) })));
  admin.delete("/media/:assetId", async (req, res, next) => route(req, res, next, async (api) => await api.deleteMedia(req.params.assetId, req.builderActor)));
  admin.get("/navigation", async (req, res, next) => route(req, res, next, async (api) => ({ items: await api.navigation() })));
  admin.put("/navigation", async (req, res, next) => route(req, res, next, async (api) => ({ items: await api.saveNavigation(Array.isArray(req.body.items) ? req.body.items : [], req.builderActor) })));
  admin.get("/forms", async (req, res, next) => route(req, res, next, async (api) => ({ forms: await api.formsList() })));
  admin.post("/forms", async (req, res, next) => route(req, res, next, async (api) => ({ form: await api.createForm(req.body || {}, req.builderActor) }), 201));
  admin.get("/forms/:formId/submissions", async (req, res, next) => route(req, res, next, async (api) => ({ submissions: await api.submissions(req.params.formId) })));
  admin.get("/audit-events", async (req, res, next) => route(req, res, next, async (api) => ({ events: await api.auditEvents() })));
  app.use("/api/builder", admin);

  app.post("/api/builder/forms/:formId/submissions", async (req, res, next) => route(req, res, next, async (api) => ({ submission: await api.createSubmission(req.params.formId, req.body || {}) }), 201));
  app.get("/api/builder/published/:slug", async (req, res, next) => route(req, res, next, async (api) => ({ published: await api.published(req.params.slug) })));
  app.get("/builder/pages/:slug", async (req, res, next) => {
    try {
      const api = await store();
      const published = await api.published(req.params.slug);
      if (!published) return res.status(404).send("Published page not found.");
      return res.type("html").send(published.version.renderedHtml || renderPageHtml(published.page, published.version.content));
    } catch (error) {
      return next(error);
    }
  });
}

async function route(req, res, next, handler, status = 200) {
  try {
    const api = await store();
    const payload = await handler(api);
    return res.status(status).json(payload);
  } catch (error) {
    return next(error);
  }
}

express.application.listen = function patchedListen(...args) {
  attachBuilderRoutes(this);
  return originalListen.apply(this, args);
};

module.exports = { attachBuilderRoutes, normalizeContent, renderPageHtml, publishWarnings };
