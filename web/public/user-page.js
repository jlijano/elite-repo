(() => {
  const usersContainer = document.getElementById("users");
  const dialog = document.getElementById("userDialog");
  const addButton = document.getElementById("manageUsersButton");
  const closeButton = document.getElementById("closeUserModalButton");
  const cancelEditButton = document.getElementById("cancelUserEditButton");
  const form = document.getElementById("userForm");
  const status = document.getElementById("status");
  const exportButton = document.getElementById("exportUserAuditButton");
  const photoInput = document.getElementById("userPhotoUrl");
  const photoFileInput = document.getElementById("photoFileInput");
  const photoDropZone = document.getElementById("photoDropZone");
  const choosePhotoButton = document.getElementById("choosePhotoButton");
  const photoPreviewImage = document.getElementById("photoPreviewImage");
  const photoPreviewText = document.getElementById("photoPreviewText");
  const photoUploadStatus = document.getElementById("photoUploadStatus");
  const maxPhotoBytes = 512 * 1024;
  let transformingUsers = false;

  function renderPhotoPreview(value = photoInput?.value || "") {
    const photoValue = String(value || "").trim();
    const canPreview = /^(https?:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(photoValue);
    if (photoPreviewImage) {
      photoPreviewImage.hidden = !canPreview;
      if (canPreview) photoPreviewImage.src = photoValue;
      else photoPreviewImage.removeAttribute("src");
    }
    if (photoPreviewText) photoPreviewText.hidden = canPreview;
    if (photoUploadStatus) photoUploadStatus.textContent = canPreview ? "Photo ready." : "No photo selected.";
  }

  function openUserDialog() {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    window.setTimeout(() => {
      renderPhotoPreview();
      document.getElementById("userName")?.focus();
    }, 0);
  }

  function closeUserDialog() {
    if (dialog?.open) dialog.close();
  }

  function setPhotoStatus(message, error = false) {
    if (!photoUploadStatus) return;
    photoUploadStatus.textContent = message;
    photoUploadStatus.style.color = error ? "var(--error)" : "var(--muted)";
  }

  function applyPhotoFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp)$/i.test(file.type)) {
      setPhotoStatus("Choose a PNG, JPG, GIF, or WebP image.", true);
      return;
    }
    if (file.size > maxPhotoBytes) {
      setPhotoStatus("Photo must be 512 KB or smaller.", true);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (photoInput) {
        photoInput.value = String(reader.result || "");
        photoInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      renderPhotoPreview(reader.result);
      setPhotoStatus(`${file.name} selected.`);
    });
    reader.addEventListener("error", () => setPhotoStatus("Could not read that image.", true));
    reader.readAsDataURL(file);
  }

  function tableCell(content, className = "") {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    if (content instanceof Node) cell.appendChild(content);
    else cell.textContent = content || "";
    return cell;
  }

  function transformUsersToTable() {
    if (!usersContainer || transformingUsers || usersContainer.querySelector(".users-table")) return;
    const userItems = Array.from(usersContainer.querySelectorAll(".user-item"));
    if (!userItems.length) return;
    transformingUsers = true;

    const wrap = document.createElement("div");
    wrap.className = "users-table-wrap";
    const table = document.createElement("table");
    table.className = "users-table";
    table.innerHTML = "<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>";
    const tbody = document.createElement("tbody");

    for (const item of userItems) {
      const row = document.createElement("tr");
      if (item.classList.contains("active")) row.classList.add("active");
      const name = item.querySelector(".row span")?.textContent?.trim() || "User";
      const statusBadge = item.querySelector(".status-badge")?.cloneNode(true) || document.createTextNode("unknown");
      const details = item.querySelectorAll("p");
      const [email = "", role = ""] = (details[0]?.textContent || "").split(" - ");
      const updated = (details[1]?.textContent || "").replace(/^Updated\s*/i, "");
      const actions = item.querySelector(".actions") || document.createElement("div");
      actions.classList.add("actions");

      row.appendChild(tableCell(name));
      row.appendChild(tableCell(email, "muted-cell"));
      row.appendChild(tableCell(role || "viewer", "muted-cell"));
      row.appendChild(tableCell(statusBadge));
      row.appendChild(tableCell(updated, "muted-cell"));
      row.appendChild(tableCell(actions));
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    usersContainer.replaceChildren(wrap);
    transformingUsers = false;
  }

  function csvEscape(value) {
    return `"${String(value || "").replace(/"/g, '""')}"`;
  }

  function exportAuditReport() {
    const auditItems = Array.from(document.querySelectorAll("#userAuditEvents .audit-item"));
    if (!auditItems.length) {
      if (status) status.textContent = "No user audit events available to export.";
      return;
    }
    const rows = auditItems.map((item) => {
      const action = item.querySelector(".row span")?.textContent?.trim() || "";
      const details = Array.from(item.querySelectorAll("p")).map((node) => node.textContent.trim());
      const target = (details[0] || "").replace(/^Target:\s*/i, "");
      const createdAt = details[1] || "";
      return [action, target, createdAt].map(csvEscape).join(",");
    });
    const csv = ["Action,Target user,Created at", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `user-audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (status) status.textContent = "User audit report exported.";
  }

  addButton?.addEventListener("click", () => window.setTimeout(openUserDialog, 0));
  closeButton?.addEventListener("click", closeUserDialog);
  cancelEditButton?.addEventListener("click", closeUserDialog);
  form?.addEventListener("reset", () => window.setTimeout(renderPhotoPreview, 0));
  form?.addEventListener("submit", () => {
    window.setTimeout(() => {
      const message = status?.textContent || "";
      if (/User (created|updated)\./.test(message)) closeUserDialog();
    }, 700);
  });
  usersContainer?.addEventListener("click", (event) => {
    if (event.target.closest("[data-user-edit]")) window.setTimeout(openUserDialog, 0);
  }, true);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeUserDialog();
  });
  exportButton?.addEventListener("click", exportAuditReport);
  choosePhotoButton?.addEventListener("click", () => photoFileInput?.click());
  photoFileInput?.addEventListener("change", () => applyPhotoFile(photoFileInput.files?.[0]));
  photoInput?.addEventListener("input", () => renderPhotoPreview());
  photoDropZone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      photoFileInput?.click();
    }
  });
  ["dragenter", "dragover"].forEach((type) => photoDropZone?.addEventListener(type, (event) => {
    event.preventDefault();
    photoDropZone.classList.add("drag-active");
  }));
  ["dragleave", "drop"].forEach((type) => photoDropZone?.addEventListener(type, (event) => {
    event.preventDefault();
    if (type === "drop") applyPhotoFile(event.dataTransfer?.files?.[0]);
    photoDropZone.classList.remove("drag-active");
  }));

  const observer = new MutationObserver(transformUsersToTable);
  if (usersContainer) observer.observe(usersContainer, { childList: true, subtree: false });
  transformUsersToTable();
  renderPhotoPreview();
})();
