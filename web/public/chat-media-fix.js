(() => {
  const overlayId = "chatCameraOverlay";

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
      reader.onerror = () => reject(new Error(`${file.name || "Photo"} could not be read.`));
      reader.readAsDataURL(file);
    });
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

  function wireButton(id, handler) {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  wireButton("attachImageButton", () => fallbackPicker({ capture: false, kind: "Image" }));
  wireButton("takePhotoButton", openCamera);
})();
