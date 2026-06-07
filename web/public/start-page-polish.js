(() => {
  const polishStyleId = "secureRoomStartPolishStyles";
  const quickPrompts = [
    "Share this room link",
    "Explain what auto-delete does",
    "Invite a teammate"
  ];

  function installStyles() {
    if (document.getElementById(polishStyleId)) return;
    const style = document.createElement("style");
    style.id = polishStyleId;
    style.textContent = `
      body.secure-room-layout { background: #111214; }
      body.secure-room-layout .app-shell {
        grid-template-columns: minmax(280px, 392px) minmax(0, 1fr) !important;
        gap: 16px;
        width: 100vw;
        height: 100dvh;
        padding: 16px;
        background:
          radial-gradient(circle at 20% 12%, rgba(255, 255, 255, 0.055), transparent 28%),
          linear-gradient(135deg, #151617 0%, #0c0d0f 100%);
      }
      body.secure-room-layout .secure-room-sidebar,
      body.secure-room-layout .app-shell .chat-panel {
        min-height: 0;
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 18px;
        background:
          radial-gradient(circle at 16% 10%, rgba(255, 255, 255, 0.07), transparent 32%),
          rgba(20, 21, 23, 0.88);
        color: var(--text);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.24);
      }
      body.secure-room-layout .secure-room-sidebar {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 22px;
        padding: 28px;
      }
      .secure-room-lock,
      .room-header-lock,
      .secure-room-settings {
        display: inline-grid;
        place-items: center;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }
      .secure-room-lock { width: 54px; height: 54px; font-size: 1.45rem; }
      .secure-room-copy { display: grid; gap: 6px; }
      .secure-room-copy h2 { margin: 0; font-size: clamp(1.35rem, 2vw, 1.65rem); line-height: 1.15; }
      .secure-room-copy p { margin: 0; color: var(--muted); font-size: 1rem; line-height: 1.4; }
      .secure-room-share {
        min-height: 62px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding: 0 18px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 14px;
        background: transparent;
        color: var(--text);
        font-size: 1.05rem;
        font-weight: 850;
      }
      .secure-room-share:hover,
      .secure-room-share:focus-visible { background: rgba(255, 255, 255, 0.07); }
      .secure-room-sidebar-spacer { min-height: 1px; }
      .secure-room-settings {
        width: 56px;
        height: 56px;
        border: 0;
        font-size: 1.35rem;
      }
      body.secure-room-layout .app-shell .chat-panel {
        position: relative;
        height: calc(100dvh - 32px) !important;
        overflow: hidden !important;
        grid-template-rows: 118px minmax(0, 1fr) !important;
      }
      body.secure-room-layout .chat-header {
        min-height: 118px;
        justify-content: flex-start;
        gap: 20px;
        padding: 0 30px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.13);
        background: rgba(12, 13, 15, 0.42);
      }
      body.secure-room-layout .chat-close-button {
        width: 46px;
        height: 46px;
        min-height: 46px;
        border-color: rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.04);
      }
      body.secure-room-layout .room-header-lock { width: 58px; height: 58px; flex: 0 0 58px; font-size: 1.35rem; }
      .room-header-copy { min-width: 0; display: grid; gap: 4px; margin-right: auto; }
      .room-header-copy h1 { margin: 0; font-size: clamp(1.25rem, 2vw, 1.55rem); line-height: 1.2; }
      .room-header-copy p { margin: 0; color: var(--muted); font-size: 1rem; line-height: 1.35; }
      .room-menu-button {
        width: 44px;
        height: 44px;
        display: inline-grid;
        place-items: center;
        border-radius: 50%;
        background: transparent;
        color: var(--text);
        font-size: 1.4rem;
        font-weight: 900;
      }
      .room-menu-button:hover,
      .room-menu-button:focus-visible { background: rgba(255, 255, 255, 0.08); }
      body.secure-room-layout .header-actions { gap: 8px; }
      body.secure-room-layout .theme-toggle { min-height: 44px; border-color: rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.05); }
      body.secure-room-layout .app-shell .messages {
        max-height: none !important;
        height: auto !important;
        padding: 54px clamp(22px, 5vw, 76px) 170px !important;
        background: transparent;
        scroll-padding-bottom: 170px !important;
      }
      body.secure-room-layout .message { width: 100%; max-width: 1120px; }
      body.secure-room-layout .message.user .bubble {
        border-radius: 16px;
        background: linear-gradient(135deg, #0b8cff, #0566f5);
        color: #ffffff;
        box-shadow: 0 12px 32px rgba(0, 112, 255, 0.22);
      }
      body.secure-room-layout .message.assistant .bubble {
        padding: 0.78rem 1rem;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.08);
      }
      .secure-welcome { max-width: 1120px; margin: 0 auto; display: grid; gap: 28px; }
      .secure-welcome-date { justify-self: center; color: var(--muted); font-weight: 760; }
      .secure-welcome-row { display: flex; align-items: flex-start; gap: 12px; }
      .secure-welcome-row.outgoing { justify-content: flex-end; }
      .secure-welcome-bubble {
        max-width: min(540px, 82%);
        padding: 16px 20px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.09);
        color: var(--text);
        font-size: clamp(1rem, 1.9vw, 1.18rem);
        line-height: 1.45;
      }
      .secure-welcome-row.outgoing .secure-welcome-bubble { background: linear-gradient(135deg, #0b8cff, #0566f5); color: #fff; }
      .secure-welcome-meta { margin-top: 8px; color: var(--muted); font-size: 0.82rem; font-weight: 760; text-align: right; }
      .secure-welcome-prompts { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 4px; }
      .secure-welcome-prompts button {
        min-height: 38px;
        padding: 0 13px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        font-weight: 780;
      }
      .secure-welcome-prompts button:hover,
      .secure-welcome-prompts button:focus-visible { background: rgba(255, 255, 255, 0.11); }
      body.secure-room-layout .composer {
        position: absolute !important;
        left: clamp(18px, 4vw, 28px) !important;
        right: clamp(18px, 4vw, 28px) !important;
        bottom: max(18px, env(safe-area-inset-bottom)) !important;
        border-radius: 999px;
        background: rgba(32, 33, 36, 0.94);
        backdrop-filter: blur(12px);
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
      }
      body.secure-room-layout .composer-agent-bar { display: none; }
      body.secure-room-layout .composer-input-row { min-height: 78px; padding: 10px 14px; gap: 14px; }
      body.secure-room-layout textarea { min-height: 46px; padding: 0.76rem 0.1rem; font-size: 1.05rem; }
      body.secure-room-layout textarea::placeholder { color: rgba(255, 255, 255, 0.58); }
      body.secure-room-layout .composer-tool,
      body.secure-room-layout .send-button { width: 50px; height: 50px; min-height: 50px; font-size: 1.5rem; }
      body.secure-room-layout .composer-tool { background: rgba(255, 255, 255, 0.07); color: #ffffff; }
      body.secure-room-layout .send-button { background: #0b7cff; color: #ffffff; }
      body.secure-room-layout .send-button:disabled { background: rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.4); opacity: 1; }
      body.secure-room-layout .attachment-tray { padding: 12px 18px 0; }
      body.secure-room-layout .typing-status { margin: 0 22px 4px; }
      [data-theme="light"] body.secure-room-layout,
      body.secure-room-layout:has(:root[data-theme="light"]) { background: #f4f5f6; }
      [data-theme="light"] body.secure-room-layout .app-shell {
        background: linear-gradient(135deg, #f5f6f7, #e9ebee);
      }
      [data-theme="light"] body.secure-room-layout .secure-room-sidebar,
      [data-theme="light"] body.secure-room-layout .app-shell .chat-panel {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(32, 33, 35, 0.12);
      }
      [data-theme="light"] body.secure-room-layout .secure-welcome-bubble,
      [data-theme="light"] body.secure-room-layout .message.assistant .bubble,
      [data-theme="light"] body.secure-room-layout .composer-tool { background: rgba(32, 33, 35, 0.07); color: var(--text); }
      [data-theme="light"] body.secure-room-layout .composer { background: rgba(255, 255, 255, 0.94); }
      [data-theme="light"] body.secure-room-layout textarea::placeholder { color: rgba(32, 33, 35, 0.56); }
      @media (max-width: 920px) {
        body.secure-room-layout .app-shell { grid-template-columns: 1fr !important; padding: 10px; }
        body.secure-room-layout .secure-room-sidebar { display: none; }
        body.secure-room-layout .app-shell .chat-panel { height: calc(100dvh - 20px) !important; border-radius: 16px; }
        body.secure-room-layout .chat-header { min-height: 96px; padding: 0 16px; gap: 12px; }
        body.secure-room-layout .room-header-lock { width: 48px; height: 48px; flex-basis: 48px; }
        body.secure-room-layout .theme-toggle #themeToggleText { display: none; }
      }
      @media (max-width: 560px) {
        body.secure-room-layout .chat-close-button { width: 42px; height: 42px; min-height: 42px; }
        body.secure-room-layout .chat-header { min-height: 88px; }
        body.secure-room-layout .room-header-copy p { font-size: 0.82rem; }
        body.secure-room-layout .room-menu-button { display: none; }
        body.secure-room-layout .app-shell .messages { padding: 28px 14px 150px !important; }
        .secure-welcome { gap: 18px; }
        .secure-welcome-bubble { max-width: 92%; padding: 13px 15px; }
        body.secure-room-layout .composer { left: 10px !important; right: 10px !important; border-radius: 24px; }
        body.secure-room-layout .composer-input-row { min-height: 66px; gap: 8px; padding: 8px; }
        body.secure-room-layout .composer-tool,
        body.secure-room-layout .send-button { width: 44px; height: 44px; min-height: 44px; }
      }
    `;
    document.head.appendChild(style);
  }

  function setThemeToggleCopy(theme = getCurrentTheme()) {
    const isDark = theme === "dark";
    if (themeToggleText) themeToggleText.textContent = isDark ? "Switch to light" : "Switch to dark";
    if (themeToggle) themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    if (themeToggleIcon) themeToggleIcon.textContent = isDark ? "☀" : "☾";
  }

  function patchThemeCopy() {
    if (typeof updateThemeToggle === "function" && updateThemeToggle.__secureRoomPolished !== true) {
      const originalUpdateThemeToggle = updateThemeToggle;
      updateThemeToggle = function secureRoomUpdateThemeToggle(theme) {
        originalUpdateThemeToggle(theme);
        setThemeToggleCopy(theme);
      };
      updateThemeToggle.__secureRoomPolished = true;
    }
    setThemeToggleCopy();
  }

  function installRoomSidebar() {
    const shell = document.querySelector(".app-shell");
    const panel = document.querySelector(".chat-panel");
    if (!shell || !panel || document.getElementById("secureRoomSidebar")) return;
    const sidebar = document.createElement("aside");
    sidebar.id = "secureRoomSidebar";
    sidebar.className = "secure-room-sidebar";
    sidebar.setAttribute("aria-label", "Secure room details");
    sidebar.innerHTML = `
      <div class="secure-room-lock" aria-hidden="true">🔒</div>
      <div class="secure-room-copy">
        <h2>Secure room</h2>
        <p>1 participant</p>
      </div>
      <div>
        <button class="secure-room-share" type="button"><span aria-hidden="true">↗</span><span>Share link</span></button>
      </div>
      <div class="secure-room-sidebar-spacer" aria-hidden="true"></div>
      <button class="secure-room-settings" type="button" aria-label="Switch theme"><span aria-hidden="true">⚙</span></button>
    `;
    shell.insertBefore(sidebar, panel);
    sidebar.querySelector(".secure-room-share")?.addEventListener("click", () => {
      document.getElementById("shareChatButton")?.click();
    });
    sidebar.querySelector(".secure-room-settings")?.addEventListener("click", () => themeToggle?.click());
  }

  function installRoomHeader() {
    const header = document.querySelector(".chat-header");
    if (!header || header.querySelector(".room-header-copy")) return;
    const closeButton = document.getElementById("closeChatButton");
    if (closeButton) {
      closeButton.setAttribute("aria-label", "Archive this room and start a fresh secure room");
      closeButton.setAttribute("title", "Archive room and start fresh");
    }
    const lock = document.createElement("div");
    lock.className = "room-header-lock";
    lock.setAttribute("aria-hidden", "true");
    lock.textContent = "🔒";
    const copy = document.createElement("div");
    copy.className = "room-header-copy";
    copy.innerHTML = `<h1>Secure room</h1><p>Shared link <span aria-hidden="true">•</span> Auto-delete on</p>`;
    const menu = document.createElement("button");
    menu.className = "room-menu-button";
    menu.type = "button";
    menu.setAttribute("aria-label", "Room options");
    menu.textContent = "⋮";
    header.insertBefore(lock, closeButton?.nextSibling || header.firstChild);
    header.insertBefore(copy, lock.nextSibling);
    header.appendChild(menu);
  }

  function updateSendState() {
    if (!sendButton || isSending) return;
    const hasMessage = Boolean(inputEl?.value.trim());
    const hasAttachment = Array.isArray(selectedAttachments) && selectedAttachments.length > 0;
    const enabled = hasMessage || hasAttachment;
    sendButton.disabled = !enabled;
    sendButton.setAttribute("aria-disabled", String(!enabled));
  }

  function patchSendingState() {
    if (typeof setSending === "function" && setSending.__secureRoomPolished !== true) {
      const originalSetSending = setSending;
      setSending = function secureRoomSetSending(nextValue) {
        originalSetSending(nextValue);
        if (!nextValue) updateSendState();
      };
      setSending.__secureRoomPolished = true;
    }
    inputEl?.addEventListener("input", updateSendState);
    if (attachmentTray) new MutationObserver(updateSendState).observe(attachmentTray, { childList: true, subtree: true });
    updateSendState();
  }

  function buildWelcome() {
    const wrapper = document.createElement("div");
    wrapper.className = "secure-welcome";
    wrapper.innerHTML = `
      <div class="secure-welcome-date">Today</div>
      <div class="secure-welcome-row outgoing">
        <div class="secure-welcome-bubble">Secure room is ready.<div class="secure-welcome-meta">Auto-delete on</div></div>
      </div>
      <div class="secure-welcome-row">
        <div class="secure-welcome-bubble">Type a message, attach a file, or share the room link when you are ready.</div>
      </div>
      <div class="secure-welcome-prompts" aria-label="Starter prompts"></div>
    `;
    const promptRow = wrapper.querySelector(".secure-welcome-prompts");
    quickPrompts.forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = prompt;
      button.addEventListener("click", () => {
        inputEl.value = prompt;
        resizeInput();
        inputEl.focus();
        updateSendState();
      });
      promptRow.appendChild(button);
    });
    return wrapper;
  }

  function patchWelcome() {
    if (typeof renderWelcome === "function" && renderWelcome.__secureRoomPolished !== true) {
      renderWelcome = function secureRoomRenderWelcome() {
        messagesEl.innerHTML = "";
        chatHistory = [];
        currentChatTitle.textContent = "Secure room";
        messagesEl.appendChild(buildWelcome());
      };
      renderWelcome.__secureRoomPolished = true;
    }
    if (messagesEl?.querySelector(".start-chat-empty") || !messagesEl?.children.length) renderWelcome();
  }

  function applyComposerCopy() {
    if (inputEl) inputEl.placeholder = "Type a message...";
    if (currentChatTitle && currentChatTitle.textContent === "New chat") currentChatTitle.textContent = "Secure room";
  }

  function initialize() {
    document.body.classList.add("secure-room-layout");
    installStyles();
    patchThemeCopy();
    installRoomSidebar();
    installRoomHeader();
    patchSendingState();
    patchWelcome();
    applyComposerCopy();
    setTimeout(() => {
      applyComposerCopy();
      updateSendState();
      if (messagesEl?.querySelector(".start-chat-empty")) patchWelcome();
    }, 420);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();