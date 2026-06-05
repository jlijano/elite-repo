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
const chatList = document.getElementById("chatList");
const currentChatTitle = document.getElementById("currentChatTitle");

const themeStorageKey = "switchboard-theme";
const chatStorageKey = "switchboard-current-chat";
const refreshIntervalMs = 40000;
let currentChatId = null;
let chatHistory = [];
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
  messagesEl.appendChild(createMessageElement("assistant", "Hi. Send me a request and I will classify it, check the Agent Directory, route it to an active match, or recommend what is missing."));
}

function renderMessages(messages = []) {
  renderWelcome();
  chatHistory = [];
  for (const message of messages) {
    messagesEl.appendChild(createMessageElement(message.role, message.content, { createdAt: message.createdAt }));
    if (message.role === "user" || message.role === "assistant") chatHistory.push({ role: message.role, content: message.content });
  }
  scrollToBottom();
}

function addMessage(role, content, options = {}) {
  messagesEl.appendChild(createMessageElement(role, content, options));
  if (!options.skipHistory && !options.error) chatHistory.push({ role, content });
  scrollToBottom();
}

function showTyping() {
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
  sendButton.textContent = nextValue ? "..." : "↑";
}

function resizeInput() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
}

function renderChatList(chats = []) {
  chatList.innerHTML = "";
  if (!chats.length) {
    chatList.innerHTML = `<p class="chat-list-empty">No saved chats yet.</p>`;
    return;
  }
  for (const chat of chats) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chat-list-item${chat.id === currentChatId ? " active" : ""}`;
    button.innerHTML = `<span>${escapeHtml(chat.title || "New chat")}</span><small>${chat.messageCount || 0} message${chat.messageCount === 1 ? "" : "s"}</small>`;
    button.addEventListener("click", () => loadChat(chat.id));
    chatList.appendChild(button);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "New chat" })
  });
  saveCurrentChat(data.chat.id);
  currentChatTitle.textContent = data.chat.title;
  renderMessages([]);
  await loadChats();
}

async function loadChat(chatId) {
  const data = await requestJson(`/api/chats/${encodeURIComponent(chatId)}`);
  saveCurrentChat(data.chat.id);
  currentChatTitle.textContent = data.chat.title || "New chat";
  renderMessages(data.chat.messages || []);
  await loadChats();
}

async function ensureChatSession() {
  const chats = await loadChats();
  const saved = chats.find((chat) => chat.id === getStored(chatStorageKey));
  if (saved) return loadChat(saved.id);
  if (chats[0]) return loadChat(chats[0].id);
  return createChat();
}

async function refreshCurrentSession() {
  await loadStatus();
  const chats = await loadChats();
  const active = chats.find((chat) => chat.id === currentChatId);
  if (active) currentChatTitle.textContent = active.title || "New chat";
  if (currentChatId && !isSending && !inputEl.value.trim() && document.visibilityState === "visible") {
    const data = await requestJson(`/api/chats/${encodeURIComponent(currentChatId)}`);
    renderMessages(data.chat.messages || []);
  }
}

async function sendMessage() {
  const message = inputEl.value.trim();
  if (!message || isSending) return;
  if (!currentChatId) await createChat();

  addMessage("user", message, { createdAt: new Date().toISOString() });
  inputEl.value = "";
  resizeInput();
  setSending(true);
  showTyping();

  try {
    const data = await requestJson("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: currentChatId, message, history: chatHistory.slice(0, -1) })
    });
    hideTyping();
    if (data.chatId && data.chatId !== currentChatId) saveCurrentChat(data.chatId);
    setStatus(data);
    const assistantMessage = data.messages?.find((item) => item.role === "assistant");
    addMessage("assistant", data.reply || "I could not produce a response.", { createdAt: assistantMessage?.createdAt });
    const chats = await loadChats();
    const active = chats.find((chat) => chat.id === currentChatId);
    if (active) currentChatTitle.textContent = active.title || "New chat";
  } catch (error) {
    hideTyping();
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
newChatButton.addEventListener("click", () => createChat().catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true })));
mobileNewChatButton.addEventListener("click", () => createChat().catch((error) => addMessage("assistant", error.message, { error: true, skipHistory: true })));

initializeThemeToggle();
loadStatus();
ensureChatSession().catch((error) => {
  renderWelcome();
  addMessage("assistant", error.message, { error: true, skipHistory: true });
});
setInterval(() => refreshCurrentSession().catch(() => {}), refreshIntervalMs);
resizeInput();
