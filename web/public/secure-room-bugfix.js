(() => {
  if (window.__secureRoomBugfixInstalled) return;
  window.__secureRoomBugfixInstalled = true;

  const style = document.createElement("style");
  style.id = "secureRoomBugfixStyles";
  style.textContent = `
    body.secure-room-layout .app-shell .messages{padding-top:clamp(22px,4vh,38px)!important;padding-bottom:138px!important;scroll-padding-bottom:138px!important}
    body.secure-room-layout .chat-header{min-height:104px;gap:14px;padding-inline:24px}
    body.secure-room-layout .chat-close-button{width:auto;min-width:86px;height:42px;min-height:42px;padding:0 14px;border-radius:999px;font-size:.86rem;font-weight:850}
    body.secure-room-layout .room-header-lock{width:48px;height:48px;flex-basis:48px;border-radius:14px}
    body.secure-room-layout .theme-toggle{min-width:44px;min-height:42px;padding:0 12px;font-size:.84rem}
    body.secure-room-layout .theme-toggle #themeToggleText{display:none}
    body.secure-room-layout .room-menu-button{width:42px;height:42px}
    .secure-room-facts{align-self:end;display:grid;gap:10px;margin-bottom:18px;color:var(--muted);font-size:.88rem;line-height:1.35}
    .secure-room-fact{display:flex;align-items:center;gap:9px;min-height:34px;padding:0 10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.045)}
    .secure-room-fact span:first-child{color:var(--text);font-weight:900}
    .secure-welcome{align-content:start;gap:18px;min-height:min(430px,calc(100dvh - 300px))}
    .secure-welcome-date{margin-bottom:2px}.secure-welcome-row{width:100%}.secure-welcome-row.assistant{justify-content:flex-start}.secure-welcome-row.outgoing{justify-content:flex-end}.secure-welcome-bubble{max-width:min(520px,72%)}
    .secure-welcome-row.assistant .secure-welcome-bubble{border-top-left-radius:8px;background:rgba(255,255,255,.075)}
    .secure-welcome-prompts{justify-content:flex-start;max-width:760px}.secure-welcome-prompts button{min-height:44px;padding:0 16px}
    body.secure-room-layout .send-button,body.secure-room-layout .send-button:hover:not(:disabled),body.secure-room-layout .send-button:focus-visible:not(:disabled){background:#0b7cff!important;color:#fff!important}
    body.secure-room-layout .send-button:disabled{background:rgba(255,255,255,.12)!important;color:rgba(255,255,255,.42)!important}
    .guest-access-modal{background:rgba(0,0,0,.42)!important;backdrop-filter:blur(3px)!important}.guest-access-card{width:min(460px,calc(100vw - 32px))!important}
    .guest-access-button.primary{background:#0b7cff!important;color:#fff!important;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 10px 24px rgba(11,124,255,.22)}
    .guest-access-button.secondary{background:rgba(255,255,255,.06)!important;color:var(--muted)!important;box-shadow:none!important}.guest-access-button.secondary:hover,.guest-access-button.secondary:focus-visible{color:var(--text)!important;background:rgba(255,255,255,.1)!important}
    .guest-access-note[data-state="working"]{color:#93c5fd!important}
    .secure-toast{position:fixed;right:22px;bottom:max(104px,calc(84px + env(safe-area-inset-bottom)));z-index:220;max-width:min(360px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(24,25,28,.96);color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.34);font-weight:780;line-height:1.35}.secure-toast[hidden]{display:none}
    @media (max-width:920px){body.secure-room-layout .chat-header{min-height:84px;padding-inline:12px}body.secure-room-layout .chat-close-button{min-width:44px;width:44px;padding:0;font-size:0}body.secure-room-layout .chat-close-button::before{content:"+";font-size:1.35rem;line-height:1}.secure-welcome-bubble{max-width:88%}}
  `;
  document.head.appendChild(style);

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function toast(message) {
    let node = document.getElementById("secureRoomToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "secureRoomToast";
      node.className = "secure-toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }
    setText(node, message);
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  function tightenHeader() {
    const closeButton = document.getElementById("closeChatButton");
    if (closeButton) {
      setText(closeButton, "New room");
      closeButton.setAttribute("aria-label", "Archive this room and start a new room");
      closeButton.setAttribute("title", "Archive room and start new");
    }
    document.querySelector(".room-menu-button")?.setAttribute("title", "Room options");
  }

  function enrichSidebar() {
    const sidebar = document.getElementById("secureRoomSidebar");
    if (!sidebar || sidebar.querySelector(".secure-room-facts")) return;
    const facts = document.createElement("div");
    facts.className = "secure-room-facts";
    facts.innerHTML = `<div class="secure-room-fact"><span>On</span><span>Auto-delete</span></div><div class="secure-room-fact"><span>Guest</span><span>No account required</span></div><div class="secure-room-fact"><span>Link</span><span>Share access</span></div>`;
    sidebar.insertBefore(facts, sidebar.querySelector(".secure-room-settings") || null);
  }

  function buildWelcome() {
    const wrapper = document.createElement("div");
    wrapper.className = "secure-welcome";
    wrapper.innerHTML = `<div class="secure-welcome-date">Today</div><div class="secure-welcome-row outgoing"><div class="secure-welcome-bubble">Secure room is ready.<div class="secure-welcome-meta">Auto-delete on</div></div></div><div class="secure-welcome-row assistant"><div class="secure-welcome-bubble">Type a message below, attach a file, or share the room link.</div></div><div class="secure-welcome-prompts" aria-label="Starter prompts"></div>`;
    ["Share this room link", "Explain auto-delete", "Invite teammate"].forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = prompt;
      button.addEventListener("click", () => {
        if (prompt.toLowerCase().includes("share")) {
          toast("Preparing share link...");
          document.getElementById("shareChatButton")?.click();
          setTimeout(() => toast("Share link copied or shown in chat actions."), 700);
          return;
        }
        inputEl.value = prompt;
        resizeInput();
        inputEl.focus();
        sendButton.disabled = false;
        sendButton.setAttribute("aria-disabled", "false");
      });
      wrapper.querySelector(".secure-welcome-prompts").appendChild(button);
    });
    return wrapper;
  }

  function patchWelcome() {
    if (typeof renderWelcome === "function" && renderWelcome.__secureRoomBugfix !== true) {
      renderWelcome = function secureRoomBugfixWelcome() {
        messagesEl.innerHTML = "";
        chatHistory = [];
        if (currentChatTitle) currentChatTitle.textContent = "Secure room";
        messagesEl.appendChild(buildWelcome());
      };
      renderWelcome.__secureRoomBugfix = true;
    }
    if (messagesEl?.querySelector(".secure-welcome")) renderWelcome();
  }

  function wireOnce(button, key, handler) {
    if (!button || button.dataset[key] === "true") return;
    button.dataset[key] = "true";
    button.addEventListener("click", handler);
  }

  function polishGuestModal() {
    const modal = document.querySelector(".guest-access-modal:not([hidden])");
    if (!modal) return;
    const continueButton = modal.querySelector("#guestContinueButton");
    const noButton = modal.querySelector("#guestAccountQuestionButton");
    const returnButton = modal.querySelector("#returnGuestFlowButton");
    const note = modal.querySelector(".guest-access-note");

    setText(modal.querySelector("#guestAccessDescription"), "Enter as a guest now. No email, password, or account is required.");
    if (continueButton) {
      setText(continueButton, "Continue as guest");
      continueButton.classList.add("primary");
      wireOnce(continueButton, "secureBugfixWired", () => {
        if (note) {
          note.dataset.state = "working";
          setText(note, "Opening guest profile setup...");
        }
        toast("Continuing as guest...");
      });
    }
    if (noButton) {
      setText(noButton, "Use account");
      noButton.classList.add("secondary");
      wireOnce(noButton, "secureBugfixWired", () => {
        if (note) {
          note.dataset.state = "working";
          setText(note, "Showing account options...");
        }
      });
    }
    if (returnButton) {
      setText(returnButton, "Continue as guest");
      returnButton.classList.remove("secondary");
    }
    if (note && !note.dataset.state) setText(note, "Next step: choose a nickname and color.");
  }

  function patchShareFeedback() {
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".secure-room-share, #shareChatButton")) return;
      toast("Preparing share link...");
      setTimeout(() => toast("Share link copied or shown in chat actions."), 900);
    }, true);
  }

  function observeModal() {
    const observer = new MutationObserver(() => polishGuestModal());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    polishGuestModal();
  }

  function initialize() {
    tightenHeader();
    enrichSidebar();
    patchWelcome();
    patchShareFeedback();
    observeModal();
    setTimeout(() => {
      tightenHeader();
      enrichSidebar();
      polishGuestModal();
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();