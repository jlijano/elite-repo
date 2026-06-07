(function stabilizeCreateUserModalShell() {
  if (document.body?.dataset?.adminPage !== "user") return;

  function setImportant(element, property, value) {
    if (element) element.style.setProperty(property, value, "important");
  }

  function addStyles() {
    if (document.getElementById("createUserModalShellStructureStyles")) return;
    const style = document.createElement("style");
    style.id = "createUserModalShellStructureStyles";
    style.textContent = `
      body[data-admin-page="user"] #userDialog.reference-create-user-shell {
        width: min(1080px, calc(100vw - 56px)) !important;
        max-width: none !important;
        max-height: min(860px, calc(100dvh - 56px)) !important;
        padding: 0 !important;
        border: 1px solid rgba(148, 163, 184, 0.24) !important;
        border-radius: 22px !important;
        background: rgba(5, 12, 22, 0.78) !important;
        color: #f8fafc !important;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        backdrop-filter: blur(24px) saturate(135%) !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell::backdrop {
        background: linear-gradient(rgba(2, 6, 12, 0.66), rgba(2, 6, 12, 0.78)), rgba(0, 0, 0, 0.64) !important;
        backdrop-filter: blur(8px) !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-content {
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        max-height: min(860px, calc(100dvh - 56px)) !important;
        overflow: hidden !important;
        border-radius: inherit !important;
        background: linear-gradient(145deg, rgba(8, 15, 27, 0.94), rgba(4, 10, 18, 0.82)) !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-head {
        min-height: 82px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 18px !important;
        padding: 0 34px !important;
        border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
        background: rgba(15, 23, 42, 0.2) !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-head h2 {
        position: static !important;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        clip: auto !important;
        white-space: normal !important;
        border: 0 !important;
        color: #ffffff !important;
        font-size: 1.55rem !important;
        line-height: 1.15 !important;
        font-weight: 700 !important;
        letter-spacing: 0 !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-close {
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        display: grid !important;
        place-items: center !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: transparent !important;
        color: rgba(226, 232, 240, 0.82) !important;
        box-shadow: none !important;
        font-size: 1.8rem !important;
        font-weight: 400 !important;
        line-height: 1 !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-close:hover,
      body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-close:focus-visible {
        color: #ffffff !important;
        background: rgba(255, 255, 255, 0.07) !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .user-dialog-body {
        min-height: 0 !important;
        max-height: none !important;
        overflow: auto !important;
        padding: 32px 34px 28px !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .management-form.user-form-layout {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 28px !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .reference-form-grid,
      body[data-admin-page="user"] #userDialog.reference-create-user-shell .reference-shell-grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 34px !important;
        align-items: start !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .reference-column {
        min-width: 0 !important;
        display: grid !important;
        gap: 18px !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .form-actions {
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 14px !important;
        margin-top: 2px !important;
        padding: 24px 0 0 !important;
        border-top: 1px solid rgba(148, 163, 184, 0.18) !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .form-actions button {
        min-width: 128px !important;
        min-height: 52px !important;
        padding: 0 24px !important;
        border-radius: 16px !important;
        font-size: 0.98rem !important;
        font-weight: 700 !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell .reference-cancel-button {
        border: 1px solid rgba(148, 163, 184, 0.28) !important;
        background: rgba(15, 23, 42, 0.48) !important;
        color: #f8fafc !important;
        box-shadow: none !important;
      }

      body[data-admin-page="user"] #userDialog.reference-create-user-shell #saveUserButton {
        min-width: 160px !important;
        border: 1px solid rgba(96, 165, 250, 0.62) !important;
        background: linear-gradient(180deg, #3b82f6 0%, #2563eb 52%, #1d4ed8 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 18px 34px rgba(37, 99, 235, 0.34) !important;
      }

      @media (max-width: 860px) {
        body[data-admin-page="user"] #userDialog.reference-create-user-shell {
          width: calc(100vw - 24px) !important;
          max-height: calc(100dvh - 24px) !important;
        }

        body[data-admin-page="user"] #userDialog.reference-create-user-shell .modal-head {
          min-height: 72px !important;
          padding: 0 22px !important;
        }

        body[data-admin-page="user"] #userDialog.reference-create-user-shell .user-dialog-body {
          padding: 24px !important;
        }

        body[data-admin-page="user"] #userDialog.reference-create-user-shell .reference-form-grid,
        body[data-admin-page="user"] #userDialog.reference-create-user-shell .reference-shell-grid {
          grid-template-columns: 1fr !important;
          gap: 22px !important;
        }
      }

      @media (max-width: 520px) {
        body[data-admin-page="user"] #userDialog.reference-create-user-shell .form-actions {
          flex-direction: column-reverse !important;
        }

        body[data-admin-page="user"] #userDialog.reference-create-user-shell .form-actions button {
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTitle(head) {
    let title = head?.querySelector("h2");
    if (!head) return null;
    if (!title) {
      title = document.createElement("h2");
      head.prepend(title);
    }
    title.textContent = "Create User";
    return title;
  }

  function ensureCancelButton(actions) {
    if (!actions) return;
    let cancel = actions.querySelector(".reference-cancel-button");
    if (!cancel) {
      cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "reference-cancel-button";
      cancel.addEventListener("click", () => document.getElementById("closeUserModalButton")?.click());
      actions.prepend(cancel);
    }
    cancel.textContent = "Cancel";
  }

  function ensureTwoColumnGrid(form) {
    if (!form) return;
    let grid = form.querySelector(".reference-form-grid, .reference-shell-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "reference-shell-grid";
      const left = document.createElement("div");
      left.className = "reference-column reference-left-column";
      const right = document.createElement("div");
      right.className = "reference-column reference-right-column";
      grid.append(left, right);

      const actions = form.querySelector(".form-actions");
      const fields = [...form.children].filter((child) => {
        return child !== actions && !child.classList.contains("form-heading");
      });
      fields.forEach((field, index) => (index % 2 === 0 ? left : right).appendChild(field));
      if (actions) form.insertBefore(grid, actions);
      else form.appendChild(grid);
    }
    grid.classList.add("reference-shell-grid");
  }

  function applyInlineShell() {
    const dialog = document.getElementById("userDialog");
    const content = dialog?.querySelector(".modal-content");
    const head = dialog?.querySelector(".modal-head");
    const body = dialog?.querySelector(".user-dialog-body");
    const form = dialog?.querySelector("#userForm");
    const actions = dialog?.querySelector(".form-actions");
    const close = dialog?.querySelector(".modal-close");
    const save = dialog?.querySelector("#saveUserButton");

    if (!dialog || !content || !head || !body || !form) return;

    dialog.classList.add("reference-create-user-shell");
    ensureTitle(head);
    ensureTwoColumnGrid(form);
    ensureCancelButton(actions);

    if (close) {
      close.textContent = "×";
      close.setAttribute("aria-label", "Close Create User modal");
    }
    if (save) save.textContent = "Create User";

    setImportant(dialog, "width", "min(1080px, calc(100vw - 56px))");
    setImportant(dialog, "max-width", "none");
    setImportant(dialog, "max-height", "min(860px, calc(100dvh - 56px))");
    setImportant(dialog, "padding", "0");
    setImportant(dialog, "border-radius", "22px");
    setImportant(content, "display", "grid");
    setImportant(content, "grid-template-rows", "auto minmax(0, 1fr)");
    setImportant(content, "overflow", "hidden");
    setImportant(head, "display", "flex");
    setImportant(head, "align-items", "center");
    setImportant(head, "justify-content", "space-between");
    setImportant(body, "overflow", "auto");
    setImportant(body, "padding", "32px 34px 28px");
    setImportant(form, "display", "grid");
    setImportant(form, "grid-template-columns", "1fr");
    setImportant(form, "gap", "28px");
    setImportant(actions, "display", "flex");
    setImportant(actions, "justify-content", "flex-end");
  }

  function init() {
    addStyles();
    applyInlineShell();
    const dialog = document.getElementById("userDialog");
    if (dialog && dialog.dataset.shellStructureObserved !== "true") {
      dialog.dataset.shellStructureObserved = "true";
      new MutationObserver(applyInlineShell).observe(dialog, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#manageUsersButton")) setTimeout(init, 0);
  });
})();