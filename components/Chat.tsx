"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant" | "system" | "error";

interface Msg {
  id: string;
  role: Role;
  content: string;
}

interface Thread {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: number;
}

const LS_THREADS = "ai.chat.threads.v1";
const LS_ACTIVE = "ai.chat.active.v1";
const LS_THEME = "ai.chat.theme.v1"; // "light" | "dark"

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

function loadThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(LS_THREADS);
    return raw ? (JSON.parse(raw) as Thread[]) : [];
  } catch {
    return [];
  }
}

function saveThreads(list: Thread[]) {
  localStorage.setItem(LS_THREADS, JSON.stringify(list));
}

function loadActiveId(): string | null {
  return localStorage.getItem(LS_ACTIVE);
}

function saveActiveId(id: string) {
  localStorage.setItem(LS_ACTIVE, id);
}

function loadTheme(): "light" | "dark" {
  const t = localStorage.getItem(LS_THEME);
  return t === "dark" ? "dark" : "light";
}

function saveTheme(t: "light" | "dark") {
  localStorage.setItem(LS_THEME, t);
}

export default function Chat() {
  // --------- состояние
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);

  // для скролла вниз
  const endRef = useRef<HTMLDivElement | null>(null);

  // --------- инициализация
  useEffect(() => {
    const t = loadThreads();
    const id = loadActiveId();
    if (t.length === 0) {
      // стартовый поток
      const first: Thread = {
        id: uid(),
        title: "Привет =)",
        createdAt: now(),
        messages: [
          {
            id: uid(),
            role: "assistant",
            content:
              "Привет! Я твой личный ИИ-помощник по **коксохим-производству**. Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.",
          },
        ],
      };
      setThreads([first]);
      setActiveId(first.id);
      saveThreads([first]);
      saveActiveId(first.id);
    } else {
      setThreads(t);
      setActiveId(id ?? t[0].id);
    }
  }, []);

  // --------- вычисления
  const active = useMemo(
    () => threads.find((x) => x.id === activeId) ?? null,
    [threads, activeId]
  );

  // авто-скролл
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length]);

  // --------- история
  function newThread() {
    const th: Thread = {
      id: uid(),
      title: "Новый чат",
      createdAt: now(),
      messages: [
        {
          id: uid(),
          role: "assistant",
          content:
            "Готов! Напиши вопрос — и я постараюсь помочь. (Если ответа нет — проверь баланс OpenAI и переменную `OPENAI_API_KEY
