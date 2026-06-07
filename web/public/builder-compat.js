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
    return new Response(JSON.stringify(payload), {
      status: source.status,
      statusText: source.statusText,
      headers: source.headers
    });
  }

  function pageIdFromDraftPath(pathname) {
    const match = pathname.match(/^\/api\/builder\/pages\/([^/]+)\/draft$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  window.fetch = async (input, options = {}) => {
    const response = await originalFetch(input, options);
    if (!response.ok) return response;

    const pathname = requestPath(input);
    const method = String(options.method || "GET").toUpperCase();
    const isPagesIndex = method === "GET" && pathname === "/api/builder/pages";
    const draftPageId = method === "GET" ? pageIdFromDraftPath(pathname) : "";

    if (!isPagesIndex && !draftPageId) return response;

    const data = await response.clone().json().catch(() => null);
    if (!data || typeof data !== "object") return response;

    if (isPagesIndex && Array.isArray(data.pages)) {
      builderPages = data.pages;
      return responseWithJson(response, data);
    }

    if (draftPageId && data.draft && !data.page) {
      const page = builderPages.find((item) => item.id === draftPageId);
      return responseWithJson(response, page ? { ...data, page } : data);
    }

    return response;
  };
})();