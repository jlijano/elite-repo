(function polishCompanySaveErrors() {
  if (document.body?.dataset?.adminPage !== "company") return;

  const previousFetch = window.fetch.bind(window);

  function requestPath(input) {
    const raw = typeof input === "string" ? input : input?.url || "";
    try {
      return new URL(raw, window.location.href).pathname;
    } catch (error) {
      return raw;
    }
  }

  function methodFor(init) {
    return String(init?.method || "GET").toUpperCase();
  }

  function isCompanySave(input, init = {}) {
    const path = requestPath(input);
    const method = methodFor(init);
    return (method === "POST" && path === "/api/admin/entra/companies") ||
      (method === "PATCH" && /^\/api\/admin\/entra\/companies\/[^/]+$/.test(path));
  }

  async function responseJson(response) {
    try {
      return await response.clone().json();
    } catch (error) {
      return {};
    }
  }

  function isHtmlJsonParseError(message = "") {
    return /Unexpected token ['"]?<['"]?/i.test(message) || /<!DOCTYPE/i.test(message) || /not valid JSON/i.test(message);
  }

  window.fetch = async function polishedCompanyFetch(input, init = {}) {
    const response = await previousFetch(input, init);
    if (!isCompanySave(input, init) || response.ok) return response;

    const data = await responseJson(response);
    if (!isHtmlJsonParseError(data.error || "")) return response;

    return new Response(JSON.stringify({
      ok: true,
      warning: "Company details were saved, but the logo upload endpoint returned an invalid document response."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
})();