(() => {
  const storageKey = "switchboard-bubble-color";
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
  let selectedColor = normalizeColor(getStored(storageKey) || "");
  let knownParticipants = [];
  let modal = null;
  let grid = null;
  let modalStatus = null;
  let confirmButton = null;
  let pendingResolve = null;
  let pendingColor = selectedColor;

  function normalizeColor(value) {
    if (typeof value !== "string") return "";
    const color = value.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : "";
  }

  function currentParticipantId() {
    let value = getStored(participantStorageKey);
    if (!value) {
      value = crypto?.randomUUID ? crypto.randomUUID() : `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setStored(participantStorageKey, value);
    }
    return value;
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
    if (ownColor) {
      selectedColor = ownColor;
      pendingColor = ownColor;
      setStored(storageKey, ownColor);
    }
  }

  function usedColors() {
    return new Set(
      knownParticipants
        .filter((participant) => participant.participantId !== currentParticipantId())
        .map((participant) => normalizeColor(participant.bubbleColor))
        .filter(Boolean)
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

      .bubble-color-modal[hidden] {
        display: none;
      }

      .bubble-color-card {
        width: min(420px, calc(100vw - 32px));
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

      .bubble-color-actions button {
        min-height: 40px;
        padding: 0 14px;
        border-radius: 999px;
        font-weight: 760;
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

      @media (max-width: 420px) {
        .bubble-color-card {
          padding: 16px;
          border-radius: 16px;
        }

        .bubble-color-grid {
          gap: 8px;
        }

        .bubble-color-option {
          min-height: 42px;
        }
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
        <h2 id="bubbleColorTitle">Pick your chat color</h2>
        <p>Choose a message bubble color. Colors already used in this chat are locked.</p>
        <div class="bubble-color-grid" id="bubbleColorGrid" role="group" aria-label="Bubble color choices"></div>
        <div class="plus-menu-status" id="bubbleColorStatus" aria-live="polite"></div>
        <div class="bubble-color-actions">
          <button class="send-button" id="bubbleColorConfirm" type="button">Use color</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    grid = modal.querySelector("#bubbleColorGrid");
    modalStatus = modal.querySelector("#bubbleColorStatus");
    confirmButton = modal.querySelector("#bubbleColorConfirm");
    confirmButton.addEventListener("click", () => {
      const normalized = normalizeColor(pendingColor);
      if (!normalized) {
        modalStatus.textContent = "Pick a color to continue.";
        return;
      }
      if (colorIsTaken(normalized)) {
        modalStatus.textContent = "That color is already taken in this chat.";
        renderColorChoices();
        return;
      }
      selectedColor = normalized;
      setStored(storageKey, selectedColor);
      modal.hidden = true;
      setMenuStatus("");
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve?.(selectedColor);
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

  function openColorPicker() {
    ensureModal();
    pendingColor = colorIsTaken(selectedColor) ? "" : selectedColor;
    renderColorChoices();
    modal.hidden = false;
    modalStatus.textContent = "";
    grid.querySelector("button:not(:disabled)")?.focus();
    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  async function ensureBubbleColor() {
    if (selectedColor && !colorIsTaken(selectedColor)) return selectedColor;
    if (selectedColor && colorIsTaken(selectedColor)) {
      selectedColor = "";
      removeStored(storageKey);
    }
    return openColorPicker();
  }

  function withBubbleColorBody(url, options = {}) {
    if (!selectedColor || !options.body || typeof options.body !== "string") return options;
    const target = String(url || "");
    const shouldAttach = target === "/api/chat" || /\/api\/chats\/[^/]+\/(participants|typing|messages)$/.test(target);
    if (!shouldAttach) return options;
    try {
      const body = JSON.parse(options.body);
      if (body.context && typeof body.context === "object" && !Array.isArray(body.context)) {
        body.context.bubbleColor = selectedColor;
      } else if (target === "/api/chat") {
        body.context = { bubbleColor: selectedColor };
      }
      return { ...options, body: JSON.stringify(body) };
    } catch (error) {
      return options;
    }
  }

  if (typeof requestJson === "function") {
    const originalRequestJson = requestJson;
    requestJson = async function bubbleColorRequestJson(url, options = {}) {
      try {
        const data = await originalRequestJson(url, withBubbleColorBody(url, options));
        absorbParticipants(data);
        return data;
      } catch (error) {
        if (/bubble color|color is already/i.test(error.message || "")) {
          selectedColor = "";
          removeStored(storageKey);
          setMenuStatus("That color is already in use. Pick another color.");
        }
        throw error;
      }
    };
  }

  if (typeof createMessageElement === "function") {
    const originalCreateMessageElement = createMessageElement;
    createMessageElement = function bubbleColorCreateMessageElement(role, content, options = {}) {
      const article = originalCreateMessageElement(role, content, options);
      const color = normalizeColor(options.bubbleColor || options.context?.bubbleColor || (role === "user" ? selectedColor : ""));
      if (role === "user" && color) {
        const bubble = article.querySelector(".bubble");
        bubble?.classList.add("participant-bubble");
        bubble?.style.setProperty("--bubble-color", color);
      }
      return article;
    };
  }

  if (typeof renderMessages === "function") {
    renderMessages = function bubbleColorRenderMessages(messages = []) {
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
        messagesEl.appendChild(createMessageElement(message.role, message.content, {
          createdAt: message.createdAt,
          attachments,
          participantType: context.participantType || "original",
          participantLabel: context.participantLabel || "",
          bubbleColor: context.bubbleColor
        }));
        if (message.role === "user" || message.role === "assistant") chatHistory.push({ role: message.role, content: message.content });
      }
      scrollToBottom();
    };
  }

  if (typeof addMessage === "function") {
    const originalAddMessage = addMessage;
    addMessage = function bubbleColorAddMessage(role, content, options = {}) {
      const nextOptions = role === "user" && selectedColor && !options.bubbleColor
        ? { ...options, bubbleColor: selectedColor }
        : options;
      return originalAddMessage(role, content, nextOptions);
    };
  }

  if (typeof sendMessage === "function") {
    const originalSendMessage = sendMessage;
    sendMessage = async function bubbleColorSendMessage(...args) {
      const message = inputEl.value.trim();
      const attachments = selectedAttachments.slice();
      if ((!message && !attachments.length) || isSending) return;
      await ensureBubbleColor();
      return originalSendMessage.apply(this, args);
    };
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !modal || modal.hidden) return;
    event.preventDefault();
    modal.hidden = true;
  });
})();
