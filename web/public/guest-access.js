(() => {
  const guestAccessKey = "switchboard-guest-access-choice";
  const extraColors = ["#0f766e", "#ca8a04"];
  let modal = null;
  let lastFocus = null;
  let pendingResolve = null;
  let extraSelectedColor = "";
  let lastCreateChat = null;
  let lastSendMessage = null;

  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }

  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch { return; }
  }

  function isLoggedIn() {
    return typeof currentSessionToken === "function"
      ? Boolean(currentSessionToken())
      : Boolean(sessionGet("switchboard-session-token"));
  }

  function guestReady() {
    return isLoggedIn() || sessionGet(guestAccessKey) === "guest";
  }

  function ensureGuestStyles() {
    if (document.getElementById("guestAccessStyles")) return;
    const style = document.createElement("style");
    style.id = "guestAccessStyles";
    style.textContent = `
      .guest-access-modal{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.62);backdrop-filter:blur(8px)}.guest-access-modal[hidden]{display:none}.guest-access-card{width:min(430px,calc(100vw - 32px));display:grid;gap:14px;padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--composer);color:var(--text);box-shadow:0 26px 80px rgba(0,0,0,.36)}.guest-access-card h2{margin:0;font-size:1.15rem;line-height:1.2}.guest-access-card p{margin:0;color:var(--muted);font-size:.92rem;line-height:1.45}.guest-access-actions{display:grid;grid-template-columns:1fr;gap:9px}.guest-access-button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;border-radius:999px;background:var(--panel-soft);color:var(--text);font-weight:850;text-decoration:none}.guest-access-button.primary{background:var(--primary);color:#fff}.guest-access-button:hover,.guest-access-button:focus-visible{border-color:var(--composer-border);filter:brightness(1.04)}.guest-access-note{min-height:18px;color:var(--muted);font-size:.78rem;font-weight:750;line-height:1.35}@media (min-width:520px){.guest-access-actions.two{grid-template-columns:1fr 1fr}}@media (max-width:420px){.guest-access-card{padding:16px;border-radius:16px}.guest-access-button{min-height:42px}}
    `;
    document.head.appendChild(style);
  }

  function focusFirstButton() {
    requestAnimationFrame(() => modal?.querySelector("button, a")?.focus());
  }

  function renderChoice() {
    modal.innerHTML = `
      <section class="guest-access-card" role="dialog" aria-modal="true" aria-labelledby="guestAccessTitle" aria-describedby="guestAccessDescription">
        <h2 id="guestAccessTitle">Continue with no account?</h2>
        <p id="guestAccessDescription">You can enter the chat as a guest. No email, password, or account is required.</p>
        <div class="guest-access-actions two">
          <button class="guest-access-button primary" id="guestContinueButton" type="button">Yes / Continue as Guest</button>
          <button class="guest-access-button" id="guestAccountQuestionButton" type="button">No</button>
        </div>
        <div class="guest-access-note" aria-live="polite">Guest users create a nickname and color before chatting.</div>
      </section>`;
    modal.querySelector("#guestContinueButton").addEventListener("click", acceptGuest);
    modal.querySelector("#guestAccountQuestionButton").addEventListener("click", renderAccountQuestion);
    focusFirstButton();
  }

  function renderAccountQuestion() {
    modal.innerHTML = `
      <section class="guest-access-card" role="dialog" aria-modal="true" aria-labelledby="guestAccountTitle" aria-describedby="guestAccountDescription">
        <h2 id="guestAccountTitle">Would you like to create an account?</h2>
        <p id="guestAccountDescription">Account access uses the existing Switchboard login and account setup path.</p>
        <div class="guest-access-actions two">
          <a class="guest-access-button primary" href="/login.html">Create an account</a>
          <button class="guest-access-button" id="returnGuestFlowButton" type="button">Return to guest flow</button>
        </div>
        <div class="guest-access-note" aria-live="polite">You can still chat as a guest after setting a nickname and color.</div>
      </section>`;
    modal.querySelector("#returnGuestFlowButton").addEventListener("click", acceptGuest);
    focusFirstButton();
  }

  function acceptGuest() {
    sessionSet(guestAccessKey, "guest");
    closeGuestModal();
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.(true);
  }

  function closeGuestModal() {
    if (!modal) return;
    modal.hidden = true;
    lastFocus?.focus?.();
  }

  function ensureGuestModal() {
    if (modal) return;
    ensureGuestStyles();
    modal = document.createElement("div");
    modal.className = "guest-access-modal";
    modal.hidden = true;
    document.body.appendChild(modal);
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        modal.querySelector("button, a")?.focus();
      }
      if (event.key !== "Tab") return;
      const items = [...modal.querySelectorAll("button, a")].filter((item) => !item.disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function openGuestModal() {
    if (pendingResolve) return new Promise((resolve) => { pendingResolve = resolve; });
    ensureGuestModal();
    lastFocus = document.activeElement;
    modal.hidden = false;
    renderChoice();
    return new Promise((resolve) => { pendingResolve = resolve; });
  }

  async function ensureGuestAccess() {
    if (guestReady()) return true;
    return openGuestModal();
  }

  function hasPendingChatWork() {
    return Boolean(inputEl?.value?.trim()) || Boolean(Array.isArray(selectedAttachments) && selectedAttachments.length);
  }

  function installGuestGate() {
    if (typeof createChat === "function" && createChat !== lastCreateChat && createChat.__guestAccessEnhanced !== true) {
      const originalCreateChat = createChat;
      createChat = async function guestAccessCreateChat(...args) {
        await ensureGuestAccess();
        return originalCreateChat.apply(this, args);
      };
      createChat.__guestAccessEnhanced = true;
      lastCreateChat = createChat;
    }

    if (typeof sendMessage === "function" && sendMessage !== lastSendMessage && sendMessage.__guestAccessEnhanced !== true) {
      const originalSendMessage = sendMessage;
      sendMessage = async function guestAccessSendMessage(...args) {
        if (hasPendingChatWork()) await ensureGuestAccess();
        return originalSendMessage.apply(this, args);
      };
      sendMessage.__guestAccessEnhanced = true;
      lastSendMessage = sendMessage;
    }
  }

  function enhanceIdentityCopy() {
    const title = document.getElementById("bubbleColorTitle");
    if (title) title.textContent = "Create your guest profile";
    const description = title?.parentElement?.querySelector("p");
    if (description) description.textContent = "Add a nickname and choose a chat color. Both are required before entering the guest chat.";
  }

  function addExtraColorOptions() {
    const grid = document.getElementById("bubbleColorGrid");
    if (!grid) return;
    enhanceIdentityCopy();
    for (const color of extraColors) {
      if (grid.querySelector(`[data-color-choice='${color}']`)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bubble-color-option guest-extra-color";
      button.dataset.colorChoice = color;
      button.style.setProperty("--bubble-choice", color);
      button.setAttribute("aria-label", color);
      button.setAttribute("aria-pressed", String(extraSelectedColor === color));
      button.addEventListener("pointerdown", () => { extraSelectedColor = color; });
      button.addEventListener("click", () => {
        grid.querySelectorAll(".bubble-color-option").forEach((option) => option.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
        const status = document.getElementById("bubbleColorStatus");
        if (status) status.textContent = "";
      });
      grid.appendChild(button);
    }
  }

  installGuestGate();
  addExtraColorOptions();
  new MutationObserver(() => {
    installGuestGate();
    addExtraColorOptions();
  }).observe(document.body, { childList: true, subtree: true });

  let attempts = 0;
  const installer = setInterval(() => {
    attempts += 1;
    installGuestGate();
    addExtraColorOptions();
    if (attempts > 50) clearInterval(installer);
  }, 100);

  setTimeout(() => {
    if (!guestReady()) ensureGuestAccess().catch(() => {});
  }, 250);
})();
