const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chatForm");
const inputEl = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const mobileStatusText = document.getElementById("mobileStatusText");
const filesLoaded = document.getElementById("filesLoaded");
const themeToggle = document.getElementById("themeToggle");
const themeToggleText = document.getElementById("themeToggleText");
const themeToggleIcon = document.querySelector(".theme-toggle-icon");

const chatHistory = [];
const themeStorageKey = "switchboard-theme";
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

function setStatus({ directoryAvailable, filesLoaded: loadedFiles, error } = {}) {
  const compactDot = document.querySelector(".compact-status .status-dot");

  statusDot.classList.remove("online", "error");
  compactDot.classList.remove("online", "error");

  if (error) {
    statusDot.classList.add("error");
    compactDot.classList.add("error");
    statusText.textContent = "Directory unavailable";
    mobileStatusText.textContent = "Directory unavailable";
    filesLoaded.textContent = "Backend status could not be loaded.";
    return;
  }

  if (directoryAvailable) {
    statusDot.classList.add("online");
    compactDot.classList.add("online");
    statusText.textContent = "Reading Agent Directory";
    mobileStatusText.textContent = "Online";
  } else {
    statusText.textContent = "Directory unavailable";
    mobileStatusText.textContent = "Directory unavailable";
  }

  if (Array.isArray(loadedFiles) && loadedFiles.length > 0) {
    filesLoaded.textContent = `Loaded ${loadedFiles.length} repository file${loadedFiles.length === 1 ? "" : "s"}.`;
  } else {
    filesLoaded.textContent = "No repository routing files loaded yet.";
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
  article.appendChild(bubble);

  return article;
}

function addMessage(role, content, options = {}) {
  const messageEl = createMessageElement(role, content, options);
  messagesEl.appendChild(messageEl);

  if (!options.skipHistory && !options.error) {
    chatHistory.push({ role, content });
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

async function loadStatus() {
  try {
    const response = await fetch("/api/status");

    if (!response.ok) {
      throw new Error("Status request failed.");
    }

    const status = await response.json();
    setStatus(status);
  } catch (error) {
    setStatus({ error: true });
  }
}

async function sendMessage() {
  const message = inputEl.value.trim();

  if (!message || isSending) {
    return;
  }

  addMessage("user", message);
  inputEl.value = "";
  resizeInput();
  setSending(true);
  showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(0, -1)
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "The backend could not process the message.");
    }

    hideTyping();
    setStatus(data);
    addMessage("assistant", data.reply || "I could not produce a response.");
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

initializeThemeToggle();
loadStatus();
resizeInput();
