// components/Chat.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Mic, Send, Menu } from "lucide-react";

type Role = "user" | "assistant" | "system";
type Msg = { id: string; role: Role; content: string };

const uid = () => Math.random().toString(36).slice(2);

// Мини-рендерер жирного текста (**bold**) и переносов строк
function RichText({ text }: { text: string }) {
  // разбиваем на строки и внутри строки подсвечиваем **...**
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**") ? (
                <strong key={j}>{p.slice(2, -2)}</strong>
              ) : (
                <React.Fragment key={j}>{p}</React.Fragment>
              )
            )}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const historyForServer = useMemo(
    () =>
      messages
        .filter((m) => !(m.role === "assistant" && m.content.trim() === ""))
        .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsg: Msg = { id: uid(), role: "user", content: text };
    const asstMsg: Msg = { id: uid(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, asstMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history: historyForServer }),
      });

      if (!res.ok) {
        const errText = await safeReadText(res).catch(() => "");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id
              ? {
                  ...m,
                  content:
                    errText ||
                    "Не удалось получить ответ от модели. Проверьте Billing и OPENAI_API_KEY на Vercel.",
                }
              : m
          )
        );
        setLoading(false);
        return;
      }

      if (!res.body) {
        const txt = await res.text();
        setMessages((prev) =>
          prev.map((m) => (m.id === asstMsg.id ? { ...m, content: txt } : m))
        );
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsg.id ? { ...m, content: m.content + chunk } : m
              )
            );
          }
        }
      }
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" ? e.message : "Network/Abort error.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsg.id ? { ...m, content: `[Ошибка]: ${msg}` } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const hasUserMessaged = messages.some((m) => m.role === "user");

  return (
    <div className="flex h-[100dvh] w-full flex-col">
      {/* Верхняя панель */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white/60 p-3 backdrop-blur">
        <button
          type="button"
          className="rounded-full p-2 hover:bg-black/5 active:scale-95"
          title="Меню"
        >
          <Menu size={20} />
        </button>
        <h1 className="mx-auto text-sm font-semibold">Мой ИИ-ассистент</h1>
      </header>

      {/* Приветственный баннер – полупрозрачный, пока не написали первое сообщение */}
      {!hasUserMessaged && (
        <div className="mx-auto mt-6 w-[min(92%,900px)] rounded-2xl bg-gradient-to-r from-gray-100/90 to-gray-50/80 p-6 text-center text-lg font-semibold text-gray-800 shadow-sm">
          Чем я могу помочь сегодня?
        </div>
      )}

      {/* ЛЕВАЯ ВНЕШНЯЯ СКРЕПКА (как раньше): фиксированная снизу слева */}
      <button
        type="button"
        className="fixed bottom-[84px] left-4 z-20 rounded-full bg-black p-3 text-white shadow-lg hover:opacity-90"
        title="Прикрепить"
      >
        <Paperclip size={18} />
      </button>

      {/* Лента сообщений */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-2xl bg-black px-4 py-2 text-white"
                  : "mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-4 py-2 text-gray-900"
              }
            >
              {m.content || (m.role === "assistant" && loading ? "…" : "")}
              {/* Рендерим жирный — только для ассистента */}
              {m.content && m.role === "assistant" && (
                <RichText text={m.content} />
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </main>

      {/* Ввод */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 z-10 w-full border-t bg-white/80 p-3 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm">
          {/* Скрепки внутри поля больше нет — она вынесена слева фиксированно */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Спросите что-нибудь…"
            className="flex-1 bg-transparent outline-none placeholder:text-gray-400"
          />

          <button
            type="button"
            className="rounded-full p-2 text-gray-600 hover:bg-black/5"
            title="Голосовой ввод"
            onClick={() =>
              setMessages((prev) => [
                ...prev,
                {
                  id: uid(),
                  role: "assistant",
                  content: "🎤 Голосовой ввод пока отключён.",
                },
              ])
            }
          >
            <Mic size={18} />
          </button>

          {/* Самолётик отправки — остаётся */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full bg-black p-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            title="Отправить"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

async function safeReadText(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await res.json();
      return typeof j === "string" ? j : JSON.stringify(j);
    }
    return await res.text();
  } catch {
    return "";
  }
}
