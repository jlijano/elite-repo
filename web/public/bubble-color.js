(() => {
  const colorKey = "switchboard-bubble-color";
  const nicknameKey = "switchboard-chat-nickname";
  const participantKey = "switchboard-participant-id";
  const quickReplyId = "chatQuickReplies";
  const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f97316", "#0891b2", "#be123c", "#4f46e5"];
  const params = new URLSearchParams(location.search);
  const sharedChatId = params.get("chat") || "";
  const sharedLinkNumber = Math.max(1, Number(params.get("share") || 1));
  let selectedColor = normalizeColor(getStored(colorKey) || "");
  let selectedNickname = cleanNickname(getStored(nicknameKey) || "");
  let participants = [];
  let modal = null;
  let pendingColor = selectedColor;
  let pendingResolve = null;
  let lastTypingStartAt = 0;
  let lastTypingStopAt = 0;

  function normalizeColor(value) {
    const color = String(value || "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : "";
  }

  function cleanNickname(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function currentParticipantId() {
    let id = getStored(participantKey);
    if (!id) {
      id = crypto?.randomUUID ? crypto.randomUUID() : `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setStored(participantKey, id);
    }
    return id;
  }

  function deviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/ipad|tablet/.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/.test(ua))) return "tablet";
    if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
    return "desktop";
  }

  function participantType() {
    if (!sharedChatId) return "original";
    return getStored(`switchboard-origin-chat-${sharedChatId}`) === "true" ? "original" : "shared";
  }

  function currentShareCount() {
    const chatId = currentChatId || sharedChatId;
    const stored = Number(getStored(`switchboard-share-count-${chatId}`) || 0);
    return Math.max(stored, sharedChatId === chatId ? sharedLinkNumber : 0);
  }

  function fallbackLabel() {
    return participantType() === "original" ? "Original" : `Shared link #${Math.max(1, currentShareCount() || sharedLinkNumber)}`;
  }

  function ownLabel() {
    return selectedNickname || fallbackLabel();
  }

  function context(extra = {}) {
    return {
      participantId: currentParticipantId(),
      participantType: participantType(),
      participantLabel: ownLabel(),
      deviceType: deviceType(),
      shareCount: currentShareCount(),
      bubbleColor: selectedColor,
      ...extra
    };
  }

  function participantById(id) {
    return participants.find((participant) => participant.participantId === id) || null;
  }

  function preferredLabel(rawLabel) {
    const label = cleanNickname(rawLabel);
    return label && !/^Original$|^Shared link/i.test(label) ? label : "";
  }

  function displayLabel(message = {}) {
    const senderId = message.context?.participantId || "";
    const sender = participantById(senderId);
    return preferredLabel(sender?.participantLabel)
      || preferredLabel(message.context?.participantLabel)
      || (senderId === currentParticipantId() && selectedNickname ? selectedNickname : "")
      || fallbackLabel();
  }

  function setMenuStatus(message) {
    const status = document.getElementById("plusMenuStatus");
    if (status) status.textContent = message || "";
  }

  function absorbParticipants(data = {}) {
    const next = Array.isArray(data.participants) ? data.participants : Array.isArray(data.chat?.participants) ? data.chat.participants : null;
    if (!next) return;
    participants = next;
    const own = participantById(currentParticipantId());
    const color = normalizeColor(own?.bubbleColor);
    if (color && color !== "#2f2f2f") {
      selectedColor = color;
      pendingColor = color;
      setStored(colorKey, color);
    }
    const nickname = preferredLabel(own?.participantLabel);
    if (nickname) {
      selectedNickname = nickname;
      setStored(nicknameKey, nickname);
    }
  }

  function usedColors() {
    return new Set(participants
      .filter((participant) => participant.participantId !== currentParticipantId())
      .map((participant) => normalizeColor(participant.bubbleColor))
      .filter((color) => color && color !== "#2f2f2f"));
  }

  function colorTaken(color) {
    return usedColors().has(normalizeColor(color));
  }

  function injectStyles() {
    if (document.getElementById("bubbleColorStyles")) return;
    const style = document.createElement("style");
    style.id = "bubbleColorStyles";
    style.textContent = `
      .bubble-color-modal{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.48)}
      .bubble-color-modal[hidden]{display:none}.bubble-color-card{width:min(440px,calc(100vw - 32px));padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--composer);color:var(--text);box-shadow:0 24px 70px rgba(0,0,0,.28)}
      .bubble-color-card h2{margin:0 0 6px;font-size:1.05rem;line-height:1.2}.bubble-color-card p{margin:0 0 14px;color:var(--muted);font-size:.9rem;line-height:1.4}
      .bubble-nickname-label{display:grid;gap:6px;margin:0 0 14px;color:var(--text);font-size:.82rem;font-weight:800}.bubble-nickname-input{width:100%;min-height:42px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel-soft);color:var(--text);font:inherit}
      .bubble-color-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.bubble-color-option{min-height:46px;border:2px solid transparent;border-radius:14px;background:var(--bubble-choice);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}
      .bubble-color-option[aria-pressed="true"]{border-color:var(--text);box-shadow:0 0 0 3px rgba(37,99,235,.22),inset 0 0 0 1px rgba(255,255,255,.3)}.bubble-color-option:disabled{cursor:not-allowed;opacity:.32;filter:grayscale(.5)}
      .bubble-color-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.bubble-color-confirm{width:auto;min-width:108px;min-height:42px;display:inline-flex;align-items:center;justify-content:center;padding:0 16px;border-radius:999px;background:var(--primary);color:#fff;font-weight:800;line-height:1;white-space:nowrap}
      .message.user .bubble.participant-bubble{background:var(--bubble-color);border-color:transparent;color:#fff}.participant-label{display:block;margin-bottom:5px;font-size:.72rem;font-weight:900;line-height:1.2;color:inherit;opacity:.88}
      .message.user .bubble.participant-bubble time,.message.user .bubble.participant-bubble .message-attachment{color:rgba(255,255,255,.86)}.message-status{display:block;margin-top:6px;color:var(--muted);font-size:.7rem;font-weight:800;line-height:1.2;text-align:right}.message-status.failed{color:#ffb4b4}.message.user .bubble.participant-bubble .message-status{color:rgba(255,255,255,.78)}.message.user .bubble.participant-bubble .message-status.failed{color:#ffe1e1}
      .quick-replies{display:flex;flex-wrap:wrap;gap:8px;margin:-2px 8px 10px}.quick-replies button{min-height:34px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel-soft);color:var(--text);font-weight:760}.quick-replies button:hover,.quick-replies button:focus-visible{border-color:var(--composer-border);background:var(--composer)}
      @media (max-width:420px){.bubble-color-card{padding:16px;border-radius:16px}.bubble-color-grid{gap:8px}.bubble-color-option{min-height:42px}.quick-replies{gap:6px}.quick-replies button{min-height:32px;padding:0 10px}}
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
        <label class="bubble-nickname-label" for="bubbleNicknameInput">Nickname<input class="bubble-nickname-input" id="bubbleNicknameInput" type="text" maxlength="40" autocomplete="nickname" placeholder="Example: Alex"></label>
        <div class="bubble-color-grid" id="bubbleColorGrid" role="group" aria-label="Bubble color choices"></div>
        <div class="plus-menu-status" id="bubbleColorStatus" aria-live="polite"></div>
        <div class="bubble-color-actions"><button class="bubble-color-confirm" id="bubbleColorConfirm" type="button">Start chat</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector("#bubbleColorConfirm").addEventListener("click", () => {
      const nicknameInput = modal.querySelector("#bubbleNicknameInput");
      const status = modal.querySelector("#bubbleColorStatus");
      const nickname = cleanNickname(nicknameInput.value);
      const color = normalizeColor(pendingColor);
      if (!nickname) { status.textContent = "Add a nickname to continue."; nicknameInput.focus(); return; }
      if (!color) { status.textContent = "Pick a color to continue."; return; }
      if (colorTaken(color)) { status.textContent = "That color is already taken in this chat."; renderColors(); return; }
      selectedNickname = nickname;
      selectedColor = color;
      setStored(nicknameKey, nickname);
      setStored(colorKey, color);
      modal.hidden = true;
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve?.(context());
    });
  }

  function renderColors() {
    ensureModal();
    const grid = modal.querySelector("#bubbleColorGrid");
    const status = modal.querySelector("#bubbleColorStatus");
    const taken = usedColors();
    grid.innerHTML = "";
    for (const color of colors) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bubble-color-option";
      button.style.setProperty("--bubble-choice", color);
      button.setAttribute("aria-label", taken.has(color) ? `${color} taken` : color);
      button.setAttribute("aria-pressed", String(normalizeColor(pendingColor) === color));
      button.disabled = taken.has(color);
      button.addEventListener("click", () => { pendingColor = color; status.textContent = ""; renderColors(); });
      grid.appendChild(button);
    }
    if (taken.size >= colors.length) status.textContent = "All colors are taken in this chat.";
  }

  function openIdentityPicker() {
    ensureModal();
    pendingColor = colorTaken(selectedColor) ? "" : selectedColor;
    modal.querySelector("#bubbleNicknameInput").value = selectedNickname;
    modal.querySelector("#bubbleColorStatus").textContent = "";
    renderColors();
    modal.hidden = false;
    modal.querySelector("#bubbleNicknameInput").focus();
    return new Promise((resolve) => { pendingResolve = resolve; });
  }

  async function ensureIdentity() {
    if (selectedNickname && selectedColor && !colorTaken(selectedColor)) return context();
    if (selectedColor && colorTaken(selectedColor)) { selectedColor = ""; removeStored(colorKey); }
    return openIdentityPicker();
  }

  function withContext(url, options = {}) {
    if (!selectedColor || !selectedNickname || !options.body || typeof options.body !== "string") return options;
    const target = String(url || "");
    if (target !== "/api/chat" && !/\/api\/chats\/[^/]+\/(participants|typing|messages)$/.test(target)) return options;
    try {
      const body = JSON.parse(options.body);
      body.context = { ...(body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {}), ...context(body.context || {}) };
      return { ...options, body: JSON.stringify(body) };
    } catch {
      return options;
    }
  }

  function shouldSendTyping(url, options = {}) {
    if (!/\/api\/chats\/[^/]+\/typing$/.test(String(url || "")) || !options.body) return true;
    try {
      const body = JSON.parse(options.body);
      const now = Date.now();
      if (body.isTyping !== false) {
        if (now - lastTypingStartAt < 1800) return false;
        lastTypingStartAt = now;
        return true;
      }
      if (now - lastTypingStopAt < 900) return false;
      lastTypingStopAt = now;
      return true;
    } catch {
      return true;
    }
  }

  function readLabels(message = {}) {
    const createdAt = new Date(message.createdAt || 0).getTime();
    const senderId = message.context?.participantId || "";
    if (!createdAt) return [];
    return participants
      .filter((participant) => participant.participantId && participant.participantId !== senderId)
      .filter((participant) => participant.lastSeenAt && new Date(participant.lastSeenAt).getTime() >= createdAt)
      .map((participant) => preferredLabel(participant.participantLabel) || participant.participantLabel)
      .filter(Boolean);
  }

  function statusText(message = {}) {
    const labels = readLabels(message);
    if (labels.length === 1) return `Seen by ${labels[0]}`;
    if (labels.length > 1) return `Seen by ${labels.length}`;
    return "Delivered";
  }

  function appendStatus(article, text, state = "delivered") {
    const bubble = article?.querySelector(".bubble");
    if (!bubble || !text) return;
    bubble.querySelector(".message-status")?.remove();
    const status = document.createElement("span");
    status.className = `message-status ${state}`;
    status.textContent = text;
    bubble.appendChild(status);
  }

  function updatePending(text, state) {
    document.querySelectorAll(".message.user .message-status.pending").forEach((status) => {
      status.textContent = text;
      status.className = `message-status ${state}`;
    });
  }

  async function markRead(data = {}) {
    const chat = data.chat;
    if (!chat?.id || !Array.isArray(chat.messages) || !chat.messages.length || !selectedColor || !selectedNickname) return;
    await fetch(`/api/chats/${encodeURIComponent(chat.id)}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: context() })
    }).then((response) => response.json()).then(absorbParticipants).catch(() => {});
  }

  function installQuickReplies() {
    if (!getStored("switchboard-enable-chat-suggestions")) {
      document.getElementById(quickReplyId)?.remove();
      return;
    }
    if (document.getElementById(quickReplyId)) return;
    const row = document.createElement("div");
    row.id = quickReplyId;
    row.className = "quick-replies";
    row.setAttribute("aria-label", "Quick replies");
    const replies = [
      ["Yes", () => { inputEl.value = "Yes"; resizeInput(); sendMessage(); }],
      ["No", () => { inputEl.value = "No"; resizeInput(); sendMessage(); }],
      ["Send file", () => document.getElementById("attachFileButton")?.click() || fileInput?.click()],
      ["Start new chat", () => createChat().catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true }))],
      ["Share link", () => document.getElementById("shareChatButton")?.click()]
    ];
    for (const [label, action] of replies) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", action);
      row.appendChild(button);
    }
    document.getElementById("typingStatus")?.insertAdjacentElement("afterend", row);
  }

  if (typeof requestJson === "function") {
    const originalRequestJson = requestJson;
    requestJson = async function identityRequestJson(url, options = {}) {
      if (!shouldSendTyping(url, options)) return {};
      try {
        const data = await originalRequestJson(url, withContext(url, options));
        absorbParticipants(data);
        if (String(url || "") === "/api/chat" || /\/api\/chats\/[^/]+\/messages$/.test(String(url || ""))) updatePending("Delivered", "delivered");
        if (/\/api\/chats\/[^/?]+(?:\?|$)/.test(String(url || "")) && (!options.method || options.method === "GET")) markRead(data);
        return data;
      } catch (error) {
        if (String(url || "") === "/api/chat" || /\/api\/chats\/[^/]+\/messages$/.test(String(url || ""))) updatePending("Failed", "failed");
        if (/bubble color|color is already/i.test(error.message || "")) {
          selectedColor = "";
          removeStored(colorKey);
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
      const bubble = article.querySelector(".bubble");
      if (role === "user" && bubble) {
        const label = cleanNickname(options.participantLabel || "");
        if (label) {
          const labelEl = document.createElement("span");
          labelEl.className = "participant-label";
          labelEl.textContent = label;
          bubble.insertBefore(labelEl, bubble.firstChild);
        }
        const color = normalizeColor(options.bubbleColor || options.context?.bubbleColor || "");
        if (color) {
          bubble.classList.add("participant-bubble");
          bubble.style.setProperty("--bubble-color", color);
        }
      }
      return article;
    };
  }

  if (typeof renderMessages === "function") {
    renderMessages = function identityRenderMessages(messages = []) {
      messagesEl.innerHTML = "";
      chatHistory = [];
      const visible = messages.filter((message) => !isAutomaticAssistantMessage(message));
      if (!visible.length) { renderWelcome(); return; }
      for (const message of visible) {
        const messageContext = message.context || {};
        const article = createMessageElement(message.role, message.content, {
          createdAt: message.createdAt,
          attachments: Array.isArray(messageContext.attachments) ? messageContext.attachments : [],
          participantLabel: displayLabel(message),
          bubbleColor: messageContext.bubbleColor
        });
        if (message.role === "user") appendStatus(article, statusText(message));
        messagesEl.appendChild(article);
        if (message.role === "user" || message.role === "assistant") chatHistory.push({ role: message.role, content: message.content });
      }
      scrollToBottom();
    };
  }

  if (typeof addMessage === "function") {
    const originalAddMessage = addMessage;
    addMessage = function identityAddMessage(role, content, options = {}) {
      originalAddMessage(role, content, role === "user" ? { ...options, bubbleColor: options.bubbleColor || selectedColor, participantLabel: options.participantLabel || ownLabel() } : options);
      if (role === "user") appendStatus(messagesEl.lastElementChild, "Sending...", "pending");
    };
  }

  if (typeof sendMessage === "function") {
    const originalSendMessage = sendMessage;
    sendMessage = async function identitySendMessage(...args) {
      const message = inputEl.value.trim();
      if ((!message && !selectedAttachments.length) || isSending) return;
      await ensureIdentity();
      return originalSendMessage.apply(this, args);
    };
  }

  if (typeof createChat === "function") {
    const originalCreateChat = createChat;
    createChat = async function identityCreateChat(...args) {
      await ensureIdentity();
      await originalCreateChat.apply(this, args);
      if (currentChatId) {
        await requestJson(`/api/chats/${encodeURIComponent(currentChatId)}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: context() })
        }).catch(() => {});
      }
    };
  }

  installQuickReplies();
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !modal || modal.hidden) return;
    event.preventDefault();
    modal.querySelector("#bubbleNicknameInput")?.focus();
  });
})();
