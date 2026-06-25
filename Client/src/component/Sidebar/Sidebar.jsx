import "./Sidebar.css";
import { useState } from "react";
import { X, Trash2, Pencil, Search, Plus, MessageSquare } from "lucide-react";

function Sidebar({
  chats,
  activeChat,
  setActiveChat,
  createNewChat,
  deleteChat,
  renameChat,
  sidebarOpen,
  setSidebarOpen,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const userName = user?.name || "User";

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectChat = (id) => {
    setActiveChat(id);
    setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="mobile-close">
          <h3>AI Chat</h3>
          <X size={24} onClick={() => setSidebarOpen(false)} />
        </div>

        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={createNewChat}>
            <Plus size={18} />
            New Chat
          </button>

          <div className="search-box">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="chat-history">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${activeChat === chat.id ? "active" : ""}`}
              >
                <div
                  className="chat-info"
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <MessageSquare size={16} />
                  <span className="chat-title">{chat.title}</span>
                </div>

                <div className="chat-actions">
                  <Pencil
                    size={15}
                    className="edit-icon"
                    onClick={() => renameChat(chat.id)}
                  />

                  <Trash2
                    size={15}
                    className="delete-icon"
                    onClick={() => deleteChat(chat.id)}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="no-chat">No chats found</p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
          <div>
            <h4>{userName}</h4>
            <p>Active now</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;