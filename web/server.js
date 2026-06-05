const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(__dirname, "public");
const knowledgeFiles = [
  "agent-directory.md",
  "routing-rules.md",
  "memory-rules.md",
  "handoff-template.md",
  "change-log.md"
];

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

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

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
      content: message.content.slice(0, 6000)
    }));
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  const knowledge = readKnowledgeFiles();

  res.json({
    ok: true,
    directoryAvailable: knowledge.directoryAvailable,
    filesLoaded: knowledge.filesLoaded
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "The server is missing OPENAI_API_KEY. Add it in Render environment variables."
      });
    }

    const knowledge = readKnowledgeFiles();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const contextMessage = knowledge.context
      ? `Repository-maintained Switchboard context:\n\n${knowledge.context}`
      : "Repository-maintained Switchboard context is unavailable. Do not claim unconfirmed agents, skills, tools, or workflows.";

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextMessage },
        ...normalizeHistory(history),
        { role: "user", content: message.trim().slice(0, 12000) }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: "The assistant returned an empty response." });
    }

    res.json({
      reply,
      directoryAvailable: knowledge.directoryAvailable,
      filesLoaded: knowledge.filesLoaded
    });
  } catch (error) {
    console.error("Chat request failed:", error);

    res.status(500).json({
      error: "The Switchboard Agent could not respond right now. Please try again."
    });
  }
});

app.listen(port, () => {
  console.log(`Switchboard Agent app listening on port ${port}`);
});
