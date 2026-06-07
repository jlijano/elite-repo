(() => {
  const originalFetch = window.fetch.bind(window);
  let builderPages = [];

  function requestPath(input) {
    const value = typeof input === "string" ? input : input?.url || "";
    try {
      return new URL(value, window.location.origin).pathname;
    } catch (error) {
      return value;
    }
  }

  function responseWithJson(source, payload) {
    const headers = new Headers(source.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    return new Response(JSON.stringify(payload), {
      status: source.status,
      statusText: source.statusText,
      headers
    });
  }

  function slugify(value) {
    const slug = String(value || "untitled-page")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 96);
    return slug || "untitled-page";
  }

  function safeIsoDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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
    return {
      version: Number(source.content?.version || source.version || 1),
      blocks: sectionsFrom(source)
    };
  }

  function normalizePage(value = {}, fallback = {}) {
    const id = String(value.id || value.pageId || fallback.id || fallback.pageId || "").trim();
    const title = String(value.title || fallback.title || "").trim() || "Untitled page";
    const slug = String(value.slug || fallback.slug || slugify(title || id)).trim() || "untitled-page";
    const status = ["draft", "published", "archived"].includes(value.status || fallback.status)
      ? value.status || fallback.status
      : "draft";
    const sections = sectionsFrom(value).length ? sectionsFrom(value) : sectionsFrom(fallback);

    return {
      ...value,
      id,
      title,
      slug,
      status,
      sections,
      seo: normalizeSeo(value.seo || fallback.seo || {}),
      updatedAt: safeIsoDate(value.updatedAt || value.updated_at || fallback.updatedAt || fallback.updated_at)
    };
  }

  function normalizeDraft(value = {}, fallbackPage = {}) {
    const page = normalizePage(fallbackPage, value);
    const content = normalizeContent(value);
    return {
      ...value,
      id: String(value.id || value.pageId || page.id || "").trim(),
      pageId: String(value.pageId || value.id || page.id || "").trim(),
      title: String(value.title || page.title || "").trim() || "Untitled page",
      slug: String(value.slug || page.slug || "untitled-page").trim() || "untitled-page",
      status: ["draft", "published", "archived"].includes(value.status || page.status) ? value.status || page.status : "draft",
      sections: content.blocks,
      seo: normalizeSeo(value.seo || page.seo || {}),
      updatedAt: safeIsoDate(value.updatedAt || value.updated_at || page.updatedAt),
      content
    };
  }

  function pageIdFromPath(pathname) {
    const match = pathname.match(/^\/api\/builder\/pages\/([^/]+)(?:\/|$)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function normalizePayload(pathname, payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

    const shaped = { ...payload };
    const pageId = pageIdFromPath(pathname);

    if (Array.isArray(shaped.pages)) {
      shaped.pages = shaped.pages.map((page) => normalizePage(page));
      builderPages = shaped.pages;
    }

    if (shaped.draft) {
      const pageFallback = shaped.page || builderPages.find((page) => page.id === pageId) || { id: pageId };
      shaped.draft = normalizeDraft(shaped.draft, pageFallback);
      shaped.page = normalizePage(shaped.page || shaped.draft, shaped.draft);
    } else if (pageId && pathname.endsWith("/draft")) {
      shaped.draft = normalizeDraft({ pageId, content: { version: 1, blocks: [] } }, { id: pageId });
      shaped.page = normalizePage(shaped.page || shaped.draft, shaped.draft);
    } else if (shaped.page) {
      shaped.page = normalizePage(shaped.page);
    }

    return shaped;
  }

  window.fetch = async (input, options = {}) => {
    const response = await originalFetch(input, options);
    if (!response.ok) return response;

    const pathname = requestPath(input);
    if (!pathname.startsWith("/api/builder")) return response;

    const data = await response.clone().json().catch(() => null);
    if (!data || typeof data !== "object") return response;

    return responseWithJson(response, normalizePayload(pathname, data));
  };
})();
