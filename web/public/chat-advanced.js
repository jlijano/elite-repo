(() => {
  const participantKey = "switchboard-participant-id";
  const nicknameKey = "switchboard-chat-nickname";
  const hiddenKeyPrefix = "switchboard-hidden-message-ids";
  let installed = false;
  let stream = null;
  let lastPresence = [];
  let lastMessages = [];
  let reloadTimer = null;

  function stored(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function setStoredValue(key, value) {
    try { localStorage.setItem(key, value); } catch { return; }
  }

  function participantId() {
    let value = stored(participantKey);
    if (!value) {
      value = crypto?.randomUUID ? crypto.randomUUID() : `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setStoredValue(participantKey, value);
    }
    return value;
  }

  function nickname() {
    return String(stored(nicknameKey) || "").trim().slice(0, 40);
  }

  function deviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad|tablet/.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/.test(ua))) return "tablet";
    if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
    return "desktop";
  }

  function participantContext() {
    const id = participantId();
    const name = nickname();
    return {
      participantId: id,
      participantType: document.location.search.includes("chat=") ? "shared" : "original",
      participantLabel: name || "Participant",
      deviceType: deviceType()
    };
  }

  function hiddenIds(chatId = currentChatId) {
    try { return new Set(JSON.parse(localStorage.getItem(`${hiddenKeyPrefix}-${chatId}`) || "[]")); } catch { return new Set(); }
  }

  function saveHiddenIds(ids, chatId = currentChatId) {
    try { localStorage.setItem(`${hiddenKeyPrefix}-${chatId}`, JSON.stringify([...ids])); } catch { return; }
  }

  function displayReceiptLabel(receipt) {
    return String(receipt?.participantLabel || "").trim() || "Participant";
  }

  function messageStatus(message) {
    const ownId = participantId();
    const receipts = Array.isArray(message.readReceipts) ? message.readReceipts.filter((receipt) => receipt.participantId !== ownId) : [];
    if (receipts.length === 1) return { text: `Seen by ${displayReceiptLabel(receipts[0])}`, state: "seen" };
    if (receipts.length > 1) return { text: `Seen by ${receipts.length}`, state: "seen" };
    const status = message.delivery?.status || (message.role === "user" ? "delivered" : "");
    if (status === "failed") return { text: "Failed", state: "failed" };
    if (status === "sent") return { text: "Sent", state: "sent" };
    if (status === "seen") return { text: "Seen", state: "seen" };
    if (status === "delivered") return { text: "Delivered", state: "delivered" };
    return { text: "", state: "" };
  }

  function ensureStyle() {
    if (document.getElementById("chatAdvancedStyles")) return;
    const style = document.createElement("style");
    style.id = "chatAdvancedStyles";
    style.textContent = `
      .participant-presence{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 8px 8px;color:var(--muted);font-size:.76rem;font-weight:760}.participant-presence:empty{display:none}.presence-pill{display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:0 8px;border:1px solid var(--line);border-radius:999px;background:var(--panel-soft)}.presence-dot{width:7px;height:7px;border-radius:50%;background:#9ca3af}.presence-dot.online{background:#22c55e}
      .message{position:relative}.message-action-button{position:absolute;top:2px;right:-34px;width:28px;height:28px;min-height:28px;border:1px solid var(--line);border-radius:999px;background:var(--composer);color:var(--text);opacity:0;transition:opacity .15s ease}.message:hover .message-action-button,.message:focus-within .message-action-button{opacity:1}.message.user .message-action-button{right:auto;left:-34px}.message-action-menu{position:absolute;z-index:40;top:32px;right:0;display:grid;gap:3px;min-width:160px;padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--composer);box-shadow:0 16px 38px rgba(0,0,0,.26)}.message.user .message-action-menu{right:auto;left:0}.message-action-menu[hidden]{display:none}.message-action-menu button{min-height:34px;padding:0 9px;border-radius:8px;background:transparent;color:var(--text);font-weight:720;text-align:left}.message-action-menu button:hover,.message-action-menu button:focus-visible{background:var(--panel-soft)}
      @media (max-width:520px){.message-action-button{opacity:1;right:2px;top:-26px}.message.user .message-action-button{left:2px}.message-action-menu{max-width:calc(100vw - 32px)}}
    `;
    document.head.appendChild(style);
  }

  function renderPresence(participants = lastPresence) {
    lastPresence = Array.isArray(participants) ? participants : [];
    const typing = document.getElementById("typingStatus");
    if (!typing) return;
    let row = document.getElementById("participantPresence");
    if (!row) {
      row = document.createElement("div");
      row.id = "participantPresence";
      row.className = "participant-presence";
      row.setAttribute("aria-label", "Participants online");
      typing.insertAdjacentElement("beforebegin", row);
    }
    const ownId = participantId();
    row.innerHTML = "";
    for (const participant of lastPresence.filter((item) => item.participantId && item.participantId !== ownId).slice(0, 6)) {
      const pill = document.createElement("span");
      pill.className = "presence-pill";
      const dot = document.createElement("span");
      dot.className = `presence-dot${participant.isOnline ? " online" : ""}`;
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = `${participant.participantLabel || "Participant"} · ${participant.deviceType || "device"}`;
      pill.appendChild(dot);
      pill.appendChild(label);
      row.appendChild(pill);
    }
  }

  function updateStatus(article, message) {
    const bubble = article.querySelector(".bubble");
    if (!bubble || message.role !== "user") return;
    const next = messageStatus(message);
    if (!next.text) return;
    let status = bubble.querySelector(".message-status");
    if (!status) {
      status = document.createElement("span");
      bubble.appendChild(status);
    }
    status.className = `message-status ${next.state}`;
    status.textContent = next.text;
  }

  function downloadAttachment(attachment) {
    const link = document.createElement("a");
    link.href = attachment.content || "";
    link.download = attachment.name || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function addMessageActions(article, message) {
    if (!message.id || article.querySelector(".message-action-button")) return;
    article.dataset.messageId = message.id;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "message-action-button";
    toggle.setAttribute("aria-label", "Message actions");
    toggle.textContent = "⋯";
    const menu = document.createElement("div");
    menu.className = "message-action-menu";
    menu.hidden = true;

    const makeButton = (label, action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => { menu.hidden = true; action(); });
      menu.appendChild(button);
    };

    makeButton("Reply", () => {
      const who = message.context?.participantLabel || "message";
      inputEl.value = `Reply to ${who}: `;
      resizeInput();
      inputEl.focus();
    });
    makeButton("Copy", () => navigator.clipboard?.writeText(message.content || ""));
    makeButton("Archive here", () => {
      const ids = hiddenIds();
      ids.add(message.id);
      saveHiddenIds(ids);
      article.hidden = true;
    });
    if ((messageStatus(message).state || "") === "failed") makeButton("Resend", () => {
      inputEl.value = message.content || "";
      resizeInput();
      sendMessage();
    });
    const attachments = Array.isArray(message.context?.attachments) ? message.context.attachments : [];
    if (attachments.length) makeButton("Download attachment", () => downloadAttachment(attachments[0]));

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    article.appendChild(toggle);
    article.appendChild(menu);
  }

  function decorateMessages(messages = lastMessages) {
    lastMessages = Array.isArray(messages) ? messages : [];
    const visible = lastMessages.filter((message) => !isAutomaticAssistantMessage(message));
    const hidden = hiddenIds();
    const articles = [...messagesEl.querySelectorAll(".message")];
    let articleIndex = 0;
    for (const message of visible) {
      const article = articles[articleIndex++];
      if (!article) continue;
      if (hidden.has(message.id)) article.hidden = true;
      updateStatus(article, message);
      addMessageActions(article, message);
    }
  }

  function markRead(messages = lastMessages) {
    if (!currentChatId || !Array.isArray(messages) || !messages.length) return;
    const ownId = participantId();
    const messageIds = messages
      .filter((message) => message.role === "user" && message.context?.participantId !== ownId)
      .map((message) => message.id)
      .filter(Boolean);
    if (!messageIds.length) return;
    fetch(`/api/chats/${encodeURIComponent(currentChatId)}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: participantContext(), messageIds })
    }).catch(() => {});
  }

  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (currentChatId && document.visibilityState === "visible" && typeof loadChat === "function") loadChat(currentChatId).catch(() => {});
    }, 180);
  }

  function openStream(chatId) {
    if (!chatId || !window.EventSource) return;
    if (stream) stream.close();
    stream = new EventSource(`/api/chats/${encodeURIComponent(chatId)}/events?participantId=${encodeURIComponent(participantId())}`);
    const onUpdate = (event) => {
      try {
        const data = JSON.parse(event.data || "{}");
        if (Array.isArray(data.participants)) renderPresence(data.participants);
      } catch { return; }
      scheduleReload();
    };
    stream.addEventListener("snapshot", (event) => {
      try { renderPresence(JSON.parse(event.data || "{}").participants || []); } catch { return; }
    });
    stream.addEventListener("message", onUpdate);
    stream.addEventListener("receipt", onUpdate);
    stream.addEventListener("delivery", onUpdate);
    stream.addEventListener("presence", onUpdate);
    stream.onerror = () => {
      stream?.close();
      stream = null;
      setTimeout(() => { if (currentChatId === chatId) openStream(chatId); }, 2500);
    };
  }

  function install() {
    if (installed || typeof renderMessages !== "function" || typeof requestJson !== "function") return;
    installed = true;
    ensureStyle();

    const originalRequestJson = requestJson;
    requestJson = async function advancedRequestJson(url, options = {}) {
      const data = await originalRequestJson(url, options);
      if (data?.chat?.participants) renderPresence(data.chat.participants);
      if (data?.participants) renderPresence(data.participants);
      if (data?.typingParticipants) renderPresence(lastPresence);
      return data;
    };

    const originalRenderMessages = renderMessages;
    renderMessages = function advancedRenderMessages(messages = []) {
      originalRenderMessages(messages);
      decorateMessages(messages);
      markRead(messages);
    };

    const originalSaveCurrentChat = saveCurrentChat;
    saveCurrentChat = function advancedSaveCurrentChat(chatId) {
      originalSaveCurrentChat(chatId);
      openStream(chatId);
    };

    if (currentChatId) openStream(currentChatId);
    renderPresence([]);
  }

  window.addEventListener("load", () => setTimeout(install, 900), { once: true });
  setTimeout(install, 1800);
})();
