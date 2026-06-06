(function enhanceEntraAdmin() {
  const page = document.body?.dataset?.adminPage;
  const endpoints = { company: "companies", department: "departments", group: "groups" };
  const labels = { company: "company", department: "department", group: "group" };
  if (!endpoints[page]) return;

  const logoByCompanyId = new Map();
  let pendingLogoUrl = null;

  function sessionHeaders() {
    const headers = { "Content-Type": "application/json" };
    const sessionToken = sessionStorage.getItem("switchboard-session-token") || localStorage.getItem("switchboard_session_token");
    const adminToken = sessionStorage.getItem("switchboard-admin-token") || localStorage.getItem("switchboard_admin_token");
    if (sessionToken) headers["x-session-token"] = sessionToken;
    if (adminToken) headers["x-admin-token"] = adminToken;
    return headers;
  }

  function isGlobalAdmin() {
    try {
      const user = JSON.parse(sessionStorage.getItem("switchboard-session-user") || "{}");
      return user.role === "owner";
    } catch (error) {
      return false;
    }
  }

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

  async function mergeCompanyLogos(data) {
    if (!data?.companies?.length) return data;
    try {
      const response = await originalFetch("/api/admin/entra/company-logos", {
        headers: sessionHeaders(),
        credentials: "same-origin"
      });
      if (!response.ok) return data;
      const logoData = await response.json();
      logoByCompanyId.clear();
      (logoData.logos || []).forEach((item) => {
        if (item.id && item.logoUrl) logoByCompanyId.set(item.id, item.logoUrl);
      });
      data.companies = data.companies.map((company) => ({
        ...company,
        logoUrl: logoByCompanyId.get(company.id) || company.logoUrl || ""
      }));
    } catch (error) {
      // Logo enrichment should not block the main directory page.
    }
    return data;
  }

  function jsonResponseLike(response, data) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function enhancedFetch(input, init = {}) {
    const path = requestPath(input);
    const method = methodFor(init);
    const response = await originalFetch(input, init);
    const isDirectoryLoad = method === "GET" && path === "/api/admin/entra";
    const isCompanySave =
      page === "company" &&
      response.ok &&
      ((method === "POST" && path === "/api/admin/entra/companies") ||
        (method === "PATCH" && /^\/api\/admin\/entra\/companies\/[^/]+$/.test(path)));

    if (response.ok && isDirectoryLoad) {
      try {
        const data = await response.clone().json();
        return jsonResponseLike(response, await mergeCompanyLogos(data));
      } catch (error) {
        return response;
      }
    }

    if (isCompanySave) {
      try {
        const data = await response.clone().json();
        const companyId = data?.company?.id || path.split("/").pop();
        if (companyId && pendingLogoUrl !== null) {
          const logoResponse = await originalFetch(`/api/admin/entra/companies/${encodeURIComponent(companyId)}/logo`, {
            method: "PATCH",
            headers: sessionHeaders(),
            credentials: "same-origin",
            body: JSON.stringify({ logoUrl: pendingLogoUrl })
          });
          if (!logoResponse.ok) throw new Error((await logoResponse.json()).error || "Company logo could not be saved.");
          if (data.company) data.company.logoUrl = pendingLogoUrl;
          if (pendingLogoUrl) logoByCompanyId.set(companyId, pendingLogoUrl);
          else logoByCompanyId.delete(companyId);
        }
        pendingLogoUrl = null;
        return jsonResponseLike(response, data);
      } catch (error) {
        pendingLogoUrl = null;
        return new Response(JSON.stringify({ error: error.message || "Company logo could not be saved." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return response;
  };

  function addStyles() {
    if (document.getElementById("entraAdminEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "entraAdminEnhancementStyles";
    style.textContent = `
      .company-logo-field {
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 10px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.74);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
      }

      .company-logo-picker {
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr);
        gap: 12px;
        align-items: center;
      }

      .company-logo-preview,
      .company-logo-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.32);
        background: rgba(255, 255, 255, 0.82);
      }

      .company-logo-preview {
        width: 54px;
        height: 54px;
        border-radius: 14px;
        color: #64748b;
        font-weight: 800;
        font-size: 0.8rem;
      }

      .company-logo-preview img,
      .company-logo-mark img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .company-logo-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .company-logo-tools input[type="url"] {
        flex: 1 1 220px;
        min-width: 0;
      }

      .company-logo-tools input[type="file"] {
        display: none;
      }

      .company-logo-mark {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        flex: 0 0 34px;
        margin-right: 10px;
        vertical-align: middle;
      }

      .company-logo-name {
        display: inline-flex;
        align-items: center;
        min-width: 0;
      }

      .entra-name-edit-trigger {
        display: inline-flex !important;
        flex-direction: column;
        align-items: flex-start;
        max-width: 100%;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .entra-name-edit-trigger .entra-record-name {
        color: var(--primary);
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }

      .entra-name-edit-trigger:hover .entra-record-name,
      .entra-name-edit-trigger:focus-visible .entra-record-name {
        color: var(--primary-strong, var(--primary));
      }

      .danger-action {
        border-color: rgba(239, 68, 68, 0.28) !important;
        color: #b91c1c !important;
        background: rgba(254, 242, 242, 0.78) !important;
      }

      .danger-action:hover {
        border-color: rgba(220, 38, 38, 0.45) !important;
        background: rgba(254, 226, 226, 0.92) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function logoPreview(url) {
    const preview = document.getElementById("companyLogoPreview");
    if (!preview) return;
    preview.innerHTML = "";
    if (!url) {
      preview.textContent = "Logo";
      return;
    }
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Company logo preview";
    preview.appendChild(image);
  }

  function addCompanyLogoField() {
    if (page !== "company" || document.getElementById("companyLogoUrl")) return;
    const description = document.getElementById("entraDescription");
    const descriptionLabel = description?.closest("label");
    if (!descriptionLabel) return;

    const wrapper = document.createElement("div");
    wrapper.className = "company-logo-field";
    wrapper.innerHTML = `
      <span>Company logo</span>
      <div class="company-logo-picker">
        <div class="company-logo-preview" id="companyLogoPreview">Logo</div>
        <div class="company-logo-tools">
          <input id="companyLogoUrl" type="url" placeholder="https://example.com/logo.png">
          <input id="companyLogoFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp">
          <button type="button" class="secondary" id="companyLogoChoose">Upload</button>
          <button type="button" class="secondary" id="companyLogoClear">Clear</button>
        </div>
      </div>
    `;
    descriptionLabel.insertAdjacentElement("afterend", wrapper);

    const logoUrl = document.getElementById("companyLogoUrl");
    const logoFile = document.getElementById("companyLogoFile");
    document.getElementById("companyLogoChoose")?.addEventListener("click", () => logoFile?.click());
    document.getElementById("companyLogoClear")?.addEventListener("click", () => {
      logoUrl.value = "";
      if (logoFile) logoFile.value = "";
      logoPreview("");
    });
    logoUrl?.addEventListener("input", () => logoPreview(logoUrl.value.trim()));
    logoFile?.addEventListener("change", () => {
      const file = logoFile.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type) || file.size > 550000) {
        window.alert("Use a PNG, JPG, GIF, or WebP logo under 550 KB.");
        logoFile.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        logoUrl.value = String(reader.result || "");
        logoPreview(logoUrl.value);
      };
      reader.readAsDataURL(file);
    });
  }

  function captureCompanyLogoOnSubmit() {
    if (page !== "company") return;
    const form = document.getElementById("entraForm");
    form?.addEventListener("submit", () => {
      pendingLogoUrl = document.getElementById("companyLogoUrl")?.value?.trim() || "";
    }, true);
  }

  function fillCompanyLogoForEdit(event) {
    if (page !== "company") return;
    const button = event.target.closest("[data-edit]");
    if (!button) return;
    window.setTimeout(() => {
      const logoUrl = document.getElementById("companyLogoUrl");
      if (!logoUrl) return;
      const value = logoByCompanyId.get(button.dataset.edit) || "";
      logoUrl.value = value;
      logoPreview(value);
    }, 0);
  }

  function clearLogoForNewRecord(event) {
    if (page !== "company" || !event.target.closest("#addRecord")) return;
    window.setTimeout(() => {
      const logoUrl = document.getElementById("companyLogoUrl");
      if (logoUrl) logoUrl.value = "";
      logoPreview("");
    }, 0);
  }

  function rowRecordId(row) {
    return row.querySelector("[data-edit]")?.dataset.edit ||
      row.querySelector("[data-archive]")?.dataset.archive ||
      row.querySelector("[data-reactivate]")?.dataset.reactivate ||
      row.querySelector("[data-purge]")?.dataset.purge ||
      "";
  }

  function enhanceRows() {
    const list = document.getElementById("entraList");
    if (!list) return;
    list.querySelectorAll("tr").forEach((row) => {
      const recordId = rowRecordId(row);
      if (!recordId) return;

      const actions = row.querySelector(".actions");
      const editButton = actions?.querySelector("[data-edit]");
      if (editButton) editButton.remove();

      const firstCell = row.querySelector("td:first-child");
      const existingTrigger = firstCell?.querySelector(".entra-name-edit-trigger");
      const name = firstCell?.querySelector(".entra-record-name");
      if (firstCell && name && !existingTrigger) {
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "entra-name-edit-trigger";
        trigger.dataset.edit = recordId;
        trigger.setAttribute("aria-label", `Edit ${name.textContent || labels[page]}`);
        firstCell.insertBefore(trigger, name);
        trigger.appendChild(name);
        const note = firstCell.querySelector(".entra-record-note");
        if (note) trigger.appendChild(note);
      }

      if (isGlobalAdmin() && actions && !actions.querySelector("[data-purge]")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "danger-action";
        button.dataset.purge = recordId;
        button.textContent = "Delete";
        actions.appendChild(button);
      }

      if (page === "company" && logoByCompanyId.has(recordId) && !row.querySelector(".company-logo-mark")) {
        const target = firstCell?.querySelector(".entra-name-edit-trigger") || firstCell;
        if (!firstCell || !name) return;
        const logo = document.createElement("span");
        logo.className = "company-logo-mark";
        const image = document.createElement("img");
        image.src = logoByCompanyId.get(recordId);
        image.alt = "";
        logo.appendChild(image);
        const group = document.createElement("span");
        group.className = "company-logo-name";
        name.replaceWith(group);
        group.appendChild(logo);
        group.appendChild(name);
        if (target && target !== firstCell) target.insertBefore(group, target.firstChild);
      }
    });
  }

  async function purgeRecord(recordId) {
    const label = labels[page];
    const confirmed = window.confirm(`Permanently delete this ${label}? This cannot be undone.`);
    if (!confirmed) return;
    const response = await originalFetch(`/api/admin/entra/${endpoints[page]}/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
      headers: sessionHeaders(),
      credentials: "same-origin"
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Could not delete ${label}.`);
    }
    window.location.reload();
  }

  function bindPurgeClicks() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-purge]");
      if (!button || !document.getElementById("entraList")?.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        await purgeRecord(button.dataset.purge);
      } catch (error) {
        button.disabled = false;
        window.alert(error.message || "Delete failed.");
      }
    });
  }

  function observeList() {
    const list = document.getElementById("entraList");
    if (!list) return;
    enhanceRows();
    new MutationObserver(enhanceRows).observe(list, { childList: true, subtree: true });
  }

  addStyles();
  addCompanyLogoField();
  captureCompanyLogoOnSubmit();
  bindPurgeClicks();
  observeList();
  document.addEventListener("click", fillCompanyLogoForEdit);
  document.addEventListener("click", clearLogoForNewRecord);
})();