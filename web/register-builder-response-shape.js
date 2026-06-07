const express = require("express");

const originalJson = express.response.json;
const pagePathPattern = /^\/api\/builder\/pages\/([^/]+)(?:\/|$)/;

function safeIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function slugify(value) {
  const slug = String(value || "untitled-page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);
  return slug || "untitled-page";
}

function normalizeSeo(seo = {}) {
  return {
    title: String(seo.title || ""),
    description: String(seo.description || ""),
    canonicalUrl: String(seo.canonicalUrl || ""),
    ogTitle: String(seo.ogTitle || ""),
    ogDescription: String(seo.ogDescription || ""),
    ogImage: String(seo.ogImage || ""),
    robots: String(seo.robots || "index,follow")
  };
}

function sectionsFrom(source = {}) {
  if (Array.isArray(source.sections)) return source.sections;
  if (Array.isArray(source.content?.blocks)) return source.content.blocks;
  if (Array.isArray(source.content?.sections)) return source.content.sections;
  if (Array.isArray(source.autosaveContent?.blocks)) return source.autosaveContent.blocks;
  if (Array.isArray(source.autosaveContent?.sections)) return source.autosaveContent.sections;
  return [];
}

function normalizeContent(source = {}) {
  const sections = sectionsFrom(source);
  return {
    version: Number(source.content?.version || source.version || 1),
    blocks: sections
  };
}

function pageIdFromRequest(req) {
  const match = String(req?.path || req?.originalUrl || "").match(pagePathPattern);
  return match ? decodeURIComponent(match[1]) : "";
}

function normalizePage(value = {}, fallback = {}) {
  const id = String(value.id || value.pageId || fallback.id || fallback.pageId || "").trim();
  const title = String(value.title || fallback.title || "").trim() || "Untitled page";
  const slug = String(value.slug || fallback.slug || slugify(title || id)).trim() || "untitled-page";
  const status = ["draft", "published", "archived"].includes(value.status || fallback.status)
    ? value.status || fallback.status
    : "draft";
  const sections = sectionsFrom(value).length ? sectionsFrom(value) : sectionsFrom(fallback);
  const updatedAt = safeIsoDate(value.updatedAt || value.updated_at || fallback.updatedAt || fallback.updated_at);

  return {
    ...value,
    id,
    title,
    slug,
    status,
    sections,
    seo: normalizeSeo(value.seo || fallback.seo || {}),
    updatedAt
  };
}

function normalizeDraft(value = {}, fallbackPage = {}) {
  const page = normalizePage(fallbackPage, value);
  const content = normalizeContent(value);
  const sections = content.blocks;
  const updatedAt = safeIsoDate(value.updatedAt || value.updated_at || page.updatedAt);

  return {
    ...value,
    id: String(value.id || value.pageId || page.id || "").trim(),
    pageId: String(value.pageId || value.id || page.id || "").trim(),
    title: String(value.title || page.title || "").trim() || "Untitled page",
    slug: String(value.slug || page.slug || "untitled-page").trim() || "untitled-page",
    status: ["draft", "published", "archived"].includes(value.status || page.status) ? value.status || page.status : "draft",
    sections,
    seo: normalizeSeo(value.seo || page.seo || {}),
    updatedAt,
    content
  };
}

function normalizePayload(req, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  const shaped = { ...payload };
  const requestPageId = pageIdFromRequest(req);

  if (Array.isArray(shaped.pages)) {
    shaped.pages = shaped.pages.map((page) => normalizePage(page));
  }

  if (shaped.draft) {
    const pageFallback = shaped.page || shaped.pages?.find((page) => page.id === requestPageId) || { id: requestPageId };
    shaped.draft = normalizeDraft(shaped.draft, pageFallback);
    shaped.page = normalizePage(shaped.page || shaped.draft, shaped.draft);
  } else if (requestPageId && String(req?.path || req?.originalUrl || "").includes("/draft")) {
    shaped.draft = normalizeDraft({ pageId: requestPageId, content: { version: 1, blocks: [] } }, { id: requestPageId });
    shaped.page = normalizePage(shaped.page || shaped.draft, shaped.draft);
  } else if (shaped.page) {
    shaped.page = normalizePage(shaped.page);
  }

  return shaped;
}

if (!express.response.__builderShapePatched) {
  Object.defineProperty(express.response, "__builderShapePatched", { value: true });
  express.response.json = function patchedBuilderJson(payload) {
    const nextPayload = String(this.req?.path || this.req?.originalUrl || "").startsWith("/api/builder")
      ? normalizePayload(this.req, payload)
      : payload;
    return originalJson.call(this, nextPayload);
  };
}

module.exports = { normalizePayload, normalizePage, normalizeDraft };
