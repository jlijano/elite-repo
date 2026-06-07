const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chatForm");
const inputEl = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const mobileStatusText = document.getElementById("mobileStatusText");
const filesLoaded = document.getElementById("filesLoaded");
const storageStatus = document.getElementById("storageStatus");
const themeToggle = document.getElementById("themeToggle");
const themeToggleText = document.getElementById("themeToggleText");
const themeToggleIcon = document.querySelector(".theme-toggle-icon");
const newChatButton = document.getElementById("newChatButton");
const mobileNewChatButton = document.getElementById("mobileNewChatButton");
const closeChatButton = document.getElementById("closeChatButton");
const chatList = document.getElementById("chatList");
const availableUsersPanel = document.getElementById("availableUsersPanel");
const availableUsersList = document.getElementById("availableUsersList");
const currentChatTitle = document.getElementById("currentChatTitle");
const filePickerButton = document.getElementById("filePickerButton");
const fileInput = document.getElementById("fileInput");
const attachmentTray = document.getElementById("attachmentTray");

const themeStorageKey = "switchboard-theme";
const chatStorageKey = "switchboard-current-chat";
const sessionTokenStorageKey = "switchboard-session-token";
const refreshIntervalMs = 40000;
const maxAttachmentFiles = 4;
const maxAttachmentBytes = 1500 * 1024;
const startChatLabel = "Start new chat";
const newChatTitle = "New chat";
let currentChatId = null;
let chatHistory = [];
let selectedAttachments = [];
let isSending = false;
let typingEl = null;

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function setStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    return;
  }
}

function getStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function getSessionStored(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    return;
  }
}

function currentSessionToken() {
  return getSessionStored(sessionTokenStorageKey) || "";
}

function authHeaders() {
  const token = currentSessionToken();
  return token ? { "x-session-token": token } : {};
}

function saveCurrentChat(chatId) {
  currentChatId = chatId;
  setStored(chatStorageKey, chatId);
}

function updateThemeToggle(theme) {
  const isDark = theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  themeToggleText.textContent = isDark ? "Light Mode" : "Dark Mode";
  themeToggleIcon.textContent = isDark ? "☀" : "☾";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  setStored(themeStorageKey, theme);
  updateThemeToggle(theme);
}

function initializeThemeToggle() {
  updateThemeToggle(getCurrentTheme());
  themeToggle.addEventListener("click", () => applyTheme(getCurrentTheme() === "dark" ? "light" : "dark"));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The backend could not process the request.");
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentNames(attachments = []) {
  return attachments.map((attachment) => attachment.name).join(", ");
}

function initials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() || "").join("") || "U";
}

function scopeLabel(scope) {
  if (scope === "company") return "Company";
  if (scope === "department") return "Department";
  if (scope === "group") return "Group";
  return scope;
}

function setStatus({ directoryAvailable, filesLoaded: loadedFiles, error, aiAvailable, storageAvailable, storageMode } = {}) {
  const compactDot = document.querySelector(".compact-status .status-dot");
  statusDot.classList.remove("online", "error");
  compactDot.classList.remove("online", "error");

  if (error) {
    statusDot.classList.add("error");
    compactDot.classList.add("error");
    statusText.textContent = "Directory unavailable";
    mobileStatusText.textContent = "Status unavailable";
    filesLoaded.textContent = "Backend status could not be loaded.";
    storageStatus.textContent = "Storage status unavailable.";
    return;
  }

  if (directoryAvailable) {
    statusDot.classList.add("online");
    compactDot.classList.add("online");
    statusText.textContent = "Reading Agent Directory";
    mobileStatusText.textContent = aiAvailable ? "AI online" : "Storage-only";
  } else {
    statusText.textContent = "Directory unavailable";
    mobileStatusText.textContent = "Directory unavailable";
  }

  filesLoaded.textContent = Array.isArray(loadedFiles) && loadedFiles.length
    ? `Loaded ${loadedFiles.length} repository file${loadedFiles.length === 1 ? "" : "s"}.`
    : "No repository routing files loaded yet.";
  if (typeof storageAvailable === "boolean") {
    storageStatus.textContent = `${storageAvailable ? "Storage ready" : "Storage unavailable"} (${storageMode || "unknown"}).`;
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearStartPrompt() {
  messagesEl.querySelector(".start-chat-empty")?.remove();
}

function isAutomaticAssistantMessage(message = {}) {
  if (message.role !== "assistant") return false;
  const content = String(message.content || "");
  return Boolean(message.context?.pendingReview || message.context?.aiError)
    || content.includes("I saved your message for Switchboard review")
    || content.includes("could not generate an AI response right now");
}

function resetChatView() {
  removeStored(chatStorageKey);
  currentChatId = null;
  chatHistory = [];
  selectedAttachments = [];
  inputEl.value = "";
  renderSelectedAttachments();
  resizeInput();
  renderWelcome();
}

function appendAttachmentList(parent, attachments = []) {
  if (!attachments.length) return;
  const list = document.createElement("div");
  list.className = "message-attachments";
  for (const attachment of attachments) {
    const item = document.createElement("span");
    item.className = "message-attachment";
    item.textContent = `${attachment.name}${attachment.size ? ` · ${formatBytes(Number(attachment.size))}` : ""}`;
    list.appendChild(item);
  }
  parent.appendChild(list);
}

function createMessageElement(role, content, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  if (options.error) article.classList.add("error");
  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "★";
    article.appendChild(avatar);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;
  appendAttachmentList(bubble, options.attachments || []);
  if (options.createdAt) {
    const time = document.createElement("time");
    time.dateTime = options.createdAt;
    time.textContent = formatTime(options.createdAt);
    bubble.appendChild(document.createElement("br"));
    bubble.appendChild(time);
  }
  article.appendChild(bubble);
  return article;
}

function renderWelcome() {
  messagesEl.innerHTML = "";
  chatHistory = [];
  currentChatTitle.textContent = newChatTitle;
  const emptyState = document.createElement("div");
  emptyState.className = "start-chat-empty";
  emptyState.textContent = startChatLabel;
  messagesEl.appendChild(emptyState);
}

function renderMessages(messages = []) {
  messagesEl.innerHTML = "";
  chatHistory = [];
  const visibleMessages = messages.filter((message) => !isAutomaticAssistantMessage(message));
  if (!visibleMessages.length) {
    renderWelcome();
    return;
  }
  for (const message of visibleMessages) {
    const attachments = Array.isArray(message.context?.attachments) ? message.context.attachments : [];
    messagesEl.appendChild(createMessageElement(message.role, message.content, { createdAt: message.createdAt, attachments }));
    if (message.role === "user" || message.role === "assistant") chatHistory.push({ role: message.role, content: message.content });
  }
  scrollToBottom();
}

function addMessage(role, content, options = {}) {
  clearStartPrompt();
  messagesEl.appendChild(createMessageElement(role, content, options));
  if (!options.skipHistory && !options.error) chatHistory.push({ role, content });
  scrollToBottom();
}

function showTyping() {
  clearStartPrompt();
  typingEl = document.createElement("article");
  typingEl.className = "message assistant typing";
  typingEl.innerHTML = `<div class="avatar" aria-hidden="true">★</div><div class="bubble" aria-label="Switchboard Agent is typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  messagesEl.appendChild(typingEl);
  scrollToBottom();
}

function hideTyping() {
  typingEl?.remove();
  typingEl = null;
}

function setSending(nextValue) {
  isSending = nextValue;
  inputEl.disabled = nextValue;
  sendButton.disabled = nextValue;
  filePickerButton.disabled = nextValue;
  fileInput.disabled = nextValue;
  if (closeChatButton) closeChatButton.disabled = nextValue;
  sendButton.textContent = nextValue ? "..." : "↑";
}

function resizeInput() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
}

function renderSelectedAttachments() {
  attachmentTray.innerHTML = "";
  attachmentTray.hidden = selectedAttachments.length === 0;
  for (const attachment of selectedAttachments) {
    const chip = document.createElement("span");
    chip.className = "attachment-chip";
    chip.innerHTML = `<span>${escapeHtml(attachment.name)}</span><small>${formatBytes(attachment.size)}</small>`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-attachment";
    removeButton.setAttribute("aria-label", `Remove ${attachment.name}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      selectedAttachments = selectedAttachments.filter((item) => item !== attachment);
      renderSelectedAttachments();
    });
    chip.appendChild(removeButton);
    attachmentTray.appendChild(chip);
  }
}

async function addFiles(files) {
  const availableSlots = maxAttachmentFiles - selectedAttachments.length;
  const nextFiles = [...files].slice(0, Math.max(availableSlots, 0));
  if (!nextFiles.length) {
    addMessage("assistant", `You can attach up to ${maxAttachmentFiles} files per message.`, { error: true, skipHistory: true });
    return;
  }

  for (const file of nextFiles) {
    if (file.size > maxAttachmentBytes) {
      addMessage("assistant", `${file.name} is too large. Attach text files up to ${formatBytes(maxAttachmentBytes)}.`, { error: true, skipHistory: true });
      continue;
    }
    try {
      const content = await file.text();
      if (!content.trim()) {
        addMessage("assistant", `${file.name} does not contain readable text.`, { error: true, skipHistory: true });
        continue;
      }
      selectedAttachments.push({ name: file.name, type: file.type, size: file.size, content });
    } catch (error) {
      addMessage("assistant", `${file.name} could not be read as text.`, { error: true, skipHistory: true });
    }
  }
  fileInput.value = "";
  renderSelectedAttachments();
}

function renderChatList(chats = []) {
  chatList.innerHTML = "";
  if (!chats.length) {
    chatList.innerHTML = `<p class="chat-list-empty">No saved chats yet.</p>`;
    return;
  }
  for (const chat of chats) {
    const row = document.createElement("div");
    row.className = `chat-list-row${chat.id === currentChatId ? " active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-list-item";
    button.innerHTML = `<span>${escapeHtml(chat.title || newChatTitle)}</span><small>${chat.messageCount || 0} message${chat.messageCount === 1 ? "" : "s"}</small>`;
    button.addEventListener("click", () => loadChat(chat.id));

    const archiveButton = document.createElement("button");
    archiveButton.type = "button";
    archiveButton.className = "archive-chat-button";
    archiveButton.setAttribute("aria-label", `Archive ${chat.title || "chat"}`);
    archiveButton.textContent = "Archive";
    archiveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      archiveChat(chat.id).catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true }));
    });

    row.appendChild(button);
    row.appendChild(archiveButton);
    chatList.appendChild(row);
  }
}

function renderAvailableUsers(users = []) {
  if (!availableUsersPanel || !availableUsersList) return;
  availableUsersPanel.hidden = false;
  availableUsersList.innerHTML = "";
  if (!users.length) {
    availableUsersList.innerHTML = `<p class="chat-list-empty">No available users in your company, department, or group.</p>`;
    return;
  }
  for (const user of users) {
    const scopes = Array.isArray(user.sharedScopes) && user.sharedScopes.length
      ? user.sharedScopes.map(scopeLabel).join(", ")
      : "Shared access";
    const row = document.createElement("div");
    row.className = "agent-pill";
    row.setAttribute("role", "listitem");
    row.setAttribute("title", `${user.email || user.name} · ${scopes}`);
    row.innerHTML = `<span class="brand-mark small" aria-hidden="true">${escapeHtml(initials(user.name))}</span><span>${escapeHtml(user.name || user.email || "User")} · ${escapeHtml(scopes)}</span>`;
    availableUsersList.appendChild(row);
  }
}

async function loadAvailableUsers() {
  if (!availableUsersPanel || !availableUsersList) return [];
  const token = currentSessionToken();
  if (!token) {
    availableUsersPanel.hidden = true;
    availableUsersList.innerHTML = "";
    return [];
  }
  try {
    const data = await requestJson("/api/users/available-chat-users", { headers: authHeaders() });
    renderAvailableUsers(data.users || []);
    return data.users || [];
  } catch (error) {
    availableUsersPanel.hidden = false;
    availableUsersList.innerHTML = `<p class="chat-list-empty">${escapeHtml(error.message)}</p>`;
    return [];
  }
}

async function loadStatus() {
  try {
    setStatus(await requestJson("/api/status"));
  } catch (error) {
    setStatus({ error: true });
  }
}

async function loadChats() {
  try {
    const data = await requestJson("/api/chats");
    renderChatList(data.chats || []);
    return data.chats || [];
  } catch (error) {
    chatList.innerHTML = `<p class="chat-list-empty">${escapeHtml(error.message)}</p>`;
    return [];
  }
}

async function createChat() {
  const data = await requestJson("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title: newChatTitle })
  });
  saveCurrentChat(data.chat.id);
  currentChatTitle.textContent = data.chat.title || newChatTitle;
  renderMessages([]);
  await loadChats();
}

async function archiveChat(chatId, options = {}) {
  await requestJson(`/api/chats/${encodeURIComponent(chatId)}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived: true })
  });
  await loadChats();
  if (chatId === currentChatId) {
    resetChatView();
    if (options.createNext !== false) await createChat();
  }
}

async function closeCurrentChat() {
  if (isSending) return;
  const closingChatId = currentChatId;
  if (!closingChatId) {
    resetChatView();
    await createChat();
    return;
  }
  await archiveChat(closingChatId, { createNext: true });
}

async function loadChat(chatId) {
  const data = await requestJson(`/api/chats/${encodeURIComponent(chatId)}`);
  saveCurrentChat(data.chat.id);
  currentChatTitle.textContent = data.chat.title || newChatTitle;
  renderMessages(data.chat.messages || []);
  await loadChats();
}

async function ensureChatSession() {
  removeStored(chatStorageKey);
  currentChatId = null;
  renderWelcome();
  return [];
}

async function refreshCurrentSession() {
  await loadStatus();
  await loadAvailableUsers();
  const chats = await loadChats();
  const active = chats.find((chat) => chat.id === currentChatId);
  if (active) currentChatTitle.textContent = active.title || newChatTitle;
  if (currentChatId && !isSending && !inputEl.value.trim() && !selectedAttachments.length && document.visibilityState === "visible") {
    const data = await requestJson(`/api/chats/${encodeURIComponent(currentChatId)}`);
    renderMessages(data.chat.messages || []);
  }
}

async function sendMessage() {
  const message = inputEl.value.trim();
  const attachments = selectedAttachments.slice();
  if ((!message && !attachments.length) || isSending) return;
  if (!currentChatId) await createChat();

  const displayMessage = message || `Uploaded ${attachments.length} file${attachments.length === 1 ? "" : "s"}: ${attachmentNames(attachments)}`;
  addMessage("user", displayMessage, { createdAt: new Date().toISOString(), attachments });
  inputEl.value = "";
  selectedAttachments = [];
  renderSelectedAttachments();
  resizeInput();
  setSending(true);

  try {
    const data = await requestJson("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ chatId: currentChatId, message, attachments, history: chatHistory.slice(0, -1) })
    });
    if (data.chatId && data.chatId !== currentChatId) saveCurrentChat(data.chatId);
    setStatus(data);
    const chats = await loadChats();
    const active = chats.find((chat) => chat.id === currentChatId);
    if (active) currentChatTitle.textContent = active.title || newChatTitle;
  } catch (error) {
    addMessage("assistant", error.message || "Something went wrong while contacting the Switchboard Agent.", { error: true, skipHistory: true });
  } finally {
    setSending(false);
    inputEl.focus();
  }
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
inputEl.addEventListener("input", resizeInput);
filePickerButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => addFiles(fileInput.files).catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true })));
newChatButton.addEventListener("click", () => createChat().catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true })));
mobileNewChatButton.addEventListener("click", () => createChat().catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true })));
closeChatButton?.addEventListener("click", () => closeCurrentChat().catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true })));

initializeThemeToggle();
renderSelectedAttachments();
loadStatus();
loadAvailableUsers();
ensureChatSession().catch((error) => {
  renderWelcome();
  addMessage("assistant", error.message, { error: true, skipHistory: true });
});
setInterval(() => refreshCurrentSession().catch(() => {}), refreshIntervalMs);
resizeInput();

window.addEventListener("load", () => {
  for (const src of [
    "bubble-color.js?v=20260607-chat-scope",
    "chat-media-fix.js?v=20260607-camera-fix",
    "start-page-polish.js?v=20260608-secure-room-ui"
  ]) {
    const script = document.createElement("script");
    script.src = src;
    document.body.appendChild(script);
  }
});
