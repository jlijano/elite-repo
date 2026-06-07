(() => {
  if (window.__switchboardAiReplyFixInstalled) return;
  window.__switchboardAiReplyFixInstalled = true;

  function contextFromPage() {
    try {
      return typeof participantContext === "function" ? participantContext() : {};
    } catch (error) {
      return {};
    }
  }

  function headersWithAuth() {
    try {
      return { "Content-Type": "application/json", ...authHeaders() };
    } catch (error) {
      return { "Content-Type": "application/json" };
    }
  }

  function setUiStatus(data) {
    try {
      if (typeof setStatus === "function") setStatus(data);
    } catch (error) {}
  }

  function reloadChat(chatId) {
    if (!chatId) return Promise.resolve();
    if (typeof loadSharedChat === "function") return loadSharedChat(chatId, { force: true }).catch(() => {});
    if (typeof loadChat === "function") return loadChat(chatId).catch(() => {});
    return Promise.resolve();
  }

  function updateTitleFromList() {
    if (typeof loadChats !== "function") return Promise.resolve();
    return loadChats().then((chats) => {
      const active = Array.isArray(chats) ? chats.find((chat) => chat.id === currentChatId) : null;
      if (active && currentChatTitle) currentChatTitle.textContent = active.title || newChatTitle;
    }).catch(() => {});
  }

  function addAssistantReply(data) {
    if (!data?.reply || typeof addMessage !== "function") return;
    const assistantWasSaved = Array.isArray(data.messages) && data.messages.some((message) => message.role === "assistant" && message.content === data.reply);
    if (!assistantWasSaved) addMessage("assistant", data.reply, { createdAt: new Date().toISOString() });
  }

  sendMessage = async function aiReplySendMessage() {
    const message = inputEl.value.trim();
    const attachments = selectedAttachments.slice();
    if ((!message && !attachments.length) || isSending) return;
    if (!currentChatId && typeof createChat === "function") await createChat();

    const context = contextFromPage();
    const displayMessage = message || `Uploaded ${attachments.length} file${attachments.length === 1 ? "" : "s"}: ${attachmentNames(attachments)}`;
    addMessage("user", displayMessage, {
      createdAt: new Date().toISOString(),
      attachments,
      context,
      participantType: context.participantType,
      participantLabel: context.participantLabel,
      bubbleColor: context.bubbleColor
    });
    inputEl.value = "";
    selectedAttachments = [];
    renderSelectedAttachments();
    resizeInput();
    setSending(true);

    try {
      if (typeof sendTypingState === "function") await sendTypingState(false);
      const data = await requestJson("/api/chat", {
        method: "POST",
        headers: headersWithAuth(),
        body: JSON.stringify({
          chatId: currentChatId,
          message,
          attachments,
          history: chatHistory.slice(0, -1),
          context
        })
      });
      if (data.chatId && data.chatId !== currentChatId) saveCurrentChat(data.chatId);
      setUiStatus(data);
      await reloadChat(currentChatId || data.chatId);
      addAssistantReply(data);
      await updateTitleFromList();
    } catch (error) {
      addMessage("assistant", error.message || "Something went wrong while contacting the Switchboard Agent.", { error: true, skipHistory: true });
    } finally {
      setSending(false);
      inputEl.focus();
    }
  };
})();
