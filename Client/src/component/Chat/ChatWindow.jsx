import { useState, useRef, useEffect } from "react";
import { Menu, Sparkles, Crown } from "lucide-react";
import axios from "axios";

import "./ChatWindow.css";
import Message from "./Message";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";

function ChatWindow({ chats, setChats, activeChat, setSidebarOpen }) {
  const [isTyping, setIsTyping] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);

  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?.id;

  const currentChat = chats.find((chat) => chat.id === activeChat);
  const messages = currentChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, paymentRequired]);

  const saveMessagesToDB = async (newMessages) => {
    if (userId && currentChat) {
      try {
        await axios.post("http://localhost:5000/chats/save", {
          userId,
          chatId: String(activeChat),
          title: currentChat.title,
          messages: newMessages,
        });
      } catch (err) {
        console.log("Save chat error:", err);
      }
    }
  };

  const updateChatMessages = async (newMessages) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat ? { ...chat, messages: newMessages } : chat
      )
    );

    await saveMessagesToDB(newMessages);
  };

  const updateStreamingMessage = (aiMessageId, newText) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat
          ? {
              ...chat,
              messages: chat.messages.map((msg) =>
                msg.id === aiMessageId ? { ...msg, text: newText } : msg
              ),
            }
          : chat
      )
    );
  };

  const stopGenerating = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setIsTyping(false);
  };

  const streamAIResponse = async ({
    userMessageText,
    baseMessages,
    aiMessageId,
    title,
  }) => {
    const controller = new AbortController();
    abortRef.current = controller;

    let fullReply = "";

    const response = await fetch("http://localhost:5000/chat-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        message: userMessageText,
        userId,
        chatId: String(activeChat),
        title: title || currentChat?.title || "New Chat",
        messages: baseMessages,
      }),
    });

    if (!response.ok) {
      const data = await response.json();

      if (response.status === 402 || data?.paymentRequired) {
        setPaymentRequired(true);
        throw new Error(
          "Your 10 free messages are completed. Please buy Premium ₹100 for 1 month unlimited chat."
        );
      }

      throw new Error(data?.error || "Server Error");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        if (!part.startsWith("data:")) continue;

        const jsonText = part.replace("data:", "").trim();

        try {
          const parsed = JSON.parse(jsonText);

          if (parsed.token) {
            fullReply += parsed.token;
            updateStreamingMessage(aiMessageId, fullReply);
          }

          if (parsed.error) {
            updateStreamingMessage(aiMessageId, parsed.error);
          }
        } catch (err) {
          console.log("Stream JSON parse error:", err);
        }
      }
    }

    return fullReply;
  };

  const sendMessage = async (rawText, files = []) => {
    const text = (rawText || "").trim();

    if (!text && files.length === 0) return;

    const fileText =
      files.length > 0
        ? "\n\nUploaded files:\n" +
          files.map((f) => `- ${f.name} (${f.type})`).join("\n")
        : "";

    const userMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text: text || "File uploaded",
      files,
    };

    const aiMessageId = crypto.randomUUID();

    const aiMessage = {
      id: aiMessageId,
      sender: "ai",
      text: "",
      files: [],
    };

    const messagesAfterUser = [...messages, userMessage, aiMessage];

    await updateChatMessages(messagesAfterUser);

    setIsTyping(true);
    setPaymentRequired(false);

    try {
      const fullReply = await streamAIResponse({
        userMessageText: text + fileText,
        baseMessages: [...messages, userMessage],
        aiMessageId,
        title: currentChat?.title || "New Chat",
      });

      const finalMessages = [
        ...messages,
        userMessage,
        {
          id: aiMessageId,
          sender: "ai",
          text: fullReply || "No response from AI",
          files: [],
        },
      ];

      await updateChatMessages(finalMessages);
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Generation stopped by user");
        await saveMessagesToDB(
          chats.find((chat) => chat.id === activeChat)?.messages || []
        );
        return;
      }

      const finalMessages = [
        ...messages,
        userMessage,
        {
          id: crypto.randomUUID(),
          sender: "ai",
          text: error.message || "Server Error",
          files: [],
        },
      ];

      await updateChatMessages(finalMessages);
    } finally {
      abortRef.current = null;
      setIsTyping(false);
    }
  };

  const regenerateResponse = async () => {
    if (isTyping) return;

    const currentMessages =
      chats.find((chat) => chat.id === activeChat)?.messages || [];

    const lastUserIndex = [...currentMessages]
      .reverse()
      .findIndex((msg) => msg.sender === "user");

    if (lastUserIndex === -1) {
      alert("Regenerate ke liye pehle user message hona chahiye");
      return;
    }

    const actualUserIndex = currentMessages.length - 1 - lastUserIndex;
    const lastUserMessage = currentMessages[actualUserIndex];

    const messagesBeforeAI = currentMessages.slice(0, actualUserIndex + 1);

    const aiMessageId = crypto.randomUUID();

    const aiMessage = {
      id: aiMessageId,
      sender: "ai",
      text: "",
      files: [],
    };

    const messagesWithEmptyAI = [...messagesBeforeAI, aiMessage];

    await updateChatMessages(messagesWithEmptyAI);

    setIsTyping(true);
    setPaymentRequired(false);

    try {
      const fullReply = await streamAIResponse({
        userMessageText: lastUserMessage.text,
        baseMessages: messagesBeforeAI,
        aiMessageId,
        title: currentChat?.title || "New Chat",
      });

      const finalMessages = [
        ...messagesBeforeAI,
        {
          id: aiMessageId,
          sender: "ai",
          text: fullReply || "No response from AI",
          files: [],
        },
      ];

      await updateChatMessages(finalMessages);
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Regenerate stopped by user");
        await saveMessagesToDB(
          chats.find((chat) => chat.id === activeChat)?.messages || []
        );
        return;
      }

      const finalMessages = [
        ...messagesBeforeAI,
        {
          id: crypto.randomUUID(),
          sender: "ai",
          text: error.message || "Server Error",
          files: [],
        },
      ];

      await updateChatMessages(finalMessages);
    } finally {
      abortRef.current = null;
      setIsTyping(false);
    }
  };

  return (
    <>
      <div className="mobile-header">
        <Menu size={28} onClick={() => setSidebarOpen(true)} />

        <div className="mobile-logo">
          <Sparkles size={18} />
          <h3>AI Chat</h3>
        </div>
      </div>

      <div className="chat-window">
        <div className="messages-container">
          {messages.map((msg, index) => (
            <Message
              key={msg.id}
              sender={msg.sender}
              text={msg.text}
              files={msg.files}
              isLastAI={msg.sender === "ai" && index === messages.length - 1}
              onRegenerate={regenerateResponse}
            />
          ))}

          {paymentRequired && (
            <div className="payment-warning-box">
              <Crown size={22} />
              <div>
                <h4>Free limit completed</h4>
                <p>Premium ₹100 buy karo aur 1 month unlimited chat use karo.</p>
              </div>
            </div>
          )}

          {isTyping && <TypingIndicator />}

          {isTyping && (
            <button className="stop-btn" onClick={stopGenerating}>
              Stop Generating
            </button>
          )}

          <div ref={bottomRef}></div>
        </div>

        <MessageInput
          sendMessage={sendMessage}
          paymentRequired={paymentRequired}
        />
      </div>
    </>
  );
}

export default ChatWindow;