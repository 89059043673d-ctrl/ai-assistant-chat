'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Role = 'user' | 'assistant';
export type Message = { role: Role; content: string };

export type Session = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

type Theme = 'light' | 'dark';

type ChatContextValue = {
  sessions: Session[];
  activeId: string | null;
  setActiveId: (id: string) => void;
  newChat: () => void;
  removeChat: (id: string) => void;
  theme: Theme;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = 'chats_v1';

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

function makeEmptySession(): Session {
  const now = Date.now();
  return {
    id: genId(),
    title: 'Новый чат',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  // Инициализация из localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Session[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      }
    } catch {}
    const first = makeEmptySession();
    setSessions([first]);
    setActiveId(first.id);
  }, []);

  // Сохранение в localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  // Применение темы на html
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const value: ChatContextValue = useMemo(
    () => ({
      sessions,
      activeId,
      setActiveId: (id: string) => setActiveId(id),
      newChat: () => {
        const s = makeEmptySession();
        setSessions((arr) => [s, ...arr]);
        setActiveId(s.id);
      },
      removeChat: (id: string) => {
        setSessions((arr) => arr.filter((s) => s.id !== id));
        if (activeId === id) {
          // переключиться на следующий доступный
          setActiveId((prev) => {
            const rest = sessions.filter((s) => s.id !== id);
            return rest[0]?.id ?? null;
          });
        }
      },
      theme,
      toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
      sidebarOpen,
      setSidebarOpen,
    }),
    [sessions, activeId, theme, sidebarOpen]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within <ChatProvider>');
  }
  return ctx;
}

// Экспорт по умолчанию — провайдер (может использоваться в layout)
export default ChatProvider;
