(function createUserReferenceModal() {
  if (document.body?.dataset?.adminPage !== "user") return;

  const userIcon = `
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
      <circle cx="32" cy="23" r="10" stroke="currentColor" stroke-width="3"></circle>
      <path d="M15 51c3.7-10.7 12.1-15 17-15s13.3 4.3 17 15" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
      <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="1.5" opacity=".38"></circle>
    </svg>`;

  function addStyles() {
    if (document.getElementById("createUserReferenceModalStyles")) return;
    const style = document.createElement("style");
    style.id = "createUserReferenceModalStyles";
    style.textContent = `
      body[data-admin-page="user"]{background:radial-gradient(circle at 88% 7%,rgba(42,111,255,.2),transparent 24rem),linear-gradient(145deg,#03070d,#07111b 48%,#020409)}
      body[data-admin-page="user"] #userDialog{width:min(1120px,calc(100vw - 48px))!important;max-height:min(880px,calc(100dvh - 48px))!important;padding:0!important;border:1px solid rgba(148,163,184,.24)!important;border-radius:18px!important;background:rgba(5,12,20,.78)!important;color:#f8fafc!important;box-shadow:0 28px 90px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.05)!important;backdrop-filter:blur(24px) saturate(130%)}
      body[data-admin-page="user"] #userDialog::backdrop{background:linear-gradient(rgba(2,6,12,.68),rgba(2,6,12,.76)),rgba(0,0,0,.64)!important;backdrop-filter:blur(7px)}
      body[data-admin-page="user"] #userDialog .modal-content{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;max-height:min(880px,calc(100dvh - 48px))!important;overflow:hidden!important;background:linear-gradient(145deg,rgba(8,15,26,.92),rgba(4,11,18,.78))!important}
      body[data-admin-page="user"] #userDialog .modal-head{min-height:86px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 36px!important;border-bottom:1px solid rgba(148,163,184,.22)!important;background:rgba(8,14,23,.3)!important}
      body[data-admin-page="user"] #userDialog .modal-head h2{position:static!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;overflow:visible!important;clip:auto!important;white-space:normal!important;color:#fff!important;font-size:clamp(1.45rem,2vw,1.85rem)!important;line-height:1.15!important;font-weight:650!important;letter-spacing:0!important}
      body[data-admin-page="user"] #userDialog .modal-close{width:42px!important;height:42px!important;min-height:42px!important;display:grid!important;place-items:center!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:rgba(226,232,240,.82)!important;font-size:1.85rem!important;line-height:1!important;box-shadow:none!important}
      body[data-admin-page="user"] #userDialog .modal-close:hover{color:#fff!important;background:rgba(255,255,255,.08)!important}
      body[data-admin-page="user"] #userDialog .user-dialog-body{min-height:0!important;max-height:none!important;overflow:auto!important;padding:36px!important}
      body[data-admin-page="user"] #userDialog .management-form.user-form-layout{display:grid!important;grid-template-columns:1fr!important;gap:34px!important;padding:0!important;border:0!important;background:transparent!important}
      body[data-admin-page="user"] #userDialog .form-heading{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}
      body[data-admin-page="user"] #userDialog .reference-form-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:start}
      body[data-admin-page="user"] #userDialog .reference-column{min-width:0;display:grid;gap:26px}
      body[data-admin-page="user"] #userDialog label,body[data-admin-page="user"] #userDialog .photo-field{min-width:0!important;display:grid!important;gap:14px!important;margin:0!important;color:#f8fafc!important;font-weight:520!important}
      body[data-admin-page="user"] #userDialog label>span,body[data-admin-page="user"] #userDialog .photo-field-label{position:static!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;overflow:visible!important;clip:auto!important;white-space:normal!important;color:#fff!important;font-size:1.03rem!important;font-weight:520!important;line-height:1.2!important;text-transform:none!important}
      body[data-admin-page="user"] #userDialog input,body[data-admin-page="user"] #userDialog select{min-height:66px!important;padding:0 20px!important;border:1px solid rgba(148,163,184,.25)!important;border-radius:14px!important;background:rgba(3,10,18,.62)!important;color:#f8fafc!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;font-size:1.03rem!important}
      body[data-admin-page="user"] #userDialog input::placeholder{color:rgba(148,163,184,.74)!important}
      body[data-admin-page="user"] #userDialog select{appearance:none;padding-right:48px!important;background-image:linear-gradient(45deg,transparent 50%,rgba(226,232,240,.9) 50%),linear-gradient(135deg,rgba(226,232,240,.9) 50%,transparent 50%)!important;background-position:calc(100% - 27px) 52%,calc(100% - 19px) 52%!important;background-size:8px 8px!important;background-repeat:no-repeat!important}
      body[data-admin-page="user"] #userDialog input:focus-visible,body[data-admin-page="user"] #userDialog select:focus-visible,body[data-admin-page="user"] #userDialog button:focus-visible,body[data-admin-page="user"] #userDialog .photo-drop-zone:focus-visible{outline:3px solid rgba(59,130,246,.24)!important;outline-offset:2px!important;border-color:rgba(96,165,250,.62)!important}
      body[data-admin-page="user"] #userDialog .photo-drop-zone{width:100%!important;height:auto!important;min-height:280px!important;display:grid!important;place-items:center!important;padding:28px!important;border:1px dashed rgba(148,163,184,.42)!important;border-radius:14px!important;background:rgba(5,12,22,.52)!important;cursor:pointer!important}
      body[data-admin-page="user"] #userDialog .photo-drop-zone.drag-active{border-color:rgba(96,165,250,.75)!important;background:rgba(37,99,235,.12)!important}
      body[data-admin-page="user"] #userDialog .reference-upload-content{display:grid;justify-items:center;gap:12px;text-align:center}
      body[data-admin-page="user"] #userDialog .photo-preview{width:86px!important;height:86px!important;display:grid!important;place-items:center!important;overflow:hidden!important;border:1px solid rgba(148,163,184,.26)!important;border-radius:50%!important;background:rgba(15,23,42,.72)!important;color:rgba(203,213,225,.78)!important}
      body[data-admin-page="user"] #userDialog .photo-preview svg{width:54px;height:54px}
      body[data-admin-page="user"] #userDialog .photo-preview img{width:100%!important;height:100%!important;object-fit:cover!important}
      body[data-admin-page="user"] #userDialog .reference-upload-title{color:#f8fafc;font-size:1.1rem;line-height:1.25}
      body[data-admin-page="user"] #userDialog .photo-upload-status{max-width:none!important;color:rgba(203,213,225,.72)!important;font-size:1rem!important;line-height:1.35!important;text-align:center!important}
      body[data-admin-page="user"] #userDialog #choosePhotoButton{min-height:48px!important;display:inline-flex!important;align-items:center!important;gap:10px!important;margin-top:10px!important;padding:0 22px!important;border:1px solid rgba(148,163,184,.28)!important;border-radius:14px!important;background:rgba(15,23,42,.72)!important;color:#fff!important;font-size:1rem!important;font-weight:520!important}
      body[data-admin-page="user"] #userDialog .photo-drop-copy{display:none!important}
      body[data-admin-page="user"] #userDialog .reference-status-field{position:relative}
      body[data-admin-page="user"] #userDialog .reference-status-field select{padding-left:40px!important}
      body[data-admin-page="user"] #userDialog .reference-status-field::before{content:"";position:absolute;left:20px;top:52px;z-index:2;width:12px;height:12px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.14);pointer-events:none}
      body[data-admin-page="user"] #userDialog .reference-helper{margin:-16px 0 0;color:rgba(203,213,225,.7);font-size:.98rem;line-height:1.4}
      body[data-admin-page="user"] #userDialog .reference-password-shell{position:relative}
      body[data-admin-page="user"] #userDialog .reference-password-shell input{padding-right:54px!important;color:rgba(203,213,225,.76)!important}
      body[data-admin-page="user"] #userDialog .reference-info-icon{position:absolute;right:18px;bottom:20px;width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(226,232,240,.72);border-radius:50%;color:rgba(226,232,240,.86);font-size:.88rem;font-weight:700;pointer-events:none}
      body[data-admin-page="user"] #userDialog .form-actions{display:flex!important;justify-content:flex-end!important;gap:16px!important;padding:6px 0 0!important;border:0!important}
      body[data-admin-page="user"] #userDialog .form-actions button{min-width:128px!important;min-height:58px!important;padding:0 28px!important;border-radius:18px!important;font-size:1.02rem!important;font-weight:560!important}
      body[data-admin-page="user"] #userDialog .reference-cancel-button{border:1px solid rgba(148,163,184,.28)!important;background:rgba(15,23,42,.48)!important;color:#f8fafc!important}
      body[data-admin-page="user"] #userDialog #saveUserButton{min-width:164px!important;border:1px solid rgba(59,130,246,.58)!important;background:linear-gradient(180deg,#3b82f6,#1d4ed8)!important;color:#fff!important;box-shadow:0 18px 38px rgba(37,99,235,.34)!important}
      body[data-admin-page="user"] #userDialog #saveUserButton:hover{background:linear-gradient(180deg,#4b8ff8,#2259df)!important}
      @media (max-width:860px){body[data-admin-page="user"] #userDialog{width:calc(100vw - 24px)!important;max-height:calc(100dvh - 24px)!important}body[data-admin-page="user"] #userDialog .modal-head{min-height:74px!important;padding:0 22px!important}body[data-admin-page="user"] #userDialog .user-dialog-body{padding:24px!important}body[data-admin-page="user"] #userDialog .reference-form-grid{grid-template-columns:1fr;gap:24px}}
      @media (max-width:520px){body[data-admin-page="user"] #userDialog .user-dialog-body{padding:18px!important}body[data-admin-page="user"] #userDialog .photo-drop-zone{min-height:220px!important}body[data-admin-page="user"] #userDialog .form-actions{flex-direction:column-reverse}body[data-admin-page="user"] #userDialog .form-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function moveField(column, selector) {
    const field = document.querySelector(selector);
    if (field) column.appendChild(field);
    return field;
  }

  function ensureCancelButton() {
    const actions = document.querySelector("#userDialog .form-actions");
    if (!actions || actions.querySelector(".reference-cancel-button")) return;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "reference-cancel-button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => document.getElementById("closeUserModalButton")?.click());
    actions.prepend(cancel);
  }

  function enhanceUploadBox() {
    const dropZone = document.getElementById("photoDropZone");
    const preview = document.getElementById("photoPreview");
    const previewText = document.getElementById("photoPreviewText");
    const chooseButton = document.getElementById("choosePhotoButton");
    const uploadStatus = document.getElementById("photoUploadStatus");
    if (!dropZone || !preview || dropZone.querySelector(".reference-upload-content")) return;

    if (previewText) {
      previewText.innerHTML = userIcon;
      previewText.hidden = false;
    }
    if (chooseButton) {
      chooseButton.innerHTML = '<span aria-hidden="true">↥</span><span>Choose File</span>';
    }

    const content = document.createElement("div");
    content.className = "reference-upload-content";
    const title = document.createElement("div");
    title.className = "reference-upload-title";
    title.textContent = "No file chosen";
    content.append(preview, title);
    if (uploadStatus) content.appendChild(uploadStatus);
    if (chooseButton) content.appendChild(chooseButton);
    dropZone.prepend(content);
  }

  function reshapeForm() {
    const form = document.getElementById("userForm");
    if (!form || form.dataset.referenceModalReady === "true") return;

    const topRow = form.querySelector(".user-form-top-row");
    const topFields = form.querySelector(".user-form-top-fields");
    if (topFields) {
      while (topFields.firstChild) form.insertBefore(topFields.firstChild, topRow);
    }

    const grid = document.createElement("div");
    grid.className = "reference-form-grid";
    const left = document.createElement("div");
    left.className = "reference-column reference-left-column";
    const right = document.createElement("div");
    right.className = "reference-column reference-right-column";

    const photoField = topRow?.querySelector(".photo-field");
    if (photoField) left.appendChild(photoField);
    topRow?.remove();
    moveField(left, ".full-name-field");
    moveField(left, ".email-field");
    moveField(left, ".photo-url-field");

    const roleStatusRow = form.querySelector(".user-role-status-row");
    const roleField = roleStatusRow?.querySelector("label:has(#userRole)");
    const statusField = roleStatusRow?.querySelector("label:has(#userStatus)");
    if (statusField) {
      statusField.classList.add("reference-status-field");
      left.appendChild(statusField);
      const helper = document.createElement("p");
      helper.className = "reference-helper";
      helper.textContent = "Set whether the user is active or not active.";
      left.appendChild(helper);
    }

    moveField(right, ".company-field");
    moveField(right, ".title-field");
    moveField(right, ".group-field");
    const passwordField = moveField(right, ".password-field");
    if (passwordField) {
      passwordField.classList.add("reference-password-shell");
      const icon = document.createElement("span");
      icon.className = "reference-info-icon";
      icon.textContent = "i";
      passwordField.appendChild(icon);
    }
    if (roleField) right.appendChild(roleField);
    roleStatusRow?.remove();

    grid.append(left, right);
    const actions = form.querySelector(".form-actions");
    if (actions) form.insertBefore(grid, actions);
    else form.appendChild(grid);
    form.dataset.referenceModalReady = "true";
  }

  function syncText() {
    const title = document.querySelector("#userDialog .modal-head h2");
    const formTitle = document.getElementById("userFormTitle");
    const saveButton = document.getElementById("saveUserButton");
    const status = document.getElementById("userStatus");
    const password = document.getElementById("userPassword");
    if (title && title.textContent !== "Create User") title.textContent = "Create User";
    if (formTitle && formTitle.textContent !== "Create User") formTitle.textContent = "Create User";
    if (saveButton && saveButton.textContent !== "Create User") saveButton.textContent = "Create User";
    if (status?.options?.length) {
      status.options[0].textContent = "Active";
      if (status.options[1]) status.options[1].textContent = "Invited";
      if (status.options[2]) status.options[2].textContent = "Disabled";
    }
    if (password) {
      password.type = "text";
      password.value = "";
      password.placeholder = "Set by user after email verification";
      password.readOnly = true;
      password.disabled = true;
    }
  }

  function init() {
    addStyles();
    reshapeForm();
    enhanceUploadBox();
    ensureCancelButton();
    syncText();
    const dialog = document.getElementById("userDialog");
    if (dialog) {
      new MutationObserver(() => {
        enhanceUploadBox();
        ensureCancelButton();
        syncText();
      }).observe(dialog, { attributes: true, childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();