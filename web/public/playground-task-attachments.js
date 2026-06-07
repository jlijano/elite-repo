(() => {
  if (document.body?.dataset.adminPage !== "playground-tasks") return;

  const sessionTokenKey = "switchboard-session-token";
  const adminTokenKey = "switchboard-admin-token";
  const state = { tasks: [], loading: false };

  const html = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function headers() {
    const result = { "Content-Type": "application/json" };
    const adminToken = sessionStorage.getItem(adminTokenKey) || "";
    const sessionToken = sessionStorage.getItem(sessionTokenKey) || "";
    if (adminToken) result["x-admin-token"] = adminToken;
    if (sessionToken) result["x-session-token"] = sessionToken;
    return result;
  }

  function setStatus(message, error = false) {
    const status = document.getElementById("status");
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle("error", error);
  }

  function queryString() {
    const params = new URLSearchParams();
    const values = {
      search: document.getElementById("taskListSearch")?.value || "",
      status: document.getElementById("taskListStatus")?.value || "",
      priority: document.getElementById("taskListPriority")?.value || "",
      projectId: document.getElementById("taskListProject")?.value || "",
      assigneeId: document.getElementById("taskListAssignee")?.value || "",
      cursor: "0",
      limit: "100"
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }

  function fileFields(task = {}) {
    return (Array.isArray(task.customFields) ? task.customFields : [])
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => field?.type === "file" && (field.fileData || field.fileName || field.value));
  }

  function dataUrl(field = {}) {
    const value = typeof field.fileData === "string" ? field.fileData.trim() : "";
    return value.startsWith("data:") ? value : "";
  }

  function previewMarkup(field = {}) {
    const url = dataUrl(field);
    const type = String(field.fileType || "").toLowerCase();
    const name = html(field.fileName || field.value || "Attachment");
    if (url && type.startsWith("image/")) {
      return `<div class="task-attachment-preview"><img src="${html(url)}" alt="Preview of ${name}" loading="lazy" /></div>`;
    }
    if (url && type.startsWith("audio/")) {
      return `<div class="task-attachment-preview"><audio controls src="${html(url)}"></audio></div>`;
    }
    if (url && type.startsWith("video/")) {
      return `<div class="task-attachment-preview"><video controls src="${html(url)}"></video></div>`;
    }
    return "";
  }

  function attachmentMarkup(task) {
    const attachments = fileFields(task);
    if (!attachments.length) return "";
    return `<div class="task-attachments" aria-label="Task attachments">
      ${attachments.map(({ field, index }) => {
        const name = field.fileName || field.value || "Attachment";
        const size = Number(field.fileSize || 0);
        const sizeLabel = size ? ` · ${size.toLocaleString()} bytes` : "";
        const openAction = dataUrl(field)
          ? `<a class="task-attachment-action" href="${html(dataUrl(field))}" download="${html(name)}" target="_blank" rel="noreferrer">Open</a>`
          : "";
        return `<article class="task-attachment">
          <div class="task-attachment-main">
            <strong>${html(field.name || "Attachment")}</strong>
            <span>${html(name)}${html(sizeLabel)}</span>
          </div>
          ${previewMarkup(field)}
          <div class="task-attachment-actions">
            ${openAction}
            <button type="button" class="task-attachment-delete" data-task-attachment-delete="${html(task.id)}" data-field-index="${html(index)}" data-file-name="${html(name)}">Delete</button>
          </div>
        </article>`;
      }).join("")}
    </div>`;
  }

  function taskPayloadWithoutAttachment(task, fieldIndex) {
    const customFields = (Array.isArray(task.customFields) ? task.customFields : []).map((field, index) => {
      if (index !== Number(fieldIndex)) return field;
      return { ...field, value: "", fileName: "", fileType: "", fileSize: 0, fileData: "" };
    });
    return {
      title: task.title,
      description: task.description || "",
      status: task.status || "todo",
      recordStatus: task.recordStatus || "active",
      category: task.category || "Tasks",
      priority: task.priority || "medium",
      dueLabel: task.dueLabel || "No due date",
      dueDate: task.dueDate || "",
      boardId: task.boardId || "",
      projectId: task.projectId || "",
      assigneeIds: task.assigneeIds || [],
      customFields
    };
  }

  async function fetchTasks() {
    if (state.loading) return;
    state.loading = true;
    try {
      const response = await fetch(`/api/admin/playground?${queryString()}`, { headers: headers() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load task attachments.");
      state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
      decorateRows();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      state.loading = false;
    }
  }

  function decorateRows() {
    const rows = [...document.querySelectorAll("#taskListBody tr")];
    rows.forEach((row, index) => {
      if (!row.cells || row.cells.length < 2) return;
      const task = state.tasks[index];
      if (!task?.id) return;
      const markup = attachmentMarkup(task);
      const target = row.cells[1];
      const existing = target.querySelector(".task-attachments");
      if (existing) existing.remove();
      if (markup) target.insertAdjacentHTML("beforeend", markup);
    });
  }

  async function deleteAttachment(button) {
    const task = state.tasks.find((item) => item.id === button.dataset.taskAttachmentDelete);
    if (!task) return setStatus("Could not find that task attachment. Refresh and try again.", true);
    const fieldIndex = Number(button.dataset.fieldIndex);
    const fileName = button.dataset.fileName || "this attachment";
    if (!window.confirm(`Delete "${fileName}" from this task? This removes the stored file content.`)) return;

    button.disabled = true;
    button.textContent = "Deleting...";
    setStatus(`Deleting ${fileName}...`);
    try {
      const response = await fetch(`/api/admin/playground/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(taskPayloadWithoutAttachment(task, fieldIndex))
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete the attachment.");
      if (typeof window.loadTaskList === "function") await window.loadTaskList();
      await fetchTasks();
      setStatus(`Deleted ${fileName}.`);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Delete";
      setStatus(error.message, true);
    }
  }

  function injectStyles() {
    if (document.getElementById("playgroundTaskAttachmentStyles")) return;
    const style = document.createElement("style");
    style.id = "playgroundTaskAttachmentStyles";
    style.textContent = `
      .task-attachments { width: min(100%, 520px); display: grid; gap: 8px; margin-top: 8px; }
      .task-attachment { display: grid; gap: 8px; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
      .task-attachment-main { min-width: 0; display: grid; gap: 2px; }
      .task-attachment-main strong, .task-attachment-main span { min-width: 0; overflow-wrap: anywhere; }
      .task-attachment-main span { color: var(--muted); font-size: 0.76rem; font-weight: 800; }
      .task-attachment-preview { overflow: hidden; border: 1px solid var(--line); border-radius: calc(var(--radius) - 3px); background: var(--panel-soft); }
      .task-attachment-preview img, .task-attachment-preview video { display: block; width: 100%; max-height: 180px; object-fit: contain; background: #050505; }
      .task-attachment-preview audio { display: block; width: 100%; padding: 6px; }
      .task-attachment-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .task-attachment-action, .task-attachment-delete { min-height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border: 1px solid var(--line); border-radius: calc(var(--radius) - 3px); background: var(--panel-soft); color: var(--text); font: inherit; font-size: 0.78rem; font-weight: 900; text-decoration: none; cursor: pointer; }
      .task-attachment-delete { border-color: var(--error-line); background: var(--error-bg); color: var(--error); }
      .task-attachment-action:hover, .task-attachment-action:focus-visible, .task-attachment-delete:hover:not(:disabled), .task-attachment-delete:focus-visible:not(:disabled) { border-color: var(--primary); outline: 3px solid var(--focus-ring); outline-offset: 1px; }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-task-attachment-delete]");
      if (button) deleteAttachment(button);
    });
    const originalRender = window.renderTaskList;
    if (typeof originalRender === "function" && originalRender.datasetAttachmentWrapped !== "true") {
      window.renderTaskList = function wrappedRenderTaskList(...args) {
        const result = originalRender.apply(this, args);
        fetchTasks();
        return result;
      };
      window.renderTaskList.datasetAttachmentWrapped = "true";
    }
    fetchTasks();
    ["taskListSearch", "taskListStatus", "taskListPriority", "taskListProject", "taskListAssignee"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", fetchTasks);
      document.getElementById(id)?.addEventListener("input", fetchTasks);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
