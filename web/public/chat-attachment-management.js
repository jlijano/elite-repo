(() => {
  if (document.body?.dataset.adminPage !== "chat") return;

  const sessionTokenStorageKey = "switchboard-session-token";
  const adminTokenStorageKey = "switchboard-admin-token";
  const files = document.getElementById("fileManagement");
  const status = document.getElementById("status");
  if (!files) return;

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

  const formatTime = (value) => value
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
    : "";

  function setAttachmentStatus(message, error = false) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle("error", error);
  }

  function storedAdminToken() {
    try { return sessionStorage.getItem(adminTokenStorageKey) || ""; } catch (error) { return ""; }
  }

  function storedSessionToken() {
    try { return sessionStorage.getItem(sessionTokenStorageKey) || ""; } catch (error) { return ""; }
  }

  function protectedHeaders() {
    const headers = { "Content-Type": "application/json" };
    const adminToken = storedAdminToken();
    const sessionToken = storedSessionToken();
    if (adminToken) headers["x-admin-token"] = adminToken;
    if (sessionToken) headers["x-session-token"] = sessionToken;
    return headers;
  }

  function hasProtectedSession() {
    return Boolean(storedAdminToken() || storedSessionToken());
  }

  function activeChatId() {
    try {
      if (typeof selectedChatId === "string" && selectedChatId) return selectedChatId;
    } catch (error) {}
    return document.querySelector("#chats .item.active [data-chat]")?.dataset.chat || "";
  }

  function injectStyles() {
    if (document.getElementById("chatAttachmentManagementStyles")) return;
    const style = document.createElement("style");
    style.id = "chatAttachmentManagementStyles";
    style.textContent = `
      .chat-attachment-item .row { align-items: flex-start; gap: 12px; }
      .chat-attachment-title { display: grid; gap: 2px; min-width: 0; }
      .chat-attachment-title span { overflow-wrap: anywhere; }
      .chat-attachment-meta { color: var(--muted); font-size: 0.82rem; }
      .chat-attachment-preview { margin-top: 10px; overflow: hidden; border: 1px solid var(--line); border-radius: calc(var(--radius) - 4px); background: var(--panel-soft); }
      .chat-attachment-preview img,
      .chat-attachment-preview video { display: block; width: 100%; max-height: 280px; object-fit: contain; background: #050505; }
      .chat-attachment-preview audio { display: block; width: 100%; padding: 8px; }
      .chat-attachment-text { max-height: 180px; margin: 0; padding: 10px; overflow: auto; white-space: pre-wrap; color: var(--text); font: 0.78rem/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
      .chat-attachment-actions { justify-content: flex-end; margin-top: 10px; gap: 8px; }
      .chat-attachment-link { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 12px; border: 1px solid var(--line); border-radius: calc(var(--radius) - 4px); background: var(--panel); color: var(--text); text-decoration: none; font-size: 0.86rem; font-weight: 850; }
      .chat-attachment-link:hover,
      .chat-attachment-link:focus-visible { border-color: var(--primary); outline: 3px solid var(--focus-ring); outline-offset: 2px; }
      .admin-panel button.chat-attachment-delete { border-color: var(--error-line); background: var(--error-bg); color: var(--error); }
      .admin-panel button.chat-attachment-delete:hover:not(:disabled),
      .admin-panel button.chat-attachment-delete:focus-visible:not(:disabled) { border-color: var(--error); background: var(--error-bg); }
    `;
    document.head.appendChild(style);
  }

  function safeDataUrl(attachment = {}) {
    const content = typeof attachment.content === "string" ? attachment.content.trim() : "";
    return /^data:(?:(?:image|audio|video)\/|application\/pdf(?:[;,]|$))/i.test(content) ? content : "";
  }

  function attachmentKind(attachment = {}) {
    const type = String(attachment.type || "").toLowerCase();
    const content = safeDataUrl(attachment).toLowerCase();
    if (type.startsWith("image/") || content.startsWith("data:image/")) return "image";
    if (type.startsWith("audio/") || content.startsWith("data:audio/")) return "audio";
    if (type.startsWith("video/") || content.startsWith("data:video/")) return "video";
    if (type === "application/pdf" || content.startsWith("data:application/pdf")) return "file";
    return "text";
  }

  function renderPreview(attachment = {}) {
    const dataUrl = safeDataUrl(attachment);
    const kind = attachmentKind(attachment);
    const label = escapeHtml(attachment.name || "Attachment");
    if (dataUrl && kind === "image") return `<div class="chat-attachment-preview"><img src="${escapeHtml(dataUrl)}" alt="Preview of ${label}" loading="lazy" /></div>`;
    if (dataUrl && kind === "audio") return `<div class="chat-attachment-preview"><audio controls src="${escapeHtml(dataUrl)}"></audio></div>`;
    if (dataUrl && kind === "video") return `<div class="chat-attachment-preview"><video controls src="${escapeHtml(dataUrl)}"></video></div>`;
    if (!dataUrl && typeof attachment.content === "string" && attachment.content.trim()) {
      return `<div class="chat-attachment-preview"><pre class="chat-attachment-text">${escapeHtml(attachment.content.trim().slice(0, 1200))}${attachment.content.length > 1200 ? "..." : ""}</pre></div>`;
    }
    return "";
  }

  function renderOpenAction(attachment = {}) {
    const dataUrl = safeDataUrl(attachment);
    if (!dataUrl) return "";
    const name = escapeHtml(attachment.name || "attachment");
    return `<a class="chat-attachment-link" href="${escapeHtml(dataUrl)}" target="_blank" rel="noreferrer" download="${name}">Open</a>`;
  }

  async function deleteAttachment(messageId, attachmentIndex, attachmentName, button) {
    const chatId = activeChatId();
    if (!chatId || !messageId) return setAttachmentStatus("Select a chat before deleting an attachment.", true);
    if (!hasProtectedSession()) return setAttachmentStatus("Deleting attachments requires an admin session.", true);
    const label = attachmentName || "this attachment";
    if (!window.confirm(`Delete "${label}" from this chat message? This removes the stored attachment content.`)) return;

    button.disabled = true;
    button.textContent = "Deleting...";
    setAttachmentStatus(`Deleting ${label}...`);
    try {
      const response = await fetch(`/api/admin/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentIndex)}`, {
        method: "DELETE",
        headers: protectedHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete attachment.");
      if (typeof loadChat === "function") await loadChat(chatId);
      setAttachmentStatus(`Deleted ${label}.`);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Delete";
      setAttachmentStatus(error.message, true);
    }
  }

  injectStyles();

  renderFileManagementFromMessages = function renderManagedAttachments(messages = []) {
    const attachments = [];
    for (const message of messages) {
      const items = Array.isArray(message.context?.attachments) ? message.context.attachments : [];
      items.forEach((attachment, attachmentIndex) => attachments.push({
        ...attachment,
        role: message.role,
        createdAt: message.createdAt,
        messageId: message.id,
        attachmentIndex
      }));
    }

    files.innerHTML = attachments.length
      ? attachments.map((attachment) => {
        const size = attachment.size ? ` - ${escapeHtml(attachment.size)} bytes` : "";
        const storedAt = attachment.createdAt ? `Stored ${escapeHtml(formatTime(attachment.createdAt))}` : "Stored in sanitized chat message context";
        return `<article class="item chat-attachment-item">
          <div class="row">
            <div class="chat-attachment-title"><span>${escapeHtml(attachment.name || "Attachment")}</span><small class="chat-attachment-meta">${escapeHtml(attachment.type || "text attachment")}${size}</small></div>
            <small>${escapeHtml(attachment.role || "message")}</small>
          </div>
          <p>${storedAt}</p>
          ${renderPreview(attachment)}
          <div class="actions chat-attachment-actions">
            ${renderOpenAction(attachment)}
            ${hasProtectedSession() ? `<button class="chat-attachment-delete" type="button" data-attachment-message="${escapeHtml(attachment.messageId)}" data-attachment-index="${escapeHtml(attachment.attachmentIndex)}" data-attachment-name="${escapeHtml(attachment.name || "Attachment")}">Delete</button>` : ""}
          </div>
        </article>`;
      }).join("")
      : `<article class="item"><div class="row"><span>No attachments in selected chat</span><small>Chat</small></div><p>Select a chat to inspect files attached to its messages.</p></article>`;

    files.querySelectorAll("[data-attachment-message]").forEach((button) => {
      button.addEventListener("click", () => deleteAttachment(
        button.dataset.attachmentMessage,
        button.dataset.attachmentIndex,
        button.dataset.attachmentName,
        button
      ));
    });
  };
})();
