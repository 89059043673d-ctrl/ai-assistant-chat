"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "./Markdown";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatProps = {
  messages: Message[];
  onSend?: (text: string) => void;
  loading?: boolean;
  placeholder?: string;
  /** Показать приветственный экран, если сообщений нет */
  showWelcome?: boolean;
};

export default function Chat({
  messages,
  onSend,
  loading = false,
  placeholder = "Введите сообщение…",
  showWelcome = true,
}: ChatProps) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Автоскролл при появлении новых сообщений
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend?.(text);
    setInput("");
  };

  // Классы для «бабблов»
  const baseBubble =
    "overflow-x-auto rounded-2xl p-4 shadow border border-zinc-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-800/60";
  const userMod =
    "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-800/60";
  const assistantMod = "";

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-black">
      {/* Лента сообщений */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-auto py-6 md:py-8"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Центральная колонка — расширили до 95vw, но не шире 1400px */}
        <div className="max-w-[min(1400px,95vw)] mx-auto px-3 md:px-4">
          {/* Приветственный экран */}
          {showWelcome && messages.length === 0 && (
            <div className="max-w-[min(1400px,95vw)] mx-auto mt-10 text-center animate-fadeIn">
              <h1 className="text-white text-2xl md:text-3xl font-semibold">
                Привет! Это твой чат-сайт.
              </h1>
              <p className="text-zinc-300 mt-3">
                Отправь запрос — я отвечу. Широкие таблицы теперь прокручиваются
                по горизонтали и не «пробивают» поля.
              </p>
            </div>
          )}

          {/* Сообщения */}
          <div className="space-y-4">
            {messages.map((m) => {
              const isUser = m.role === "user";
              if (m.role === "system") return null;

              return (
                <div
                  key={m.id}
                  className={`group mb-1 ${isUser ? "ml-auto" : ""} max-w-[min(1400px,95vw)]`}
                >
                  <div
                    className={`${baseBubble} ${isUser ? userMod : assistantMod}`}
                  >
                    <Markdown className="prose prose-zinc dark:prose-invert max-w-none">
                      {m.content}
                    </Markdown>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Композер */}
      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-black/40">
        <div className="max-w-[min(1400px,95vw)] mx-auto p-3">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/50 p-2"
          >
            <textarea
              className="min-h-[44px] max-h-[33vh] w-full resize-y bg-transparent p-3 text-zinc-100 placeholder-zinc-500 outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              title="Отправить"
            >
              {loading ? "…" : "→"}
            </button>
          </form>

          {/* Подсказка про скролл для таблиц */}
          <p className="mt-2 text-xs text-zinc-500">
            Широкие таблицы можно прокручивать по горизонтали внутри сообщения.
          </p>
        </div>
      </div>
    </div>
  );
}
