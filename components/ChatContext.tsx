"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Msg = { id: string; role: "user" | "assistant"; text: string; imageBase64?: string; imageType?: string; };
export type Session = { id: string; title: string; createdAt: number; messages: Msg[] };

type Ctx = {
  sessions: Session[];
  activeId: string;
  setActiveId: (id: string) => void;
  addMessage: (m: Omit<Msg,"id">) => Msg;
  newChat: () => string;
  removeChat: (id: string) => void;
  renameActive: (title: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
};

const ChatCtx = createContext<Ctx | null>(null);
const LS_KEY = "ai-assistant-sessions-v1";
const THEME_KEY = "theme";

function uid() { return Math.random().toString(36).slice(2, 10); }

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // стартовый чат
    return [{
      id: uid(),
      title: "Новый чат",
      createdAt: Date.now(),
      messages: [{
        id: uid(),
        role: "assistant",
        text: "Привет! Я твой личный ИИ-помощник по **коксохим-производству**. Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.",
      }],
    }];
  });

  const [activeId, setActiveId] = useState<string>(() => sessions[0]?.id || uid());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => (typeof document !== "undefined" ? (document.documentElement.dataset.theme as any) || "dark" : "dark"));

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(sessions)); } catch {}
  }, [sessions]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  const addMessage = (m: Omit<Msg,"id">) => {
    const msg: Msg = { id: uid(), ...m };
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, msg] } : s));
    // авто-название чата по первой фразе пользователя
    if (m.role === "user") {
      setSessions(prev => prev.map(s => s.id === activeId && s.title === "Новый чат"
        ? { ...s, title: m.text.slice(0, 40).trim() || "Новый чат" }
        : s
      ));
    }
    return msg;
  };

  const newChat = () => {
    const id = uid();
    const s: Session = { id, title: "Новый чат", createdAt: Date.now(), messages: [] };
    setSessions(prev => [s, ...prev]);
    setActiveId(id);
    return id;
  };

  const removeChat = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (id === activeId) {
      setActiveId(prev => sessions.find(s => s.id !== id)?.id || newChat());
    }
  };

  const renameActive = (title: string) => {
    setSessions(prev => prev.map(s => s.id === activeId ? ({ ...s, title }) : s));
  };

  const value = useMemo<Ctx>(() => ({
    sessions, activeId, setActiveId,
    addMessage, newChat, removeChat, renameActive,
    theme, toggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark"),
    sidebarOpen, setSidebarOpen
  }), [sessions, activeId, theme, sidebarOpen]);

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatCtx);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
