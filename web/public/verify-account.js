(() => {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const form = document.getElementById("verifyAccountForm");
  const emailField = document.getElementById("verifyEmail");
  const passwordField = document.getElementById("verifyPassword");
  const confirmField = document.getElementById("verifyConfirmPassword");
  const status = document.getElementById("verifyStatus");
  const intro = document.getElementById("verifyIntro");
  const loginLink = document.getElementById("loginLink");

  function setStatus(message, error = false) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle("error", error);
  }

  async function jsonFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function validatePassword(password, confirmation) {
    if (password.length < 12) return "Use at least 12 characters.";
    if (password !== confirmation) return "Passwords do not match.";
    return "";
  }

  async function loadInvite() {
    if (!token) {
      form.hidden = true;
      setStatus("This verification link is missing a token. Ask your admin for a new link.", true);
      return;
    }
    try {
      setStatus("Checking verification link...");
      const data = await jsonFetch(`/api/auth/verify-account?token=${encodeURIComponent(token)}`);
      if (emailField) emailField.value = data.invite?.email || "";
      if (intro && data.invite?.name) intro.textContent = `Welcome, ${data.invite.name}. Set your password to activate this account.`;
      form.hidden = false;
      setStatus("Verification link is ready.");
    } catch (error) {
      form.hidden = true;
      setStatus(error.message, true);
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordField?.value || "";
    const confirmation = confirmField?.value || "";
    const validationError = validatePassword(password, confirmation);
    if (validationError) {
      setStatus(validationError, true);
      return;
    }
    try {
      setStatus("Activating account...");
      const data = await jsonFetch("/api/auth/verify-account", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      form.hidden = true;
      if (loginLink) {
        loginLink.href = data.loginUrl || "/login.html";
        loginLink.hidden = false;
      }
      setStatus("Account verified. You can now log in with your new password.");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  loadInvite();
})();
