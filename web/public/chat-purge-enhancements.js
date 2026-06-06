(() => {
  if (document.body?.dataset.adminPage !== "chat") return;

  const sessionTokenStorageKey = "switchboard-session-token";
  const adminTokenStorageKey = "switchboard-admin-token";
  const chats = document.getElementById("chats");
  const status = document.getElementById("status");
  const detail = document.getElementById("chatDetail");
  const files = document.getElementById("fileManagement");
  if (!chats) return;

  function setStatus(message, error = false) {
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

  function injectStyles() {
    if (document.getElementById("chatPurgeEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "chatPurgeEnhancementStyles";
    style.textContent = `
      .admin-panel button.chat-purge-action {
        border-color: var(--error-line);
        background: var(--error-bg);
        color: var(--error);
      }
      .admin-panel button.chat-purge-action:hover:not(:disabled),
      .admin-panel button.chat-purge-action:focus-visible:not(:disabled) {
        border-color: var(--error);
        background: var(--error-bg);
      }
    `;
    document.head.appendChild(style);
  }

  function chatTitle(article) {
    return article?.querySelector(".row span")?.textContent?.trim() || "this chat";
  }

  function hasPurgeButton(actions, chatId) {
    return [...actions.querySelectorAll("[data-chat-purge]")].some((button) => button.dataset.chatPurge === chatId);
  }

  function clearSelectedChat(article) {
    if (!article?.classList.contains("active")) return;
    if (detail) detail.textContent = "Select a chat to inspect messages.";
    if (files) files.textContent = "Select a chat to inspect attached files.";
  }

  async function purgeChat(chatId, article, button) {
    if (!hasProtectedSession()) {
      setStatus("Purging chats requires a global admin session.", true);
      return;
    }
    const title = chatTitle(article);
    const confirmed = window.confirm(`Permanently purge "${title}" and all messages in this chat? This cannot be undone.`);
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Purging...";
    setStatus(`Purging ${title}...`);
    try {
      const response = await fetch(`/api/admin/chats/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
        headers: protectedHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not purge chat.");
      clearSelectedChat(article);
      article?.remove();
      setStatus(`Purged ${title}.`);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Purge";
      setStatus(error.message, true);
    }
  }

  function enhanceChatList() {
    if (!hasProtectedSession()) return;
    injectStyles();
    chats.querySelectorAll("[data-chat]").forEach((inspectButton) => {
      const chatId = inspectButton.dataset.chat;
      const actions = inspectButton.closest(".actions");
      const article = inspectButton.closest(".item");
      if (!chatId || !actions || hasPurgeButton(actions, chatId)) return;
      const purgeButton = document.createElement("button");
      purgeButton.type = "button";
      purgeButton.className = "chat-purge-action";
      purgeButton.dataset.chatPurge = chatId;
      purgeButton.textContent = "Purge";
      purgeButton.addEventListener("click", () => purgeChat(chatId, article, purgeButton));
      actions.appendChild(purgeButton);
    });
  }

  enhanceChatList();
  new MutationObserver(enhanceChatList).observe(chats, { childList: true, subtree: true });
})();
