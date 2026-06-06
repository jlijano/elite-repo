const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { test } = require("node:test");

const bubbleColorScript = fs.readFileSync(path.resolve(__dirname, "../public/bubble-color.js"), "utf8");

test("chat identity is collected before creating a chat", () => {
  const createChatWrapper = bubbleColorScript.match(/createChat = async function identityCreateChat[\s\S]+?\n  };\n/);
  assert.ok(createChatWrapper, "identity createChat wrapper should be installed");

  const wrapper = createChatWrapper[0];
  assert.ok(
    wrapper.indexOf("resetIdentityForNewChat();") < wrapper.indexOf("await ensureIdentity();"),
    "starting a new chat should clear the previous nickname before prompting"
  );
  assert.ok(
    wrapper.indexOf("await ensureIdentity();") < wrapper.indexOf("await originalCreateChat.apply"),
    "nickname and bubble color should be required before the backend chat is created"
  );
});

test("starting a new chat clears stale stored identity", () => {
  const resetIdentity = bubbleColorScript.match(/function resetIdentityForNewChat\(\) \{[\s\S]+?\n  }/);
  assert.ok(resetIdentity, "new chat identity reset helper should exist");
  assert.match(resetIdentity[0], /selectedNickname = ""/);
  assert.match(resetIdentity[0], /selectedColor = ""/);
  assert.match(resetIdentity[0], /removeStored\(nicknameKey\)/);
  assert.match(resetIdentity[0], /removeStored\(colorKey\)/);
});

test("empty-chat sends delegate identity prompting to createChat", () => {
  const sendWrapper = bubbleColorScript.match(/sendMessage = async function identitySendMessage[\s\S]+?\n    };\n/);
  assert.ok(sendWrapper, "identity sendMessage wrapper should be installed");
  assert.match(sendWrapper[0], /if \(currentChatId\) await ensureIdentity\(\);/);
});

test("chat quick reply suggestions are opt-in", () => {
  const quickReplies = bubbleColorScript.match(/function installQuickReplies\(\) \{[\s\S]+?\n  }\n\n  if \(typeof requestJson/);
  assert.ok(quickReplies, "quick reply installer should exist");
  assert.match(quickReplies[0], /switchboard-enable-chat-suggestions/);
  assert.match(quickReplies[0], /document\.getElementById\(quickReplyId\)\?\.remove\(\)/);
});

test("identity prompt cannot be dismissed into a stuck chat start", () => {
  assert.match(bubbleColorScript, /event\.key !== "Escape"/);
  assert.match(bubbleColorScript, /modal\.querySelector\("#bubbleNicknameInput"\)\?\.focus\(\)/);
  assert.doesNotMatch(bubbleColorScript, /modal\.hidden = true;\n  }\);\n\}\)\(\);$/);
});
