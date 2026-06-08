(() => {
  const overlayId = "chatCameraOverlay";
  const mentionMenuId = "chatMentionSuggestions";
  const richFileAccept = ".txt,.md,.csv,.json,.log,.html,.css,.js,.jsx,.ts,.tsx,.xml,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,text/*,application/json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const mentionNames = new Map();
  let mentionIndex = 0;

  function setStatusText(message) {
    const status = document.getElementById("plusMenuStatus");
    if (status) status.textContent = message || "";
  }

  function closeMenu() {
    const menu = document.getElementById("plusMenu");
    const plusButton = document.getElementById("filePickerButton");
    if (menu) menu.hidden = true;
    plusButton?.setAttribute("aria-expanded", "false");
  }

  function availableSlots() {
    return Math.max(0, maxAttachmentFiles - selectedAttachments.length);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`${file.name || "Attachment"} could not be read.`));
      reader.readAsDataURL(file);
    });
  }

  function fileExtension(file = {}) {
    return String(file.name || "").toLowerCase().split(".").pop() || "";
  }

  function isTextLikeFile(file = {}) {
    const type = String(file.type || "").toLowerCase();
    const ext = fileExtension(file);
    return type.startsWith("text/") || type.includes("json") || ["txt", "md", "csv", "json", "log", "html", "css", "js", "jsx", "ts", "tsx", "xml", "yaml", "yml"].includes(ext);
  }

  async function attachGenericFiles(files = []) {
    const nextFiles = [...files].filter(Boolean).slice(0, availableSlots());
    if (!nextFiles.length) {
      setStatusText(`You can attach up to ${maxAttachmentFiles} files per message.`);
      return;
    }
    for (const file of nextFiles) {
      if (file.size > maxAttachmentBytes) {
        setStatusText(`${file.name || "Attachment"} is too large. Maximum ${formatBytes(maxAttachmentBytes)}.`);
        continue;
      }
      const content = isTextLikeFile(file) ? await file.text() : await fileToDataUrl(file);
      if (!String(content || "").trim()) {
        setStatusText(`${file.name || "Attachment"} does not contain readable content.`);
        continue;
      }
      selectedAttachments.push({ name: file.name || "Attachment", type: file.type || "application/octet-stream", size: file.size, content });
    }
    renderSelectedAttachments();
  }

  async function attachMediaFiles(files, kind = "Photo") {
    const nextFiles = [...files].filter(Boolean).slice(0, availableSlots());
    if (!nextFiles.length) {
      setStatusText(`You can attach up to ${maxAttachmentFiles} files per message.`);
      return;
    }
    for (const file of nextFiles) {
      if (file.size > maxAttachmentBytes) {
        setStatusText(`${file.name || kind} is too large. Maximum ${formatBytes(maxAttachmentBytes)}.`);
        continue;
      }
      const content = await fileToDataUrl(file);
      if (!content.startsWith("data:image/")) {
        setStatusText(`${file.name || kind} is not a supported image.`);
        continue;
      }
      selectedAttachments.push({
        name: file.name || `${kind.toLowerCase()}-${Date.now()}.jpg`,
        type: file.type || "image/jpeg",
        size: file.size,
        content
      });
    }
    renderSelectedAttachments();
    setStatusText(nextFiles.length === 1 ? `${kind} attached.` : `${nextFiles.length} images attached.`);
  }

  function fallbackPicker({ capture = false, kind = "Photo" } = {}) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = !capture;
    if (capture) input.setAttribute("capture", "environment");
    input.addEventListener("change", () => {
      attachMediaFiles(input.files || [], kind).catch((error) => setStatusText(error.message));
      input.remove();
    }, { once: true });
    document.body.appendChild(input);
    input.click();
    closeMenu();
  }

  function removeOverlay(stream) {
    stream?.getTracks?.().forEach((track) => track.stop());
    document.getElementById(overlayId)?.remove();
  }

  async function openCamera() {
    closeMenu();
    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackPicker({ capture: true, kind: "Photo" });
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch (error) {
      setStatusText("Camera access was not allowed. Opening photo picker instead.");
      fallbackPicker({ capture: true, kind: "Photo" });
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.style.cssText = "position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.72)";
    overlay.innerHTML = `
      <div style="width:min(560px,100%);display:grid;gap:12px;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--composer);color:var(--text)">
        <video autoplay playsinline muted style="width:100%;max-height:70vh;border-radius:12px;background:#000;object-fit:contain"></video>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button type="button" data-camera-cancel style="min-height:40px;padding:0 14px;border-radius:999px;background:var(--panel-soft);color:var(--text)">Cancel</button>
          <button type="button" data-camera-capture style="min-height:40px;padding:0 16px;border-radius:999px;background:var(--primary);color:#fff;font-weight:800">Use photo</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const video = overlay.querySelector("video");
    video.srcObject = stream;
    await video.play().catch(() => {});

    overlay.querySelector("[data-camera-cancel]").addEventListener("click", () => removeOverlay(stream), { once: true });
    overlay.querySelector("[data-camera-capture]").addEventListener("click", async () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(video, 0, 0, width, height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
        if (!blob) throw new Error("The camera photo could not be captured.");
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        removeOverlay(stream);
        await attachMediaFiles([file], "Photo");
      } catch (error) {
        setStatusText(error.message || "The camera photo could not be captured.");
      }
    }, { once: true });
  }

  function cleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function mentionableName(value) {
    const name = cleanName(value);
    return name && !/^Original$|^Participant$|^Shared link/i.test(name) ? name : "";
  }

  function rememberMentionName(value) {
    const name = mentionableName(value);
    if (!name) return;
    mentionNames.set(name.toLowerCase(), name);
  }

  function rememberFromMessages(messages = []) {
    for (const message of Array.isArray(messages) ? messages : []) {
      rememberMentionName(message.context?.participantLabel);
      if (Array.isArray(message.readReceipts)) {
        message.readReceipts.forEach((receipt) => rememberMentionName(receipt.participantLabel));
      }
    }
  }

  function rememberFromData(data = {}) {
    const participants = Array.isArray(data.participants) ? data.participants : Array.isArray(data.chat?.participants) ? data.chat.participants : [];
    participants.forEach((participant) => rememberMentionName(participant.participantLabel));
    if (Array.isArray(data.chat?.messages)) rememberFromMessages(data.chat.messages);
  }

  function fileKind(attachment = {}) {
    const name = String(attachment.name || "").toLowerCase();
    const type = String(attachment.type || "").toLowerCase();
    if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
    if (/word|document/.test(type) || /\.(doc|docx)$/.test(name)) return "DOC";
    if (/excel|spreadsheet/.test(type) || /\.(xls|xlsx|csv)$/.test(name)) return name.endsWith(".csv") ? "CSV" : "XLS";
    if (/powerpoint|presentation/.test(type) || /\.(ppt|pptx)$/.test(name)) return "PPT";
    if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/.test(name)) return "IMG";
    if (type.startsWith("audio/") || /\.(mp3|wav|webm|m4a|ogg)$/.test(name)) return "AUD";
    if (/zip|compressed/.test(type) || /\.(zip|rar|7z|tar|gz)$/.test(name)) return "ZIP";
    if (type.startsWith("text/") || /\.(txt|md|log|json|xml|ya?ml)$/.test(name)) return "TXT";
    return "FILE";
  }

  function isImageAttachment(attachment = {}) {
    return fileKind(attachment) === "IMG" && /^data:image\//.test(String(attachment.content || ""));
  }

  function isAudioAttachment(attachment = {}) {
    return fileKind(attachment) === "AUD" && /^data:audio\//.test(String(attachment.content || ""));
  }

  function isGeneratedUploadText(content = "") {
    return /^Uploaded \d+ files?:/i.test(String(content || "").trim());
  }

  function removeGeneratedImageText(bubble, content, attachments) {
    if (!bubble || !isGeneratedUploadText(content) || !attachments.length || !attachments.every(isImageAttachment)) return;
    [...bubble.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().startsWith("Uploaded")) node.remove();
    });
  }

  function ensurePreview(bubble, attachment) {
    if (!bubble || (!isImageAttachment(attachment) && !isAudioAttachment(attachment))) return;
    let wrapper = bubble.querySelector(".attachment-previews");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "attachment-previews";
      bubble.appendChild(wrapper);
    }
    const selector = isImageAttachment(attachment) ? ".attachment-preview-image" : ".attachment-preview-audio";
    if ([...wrapper.querySelectorAll(selector)].some((item) => item.getAttribute("src") === attachment.content)) return;
    if (isImageAttachment(attachment)) {
      const image = document.createElement("img");
      image.className = "attachment-preview-image";
      image.src = attachment.content;
      image.alt = attachment.name || "Attached image";
      image.loading = "lazy";
      image.addEventListener("load", () => requestAnimationFrame(scrollToBottom), { once: true });
      wrapper.appendChild(image);
      return;
    }
    const audio = document.createElement("audio");
    audio.className = "attachment-preview-audio";
    audio.controls = true;
    audio.src = attachment.content;
    audio.addEventListener("loadedmetadata", () => requestAnimationFrame(scrollToBottom), { once: true });
    wrapper.appendChild(audio);
  }

  function renderFileAttachmentList(bubble, attachments = []) {
    bubble.querySelectorAll(".message-attachments").forEach((list) => list.remove());
    const fileAttachments = attachments.filter((attachment) => !isImageAttachment(attachment) && !isAudioAttachment(attachment));
    if (!fileAttachments.length) return;
    const list = document.createElement("div");
    list.className = "message-attachments enhanced-attachments";
    for (const attachment of fileAttachments) {
      const kind = fileKind(attachment);
      const item = document.createElement("span");
      item.className = `message-attachment file-attachment kind-${kind.toLowerCase()}`;
      item.innerHTML = `<span class="file-type-icon" aria-hidden="true">${kind}</span><span class="file-attachment-meta"><strong>${escapeHtml(attachment.name || "Attachment")}</strong><small>${attachment.size ? escapeHtml(formatBytes(Number(attachment.size))) : escapeHtml(attachment.type || "file")}</small></span>`;
      list.appendChild(item);
    }
    const marker = bubble.querySelector("time, .message-status, .attachment-previews");
    bubble.insertBefore(list, marker || null);
  }

  function enhanceAttachmentDisplay(article, content, attachments = []) {
    if (!attachments.length) return;
    const bubble = article?.querySelector(".bubble");
    if (!bubble) return;
    removeGeneratedImageText(bubble, content, attachments);
    attachments.forEach((attachment) => ensurePreview(bubble, attachment));
    renderFileAttachmentList(bubble, attachments);
  }

  function decorateSelectedAttachmentTray() {
    const chips = [...document.querySelectorAll("#attachmentTray .attachment-chip")];
    chips.forEach((chip, index) => {
      const attachment = selectedAttachments[index];
      if (!attachment || chip.querySelector(".file-type-icon")) return;
      const icon = document.createElement("span");
      icon.className = `file-type-icon tray-file-icon kind-${fileKind(attachment).toLowerCase()}`;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = fileKind(attachment);
      chip.prepend(icon);
    });
  }

  function ensureEnhancementStyles() {
    if (document.getElementById("chatMediaPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "chatMediaPolishStyles";
    style.textContent = `
      .enhanced-attachments{display:grid;gap:8px;margin-top:10px}.file-attachment{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;width:min(260px,100%);padding:8px;border-radius:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}.file-type-icon{display:inline-grid;place-items:center;min-width:36px;height:30px;padding:0 6px;border-radius:7px;background:rgba(255,255,255,.9);color:#111;font-size:.66rem;font-weight:950;line-height:1}.file-attachment-meta{min-width:0;display:grid;gap:2px}.file-attachment-meta strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem}.file-attachment-meta small{font-size:.72rem;opacity:.78}.attachment-chip .tray-file-icon{min-width:30px;height:24px;font-size:.58rem}.kind-pdf{background:#fee2e2;color:#991b1b}.kind-doc{background:#dbeafe;color:#1d4ed8}.kind-xls,.kind-csv{background:#dcfce7;color:#166534}.kind-ppt{background:#ffedd5;color:#c2410c}.kind-img{background:#e0f2fe;color:#0369a1}.kind-aud{background:#f5d0fe;color:#86198f}.kind-zip{background:#fef3c7;color:#92400e}.kind-txt,.kind-file{background:#e5e7eb;color:#111827}
      .mention-suggestions{position:absolute;left:54px;right:54px;bottom:calc(100% + 8px);z-index:42;display:grid;gap:4px;max-height:190px;overflow:auto;padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--composer);box-shadow:0 18px 44px rgba(0,0,0,.28)}.mention-suggestions[hidden]{display:none}.mention-suggestions button{min-height:34px;display:flex;align-items:center;gap:8px;padding:0 9px;border-radius:8px;background:transparent;color:var(--text);font-weight:800;text-align:left}.mention-suggestions button:hover,.mention-suggestions button.active{background:var(--panel-soft)}.mention-avatar{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;font-size:.72rem;font-weight:900}
      @media (max-width:520px){.mention-suggestions{left:8px;right:8px;bottom:calc(100% + 6px)}.file-attachment{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function mentionMenu() {
    let menu = document.getElementById(mentionMenuId);
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = mentionMenuId;
    menu.className = "mention-suggestions";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Nickname suggestions");
    document.getElementById("chatForm")?.appendChild(menu);
    return menu;
  }

  function mentionToken() {
    const cursor = inputEl.selectionStart || 0;
    const before = inputEl.value.slice(0, cursor);
    const match = before.match(/(^|\s)@([^@\s]*)$/);
    if (!match) return null;
    const start = cursor - match[2].length - 1;
    return { start, end: cursor, query: match[2] || "" };
  }

  function filteredMentionNames(query = "") {
    const normalized = query.toLowerCase();
    return [...mentionNames.values()]
      .filter((name) => !normalized || name.toLowerCase().startsWith(normalized))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 6);
  }

  function insertMention(name) {
    const token = mentionToken();
    if (!token) return;
    const before = inputEl.value.slice(0, token.start);
    const after = inputEl.value.slice(token.end);
    inputEl.value = `${before}@${name} ${after}`;
    const nextCursor = before.length + name.length + 2;
    inputEl.setSelectionRange(nextCursor, nextCursor);
    inputEl.focus();
    resizeInput();
    hideMentionSuggestions();
  }

  function renderMentionSuggestions() {
    ensureEnhancementStyles();
    const token = mentionToken();
    const menu = mentionMenu();
    if (!token) {
      hideMentionSuggestions();
      return;
    }
    const names = filteredMentionNames(token.query);
    if (!names.length) {
      hideMentionSuggestions();
      return;
    }
    mentionIndex = Math.min(mentionIndex, names.length - 1);
    menu.innerHTML = "";
    names.forEach((name, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === mentionIndex ? "active" : "";
      button.setAttribute("role", "option");
      button.innerHTML = `<span class="mention-avatar" aria-hidden="true">${escapeHtml(name[0]?.toUpperCase() || "@")}</span><span>@${escapeHtml(name)}</span>`;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        insertMention(name);
      });
      menu.appendChild(button);
    });
    menu.hidden = false;
  }

  function hideMentionSuggestions() {
    const menu = document.getElementById(mentionMenuId);
    if (menu) menu.hidden = true;
  }

  function selectedMentionName() {
    const token = mentionToken();
    if (!token) return "";
    return filteredMentionNames(token.query)[mentionIndex] || "";
  }

  function wireMentions() {
    if (!inputEl || inputEl.dataset.mentionsEnhanced === "true") return;
    inputEl.dataset.mentionsEnhanced = "true";
    inputEl.addEventListener("input", () => {
      mentionIndex = 0;
      renderMentionSuggestions();
    });
    inputEl.addEventListener("keydown", (event) => {
      const menu = document.getElementById(mentionMenuId);
      if (!menu || menu.hidden) return;
      const count = menu.querySelectorAll("button").length;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        mentionIndex = Math.min(count - 1, mentionIndex + 1);
        renderMentionSuggestions();
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        mentionIndex = Math.max(0, mentionIndex - 1);
        renderMentionSuggestions();
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const name = selectedMentionName();
        if (!name) return;
        event.preventDefault();
        insertMention(name);
      }
      if (event.key === "Escape") hideMentionSuggestions();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(`#${mentionMenuId}`) || event.target === inputEl) return;
      hideMentionSuggestions();
    });
  }

  function wireButton(id, handler) {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  function installMessageEnhancements() {
    ensureEnhancementStyles();
    wireMentions();
    if (fileInput) fileInput.accept = richFileAccept;

    if (typeof addFiles === "function" && addFiles.__mediaPolishEnhanced !== true) {
      addFiles = async function mediaPolishAddFiles(files = []) {
        await attachGenericFiles(files);
      };
      addFiles.__mediaPolishEnhanced = true;
    }

    if (typeof requestJson === "function" && requestJson.__mediaPolishEnhanced !== true) {
      const originalRequestJson = requestJson;
      requestJson = async function mediaPolishRequestJson(url, options = {}) {
        const data = await originalRequestJson(url, options);
        rememberFromData(data);
        return data;
      };
      requestJson.__mediaPolishEnhanced = true;
    }

    if (typeof renderMessages === "function" && renderMessages.__mediaPolishEnhanced !== true) {
      const originalRenderMessages = renderMessages;
      renderMessages = function mediaPolishRenderMessages(messages = []) {
        rememberFromMessages(messages);
        originalRenderMessages(messages);
      };
      renderMessages.__mediaPolishEnhanced = true;
    }

    if (typeof createMessageElement === "function" && createMessageElement.__mediaPolishEnhanced !== true) {
      const originalCreateMessageElement = createMessageElement;
      createMessageElement = function mediaPolishCreateMessageElement(role, content, options = {}) {
        const article = originalCreateMessageElement(role, content, options);
        enhanceAttachmentDisplay(article, content, options.attachments || []);
        return article;
      };
      createMessageElement.__mediaPolishEnhanced = true;
    }

    if (typeof renderSelectedAttachments === "function" && renderSelectedAttachments.__mediaPolishEnhanced !== true) {
      const originalRenderSelectedAttachments = renderSelectedAttachments;
      renderSelectedAttachments = function mediaPolishRenderSelectedAttachments(...args) {
        originalRenderSelectedAttachments.apply(this, args);
        decorateSelectedAttachmentTray();
      };
      renderSelectedAttachments.__mediaPolishEnhanced = true;
    }

    document.querySelectorAll(".participant-label").forEach((label) => rememberMentionName(label.textContent));
    renderMentionSuggestions();
  }

  wireButton("attachImageButton", () => fallbackPicker({ capture: false, kind: "Image" }));
  wireButton("takePhotoButton", openCamera);
  installMessageEnhancements();
})();
