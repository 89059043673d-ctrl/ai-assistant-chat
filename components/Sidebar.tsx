"use client";
import { useChat } from "./ChatContext";

export default function Sidebar() {
  const { sessions, activeId, setActiveId, newChat, removeChat, theme, toggleTheme, sidebarOpen, setSidebarOpen } = useChat();

  return (
    <>
      {/* мобильный бэкдроп */}
      <div
        className="sidebar-backdrop"
        style={{ display: sidebarOpen ? "block" : "none" }}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar__top">
          <button className="btn btn--primary" onClick={() => { newChat(); setSidebarOpen(false); }}>＋ Новый чат</button>
          <div className="spacer" />
          <button className="theme-toggle btn" title="Переключить тему" onClick={toggleTheme}>
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>

        <div className="sidebar__list">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`chat-item ${activeId === s.id ? "active" : ""}`}
              onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
              title={new Date(s.createdAt).toLocaleString()}
            >
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {s.title || "Без названия"}
              </div>
              <button
                className="icon-btn"
                title="Удалить чат"
                onClick={(e) => { e.stopPropagation(); if (confirm("Удалить чат?")) removeChat(s.id); }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar__bottom">
          <div className="tag">Историй: {sessions.length}</div>
          <button className="btn" onClick={() => location.reload()}>Обновить</button>
        </div>
      </aside>
    </>
  );
}
