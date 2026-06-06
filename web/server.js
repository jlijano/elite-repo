const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const { Pool } = require("pg");
const { attachUserManagementRoutes } = require("./user-management");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(__dirname, "public");
const schemaPath = path.join(__dirname, "db", "schema.sql");
const knowledgeFiles = ["agent-directory.md", "routing-rules.md", "memory-rules.md", "handoff-template.md", "change-log.md"];
const scheduledReviewIntervalMs = Number(process.env.REVIEW_RUN_INTERVAL_MS || 0);
const minReviewIntervalMs = 60000;
const maxAttachments = 4;
const maxAttachmentChars = 2000000;
const maxAttachmentNameLength = 160;
const anonymousChatRetentionDays = 30;
const typingTimeoutMs = 6000;
const chatParticipants = new Map();
const pendingReviewReply =
  "I saved your message for Switchboard review. The AI responder is unavailable right now, so this chat is in storage-only mode and can be reviewed later.";

const systemPrompt = `You are the Switchboard Agent. Classify requests, check the Agent Directory, route only to Active agents or skills, recommend missing agents or skills, ask one concise clarification question when ambiguous, and flag high-risk requests. Use the standard Switchboard format when routing is requested:
Request summary:
Intent:
Category:
Best match:
Confidence:
Reason:
Next step:
Missing skill or agent needed:
Risk level:`;

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(express.static(publicDir));

const db = createStore();

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function redact(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]");
}

function cleanAttachment(attachment = {}) {
  const name = typeof attachment.name === "string" && attachment.name.trim()
    ? attachment.name.trim().slice(0, maxAttachmentNameLength)
    : "Untitled file";
  const type = typeof attachment.type === "string" ? attachment.type.slice(0, 120) : "";
  const size = Number.isFinite(Number(attachment.size)) ? Math.max(0, Number(attachment.size)) : 0;
  const content = typeof attachment.content === "string" ? redact(attachment.content).slice(0, maxAttachmentChars) : "";
  if (!content.trim()) return null;
  return { name, type, size, content };
}

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxAttachments).map(cleanAttachment).filter(Boolean);
}

function attachmentSummary(attachments = []) {
  if (!attachments.length) return "";
  return attachments.map((attachment, index) => {
    return `Attachment ${index + 1}: ${attachment.name}\n${attachment.content}`;
  }).join("\n\n");
}

function cleanParticipantContext(context = {}) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  const participantId = typeof context.participantId === "string" ? redact(context.participantId).slice(0, 120) : "";
  const participantType = context.participantType === "original" ? "original" : "shared";
  const fallbackLabel = participantType === "original" ? "Original" : "Shared link";
  const participantLabel = typeof context.participantLabel === "string" && context.participantLabel.trim()
    ? redact(context.participantLabel.trim()).slice(0, 80)
    : fallbackLabel;
  const deviceType = ["desktop", "mobile", "tablet"].includes(context.deviceType) ? context.deviceType : "desktop";
  const shareCount = Number.isFinite(Number(context.shareCount)) ? Math.max(0, Math.min(9999, Number(context.shareCount))) : 0;
  return { participantId, participantType, participantLabel, deviceType, shareCount };
}

function participantBucket(chatId) {
  if (!chatParticipants.has(chatId)) chatParticipants.set(chatId, new Map());
  return chatParticipants.get(chatId);
}

function participantPublicRecord(record = {}) {
  return {
    participantId: record.participantId,
    participantType: record.participantType,
    participantLabel: record.participantLabel,
    deviceType: record.deviceType,
    shareCount: Number(record.shareCount || 0),
    isTyping: Boolean(record.isTyping),
    lastSeenAt: record.lastSeenAt,
    lastTypingAt: record.lastTypingAt || null
  };
}

function upsertChatParticipant(chatId, context = {}) {
  const participant = cleanParticipantContext(context);
  if (!chatId || !participant.participantId) return null;
  const bucket = participantBucket(chatId);
  const existing = bucket.get(participant.participantId) || {};
  const record = {
    ...existing,
    ...participant,
    shareCount: Math.max(Number(existing.shareCount || 0), participant.shareCount),
    isTyping: Boolean(existing.isTyping),
    lastTypingAt: existing.lastTypingAt || null,
    lastSeenAt: now()
  };
  bucket.set(participant.participantId, record);
  return participantPublicRecord(record);
}

function chatParticipantList(chatId) {
  const bucket = chatParticipants.get(chatId);
  return bucket ? [...bucket.values()].map(participantPublicRecord) : [];
}

function setChatTyping(chatId, context = {}, isTyping = true) {
  const record = upsertChatParticipant(chatId, context);
  if (!record) return null;
  const bucket = participantBucket(chatId);
  const stored = bucket.get(record.participantId);
  stored.isTyping = Boolean(isTyping);
  stored.lastTypingAt = isTyping ? now() : null;
  stored.lastSeenAt = now();
  bucket.set(record.participantId, stored);
  return participantPublicRecord(stored);
}

function typingParticipantsForChat(chatId, currentParticipantId = "") {
  const cutoff = Date.now() - typingTimeoutMs;
  const bucket = chatParticipants.get(chatId);
  if (!bucket) return [];
  return [...bucket.values()]
    .filter((participant) => {
      if (!participant.isTyping || participant.participantId === currentParticipantId) return false;
      return participant.lastTypingAt && new Date(participant.lastTypingAt).getTime() >= cutoff;
    })
    .map(participantPublicRecord);
}

function cleanContext(context = {}) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  return Object.fromEntries(
    Object.entries(context)
      .slice(0, 20)
      .map(([key, value]) => {
        if (/secret|token|password|cookie|key/i.test(key)) return [key, "[REDACTED]"];
        if (key === "attachments") return [key, cleanAttachments(value)];
        if (key === "participantId") return [key, redact(String(value)).slice(0, 120)];
        if (key === "participantLabel") return [key, redact(String(value)).slice(0, 80)];
        if (key === "participantType") return [key, value === "original" ? "original" : "shared"];
        if (key === "deviceType") return [key, ["desktop", "mobile", "tablet"].includes(value) ? value : "desktop"];
        if (key === "shareCount") return [key, Number.isFinite(Number(value)) ? Math.max(0, Math.min(9999, Number(value))) : 0];
        if (typeof value === "string") return [key, redact(value).slice(0, maxAttachmentChars)];
        if (typeof value === "number" || typeof value === "boolean" || value === null) return [key, value];
        return [key, "[unsupported]"];
      })
  );
}

function readKnowledgeFiles() {
  const loaded = [];
  const sections = [];
  for (const file of knowledgeFiles) {
    try {
      const content = fs.readFileSync(path.join(repoRoot, file), "utf8").trim();
      if (content) {
        loaded.push(file);
        sections.push(`--- BEGIN ${file} ---\n${content}\n--- END ${file} ---`);
      }
    } catch (error) {
      // Missing repository docs are reported through directoryAvailable.
    }
  }
  return { context: sections.join("\n\n"), filesLoaded: loaded, directoryAvailable: loaded.includes("agent-directory.md") };
}

function chatRow(row) {
  const archivedValue = row.archived_at || row.archivedAt || null;
  const expiresValue = row.expires_at || row.expiresAt || null;
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString(),
    archivedAt: archivedValue ? new Date(archivedValue).toISOString() : null,
    createdByUserId: row.created_by_user_id || row.createdByUserId || null,
    isAnonymous: Boolean(row.is_anonymous ?? row.isAnonymous),
    expiresAt: expiresValue ? new Date(expiresValue).toISOString() : null,
    messageCount: Number(row.message_count || row.messageCount || 0)
  };
}

function messageRow(row) {
  return {
    id: row.id,
    chatId: row.chat_id || row.chatId,
    role: row.role,
    content: row.content,
    context: row.context || {},
    reviewed: Boolean(row.reviewed),
    createdAt: new Date(row.created_at || row.createdAt).toISOString()
  };
}

function knowledgeRow(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    sourceChatId: row.source_chat_id || row.sourceChatId,
    sourceMessageIds: row.source_message_ids || row.sourceMessageIds || [],
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    approvedAt: row.approved_at || row.approvedAt ? new Date(row.approved_at || row.approvedAt).toISOString() : null
  };
}

function runRow(row) {
  return {
    id: row.id,
    status: row.status,
    startedAt: new Date(row.started_at || row.startedAt).toISOString(),
    finishedAt: row.finished_at || row.finishedAt ? new Date(row.finished_at || row.finishedAt).toISOString() : null,
    messagesReviewed: Number(row.messages_reviewed || row.messagesReviewed || 0),
    knowledgeEntriesCreated: Number(row.knowledge_entries_created || row.knowledgeEntriesCreated || 0),
    error: row.error || null,
    context: row.context || {}
  };
}

function summaryRow(row) {
  return {
    chats: Number(row.chats || 0),
    messages: Number(row.messages || 0),
    unreviewedMessages: Number(row.unreviewed_messages || row.unreviewedMessages || 0),
    pendingKnowledge: Number(row.pending_knowledge || row.pendingKnowledge || 0),
    approvedKnowledge: Number(row.approved_knowledge || row.approvedKnowledge || 0),
    reviewRuns: Number(row.review_runs || row.reviewRuns || 0)
  };
}

function groupByChat(rows) {
  const groups = new Map();
  for (const row of rows) {
    const message = messageRow(row);
    if (!groups.has(message.chatId)) groups.set(message.chatId, { chatId: message.chatId, title: row.title || "New chat", messages: [] });
    groups.get(message.chatId).messages.push(message);
  }
  return [...groups.values()];
}

function buildKnowledge(group) {
  const bullets = group.messages
    .filter((message) => message.role === "user")
    .slice(-8)
    .map((message) => {
      const attachments = cleanAttachments(message.context?.attachments);
      const names = attachments.length ? ` Attachments: ${attachments.map((attachment) => attachment.name).join(", ")}.` : "";
      return `- ${message.content.slice(0, 600)}${names}`;
    });
  return bullets.length ? `Pending Switchboard knowledge from chat "${group.title}".\n\nUseful user-provided context:\n${bullets.join("\n")}` : "";
}

function createStore() {
  if (!process.env.DATABASE_URL) return createMemoryStore();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  let initialized;
  const ready = () => (initialized ||= fs.promises.readFile(schemaPath, "utf8")
    .then((schema) => pool.query(schema))
    .then(() => pool.query("DELETE FROM chats WHERE is_anonymous = TRUE AND expires_at IS NOT NULL AND expires_at < NOW()")));

  return {
    mode: "postgres",
    async ready() { await ready(); },
    async health() { await ready(); await pool.query("SELECT 1"); },
    async createChat(title = "New chat", options = {}) {
      await ready();
      const userId = options.userId || null;
      const isAnonymous = !userId && options.isAnonymous !== false;
      const expiresAt = isAnonymous ? daysFromNow(anonymousChatRetentionDays) : null;
      const result = await pool.query(
        "INSERT INTO chats (id, title, created_by_user_id, is_anonymous, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [id(), title.slice(0, 120), userId, isAnonymous, expiresAt]
      );
      return chatRow(result.rows[0]);
    },
    async listChats(options = {}) {
      await ready();
      const includeArchived = Boolean(options.includeArchived);
      const result = await pool.query("SELECT c.*, COUNT(m.id)::int AS message_count FROM chats c LEFT JOIN chat_messages m ON m.chat_id = c.id WHERE ($1::boolean OR c.archived_at IS NULL) GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100", [includeArchived]);
      return result.rows.map(chatRow);
    },
    async getChat(chatId) {
      await ready();
      const chat = await pool.query("SELECT * FROM chats WHERE id = $1", [chatId]);
      if (!chat.rows[0]) return null;
      const messages = await pool.query("SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC", [chatId]);
      return { ...chatRow(chat.rows[0]), messages: messages.rows.map(messageRow) };
    },
    async archiveChat(chatId, archived = true) {
      await ready();
      const result = await pool.query("UPDATE chats SET archived_at = CASE WHEN $2 THEN COALESCE(archived_at, NOW()) ELSE NULL END, updated_at = NOW() WHERE id = $1 RETURNING *", [chatId, Boolean(archived)]);
      return result.rows[0] ? chatRow(result.rows[0]) : null;
    },
    async saveMessage(chatId, role, content, context = {}) {
      await ready();
      upsertChatParticipant(chatId, context);
      const clean = redact(content).slice(0, 12000);
      const result = await pool.query(
        "INSERT INTO chat_messages (id, chat_id, role, content, context) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [id(), chatId, role, clean, cleanContext(context)]
      );
      await pool.query("UPDATE chats SET updated_at = NOW(), title = CASE WHEN title = 'New chat' AND $2 = 'user' THEN LEFT($3, 80) ELSE title END WHERE id = $1", [chatId, role, clean]);
      return messageRow(result.rows[0]);
    },
    async getApprovedKnowledge(limit = 8) {
      await ready();
      const result = await pool.query("SELECT * FROM knowledge_entries WHERE status = 'approved' ORDER BY approved_at DESC NULLS LAST, created_at DESC LIMIT $1", [limit]);
      return result.rows.map(knowledgeRow);
    },
    async listKnowledge(status = "approved") {
      await ready();
      const sql = status === "all" ? "SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT 200" : "SELECT * FROM knowledge_entries WHERE status = $1 ORDER BY created_at DESC LIMIT 100";
      const result = await pool.query(sql, status === "all" ? [] : [[ "pending_review", "approved", "archived" ].includes(status) ? status : "approved"]);
      return result.rows.map(knowledgeRow);
    },
    async updateKnowledge(entryId, updates = {}) {
      await ready();
      const title = typeof updates.title === "string" && updates.title.trim() ? updates.title.trim().slice(0, 160) : null;
      const content = typeof updates.content === "string" && updates.content.trim() ? redact(updates.content.trim()).slice(0, 12000) : null;
      const status = ["pending_review", "approved", "archived"].includes(updates.status) ? updates.status : null;
      const result = await pool.query(
        "UPDATE knowledge_entries SET title = COALESCE($2, title), content = COALESCE($3, content), status = COALESCE($4, status), approved_at = CASE WHEN $4 = 'approved' THEN COALESCE(approved_at, NOW()) WHEN $4 IN ('pending_review', 'archived') THEN NULL ELSE approved_at END WHERE id = $1 RETURNING *",
        [entryId, title, content, status]
      );
      return result.rows[0] ? knowledgeRow(result.rows[0]) : null;
    },
    async listReviewRuns() {
      await ready();
      const result = await pool.query("SELECT * FROM review_runs ORDER BY started_at DESC LIMIT 100");
      return result.rows.map(runRow);
    },
    async getAdminSummary() {
      await ready();
      const result = await pool.query(`SELECT
        (SELECT COUNT(*)::int FROM chats WHERE archived_at IS NULL) AS chats,
        (SELECT COUNT(*)::int FROM chat_messages) AS messages,
        (SELECT COUNT(*)::int FROM chat_messages WHERE reviewed = FALSE) AS unreviewed_messages,
        (SELECT COUNT(*)::int FROM knowledge_entries WHERE status = 'pending_review') AS pending_knowledge,
        (SELECT COUNT(*)::int FROM knowledge_entries WHERE status = 'approved') AS approved_knowledge,
        (SELECT COUNT(*)::int FROM review_runs) AS review_runs`);
      return summaryRow(result.rows[0]);
    },
    async runReview() {
      await ready();
      const runId = id();
      await pool.query("INSERT INTO review_runs (id, status) VALUES ($1, 'running')", [runId]);
      try {
        const rows = await pool.query("SELECT m.*, c.title FROM chat_messages m JOIN chats c ON c.id = m.chat_id WHERE m.reviewed = FALSE ORDER BY m.created_at ASC LIMIT 200");
        const groups = groupByChat(rows.rows);
        let created = 0;
        for (const group of groups) {
          const content = buildKnowledge(group);
          if (!content) continue;
          await pool.query("INSERT INTO knowledge_entries (id, title, content, status, source_chat_id, source_message_ids) VALUES ($1, $2, $3, 'pending_review', $4, $5)", [
            id(), `Reviewed chat: ${group.title}`, content, group.chatId, group.messages.map((message) => message.id)
          ]);
          created += 1;
        }
        const messageIds = rows.rows.map((row) => row.id);
        if (messageIds.length) await pool.query("UPDATE chat_messages SET reviewed = TRUE WHERE id = ANY($1::uuid[])", [messageIds]);
        const done = await pool.query("UPDATE review_runs SET status = 'completed', finished_at = NOW(), messages_reviewed = $2, knowledge_entries_created = $3 WHERE id = $1 RETURNING *", [runId, messageIds.length, created]);
        return runRow(done.rows[0]);
      } catch (error) {
        const failed = await pool.query("UPDATE review_runs SET status = 'failed', finished_at = NOW(), error = $2 WHERE id = $1 RETURNING *", [runId, redact(error.message).slice(0, 1000)]);
        return runRow(failed.rows[0]);
      }
    }
  };
}

function createMemoryStore() {
  const chats = new Map();
  const messages = [];
  const knowledge = [];
  const runs = [];
  const byStatus = (status) => (status === "all" ? knowledge : knowledge.filter((entry) => entry.status === status));
  return {
    mode: "memory",
    async ready() {
      const currentTime = Date.now();
      for (const [chatId, chat] of chats.entries()) {
        if (!chat.isAnonymous || !chat.expiresAt || new Date(chat.expiresAt).getTime() >= currentTime) continue;
        chats.delete(chatId);
        chatParticipants.delete(chatId);
        for (let index = messages.length - 1; index >= 0; index -= 1) {
          if (messages[index].chatId === chatId) messages.splice(index, 1);
        }
      }
    },
    async health() {},
    async createChat(title = "New chat", options = {}) {
      const userId = options.userId || null;
      const isAnonymous = !userId && options.isAnonymous !== false;
      const chat = {
        id: id(),
        title: title.slice(0, 120),
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
        createdByUserId: userId,
        isAnonymous,
        expiresAt: isAnonymous ? daysFromNow(anonymousChatRetentionDays) : null,
        messageCount: 0
      };
      chats.set(chat.id, chat);
      return chat;
    },
    async listChats(options = {}) {
      return [...chats.values()]
        .filter((chat) => options.includeArchived || !chat.archivedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async getChat(chatId) {
      const chat = chats.get(chatId);
      return chat ? { ...chat, messages: messages.filter((message) => message.chatId === chatId) } : null;
    },
    async archiveChat(chatId, archived = true) {
      const chat = chats.get(chatId);
      if (!chat) return null;
      chat.archivedAt = archived ? chat.archivedAt || now() : null;
      chat.updatedAt = now();
      return chat;
    },
    async saveMessage(chatId, role, content, context = {}) {
      const chat = chats.get(chatId);
      if (!chat) return null;
      upsertChatParticipant(chatId, context);
      const message = { id: id(), chatId, role, content: redact(content).slice(0, 12000), context: cleanContext(context), reviewed: false, createdAt: now() };
      messages.push(message);
      chat.updatedAt = now();
      chat.messageCount += 1;
      if (chat.title === "New chat" && role === "user") chat.title = message.content.slice(0, 80);
      return message;
    },
    async getApprovedKnowledge(limit = 8) { return byStatus("approved").slice(-limit).reverse(); },
    async listKnowledge(status = "approved") { return byStatus(status).slice(-100).reverse(); },
    async updateKnowledge(entryId, updates = {}) {
      const entry = knowledge.find((item) => item.id === entryId);
      if (!entry) return null;
      if (typeof updates.title === "string" && updates.title.trim()) entry.title = updates.title.trim().slice(0, 160);
      if (typeof updates.content === "string" && updates.content.trim()) entry.content = redact(updates.content.trim()).slice(0, 12000);
      if (["pending_review", "approved", "archived"].includes(updates.status)) {
        entry.status = updates.status;
        entry.approvedAt = updates.status === "approved" ? entry.approvedAt || now() : null;
      }
      return entry;
    },
    async listReviewRuns() { return runs.slice(-100).reverse(); },
    async getAdminSummary() {
      return {
        chats: [...chats.values()].filter((chat) => !chat.archivedAt).length,
        messages: messages.length,
        unreviewedMessages: messages.filter((message) => !message.reviewed).length,
        pendingKnowledge: byStatus("pending_review").length,
        approvedKnowledge: byStatus("approved").length,
        reviewRuns: runs.length
      };
    },
    async runReview() {
      const pending = messages.filter((message) => !message.reviewed);
      const run = { id: id(), status: "completed", startedAt: now(), finishedAt: now(), messagesReviewed: pending.length, knowledgeEntriesCreated: 0, error: null, context: { storageMode: "memory" } };
      for (const group of groupByChat(pending.map((message) => ({ ...message, title: chats.get(message.chatId)?.title || "New chat" })))) {
        const content = buildKnowledge(group);
        if (!content) continue;
        knowledge.push({ id: id(), title: `Reviewed chat: ${group.title}`, content, status: "pending_review", sourceChatId: group.chatId, sourceMessageIds: group.messages.map((message) => message.id), createdAt: now(), approvedAt: null });
        run.knowledgeEntriesCreated += 1;
      }
      pending.forEach((message) => { message.reviewed = true; });
      runs.push(run);
      return run;
    }
  };
}

function historyForAi(history) {
  return Array.isArray(history)
    ? history.filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string" && message.content.trim()).slice(-16).map((message) => ({ role: message.role, content: redact(message.content).slice(0, 6000) }))
    : [];
}

function userMessageForAi(message, attachments) {
  const files = attachmentSummary(attachments);
  return files ? `${message}\n\nAttached files:\n${files}`.slice(0, 12000) : message.slice(0, 12000);
}

async function aiContext(knowledge) {
  const approved = await db.getApprovedKnowledge(8).catch(() => []);
  const repo = knowledge.context || "Repository-maintained Switchboard context is unavailable. Do not claim unconfirmed agents, skills, tools, or workflows.";
  const kb = approved.length ? approved.map((entry) => `--- ${entry.title} ---\n${entry.content}`).join("\n\n") : "No approved durable knowledge entries are available yet.";
  return `Repository-maintained Switchboard context:\n\n${repo}\n\nApproved durable knowledge entries:\n\n${kb}`;
}

function tokenOk(req, res, envName, headerName) {
  if (!process.env[envName]) {
    res.status(403).json({ error: `${envName} is not configured.` });
    return false;
  }
  const supplied = req.get(headerName) || req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied === process.env[envName]) return true;
  res.status(401).json({ error: `${envName} is required.` });
  return false;
}

const reviewTokenOk = (req, res) => !process.env.REVIEW_RUN_TOKEN || tokenOk(req, res, "REVIEW_RUN_TOKEN", "x-review-token");
const adminTokenOk = (req, res) => tokenOk(req, res, "ADMIN_TOKEN", "x-admin-token");
const userManagementStore = attachUserManagementRoutes(app, {
  adminTokenOk,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL,
  schemaPath
});
app.locals.userManagementAttached = true;

async function sessionUserFromRequest(req) {
  const sessionToken = req.get("x-session-token");
  if (!sessionToken) return null;
  const session = await userManagementStore.getSessionUser(sessionToken).catch(() => null);
  return session?.user || null;
}

function scopeValue(user, field) {
  return typeof user?.[field] === "string" ? user[field].trim().toLowerCase() : "";
}

function sharedUserScopes(currentUser, candidate) {
  return ["company", "department", "group"].filter((field) => {
    const currentValue = scopeValue(currentUser, field);
    return currentValue && currentValue === scopeValue(candidate, field);
  });
}

function chatAvailableUser(user, sharedScopes) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl || "",
    company: user.company || "",
    department: user.department || "",
    group: user.group || "",
    sharedScopes
  };
}

function availableChatUsers(currentUser, users = []) {
  return users
    .filter((user) => user.id !== currentUser.id && user.status === "active")
    .map((user) => ({ user, sharedScopes: sharedUserScopes(currentUser, user) }))
    .filter((entry) => entry.sharedScopes.length > 0)
    .map((entry) => chatAvailableUser(entry.user, entry.sharedScopes))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function requireAdmin(req, res, next) {
  try {
    const sessionToken = req.get("x-session-token");
    const session = sessionToken ? await userManagementStore.getSessionUser(sessionToken) : null;
    if (["owner", "admin"].includes(session?.user?.role)) return next();
    if (adminTokenOk(req, res)) return next();
    return undefined;
  } catch (error) {
    return next(error);
  }
}

app.get("/health", async (req, res) => {
  try { await db.health(); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false, error: "Storage health check failed." }); }
});

app.get("/api/status", async (req, res) => {
  const knowledge = readKnowledgeFiles();
  let storageAvailable = true;
  try { await db.health(); } catch { storageAvailable = false; }
  res.json({ ok: true, directoryAvailable: knowledge.directoryAvailable, filesLoaded: knowledge.filesLoaded, aiAvailable: false, storageAvailable, storageMode: db.mode });
});

app.get("/api/users/available-chat-users", async (req, res) => {
  try {
    const sessionToken = req.get("x-session-token");
    const session = sessionToken ? await userManagementStore.getSessionUser(sessionToken) : null;
    if (!session) return res.status(401).json({ error: "Login required." });
    const users = await userManagementStore.listUsers();
    res.json({ users: availableChatUsers(session.user, users) });
  } catch (error) {
    res.status(500).json({ error: "Could not load available users." });
  }
});

app.post("/api/chats", async (req, res) => {
  try {
    const user = await sessionUserFromRequest(req);
    const chat = await db.createChat(redact(req.body?.title || "New chat"), { userId: user?.id || null, isAnonymous: !user });
    res.status(201).json({ chat });
  } catch { res.status(500).json({ error: "Could not create a new chat." }); }
});

app.get("/api/chats", async (req, res) => {
  try { res.json({ chats: await db.listChats({ includeArchived: req.query.includeArchived === "true" }) }); }
  catch { res.status(500).json({ error: "Could not load chats." }); }
});

app.get("/api/chats/:chatId", async (req, res) => {
  try {
    const chat = await db.getChat(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    chat.participants = chatParticipantList(chat.id);
    chat.typingParticipants = typingParticipantsForChat(chat.id, req.query.participantId || "");
    res.json({ chat });
  } catch { res.status(500).json({ error: "Could not load chat history." }); }
});

app.post("/api/chats/:chatId/participants", async (req, res) => {
  try {
    const chat = await db.getChat(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const participant = upsertChatParticipant(req.params.chatId, req.body?.context || req.body || {});
    if (!participant) return res.status(400).json({ error: "A participant id is required." });
    res.status(201).json({ participant, participants: chatParticipantList(req.params.chatId) });
  } catch { res.status(500).json({ error: "Could not update chat participant." }); }
});

app.get("/api/chats/:chatId/typing", async (req, res) => {
  try {
    const chat = await db.getChat(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    res.json({ typingParticipants: typingParticipantsForChat(req.params.chatId, req.query.participantId || "") });
  } catch { res.status(500).json({ error: "Could not load typing status." }); }
});

app.post("/api/chats/:chatId/typing", async (req, res) => {
  try {
    const chat = await db.getChat(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const participant = setChatTyping(req.params.chatId, req.body?.context || {}, req.body?.isTyping !== false);
    if (!participant) return res.status(400).json({ error: "A participant id is required." });
    res.json({ participant, typingParticipants: typingParticipantsForChat(req.params.chatId, participant.participantId) });
  } catch { res.status(500).json({ error: "Could not update typing status." }); }
});

app.post("/api/chats/:chatId/archive", async (req, res) => {
  try {
    const chat = await db.archiveChat(req.params.chatId, req.body?.archived !== false);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    if (chat.archivedAt) chatParticipants.delete(req.params.chatId);
    res.json({ chat });
  } catch { res.status(500).json({ error: "Could not update chat archive status." }); }
});

app.post("/api/chats/:chatId/messages", async (req, res) => {
  try {
    const { role, content, context } = req.body || {};
    if (!["user", "assistant", "system"].includes(role) || typeof content !== "string" || !content.trim()) return res.status(400).json({ error: "A valid role and content are required." });
    const chat = await db.getChat(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    if (chat.archivedAt) return res.status(409).json({ error: "Archived chats cannot receive new messages." });
    const message = await db.saveMessage(req.params.chatId, role, content.trim(), context);
    setChatTyping(req.params.chatId, context, false);
    res.status(201).json({ message, participants: chatParticipantList(req.params.chatId) });
  } catch { res.status(500).json({ error: "Could not save the message." }); }
});

app.get("/api/knowledge", async (req, res) => {
  try { res.json({ entries: await db.listKnowledge(req.query.status || "approved") }); }
  catch { res.status(500).json({ error: "Could not load knowledge entries." }); }
});

app.post("/api/reviews/run", async (req, res) => {
  if (!reviewTokenOk(req, res)) return;
  const run = await db.runReview();
  res.status(run.status === "failed" ? 500 : 201).json({ run });
});

app.get("/api/admin/summary", requireAdmin, async (req, res) => {
  res.json({ summary: await db.getAdminSummary(), status: { aiAvailable: false, storageMode: db.mode } });
});
app.get("/api/admin/chats", requireAdmin, async (req, res) => { res.json({ chats: await db.listChats({ includeArchived: true }) }); });
app.get("/api/admin/chats/:chatId", requireAdmin, async (req, res) => {
  const chat = await db.getChat(req.params.chatId);
  if (chat) {
    chat.participants = chatParticipantList(chat.id);
    chat.typingParticipants = typingParticipantsForChat(chat.id);
  }
  chat ? res.json({ chat }) : res.status(404).json({ error: "Chat not found." });
});
app.get("/api/admin/knowledge", requireAdmin, async (req, res) => { res.json({ entries: await db.listKnowledge(req.query.status || "all") }); });
app.patch("/api/admin/knowledge/:entryId", requireAdmin, async (req, res) => {
  const entry = await db.updateKnowledge(req.params.entryId, req.body || {});
  entry ? res.json({ entry }) : res.status(404).json({ error: "Knowledge entry not found." });
});
app.get("/api/admin/review-runs", requireAdmin, async (req, res) => { res.json({ runs: await db.listReviewRuns() }); });
app.post("/api/admin/reviews/run", requireAdmin, async (req, res) => { res.status(201).json({ run: await db.runReview() }); });

app.post("/api/chat", async (req, res) => {
  let chatId = req.body?.chatId;
  let savedUser = null;
  const knowledge = readKnowledgeFiles();
  try {
    const user = await sessionUserFromRequest(req);
    const attachments = cleanAttachments(req.body?.attachments);
    const rawMessage = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!rawMessage && !attachments.length) return res.status(400).json({ error: "Message or file attachment is required." });
    const fallbackMessage = attachments.length ? `Uploaded ${attachments.length} file${attachments.length === 1 ? "" : "s"}: ${attachments.map((attachment) => attachment.name).join(", ")}` : "";
    const clean = redact(rawMessage || fallbackMessage);
    if (!chatId) chatId = (await db.createChat(clean.slice(0, 80) || "New chat", { userId: user?.id || null, isAnonymous: !user })).id;
    else {
      const existingChat = await db.getChat(chatId);
      if (!existingChat) return res.status(404).json({ error: "Chat not found. Start a new chat and try again." });
      if (existingChat.archivedAt) return res.status(409).json({ error: "Archived chats cannot receive new messages. Start a new chat and try again." });
    }
    savedUser = await db.saveMessage(chatId, "user", clean, { source: "api/chat", attachments, ...cleanParticipantContext(req.body?.context || {}) });
    return res.json({ chatId, reply: null, pendingReview: false, messageSaved: true, messages: [savedUser], participants: chatParticipantList(chatId), ...knowledge, aiAvailable: false, storageMode: db.mode });
  } catch (error) {
    console.error("Chat request failed:", error.message);
    res.status(savedUser ? 200 : 503).json({
      chatId,
      reply: null,
      pendingReview: false,
      messageSaved: Boolean(savedUser),
      messages: savedUser ? [savedUser] : [],
      participants: chatId ? chatParticipantList(chatId) : [],
      ...knowledge,
      aiAvailable: false,
      storageMode: db.mode
    });
  }
});

function startScheduledReviewRunner() {
  if (!Number.isFinite(scheduledReviewIntervalMs) || scheduledReviewIntervalMs <= 0) return;
  if (scheduledReviewIntervalMs < minReviewIntervalMs) {
    console.warn(`Scheduled review disabled. REVIEW_RUN_INTERVAL_MS must be at least ${minReviewIntervalMs}.`);
    return;
  }
  setInterval(() => db.runReview().then((run) => {
    console.log(`Scheduled review ${run.status}: ${run.messagesReviewed} messages reviewed, ${run.knowledgeEntriesCreated} entries created.`);
  }).catch((error) => console.error("Scheduled review failed:", error.message)), scheduledReviewIntervalMs);
}

db.ready().then(() => {
  app.listen(port, () => {
    console.log(`Switchboard Agent app listening on port ${port}`);
    startScheduledReviewRunner();
  });
}).catch((error) => {
  console.error("Storage initialization failed:", error.message);
  process.exit(1);
});
