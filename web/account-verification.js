const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const inviteTtlMs = 1000 * 60 * 60 * 24 * 7;
const minPasswordLength = 12;

function appError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanString(value, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function passwordPolicyError(password) {
  if (password.length < minPasswordLength) return `Password must be at least ${minPasswordLength} characters.`;
  if (!/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
  if (new Set(password).size < 4) return "Password must use at least four different characters.";
  return "";
}

function hashPassword(password) {
  const value = typeof password === "string" ? password : "";
  const policyError = passwordPolicyError(value);
  if (policyError) throw appError(400, policyError);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function createInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashInviteToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function publicOrigin(req, options = {}) {
  const configured = cleanString(options.publicAppUrl || process.env.PUBLIC_APP_URL, 300).replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${proto}://${req.get("host")}`;
}

function inviteLink(req, token, options = {}) {
  return `${publicOrigin(req, options)}/verify-account.html?token=${encodeURIComponent(token)}`;
}

function userLabel(user = {}) {
  return user.name || user.email || "user";
}

async function maybeSendInviteEmail(user, link, options = {}) {
  const webhookUrl = cleanString(options.emailWebhookUrl || process.env.INVITE_EMAIL_WEBHOOK_URL, 500);
  if (!webhookUrl) return { sent: false, reason: "Email provider is not configured. Copy the verification link and send it manually." };
  const payload = {
    to: user.email,
    subject: "Verify your Switchboard account",
    text: `Welcome to Switchboard. Verify your account and set your password here: ${link}`,
    html: `<p>Welcome to Switchboard.</p><p><a href="${link}">Verify your account and set your password</a>.</p>`
  };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return { sent: false, reason: `Email webhook returned ${response.status}.` };
    return { sent: true, reason: "Verification email sent." };
  } catch (error) {
    return { sent: false, reason: "Email webhook could not be reached." };
  }
}

function createPostgresStore(options) {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    ssl: options.databaseSsl === "true" ? { rejectUnauthorized: false } : undefined
  });
  let initialized;
  const ready = () => (initialized ||= fs.promises.readFile(options.schemaPath, "utf8").then((schema) => pool.query(schema)));

  return {
    async createInvite(userId) {
      await ready();
      const token = createInviteToken();
      const tokenHash = hashInviteToken(token);
      const expiresAt = new Date(Date.now() + inviteTtlMs).toISOString();
      const user = await pool.query("SELECT id, name, email, status FROM users WHERE id = $1", [userId]);
      if (!user.rows[0]) throw appError(404, "User not found.");
      await pool.query("UPDATE users SET status = 'invited', password_hash = NULL, password_updated_at = NULL, updated_at = NOW() WHERE id = $1", [userId]);
      await pool.query("UPDATE user_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
      await pool.query(
        "INSERT INTO user_verification_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        [options.makeId(), userId, tokenHash, expiresAt]
      );
      return { token, expiresAt, user: { ...user.rows[0], status: "invited" } };
    },
    async getInvite(token) {
      await ready();
      const result = await pool.query(
        `SELECT t.*, u.name, u.email, u.status
         FROM user_verification_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW()
         LIMIT 1`,
        [hashInviteToken(token)]
      );
      const row = result.rows[0];
      if (!row) return null;
      return { userId: row.user_id, name: row.name, email: row.email, status: row.status, expiresAt: new Date(row.expires_at).toISOString() };
    },
    async verifyInvite(token, password) {
      await ready();
      const invite = await this.getInvite(token);
      if (!invite) throw appError(404, "Verification link is invalid or expired.");
      const passwordHash = hashPassword(password);
      await pool.query("UPDATE users SET status = 'active', password_hash = $2, password_updated_at = NOW(), updated_at = NOW() WHERE id = $1", [invite.userId, passwordHash]);
      await pool.query("UPDATE user_verification_tokens SET used_at = NOW() WHERE token_hash = $1", [hashInviteToken(token)]);
      await pool.query(
        "INSERT INTO user_audit_events (id, actor_user_id, target_user_id, action, details) VALUES ($1, $2, $2, 'user.verified', $3)",
        [options.makeId(), invite.userId, { source: "verification", logType: "activity", logLabel: "Activity log" }]
      ).catch(() => {});
      return { ...invite, status: "active" };
    }
  };
}

function createMemoryStore(options) {
  const invites = new Map();
  const userStore = options.userStore;
  return {
    async createInvite(userId) {
      const user = await userStore.getUser(userId);
      if (!user) throw appError(404, "User not found.");
      const token = createInviteToken();
      const expiresAt = new Date(Date.now() + inviteTtlMs).toISOString();
      invites.set(hashInviteToken(token), { userId, expiresAt, usedAt: null });
      await userStore.updateUser(userId, { status: "invited", passwordHash: null }, null);
      return { token, expiresAt, user: { ...user, status: "invited" } };
    },
    async getInvite(token) {
      const invite = invites.get(hashInviteToken(token));
      if (!invite || invite.usedAt || new Date(invite.expiresAt).getTime() <= Date.now()) return null;
      const user = await userStore.getUser(invite.userId);
      if (!user) return null;
      return { userId: user.id, name: user.name, email: user.email, status: user.status, expiresAt: invite.expiresAt };
    },
    async verifyInvite(token, password) {
      const tokenHash = hashInviteToken(token);
      const invite = await this.getInvite(token);
      if (!invite) throw appError(404, "Verification link is invalid or expired.");
      await userStore.updateUser(invite.userId, { status: "active", passwordHash: hashPassword(password) }, invite.userId);
      invites.get(tokenHash).usedAt = new Date().toISOString();
      await userStore.writeAudit("user.verified", invite.userId, { source: "verification" }, invite.userId).catch(() => {});
      return { ...invite, status: "active" };
    }
  };
}

function createVerificationStore(options = {}) {
  if (options.databaseUrl) return createPostgresStore(options);
  return createMemoryStore(options);
}

function attachAccountVerificationRoutes(app, options = {}) {
  const requireAdmin = options.requireAdmin;
  const store = createVerificationStore(options);

  function sendError(res, error, fallback) {
    res.status(error.status || 500).json({ error: error.status ? error.message : fallback });
  }

  app.post("/api/admin/users/:userId/invite", requireAdmin, async (req, res) => {
    try {
      const invite = await store.createInvite(req.params.userId);
      const link = inviteLink(req, invite.token, options);
      const email = await maybeSendInviteEmail(invite.user, link, options);
      res.status(201).json({
        invite: {
          userId: invite.user.id,
          email: invite.user.email,
          expiresAt: invite.expiresAt,
          verificationLink: link,
          emailSent: email.sent,
          emailStatus: email.reason
        }
      });
    } catch (error) { sendError(res, error, "Could not create verification invite."); }
  });

  app.get("/api/auth/verify-account", async (req, res) => {
    try {
      const token = cleanString(req.query.token, 300);
      const invite = await store.getInvite(token);
      if (!invite) return res.status(404).json({ error: "Verification link is invalid or expired." });
      res.json({ invite: { name: invite.name, email: invite.email, expiresAt: invite.expiresAt } });
    } catch (error) { sendError(res, error, "Could not load verification invite."); }
  });

  app.post("/api/auth/verify-account", async (req, res) => {
    try {
      const token = cleanString(req.body?.token, 300);
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!token) throw appError(400, "Verification token is required.");
      const user = await store.verifyInvite(token, password);
      res.json({ ok: true, user: { name: user.name, email: user.email, status: user.status }, loginUrl: "/login.html" });
    } catch (error) { sendError(res, error, "Could not verify account."); }
  });

  app.locals.accountVerificationAttached = true;
  return store;
}

module.exports = { attachAccountVerificationRoutes, createVerificationStore };
