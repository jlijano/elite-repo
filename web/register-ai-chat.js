const fs = require("fs");
const path = require("path");
const express = require("express");
const OpenAI = require("openai");

const originalExpress = express;
const repoRoot = path.resolve(__dirname, "..");
const knowledgeFiles = ["agent-directory.md", "routing-rules.md", "memory-rules.md", "handoff-template.md", "change-log.md"];
const aiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
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

function redact(value) {
  return String(value || "")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]");
}

function readKnowledgeContext() {
  const sections = [];
  for (const file of knowledgeFiles) {
    try {
      const content = fs.readFileSync(path.join(repoRoot, file), "utf8").trim();
      if (content) sections.push(`--- BEGIN ${file} ---\n${content}\n--- END ${file} ---`);
    } catch (error) {
      // Missing repository docs are already reported by the main status route.
    }
  }
  return sections.join("\n\n") || "Repository-maintained Switchboard context is unavailable. Do not claim unconfirmed agents, skills, tools, or workflows.";
}

function cleanHistory(history) {
  return Array.isArray(history)
    ? history.filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string" && message.content.trim())
      .slice(-12)
      .map((message) => ({ role: message.role, content: redact(message.content).slice(0, 5000) }))
    : [];
}

function cleanAttachments(attachments) {
  return Array.isArray(attachments)
    ? attachments.slice(0, 4).map((attachment, index) => {
      const name = redact(attachment?.name || `Attachment ${index + 1}`).slice(0, 160);
      const content = redact(attachment?.content || "").slice(0, 12000);
      return content ? `Attachment ${index + 1}: ${name}\n${content}` : "";
    }).filter(Boolean).join("\n\n")
    : "";
}

async function generateReply(req) {
  if (!openai) return "";
  const message = redact(req.body?.message || "").trim();
  const attachments = cleanAttachments(req.body?.attachments);
  const fallback = attachments ? `Uploaded files:\n${attachments}` : "";
  const userContent = [message || "Please review the uploaded attachment.", attachments && `Attached files:\n${attachments}`].filter(Boolean).join("\n\n").slice(0, 14000);
  const context = readKnowledgeContext();
  const completion = await openai.chat.completions.create({
    model: aiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Repository-maintained Switchboard context:\n\n${context}`.slice(0, 24000) },
      ...cleanHistory(req.body?.history),
      { role: "user", content: userContent || fallback || "Start a new chat." }
    ],
    temperature: 0.2
  });
  return redact(completion.choices?.[0]?.message?.content || "").trim().slice(0, 12000);
}

async function saveAssistantMessage(chatId, reply) {
  if (!chatId || !reply) return null;
  const port = process.env.PORT || 3000;
  const response = await fetch(`http://127.0.0.1:${port}/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "assistant", content: reply, context: { source: "api/chat", generatedBy: "openai", model: aiModel } })
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? data.message : null;
}

function injectClientFix(html) {
  if (typeof html !== "string" || html.includes("chat-ai-reply-fix.js")) return html;
  const script = '<script src="/chat-ai-reply-fix.js?v=20260607-ai-chat"></script>';
  return html.replace("</body>", `${script}\n  </body>`);
}

function installMiddleware(app) {
  if (app.__aiChatReplyInstalled) return;
  app.__aiChatReplyInstalled = true;

  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.send = (body) => {
      if (req.method === "GET" && (req.path === "/" || req.path === "/index.html") && typeof body === "string") {
        return originalSend(injectClientFix(body));
      }
      return originalSend(body);
    };

    res.json = async (body) => {
      if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "aiAvailable")) {
        body.aiAvailable = Boolean(openai);
      }

      if (req.method === "POST" && req.path === "/api/chat" && body?.messageSaved && body?.chatId && openai && !body.reply) {
        try {
          const reply = await generateReply(req);
          if (reply) {
            const assistantMessage = await saveAssistantMessage(body.chatId, reply);
            body.reply = reply;
            body.aiAvailable = true;
            body.pendingReview = false;
            body.messages = [...(Array.isArray(body.messages) ? body.messages : []), ...(assistantMessage ? [assistantMessage] : [])];
          }
        } catch (error) {
          console.error("AI chat reply failed:", error.message);
          body.aiAvailable = false;
          body.aiError = "The AI responder could not generate a reply, but your message was saved.";
        }
      }

      return originalJson(body);
    };

    next();
  });
}

function patchedExpress(...args) {
  const app = originalExpress(...args);
  installMiddleware(app);
  return app;
}

Object.setPrototypeOf(patchedExpress, originalExpress);
Object.assign(patchedExpress, originalExpress);
require.cache[require.resolve("express")].exports = patchedExpress;
