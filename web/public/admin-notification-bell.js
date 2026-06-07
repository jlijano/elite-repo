(() => {
  const headerActions = document.querySelector(".admin-header .header-actions");
  if (!headerActions || document.querySelector(".notification-bell-button")) return;

  const style = document.createElement("style");
  style.id = "notificationBellStyles";
  style.textContent = `
    .notification-bell-button {
      position: relative;
      width: 38px;
      height: 38px;
      min-height: 38px;
      flex: 0 0 38px;
      display: inline-grid;
      place-items: center;
      padding: 0 !important;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--panel-soft);
      color: var(--text);
      cursor: pointer;
    }
    .notification-bell-button:hover,
    .notification-bell-button:focus-visible {
      border-color: var(--primary);
      background: var(--sidebar-card);
      outline: 3px solid var(--focus-ring);
      outline-offset: 2px;
    }
    .notification-bell-button svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      pointer-events: none;
    }
    .notification-bell-indicator {
      position: absolute;
      top: 8px;
      right: 9px;
      width: 8px;
      height: 8px;
      border: 2px solid var(--panel-soft);
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.18);
      pointer-events: none;
    }
    .notification-bell-button:hover .notification-bell-indicator,
    .notification-bell-button:focus-visible .notification-bell-indicator {
      border-color: var(--sidebar-card);
    }
    @media (max-width: 520px) {
      .notification-bell-button {
        width: 34px;
        height: 34px;
        min-height: 34px;
        flex-basis: 34px;
      }
      .notification-bell-button svg {
        width: 16px;
        height: 16px;
      }
      .notification-bell-indicator {
        top: 7px;
        right: 8px;
      }
    }
    @media (max-width: 340px), (max-height: 420px) and (max-width: 740px) {
      .notification-bell-button {
        width: 32px;
        height: 32px;
        min-height: 32px;
        flex-basis: 32px;
      }
      .notification-bell-button svg {
        width: 15px;
        height: 15px;
      }
      .notification-bell-indicator {
        width: 7px;
        height: 7px;
      }
    }
  `;
  document.head.appendChild(style);

  const button = document.createElement("button");
  button.className = "notification-bell-button";
  button.type = "button";
  button.title = "Notifications";
  button.setAttribute("aria-label", "Open notifications");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path>
      <path d="M13.7 21a2 2 0 0 1-3.4 0"></path>
    </svg>
    <span class="notification-bell-indicator" aria-hidden="true"></span>
  `;

  const profileMenu = headerActions.querySelector(".profile-menu");
  if (profileMenu) headerActions.insertBefore(button, profileMenu);
  else headerActions.appendChild(button);
})();
