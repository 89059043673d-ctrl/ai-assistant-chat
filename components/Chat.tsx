// components/Chat.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Menu, Paperclip, Send, Mic, Clipboard } from "lucide-react";
import Markdown from "./Markdown";
import clsx from "clsx";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat() {
  // левое меню
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // история сообщений
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // локальная "история чатов" в сайдбаре
  const [threads, setThreads] = useState<
    { id: string; title: string; msgs: Msg[] }[]
  >([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // автоскролл в конец
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // создать новый чат
  function newChat() {
    const id = crypto.randomUUID();
    const title = "Новый чат";
    const t = { id, title, msgs: [] as Msg[] };
    setThreads((s) => [t, ...s]);
    setActiveThreadId(id);
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // выбрать чат
  function selectChat(id: string) {
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveThreadId(id);
    setMessages(t.msgs);
    setSidebarOpen(false);
  }

  // сохранить текущий чат в список
  function persistThread(nextMsgs: Msg[]) {
    if (!activeThreadId) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, msgs: nextMsgs, title: titleFromMsgs(nextMsgs) } : t))
    );
  }

  function titleFromMsgs(msgs: Msg[]) {
    const firstUser = msgs.find((m) => m.role === "user")?.content?.slice(0, 30);
    return firstUser ? firstUser : "Чат";
  }

  // копирование текста
  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  // отправка (стриминг)
  async function send(e?: React.FormEvent) {
    if (e) e.preventDefault(); // чтобы не было двойной отправки
    const text = input.trim();
    if (!text || loading) return;

    // добавляем пользовательское сообщение
    const me: Msg = { role: "user", content: text };
    const startMsgs = [...messages, me];
    setMessages(startMsgs);
    persistThread(startMsgs);
    setInput("");

    // создаем заготовку для assistant
    const ai: Msg = { role: "assistant", content: "" };
    setMessages((s) => [...s, ai]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: startMsgs,
          message: text,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("bad response");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let acc = "";

      // читаем plain text поток
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;

        // обновляем последнее сообщение ассистента
        setMessages((s) => {
          const next = [...s];
          next[next.length - 1] = { role: "assistant", content: sanitizeLeak(acc) };
          return next;
        });
      }

      setMessages((s) => {
        const next = [...s];
        next[next.length - 1] = { role: "assistant", content: sanitizeLeak(acc) };
        persistThread(next);
        return next;
      });
    } catch {
      setMessages((s) => {
        const next = [...s];
        next[next.length - 1] = {
          role: "assistant",
          content:
            "Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.",
        };
        persistThread(next);
        return next;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  // на случай если вдруг бэкенд где-то вернул `{"ok":true,"content":"..."}`
  function sanitizeLeak(text: string) {
    // если это JSON-строка вида { ok:true, content:"..." }
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"content"')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj.content === "string") return obj.content;
      } catch {}
    }
    return text;
  }

  // при первом заходе — пустой чат
  useEffect(() => {
    if (threads.length === 0) newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* верхняя плашка */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-800/60 bg-[#0f0f10]/80 px-4 py-3 backdrop-blur">
        <button
          className="rounded-lg bg-zinc-900 p-2 hover:bg-zinc-800"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Меню"
          title="Меню"
        >
          <Menu size={18} />
        </button>
        <div className="text-sm font-semibold">Мой ИИ-ассистент</div>
      </div>

      {/* сайдбар */}
      {sidebarOpen && (
        <div className="absolute left-0 top-[52px] z-30 h-[calc(100%-52px)] w-[300px] border-r border-zinc-800/60 bg-[#0e0e0f]">
          <div className="flex items-center gap-2 p-3">
            <input
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none"
              placeholder="Поиск по чатам…"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                setThreads((prev) =>
                  prev
                    .slice()
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((t) => t) // просто чтобы перерендерить
                );
              }}
            />
            <button
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
              onClick={newChat}
            >
              + Новый
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto p-2">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => selectChat(t.id)}
                className={clsx(
                  "block w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-800",
                  t.id === activeThreadId && "bg-zinc-800"
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* область сообщений */}
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-4">
        {/* приветственная надпись (как полупрозрачная подсказка) — показываем, когда нет сообщений */}
        {messages.length === 0 && (
          <div className="mb-6 rounded-2xl bg-zinc-900/40 p-4 text-center text-sm text-zinc-300">
            Чем я могу помочь сегодня?
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={clsx(
                "flex",
                m.role === "user" ? "justify-start" : "justify-start"
              )}
            >
              <div
                className={clsx(
                  "group relative max-w-[85%] rounded-2xl px-4 py-3",
                  m.role === "user"
                    ? "bg-zinc-900 text-zinc-100"
                    : "bg-zinc-800/70 text-zinc-100"
                )}
              >
                {m.role === "assistant" ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}

                {/* копировать */}
                <button
                  onClick={() => copyText(m.content)}
                  className="absolute -right-2 -top-2 hidden rounded-full bg-zinc-900 p-2 text-zinc-300 shadow group-hover:block"
                  title="Копировать"
                  aria-label="Копировать"
                >
                  <Clipboard size={14} />
                </button>
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-xs text-zinc-400">Ассистент печатает…</div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* нижняя панель ввода */}
      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800/60 bg-[#0f0f10]/90 px-4 py-3"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {/* скрепка — слева, темная */}
          <button
            type="button"
            className="rounded-xl bg-zinc-900 p-3 text-zinc-300 hover:bg-zinc-800"
            title="Прикрепить"
            aria-label="Прикрепить"
          >
            <Paperclip size={18} />
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Спросите что-нибудь…"
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 px-4 py-3 text-sm outline-none placeholder:text-zinc-500"
          />

          <button
            type="button"
            className="rounded-xl bg-zinc-900 p-3 text-zinc-300 hover:bg-zinc-800"
            title="Голос"
            aria-label="Голос"
          >
            <Mic size={18} />
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-black p-3 text-zinc-100 hover:bg-zinc-900 disabled:opacity-50"
            title="Отправить"
            aria-label="Отправить"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
