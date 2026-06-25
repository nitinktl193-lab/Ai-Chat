import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import axios from "axios";
import "./Chat.css";

import Sidebar from "../Sidebar/Sidebar";
import ChatWindow from "../Chat/ChatWindow";

const API_URL = "https://ai-chat-1-uqy6.onrender.com";

function Chat() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  const defaultMessage = [
    {
      id: crypto.randomUUID(),
      sender: "ai",
      text: `Hello ${user?.name || "User"} 👋 How can I help you today?`,
    },
  ];

  const createDefaultChat = () => ({
    id: String(Date.now()),
    title: "New Chat",
    messages: defaultMessage,
  });

  useEffect(() => {
    if (!user?.id) {
      navigate("/login");
      return;
    }

    const fetchChats = async () => {
      try {
        const res = await axios.get(`${API_URL}/chats/${user.id}`);

        if (res.data.success && res.data.chats.length > 0) {
          setChats(res.data.chats);
          setActiveChat(res.data.chats[0].id);
        } else {
          const newChat = createDefaultChat();
          setChats([newChat]);
          setActiveChat(newChat.id);

          await axios.post(`${API_URL}/chats/save`, {
            userId: user.id,
            chatId: String(newChat.id),
            title: newChat.title,
            messages: newChat.messages,
          });
        }
      } catch (err) {
        console.log("Fetch chats error:", err);
        const newChat = createDefaultChat();
        setChats([newChat]);
        setActiveChat(newChat.id);
      } finally {
        setLoadingChats(false);
      }
    };

    fetchChats();
  }, []);

  const saveChatToDB = async (chat) => {
    try {
      await axios.post(`${API_URL}/chats/save`, {
        userId: user.id,
        chatId: String(chat.id),
        title: chat.title,
        messages: chat.messages,
      });
    } catch (err) {
      console.log("Save chat error:", err);
    }
  };

  const createNewChat = async () => {
    const newChat = {
      id: String(Date.now()),
      title: `New Chat ${chats.length + 1}`,
      messages: defaultMessage,
    };

    setChats((prev) => [...prev, newChat]);
    setActiveChat(newChat.id);
    await saveChatToDB(newChat);
  };

  const deleteChat = async (id) => {
    const updated = chats.filter((chat) => chat.id !== id);

    try {
      await axios.delete(`${API_URL}/chats/${user.id}/${id}`);
    } catch (err) {
      console.log("Delete chat error:", err);
    }

    if (updated.length === 0) {
      const newChat = createDefaultChat();
      setChats([newChat]);
      setActiveChat(newChat.id);
      await saveChatToDB(newChat);
      return;
    }

    setChats(updated);
    setActiveChat(updated[0].id);
  };

  const renameChat = async (id) => {
    const newTitle = prompt("Enter new chat name");
    if (!newTitle?.trim()) return;

    let updatedChat = null;

    const updatedChats = chats.map((chat) => {
      if (chat.id === id) {
        updatedChat = { ...chat, title: newTitle };
        return updatedChat;
      }
      return chat;
    });

    setChats(updatedChats);

    if (updatedChat) {
      await saveChatToDB(updatedChat);
    }
  };

  const exportChatPDF = () => {
    const chat = chats.find((c) => c.id === activeChat);

    if (!chat) {
      alert("No chat found");
      return;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 12;
    let y = 18;

    pdf.setFontSize(18);
    pdf.text(chat.title || "AI Chat Export", margin, y);
    y += 10;

    pdf.setFontSize(10);
    pdf.text(`User: ${user?.name || "User"} | ${user?.email || ""}`, margin, y);
    y += 8;

    pdf.text(`Date: ${new Date().toLocaleString()}`, margin, y);
    y += 12;

    pdf.setFontSize(11);

    chat.messages.forEach((msg) => {
      const sender = msg.sender === "user" ? "You" : "AI";
      const text = `${sender}: ${msg.text || ""}`;

      const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);

      if (y + lines.length * 7 > 280) {
        pdf.addPage();
        y = 18;
      }

      pdf.text(lines, margin, y);
      y += lines.length * 7 + 6;
    });

    pdf.save(`${chat.title || "chat"}.pdf`);
  };

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (loadingChats) {
    return <div className="chat-loading">Loading chats...</div>;
  }

  return (
    <div className="chat-layout">
      <Sidebar
        chats={chats}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        createNewChat={createNewChat}
        deleteChat={deleteChat}
        renameChat={renameChat}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="chat-main">
        <div className="top-actions">
          <button className="export-btn" onClick={exportChatPDF}>
            <Download size={16} />
            Export PDF
          </button>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>

        <ChatWindow
          chats={chats}
          setChats={setChats}
          activeChat={activeChat}
          setSidebarOpen={setSidebarOpen}
        />
      </div>
    </div>
  );
}

export default Chat;