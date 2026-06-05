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
let currentChatId = null;
let chatHistory = [];
let isSending = false;
let typingEl = null;

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function saveThemePreference(theme) {
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch (error) {
    return;
  }
}

function saveCurrentChat(chatId) {
  currentChatId = chatId;
  try {
    localStorage.setItem(chatStorageKey, chatId);
  } catch (error) {
    return;
  }
}

function getSavedChatId() {
  try {
    return localStorage.getItem(chatStorageKey);
  } catch (error) {
    return null;
  }
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
  saveThemePreference(theme);
  updateThemeToggle(theme);
}

function initializeThemeToggle() {
  updateThemeToggle(getCurrentTheme());

  themeToggle.addEventListener("click", () => {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });
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

  if (Array.isArray(loadedFiles) && loadedFiles.length > 0) {
    filesLoaded.textContent = `Loaded ${loadedFiles.length} repository file${loadedFiles.length === 1 ? "" : "s"}.`;
  } else {
    filesLoaded.textContent = "No repository routing files loaded yet.";
  }

  if (typeof storageAvailable === "boolean") {
    storageStatus.textContent = `${storageAvailable ? "Storage ready" : "Storage unavailable"} (${storageMode || "unknown"}).`;
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function createMessageElement(role, content, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  if (options.error) {
    article.classList.add("error");
  }

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "S";
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
  const welcome = createMessageElement(
    "assistant",
    "Hi. Send me a request and I will classify it, check the Agent Directory, route it to an active match, or recommend what is missing."
  );
  messagesEl.appendChild(welcome);
}

function renderMessages(messages = []) {
  renderWelcome();
  chatHistory = [];
  for (const message of messages) {
    messagesEl.appendChild(createMessageElement(message.role, message.content, { createdAt: message.createdAt }));
    if (message.role === "user" || message.role === "assistant") {
      chatHistory.push({ role: message.role, content: message.content, createdAt: message.createdAt });
    }
  }
  scrollToBottom();
}

function addMessage(role, content, options = {}) {
  const messageEl = createMessageElement(role, content, options);
  messagesEl.appendChild(messageEl);

  if (!options.skipHistory && !options.error) {
    chatHistory.push({ role, content, createdAt: options.createdAt });
  }

  scrollToBottom();
}

function showTyping() {
  typingEl = document.createElement("article");
  typingEl.className = "message assistant typing";
  typingEl.innerHTML = `
    <div class="avatar" aria-hidden="true">S</div>
    <div class="bubble" aria-label="Switchboard Agent is typing">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  messagesEl.appendChild(typingEl);
  scrollToBottom();
}

function hideTyping() {
  if (typingEl) {
    typingEl.remove();
    typingEl = null;
  }
}

function setSending(nextValue) {
  isSending = nextValue;
  inputEl.disabled = nextValue;
  sendButton.disabled = nextValue;
  sendButton.textContent = nextValue ? "Sending" : "Send";
}

function resizeInput() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "The backend could not process the request.");
  }

  return data;
}

function renderChatList(chats = []) {
  chatList.innerHTML = "";

  if (chats.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chat-list-empty";
    empty.textContent = "No saved chats yet.";
    chatList.appendChild(empty);
    return;
  }

  for (const chat of chats) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-list-item";
    if (chat.id === currentChatId) {
      button.classList.add("active");
    }
    button.innerHTML = `
      <span>${escapeHtml(chat.title || "New chat")}</span>
      <small>${chat.messageCount || 0} message${chat.messageCount === 1 ? "" : "s"}</small>
    `;
    button.addEventListener("click", () => loadChat(chat.id));
    chatList.appendChild(button);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadStatus() {
  try {
    const status = await requestJson("/api/status");
    setStatus(status);
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
  const savedChatId = getSavedChatId();
  const savedChat = chats.find((chat) => chat.id === savedChatId);

  if (savedChat) {
    await loadChat(savedChat.id);
  } else if (chats[0]) {
    await loadChat(chats[0].id);
  } else {
    await createChat();
  }
}

async function sendMessage() {
  const message = inputEl.value.trim();

  if (!message || isSending) {
    return;
  }

  if (!currentChatId) {
    await createChat();
  }

  addMessage("user", message, { createdAt: new Date().toISOString() });
  inputEl.value = "";
  resizeInput();
  setSending(true);
  showTyping();

  try {
    const data = await requestJson("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chatId: currentChatId,
        message,
        history: chatHistory.slice(0, -1)
      })
    });

    hideTyping();
    if (data.chatId && data.chatId !== currentChatId) {
      saveCurrentChat(data.chatId);
    }
    setStatus(data);
    const assistantMessage = Array.isArray(data.messages)
      ? data.messages.find((item) => item.role === "assistant")
      : null;
    addMessage("assistant", data.reply || "I could not produce a response.", {
      createdAt: assistantMessage?.createdAt
    });
    await loadChats();
  } catch (error) {
    hideTyping();
    addMessage(
      "assistant",
      error.message || "Something went wrong while contacting the Switchboard Agent.",
      { error: true, skipHistory: true }
    );
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
resizeInput();
