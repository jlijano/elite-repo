const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const { Pool } = require("pg");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(__dirname, "public");
const schemaPath = path.join(__dirname, "db", "schema.sql");
const knowledgeFiles = [
  "agent-directory.md",
  "routing-rules.md",
  "memory-rules.md",
  "handoff-template.md",
  "change-log.md"
];
const pendingReviewReply =
  "I saved your message for Switchboard review. The AI responder is unavailable right now, so this chat is in storage-only mode and can be reviewed later.";

const systemPrompt = `You are the Switchboard Agent for a general-purpose AI workspace.

You classify, route, clarify, recommend missing agents or skills, and flag risk.
You use the GitHub-maintained Agent Directory and routing files as the source of truth.
You must not claim unconfirmed capabilities.
You must route only to Active agents or skills.
Treat Planned, Missing, Recommended, Draft, and Retired items as unavailable.
You must ask one concise clarification question for ambiguous requests.
You must recommend new agents or skills when no Active match exists.
You must flag legal, medical, financial, HR, security, privacy, compliance, destructive action, and other high-risk requests.
Mention Agent Directory unavailability only when routing depends on the directory.
Use the standard Switchboard output format when the user asks for routing, classification, triage, agent selection, or where a request should go.

Standard Switchboard output format:
Request summary:
Intent:
Category:
Best match:
Confidence:
Reason:
Next step:
Missing skill or agent needed:
Risk level:

Before responding, quietly verify:
- Did I classify the request correctly?
- Did I route only to an Active agent or skill?
- Did I avoid inventing unavailable capabilities?
- Did I ask for clarification when the request was ambiguous?
- Did I recommend a missing agent or skill when needed?
- Did I flag high-risk requests?
- Did I avoid mentioning directory access problems when the issue is only missing user context?
- Did I use the standard format when routing was requested?`;

const db = createStore();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function redactSensitiveContent(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]");
}

function cleanContext(context = {}) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return {};
  }

  const safe = {};
  for (const [key, value] of Object.entries(context).slice(0, 20)) {
    if (/secret|token|password|cookie|key/i.test(key)) {
      safe[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      safe[key] = redactSensitiveContent(value).slice(0, 2000);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    }
  }
  return safe;
}

function createStore() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
    let initialized;

    async function init() {
      if (!initialized) {
        initialized = fs.promises.readFile(schemaPath, "utf8").then((schema) => pool.query(schema));
      }
      return initialized;
    }

    return {
      mode: "postgres",
      async ready() {
        await init();
      },
      async health() {
        await init();
        await pool.query("SELECT 1");
        return true;
      },
      async createChat(title = "New chat") {
        await init();
        const id = makeId();
        const result = await pool.query(
          "INSERT INTO chats (id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at",
          [id, title.slice(0, 120)]
        );
        return rowChat(result.rows[0]);
      },
      async listChats() {
        await init();
        const result = await pool.query(
          "SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id)::int AS message_count FROM chats c LEFT JOIN chat_messages m ON m.chat_id = c.id GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100"
        );
        return result.rows.map(rowChat);
      },
      async getChat(chatId) {
        await init();
        const chatResult = await pool.query(
          "SELECT id, title, created_at, updated_at FROM chats WHERE id = $1",
          [chatId]
        );
        if (!chatResult.rows[0]) {
          return null;
        }
        const messageResult = await pool.query(
          "SELECT id, chat_id, role, content, context, reviewed, created_at FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC",
          [chatId]
        );
        return { ...rowChat(chatResult.rows[0]), messages: messageResult.rows.map(rowMessage) };
      },
      async saveMessage(chatId, role, content, context = {}) {
        await init();
        const id = makeId();
        const cleanContent = redactSensitiveContent(content).slice(0, 12000);
        const result = await pool.query(
          "INSERT INTO chat_messages (id, chat_id, role, content, context) VALUES ($1, $2, $3, $4, $5) RETURNING id, chat_id, role, content, context, reviewed, created_at",
          [id, chatId, role, cleanContent, cleanContext(context)]
        );
        await pool.query(
          "UPDATE chats SET updated_at = NOW(), title = CASE WHEN title = 'New chat' AND $2 = 'user' THEN LEFT($3, 80) ELSE title END WHERE id = $1",
          [chatId, role, cleanContent]
        );
        return rowMessage(result.rows[0]);
      },
      async getApprovedKnowledge(limit = 8) {
        await init();
        const result = await pool.query(
          "SELECT id, title, content, status, source_chat_id, source_message_ids, created_at, approved_at FROM knowledge_entries WHERE status = 'approved' ORDER BY approved_at DESC NULLS LAST, created_at DESC LIMIT $1",
          [limit]
        );
        return result.rows.map(rowKnowledge);
      },
      async listKnowledge(status = "approved") {
        await init();
        const allowedStatus = ["pending_review", "approved", "archived"].includes(status) ? status : "approved";
        const result = await pool.query(
          "SELECT id, title, content, status, source_chat_id, source_message_ids, created_at, approved_at FROM knowledge_entries WHERE status = $1 ORDER BY created_at DESC LIMIT 100",
          [allowedStatus]
        );
        return result.rows.map(rowKnowledge);
      },
      async runReview() {
        await init();
        const runId = makeId();
        await pool.query("INSERT INTO review_runs (id, status) VALUES ($1, 'running')", [runId]);
        try {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const result = await client.query(
              "SELECT m.id, m.chat_id, m.role, m.content, m.created_at, c.title FROM chat_messages m JOIN chats c ON c.id = m.chat_id WHERE m.reviewed = FALSE ORDER BY m.created_at ASC LIMIT 200"
            );
            const groups = groupMessagesByChat(result.rows.map(rowMessageWithTitle));
            let entriesCreated = 0;
            for (const group of groups) {
              const sourceIds = group.messages.map((message) => message.id);
              const content = buildKnowledgeContent(group);
              if (!content) {
                continue;
              }
              await client.query(
                "INSERT INTO knowledge_entries (id, title, content, status, source_chat_id, source_message_ids, approved_at) VALUES ($1, $2, $3, 'approved', $4, $5, NOW())",
                [makeId(), `Reviewed chat: ${group.title}`, content, group.chatId, sourceIds]
              );
              entriesCreated += 1;
            }
            const messageIds = result.rows.map((row) => row.id);
            if (messageIds.length > 0) {
              await client.query("UPDATE chat_messages SET reviewed = TRUE WHERE id = ANY($1::uuid[])", [messageIds]);
            }
            await client.query("COMMIT");
            const completed = await pool.query(
              "UPDATE review_runs SET status = 'completed', finished_at = NOW(), messages_reviewed = $2, knowledge_entries_created = $3 WHERE id = $1 RETURNING *",
              [runId, messageIds.length, entriesCreated]
            );
            return rowReviewRun(completed.rows[0]);
          } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
          } finally {
            client.release();
          }
        } catch (error) {
          const failed = await pool.query(
            "UPDATE review_runs SET status = 'failed', finished_at = NOW(), error = $2 WHERE id = $1 RETURNING *",
            [runId, redactSensitiveContent(error.message || "Review failed.").slice(0, 1000)]
          );
          return rowReviewRun(failed.rows[0]);
        }
      }
    };
  }

  const chats = new Map();
  const messages = [];
  const knowledge = [];

  return {
    mode: "memory",
    async ready() {},
    async health() {
      return true;
    },
    async createChat(title = "New chat") {
      const chat = { id: makeId(), title: title.slice(0, 120), createdAt: nowIso(), updatedAt: nowIso(), messageCount: 0 };
      chats.set(chat.id, chat);
      return chat;
    },
    async listChats() {
      return [...chats.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async getChat(chatId) {
      const chat = chats.get(chatId);
      if (!chat) {
        return null;
      }
      return { ...chat, messages: messages.filter((message) => message.chatId === chatId) };
    },
    async saveMessage(chatId, role, content, context = {}) {
      const chat = chats.get(chatId);
      if (!chat) {
        return null;
      }
      const cleanContent = redactSensitiveContent(content).slice(0, 12000);
      const message = {
        id: makeId(),
        chatId,
        role,
        content: cleanContent,
        context: cleanContext(context),
        reviewed: false,
        createdAt: nowIso()
      };
      messages.push(message);
      chat.updatedAt = nowIso();
      chat.messageCount += 1;
      if (chat.title === "New chat" && role === "user") {
        chat.title = cleanContent.slice(0, 80);
      }
      return message;
    },
    async getApprovedKnowledge(limit = 8) {
      return knowledge.filter((entry) => entry.status === "approved").slice(-limit).reverse();
    },
    async listKnowledge(status = "approved") {
      return knowledge.filter((entry) => entry.status === status).slice(-100).reverse();
    },
    async runReview() {
      const run = {
        id: makeId(),
        status: "completed",
        startedAt: nowIso(),
        finishedAt: nowIso(),
        messagesReviewed: 0,
        knowledgeEntriesCreated: 0,
        error: null,
        context: { storageMode: "memory" }
      };
      const pending = messages.filter((message) => !message.reviewed);
      const groups = groupMessagesByChat(
        pending.map((message) => ({ ...message, title: chats.get(message.chatId)?.title || "New chat" }))
      );
      for (const group of groups) {
        const content = buildKnowledgeContent(group);
        if (!content) {
          continue;
        }
        knowledge.push({
          id: makeId(),
          title: `Reviewed chat: ${group.title}`,
          content,
          status: "approved",
          sourceChatId: group.chatId,
          sourceMessageIds: group.messages.map((message) => message.id),
          createdAt: nowIso(),
          approvedAt: nowIso()
        });
        run.knowledgeEntriesCreated += 1;
      }
      for (const message of pending) {
        message.reviewed = true;
      }
      run.messagesReviewed = pending.length;
      return run;
    }
  };
}

function rowChat(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at || row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at || row.updatedAt).toISOString(),
    messageCount: Number(row.message_count || row.messageCount || 0)
  };
}

function rowMessage(row) {
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

function rowMessageWithTitle(row) {
  return { ...rowMessage(row), title: row.title };
}

function rowKnowledge(row) {
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

function rowReviewRun(row) {
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

function groupMessagesByChat(rows) {
  const groups = new Map();
  for (const message of rows) {
    if (!groups.has(message.chatId)) {
      groups.set(message.chatId, { chatId: message.chatId, title: message.title || "New chat", messages: [] });
    }
    groups.get(message.chatId).messages.push(message);
  }
  return [...groups.values()];
}

function buildKnowledgeContent(group) {
  const userMessages = group.messages.filter((message) => message.role === "user");
  if (userMessages.length === 0) {
    return "";
  }
  const bullets = userMessages.slice(-8).map((message) => `- ${message.content.slice(0, 600)}`);
  return `Approved Switchboard knowledge from chat "${group.title}".\n\nUseful user-provided context:\n${bullets.join("\n")}`;
}

function readKnowledgeFiles() {
  const loaded = [];
  const missing = [];
  const sections = [];

  for (const fileName of knowledgeFiles) {
    const filePath = path.join(repoRoot, fileName);
    try {
      const content = fs.readFileSync(filePath, "utf8").trim();
      if (content) {
        loaded.push(fileName);
        sections.push(`--- BEGIN ${fileName} ---\n${content}\n--- END ${fileName} ---`);
      } else {
        missing.push(fileName);
      }
    } catch (error) {
      missing.push(fileName);
    }
  }

  return {
    context: sections.join("\n\n"),
    filesLoaded: loaded,
    filesMissing: missing,
    directoryAvailable: loaded.includes("agent-directory.md")
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message) => {
      return (
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      );
    })
    .slice(-16)
    .map((message) => ({
      role: message.role,
      content: redactSensitiveContent(message.content).slice(0, 6000)
    }));
}

async function buildAiContext(knowledge) {
  const approvedEntries = await db.getApprovedKnowledge(8).catch(() => []);
  const repositoryContext = knowledge.context
    ? `Repository-maintained Switchboard context:\n\n${knowledge.context}`
    : "Repository-maintained Switchboard context is unavailable. Do not claim unconfirmed agents, skills, tools, or workflows.";
  const approvedContext = approvedEntries.length
    ? `Approved durable knowledge entries:\n\n${approvedEntries
        .map((entry) => `--- ${entry.title} ---\n${entry.content}`)
        .join("\n\n")}`
    : "No approved durable knowledge entries are available yet.";

  return `${repositoryContext}\n\n${approvedContext}`;
}

function validateReviewToken(req, res) {
  if (!process.env.REVIEW_RUN_TOKEN) {
    return true;
  }

  const supplied = req.get("x-review-token") || req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied === process.env.REVIEW_RUN_TOKEN) {
    return true;
  }

  res.status(401).json({ error: "Review run token is required." });
  return false;
}

app.get("/health", async (req, res) => {
  try {
    await db.health();
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({ ok: false, error: "Storage health check failed." });
  }
});

app.get("/api/status", async (req, res) => {
  const knowledge = readKnowledgeFiles();
  let storageAvailable = true;
  try {
    await db.health();
  } catch (error) {
    storageAvailable = false;
  }

  res.json({
    ok: true,
    directoryAvailable: knowledge.directoryAvailable,
    filesLoaded: knowledge.filesLoaded,
    aiAvailable: Boolean(process.env.OPENAI_API_KEY),
    storageAvailable,
    storageMode: db.mode
  });
});

app.post("/api/chats", async (req, res) => {
  try {
    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : "New chat";
    const chat = await db.createChat(redactSensitiveContent(title));
    res.status(201).json({ chat });
  } catch (error) {
    res.status(500).json({ error: "Could not create a new chat." });
  }
});

app.get("/api/chats", async (req, res) => {
  try {
    const chats = await db.listChats();
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ error: "Could not load chats." });
  }
});

app.get("/api/chats/:chatId", async (req, res) => {
  try {
    const chat = await db.getChat(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }
    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: "Could not load chat history." });
  }
});

app.post("/api/chats/:chatId/messages", async (req, res) => {
  try {
    const { role, content, context } = req.body || {};
    if (!["user", "assistant", "system"].includes(role) || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "A valid role and content are required." });
    }
    const saved = await db.saveMessage(req.params.chatId, role, content.trim(), context);
    if (!saved) {
      return res.status(404).json({ error: "Chat not found." });
    }
    res.status(201).json({ message: saved });
  } catch (error) {
    res.status(500).json({ error: "Could not save the message." });
  }
});

app.get("/api/knowledge", async (req, res) => {
  try {
    const entries = await db.listKnowledge(req.query.status || "approved");
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: "Could not load knowledge entries." });
  }
});

app.post("/api/reviews/run", async (req, res) => {
  if (!validateReviewToken(req, res)) {
    return;
  }

  try {
    const run = await db.runReview();
    res.status(run.status === "failed" ? 500 : 201).json({ run });
  } catch (error) {
    res.status(500).json({ error: "Review run could not be recorded." });
  }
});

app.post("/api/chat", async (req, res) => {
  let chatId = req.body?.chatId;
  let userMessageSaved = false;
  let knowledge = null;
  try {
    const { message, history } = req.body || {};

    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required." });
    }

    const cleanMessage = redactSensitiveContent(message.trim());
    if (!chatId) {
      const chat = await db.createChat(cleanMessage.slice(0, 80) || "New chat");
      chatId = chat.id;
    } else if (!(await db.getChat(chatId))) {
      return res.status(404).json({ error: "Chat not found. Start a new chat and try again." });
    }

    const userMessage = await db.saveMessage(chatId, "user", cleanMessage, { source: "api/chat" });
    userMessageSaved = Boolean(userMessage);
    knowledge = readKnowledgeFiles();

    if (!process.env.OPENAI_API_KEY) {
      const assistantMessage = await db.saveMessage(chatId, "assistant", pendingReviewReply, {
        aiAvailable: false,
        pendingReview: true
      });
      return res.json({
        chatId,
        reply: pendingReviewReply,
        pendingReview: true,
        messages: [userMessage, assistantMessage],
        directoryAvailable: knowledge.directoryAvailable,
        filesLoaded: knowledge.filesLoaded,
        aiAvailable: false,
        storageMode: db.mode
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const contextMessage = await buildAiContext(knowledge);
    const chat = await db.getChat(chatId);
    const storedHistory = chat ? chat.messages.filter((item) => item.id !== userMessage.id) : [];

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextMessage },
        ...normalizeHistory(storedHistory.length ? storedHistory : history),
        { role: "user", content: cleanMessage.slice(0, 12000) }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("The assistant returned an empty response.");
    }

    const assistantMessage = await db.saveMessage(chatId, "assistant", reply, {
      aiAvailable: true,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
    });

    res.json({
      chatId,
      reply,
      pendingReview: false,
      messages: [userMessage, assistantMessage],
      directoryAvailable: knowledge.directoryAvailable,
      filesLoaded: knowledge.filesLoaded,
      aiAvailable: true,
      storageMode: db.mode
    });
  } catch (error) {
    const safeMessage = userMessageSaved
      ? "The Switchboard Agent could not generate an AI response right now. Your message was saved for review."
      : "The Switchboard Agent could not save your message right now. Please try again.";
    let assistantFallbackSaved = false;
    try {
      if (chatId && userMessageSaved) {
        await db.saveMessage(chatId, "assistant", safeMessage, { aiError: true, pendingReview: true });
        assistantFallbackSaved = true;
      }
    } catch (saveError) {
      console.error("Failed to save AI error fallback:", saveError.message);
    }
    console.error("Chat request failed:", error.message);
    res.status(userMessageSaved ? 200 : 503).json({
      chatId,
      reply: safeMessage,
      pendingReview: userMessageSaved,
      messageSaved: userMessageSaved,
      assistantFallbackSaved,
      directoryAvailable: knowledge?.directoryAvailable,
      filesLoaded: knowledge?.filesLoaded,
      aiAvailable: Boolean(process.env.OPENAI_API_KEY),
      storageMode: db.mode
    });
  }
});

db.ready()
  .then(() => {
    app.listen(port, () => {
      console.log(`Switchboard Agent app listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Storage initialization failed:", error.message);
    process.exit(1);
  });
