(() => {
  const colorStorageKey = "switchboard-bubble-color";
  const nicknameStorageKey = "switchboard-chat-nickname";
  const participantStorageKey = "switchboard-participant-id";
  const colorChoices = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#9333ea",
    "#f97316",
    "#0891b2",
    "#be123c",
    "#4f46e5"
  ];
  const queryParams = new URLSearchParams(window.location.search);
  const sharedChatId = queryParams.get("chat") || "";
  const sharedLinkNumber = Math.max(1, Number(queryParams.get("share") || 1));
  let selectedColor = normalizeColor(getStored(colorStorageKey) || "");
  let selectedNickname = cleanNickname(getStored(nicknameStorageKey) || "");
  let knownParticipants = [];
  let modal = null;
  let grid = null;
  let nicknameInput = null;
  let modalStatus = null;
  let confirmButton = null;
  let pendingResolve = null;
  let pendingColor = selectedColor;

  function normalizeColor(value) {
    if (typeof value !== "string") return "";
    const color = value.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : "";
  }

  function cleanNickname(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function currentParticipantId() {
    let value = getStored(participantStorageKey);
    if (!value) {
      value = crypto?.randomUUID ? crypto.randomUUID() : `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setStored(participantStorageKey, value);
    }
    return value;
  }

  function deviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad|tablet/.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/.test(ua))) return "tablet";
    if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
    return "desktop";
  }

  function participantType() {
    if (!sharedChatId) return "original";
    const originKey = `switchboard-origin-chat-${sharedChatId}`;
    return getStored(originKey) === "true" ? "original" : "shared";
  }

  function currentShareCount() {
    const chatId = currentChatId || sharedChatId;
    if (!chatId) return 0;
    const stored = Number(getStored(`switchboard-share-count-${chatId}`) || 0);
    return Math.max(stored, sharedChatId === chatId ? sharedLinkNumber : 0);
  }

  function participantLabel() {
    if (selectedNickname) return selectedNickname;
    if (participantType() === "original") return "Original";
    return `Shared link #${Math.max(1, currentShareCount() || sharedLinkNumber)}`;
  }

  function participantContext(extra = {}) {
    return {
      participantId: currentParticipantId(),
      participantType: participantType(),
      participantLabel: participantLabel(),
      deviceType: deviceType(),
      shareCount: currentShareCount(),
      bubbleColor: selectedColor,
      ...extra
    };
  }

  function setMenuStatus(message) {
    const plusStatus = document.getElementById("plusMenuStatus");
    if (plusStatus) plusStatus.textContent = message || "";
  }

  function absorbParticipants(data = {}) {
    const participants = Array.isArray(data.participants)
      ? data.participants
      : Array.isArray(data.chat?.participants)
        ? data.chat.participants
        : null;
    if (!participants) return;
    knownParticipants = participants;
    const own = participants.find((participant) => participant.participantId === currentParticipantId());
    const ownColor = normalizeColor(own?.bubbleColor);
    if (ownColor && ownColor !== "#2f2f2f") {
      selectedColor = ownColor;
      pendingColor = ownColor;
      setStored(colorStorageKey, ownColor);
    }
    const ownLabel = cleanNickname(own?.participantLabel || "");
    if (ownLabel && !/^Original$|^Shared link/i.test(ownLabel)) {
      selectedNickname = ownLabel;
      setStored(nicknameStorageKey, ownLabel);
    }
  }

  function usedColors() {
    return new Set(
      knownParticipants
        .filter((participant) => participant.participantId !== currentParticipantId())
        .map((participant) => normalizeColor(participant.bubbleColor))
        .filter((color) => color && color !== "#2f2f2f")
    );
  }

  function colorIsTaken(color) {
    return usedColors().has(normalizeColor(color));
  }

  function injectStyles() {
    if (document.getElementById("bubbleColorStyles")) return;
    const style = document.createElement("style");
    style.id = "bubbleColorStyles";
    style.textContent = `
      .bubble-color-modal {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.48);
      }

      .bubble-color-modal[hidden] { display: none; }

      .bubble-color-card {
        width: min(440px, calc(100vw - 32px));
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--composer);
        color: var(--text);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
      }

      .bubble-color-card h2 {
        margin: 0 0 6px;
        font-size: 1.05rem;
        line-height: 1.2;
      }

      .bubble-color-card p {
        margin: 0 0 14px;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .bubble-nickname-label {
        display: grid;
        gap: 6px;
        margin: 0 0 14px;
        color: var(--text);
        font-size: 0.82rem;
        font-weight: 800;
      }

      .bubble-nickname-input {
        width: 100%;
        min-height: 42px;
        padding: 0 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel-soft);
        color: var(--text);
        font: inherit;
      }

      .bubble-color-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .bubble-color-option {
        min-height: 46px;
        border: 2px solid transparent;
        border-radius: 14px;
        background: var(--bubble-choice);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
      }

      .bubble-color-option[aria-pressed="true"] {
        border-color: var(--text);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.3);
      }

      .bubble-color-option:disabled {
        cursor: not-allowed;
        opacity: 0.32;
        filter: grayscale(0.5);
      }

      .bubble-color-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
      }

      .bubble-color-confirm {
        width: auto;
        min-width: 108px;
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        border-radius: 999px;
        background: var(--primary);
        color: #fff;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
      }

      .message.user .bubble.participant-bubble {
        background: var(--bubble-color);
        border-color: transparent;
        color: #fff;
      }

      .message.user .bubble.participant-bubble .participant-label,
      .message.user .bubble.participant-bubble time,
      .message.user .bubble.participant-bubble .message-attachment {
        color: rgba(255, 255, 255, 0.86);
      }

      .seen-status {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        font-size: 0.7rem;
        font-weight: 800;
        line-height: 1.2;
        text-align: right;
      }

      .message.user .bubble.participant-bubble .seen-status {
        color: rgba(255, 255, 255, 0.78);
      }

      @media (max-width: 420px) {
        .bubble-color-card { padding: 16px; border-radius: 16px; }
        .bubble-color-grid { gap: 8px; }
        .bubble-color-option { min-height: 42px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal) return;
    injectStyles();
    modal = document.createElement("div");
    modal.className = "bubble-color-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="bubble-color-card" role="dialog" aria-modal="true" aria-labelledby="bubbleColorTitle">
        <h2 id="bubbleColorTitle">Set up your chat identity</h2>
        <p>Choose a nickname and message bubble color. Colors already used in this chat are locked.</p>
        <label class="bubble-nickname-label" for="bubbleNicknameInput">
          Nickname
          <input class="bubble-nickname-input" id="bubbleNicknameInput" type="text" maxlength="40" autocomplete="nickname" placeholder="Example: Alex" />
        </label>
        <div class="bubble-color-grid" id="bubbleColorGrid" role="group" aria-label="Bubble color choices"></div>
        <div class="plus-menu-status" id="bubbleColorStatus" aria-live="polite"></div>
        <div class="bubble-color-actions">
          <button class="bubble-color-confirm" id="bubbleColorConfirm" type="button">Use color</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    grid = modal.querySelector("#bubbleColorGrid");
    nicknameInput = modal.querySelector("#bubbleNicknameInput");
    modalStatus = modal.querySelector("#bubbleColorStatus");
    confirmButton = modal.querySelector("#bubbleColorConfirm");
    confirmButton.addEventListener("click", () => {
      const normalized = normalizeColor(pendingColor);
      const nickname = cleanNickname(nicknameInput.value);
      if (!nickname) {
        modalStatus.textContent = "Add a nickname to continue.";
        nicknameInput.focus();
        return;
      }
      if (!normalized) {
        modalStatus.textContent = "Pick a color to continue.";
        return;
      }
      if (colorIsTaken(normalized)) {
        modalStatus.textContent = "That color is already taken in this chat.";
        renderColorChoices();
        return;
      }
      selectedNickname = nickname;
      selectedColor = normalized;
      setStored(nicknameStorageKey, selectedNickname);
      setStored(colorStorageKey, selectedColor);
      modal.hidden = true;
      setMenuStatus("");
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve?.(participantContext());
    });
  }

  function renderColorChoices() {
    ensureModal();
    const taken = usedColors();
    grid.innerHTML = "";
    for (const color of colorChoices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bubble-color-option";
      button.style.setProperty("--bubble-choice", color);
      button.setAttribute("aria-label", `${color}${taken.has(color) ? " taken" : ""}`);
      button.setAttribute("aria-pressed", String(normalizeColor(pendingColor) === color));
      button.disabled = taken.has(color);
      button.addEventListener("click", () => {
        pendingColor = color;
        modalStatus.textContent = "";
        renderColorChoices();
      });
      grid.appendChild(button);
    }
    if (taken.size >= colorChoices.length) modalStatus.textContent = "All colors are taken in this chat.";
  }

  function openIdentityPicker() {
    ensureModal();
    pendingColor = colorIsTaken(selectedColor) ? "" : selectedColor;
    nicknameInput.value = selectedNickname;
    renderColorChoices();
    modal.hidden = false;
    modalStatus.textContent = "";
    nicknameInput.focus();
    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  async function ensureChatIdentity() {
    if (selectedNickname && selectedColor && !colorIsTaken(selectedColor)) return participantContext();
    if (selectedColor && colorIsTaken(selectedColor)) {
      selectedColor = "";
      removeStored(colorStorageKey);
    }
    return openIdentityPicker();
  }

  function withParticipantContextBody(url, options = {}) {
    if (!selectedColor || !selectedNickname || !options.body || typeof options.body !== "string") return options;
    const target = String(url || "");
    const shouldAttach = target === "/api/chat" || /\/api\/chats\/[^/]+\/(participants|typing|messages)$/.test(target);
    if (!shouldAttach) return options;
    try {
      const body = JSON.parse(options.body);
      body.context = { ...(body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {}), ...participantContext(body.context || {}) };
      return { ...options, body: JSON.stringify(body) };
    } catch (error) {
      return options;
    }
  }

  function seenLabelsForMessage(message = {}) {
    const createdAt = new Date(message.createdAt || 0).getTime();
    const messageId = message.id;
    if (!messageId && !createdAt) return [];
    return knownParticipants
      .filter((participant) => participant.participantId !== (message.context || {}).participantId)
      .filter((participant) => {
        const readAt = participant.lastReadAt || participant.lastSeenAt;
        if (participant.lastReadMessageId && messageId) return participant.lastReadMessageId === messageId;
        return readAt && new Date(readAt).getTime() >= createdAt;
      })
      .map((participant) => participant.participantLabel)
      .filter(Boolean);
  }

  function appendSeenStatus(article, message = {}) {
    if (message.role !== "user") return;
    const labels = seenLabelsForMessage(message);
    if (!labels.length) return;
    const bubble = article.querySelector(".bubble");
    if (!bubble || bubble.querySelector(".seen-status")) return;
    const status = document.createElement("span");
    status.className = "seen-status";
    status.textContent = labels.length === 1 ? `Seen by ${labels[0]}` : `Seen by ${labels.length}`;
    bubble.appendChild(status);
  }

  async function markChatRead(data = {}) {
    const chat = data.chat;
    if (!chat?.id || !Array.isArray(chat.messages) || !chat.messages.length || !selectedColor || !selectedNickname) return;
    await fetch(`/api/chats/${encodeURIComponent(chat.id)}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: participantContext() })
    }).then((response) => response.json()).then(absorbParticipants).catch(() => {});
  }

  if (typeof requestJson === "function") {
    const originalRequestJson = requestJson;
    requestJson = async function identityRequestJson(url, options = {}) {
      try {
        const data = await originalRequestJson(url, withParticipantContextBody(url, options));
        absorbParticipants(data);
        if (/\/api\/chats\/[^/?]+(?:\?|$)/.test(String(url || "")) && (!options.method || options.method === "GET")) markChatRead(data);
        return data;
      } catch (error) {
        if (/bubble color|color is already/i.test(error.message || "")) {
          selectedColor = "";
          removeStored(colorStorageKey);
          setMenuStatus("That color is already in use. Pick another color.");
        }
        throw error;
      }
    };
  }

  if (typeof createMessageElement === "function") {
    const originalCreateMessageElement = createMessageElement;
    createMessageElement = function identityCreateMessageElement(role, content, options = {}) {
      const article = originalCreateMessageElement(role, content, options);
      const color = normalizeColor(options.bubbleColor || options.context?.bubbleColor || "");
      if (role === "user" && color) {
        const bubble = article.querySelector(".bubble");
        bubble?.classList.add("participant-bubble");
        bubble?.style.setProperty("--bubble-color", color);
      }
      return article;
    };
  }

  if (typeof renderMessages === "function") {
    renderMessages = function identityRenderMessages(messages = []) {
      messagesEl.innerHTML = "";
      chatHistory = [];
      const visibleMessages = messages.filter((message) => !isAutomaticAssistantMessage(message));
      if (!visibleMessages.length) {
        renderWelcome();
        return;
      }
      for (const message of visibleMessages) {
        const context = message.context || {};
        const attachments = Array.isArray(context.attachments) ? context.attachments : [];
        const article = createMessageElement(message.role, message.content, {
          createdAt: message.createdAt,
          attachments,
          participantType: context.participantType || "original",
          participantLabel: context.participantLabel || "",
          bubbleColor: context.bubbleColor
        });
        appendSeenStatus(article, message);
        messagesEl.appendChild(article);
        if (message.role === "user" || message.role === "assistant") chatHistory.push({ role: message.role, content: message.content });
      }
      scrollToBottom();
    };
  }

  if (typeof addMessage === "function") {
    const originalAddMessage = addMessage;
    addMessage = function identityAddMessage(role, content, options = {}) {
      const nextOptions = role === "user"
        ? { ...options, bubbleColor: options.bubbleColor || selectedColor, participantLabel: options.participantLabel || participantLabel() }
        : options;
      return originalAddMessage(role, content, nextOptions);
    };
  }

  if (typeof sendMessage === "function") {
    const originalSendMessage = sendMessage;
    sendMessage = async function identitySendMessage(...args) {
      const message = inputEl.value.trim();
      const attachments = selectedAttachments.slice();
      if ((!message && !attachments.length) || isSending) return;
      await ensureChatIdentity();
      return originalSendMessage.apply(this, args);
    };
  }

  if (typeof createChat === "function") {
    const originalCreateChat = createChat;
    createChat = async function identityCreateChat(...args) {
      await originalCreateChat.apply(this, args);
      await ensureChatIdentity();
      if (currentChatId) {
        await requestJson(`/api/chats/${encodeURIComponent(currentChatId)}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: participantContext() })
        }).catch(() => {});
      }
    };
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !modal || modal.hidden) return;
    event.preventDefault();
    modal.hidden = true;
  });
})();
