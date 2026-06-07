(() => {
  const notificationText = "Privacy notice: A screen capture, print, save, copy, or media export attempt was detected in this chat.";
  const style = document.createElement("style");
  style.textContent = `
    .privacy-banner { display: grid; gap: 4px; margin: 0 auto 14px; width: min(960px, 100%); padding: 10px 12px; border: 1px solid var(--warning); border-radius: 8px; background: rgba(242, 166, 13, 0.12); color: var(--text); font-size: 0.86rem; line-height: 1.35; }
    .privacy-banner strong { font-size: 0.9rem; }
    .privacy-private-log { color: var(--muted); font-size: 0.76rem; font-weight: 750; }
    .attachment-preview-card { display: grid; gap: 8px; }
    .attachment-metadata { display: flex; flex-wrap: wrap; gap: 6px; color: var(--muted); font-size: 0.74rem; font-weight: 700; }
    .attachment-safe-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .attachment-download-button, .attachment-login-required { min-height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-soft); color: var(--text); font-size: 0.76rem; font-weight: 800; text-decoration: none; }
    .attachment-login-required { color: var(--muted); cursor: not-allowed; }
    .privacy-media-guard { -webkit-user-select: none; user-select: none; }
  `;
  document.head.appendChild(style);

  const eventThrottle = new Map();

  function safeCall(name, fallback) {
    try {
      return typeof window[name] === "function" ? window[name]() : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function token() {
    return safeCall("currentSessionToken", "");
  }

  function authHeadersSafe() {
    return safeCall("authHeaders", {});
  }

  function currentChat() {
    try {
      return window.currentChatId || currentChatId || null;
    } catch (error) {
      return null;
    }
  }

  function participantContextSafe() {
    try {
      return typeof participantContext === "function" ? participantContext() : {};
    } catch (error) {
      return {};
    }
  }

  async function requestJsonSafe(url, options = {}) {
    if (typeof requestJson === "function") return requestJson(url, options);
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function setStatusTextSafe(message) {
    const status = document.getElementById("plusMenuStatus") || document.getElementById("storageStatus");
    if (status) status.textContent = message;
  }

  function formatBytesSafe(value) {
    if (typeof formatBytes === "function") return formatBytes(Number(value));
    const size = Number(value || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function privacyBanner() {
    let banner = document.getElementById("privacyBanner");
    if (banner) return banner;
    banner = document.createElement("section");
    banner.id = "privacyBanner";
    banner.className = "privacy-banner";
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `<strong>Privacy alerts are on.</strong><span>Screenshot detection is best-effort in a web browser. Print, copy, save, context-menu, and Print Screen attempts are logged when the browser exposes them.</span><span class="privacy-private-log" id="privacyPrivateLog"></span>`;
    const messages = document.getElementById("messages");
    messages?.prepend(banner);
    return banner;
  }

  function showPrivacyLog(events = []) {
    const log = document.getElementById("privacyPrivateLog") || privacyBanner().querySelector("#privacyPrivateLog");
    if (!log) return;
    if (!token()) {
      log.textContent = "Log in to view account identity details for privacy events.";
      return;
    }
    const latest = events[events.length - 1];
    log.textContent = latest
      ? `Private account detail: ${latest.actorLabel} triggered ${latest.eventType} at ${new Date(latest.createdAt).toLocaleTimeString()}.`
      : "No private privacy events recorded for this chat yet.";
  }

  async function loadPrivatePrivacyEvents() {
    const chatId = currentChat();
    if (!chatId || !token()) return;
    const data = await requestJsonSafe(`/api/chats/${encodeURIComponent(chatId)}/privacy-events`, { headers: authHeadersSafe() }).catch(() => null);
    if (data?.events) showPrivacyLog(data.events);
  }

  async function postSystemNotification(chatId, eventType) {
    await requestJsonSafe(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "system",
        content: notificationText,
        context: { privacyNotice: true, eventType, ...participantContextSafe() }
      })
    }).catch(() => {});
  }

  async function recordPrivacyAttempt(eventType) {
    const chatId = currentChat();
    if (!chatId) return;
    const last = eventThrottle.get(eventType) || 0;
    if (Date.now() - last < 2500) return;
    eventThrottle.set(eventType, Date.now());
    privacyBanner();
    setStatusTextSafe("Privacy attempt detected and logged for this chat.");
    await requestJsonSafe(`/api/chats/${encodeURIComponent(chatId)}/privacy-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeadersSafe() },
      body: JSON.stringify({ eventType, context: participantContextSafe() })
    }).then((data) => showPrivacyLog(data.event ? [data.event] : [])).catch(() => {});
    await postSystemNotification(chatId, eventType);
    if (typeof loadSharedChat === "function") loadSharedChat(chatId, { force: true }).catch(() => {});
  }

  function downloadableName(attachment = {}) {
    const name = String(attachment.name || "attachment").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
    return name || "attachment";
  }

  function appendDownloadControl(parent, attachment) {
    const actions = document.createElement("div");
    actions.className = "attachment-safe-actions";
    if (token()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attachment-download-button";
      button.textContent = "Download";
      button.addEventListener("click", () => {
        recordPrivacyAttempt("media-download");
        const link = document.createElement("a");
        link.href = attachment.content;
        link.download = downloadableName(attachment);
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
      actions.appendChild(button);
    } else {
      const notice = document.createElement("span");
      notice.className = "attachment-login-required";
      notice.textContent = "Log in to download";
      actions.appendChild(notice);
    }
    parent.appendChild(actions);
  }

  function enhanceAttachmentPreviews(root = document) {
    root.querySelectorAll(".message .bubble").forEach((bubble) => {
      if (bubble.dataset.privacyMediaEnhanced === "true") return;
      const previews = bubble.querySelector(".attachment-previews");
      if (!previews) return;
      const attachmentLabels = [...bubble.querySelectorAll(".message-attachment")].map((item) => item.textContent || "");
      previews.querySelectorAll("img, audio").forEach((media, index) => {
        media.classList.add("privacy-media-guard");
        media.setAttribute("draggable", "false");
        media.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          recordPrivacyAttempt("context-menu");
        });
        const card = document.createElement("div");
        card.className = "attachment-preview-card";
        const metadata = document.createElement("div");
        metadata.className = "attachment-metadata";
        const label = attachmentLabels[index] || media.getAttribute("alt") || "Media attachment";
        metadata.textContent = label;
        const attachment = { name: label.split(" · ")[0] || "attachment", type: media.tagName === "AUDIO" ? "audio" : "image", size: 0, content: media.currentSrc || media.src };
        media.parentNode.insertBefore(card, media);
        card.appendChild(media);
        card.appendChild(metadata);
        appendDownloadControl(card, attachment);
      });
      bubble.dataset.privacyMediaEnhanced = "true";
    });
  }

  const originalCreate = typeof createMessageElement === "function" ? createMessageElement : null;
  if (originalCreate) {
    createMessageElement = function privacyCreateMessageElement(...args) {
      const article = originalCreate.apply(this, args);
      queueMicrotask(() => enhanceAttachmentPreviews(article));
      return article;
    };
  }

  document.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    if (key === "printscreen") recordPrivacyAttempt("screenshot");
    if ((event.ctrlKey || event.metaKey) && key === "p") {
      event.preventDefault();
      recordPrivacyAttempt("print");
    }
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      recordPrivacyAttempt("save");
    }
  });

  document.addEventListener("copy", () => {
    if (document.getSelection()?.toString()) recordPrivacyAttempt("copy");
  });

  window.addEventListener("beforeprint", () => recordPrivacyAttempt("print"));

  const observer = new MutationObserver(() => {
    privacyBanner();
    enhanceAttachmentPreviews();
  });
  window.addEventListener("load", () => {
    privacyBanner();
    enhanceAttachmentPreviews();
    loadPrivatePrivacyEvents();
    const messages = document.getElementById("messages");
    if (messages) observer.observe(messages, { childList: true, subtree: true });
  });

  setInterval(() => {
    enhanceAttachmentPreviews();
    loadPrivatePrivacyEvents();
  }, 5000);
})();
