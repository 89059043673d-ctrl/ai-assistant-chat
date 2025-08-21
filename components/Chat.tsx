"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Paperclip, Send, Mic, Copy, Check } from "lucide-react";
import Markdown from "./Markdown";
import clsx from "clsx";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const LS_KEY = "chat.history.v1";

export default function Chat() {
  // UI
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Сообщения
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Копирование (визуальная обратная связь)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Поиск по истории (левая панель)
  const [q, setQ] = useState("");

  // Вложения
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedNames, setAttachedNames] = useState<string[]>([]);

  // Микрофон (Web Speech API)
  const recRef = useRef<any>(null);
  const [recOn, setRecOn] = useState(false);

  // ---------- init / persist ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(messages));
  }, [messages]);

  // ---------- helpers ----------
  const filtered = useMemo(
    () =>
      q.trim()
        ? messages.filter((m) =>
            m.content.toLowerCase().includes(q.trim().toLowerCase())
          )
        : messages,
    [messages, q]
  );

  const pushMsg = (role: Msg["role"], content: string) =>
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, ts: Date.now() },
    ]);

  // ---------- copy with feedback ----------
  const copyText = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 900);
    } catch {}
  };

  // ---------- mic ----------
  useEffect(() => {
    if (!recOn) return;

    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SR) {
      setRecOn(false);
      alert("Распознавание речи не поддерживается в этом браузере.");
      return;
    }
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e: any) => {
      let last = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        last += e.results[i][0].transcript;
      }
      setText((t) => (t ? t + " " : "") + last.trim());
    };

    rec.onerror = () => setRecOn(false);
    rec.onend = () => setRecOn(false);

    rec.start();
    recRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {}
      recRef.current = null;
    };
  }, [recOn]);

  const toggleMic = () => {
    setRecOn((v) => {
      if (v && recRef.current) {
        try {
          recRef.current.stop();
        } catch {}
      }
      return !v;
    });
  };

  // ---------- attach ----------
  const onPickFile = () => fileInputRef.current?.click();
  const onFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    if (names.length) setAttachedNames(names);
  };

  // ---------- send ----------
  const send = async () => {
    const userText = text.trim();
    if (!userText || sending) return;

    // добавляем метку про вложения (минимально рабочий функционал)
    const withAttach =
      attachedNames.length > 0
        ? `${userText}\n\n[Вложения: ${attachedNames.join(", ")}]`
        : userText;

    setSending(true);
    pushMsg("user", withAttach);
    setText("");
    setAttachedNames([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: withAttach,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        pushMsg(
          "assistant",
          "Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel."
        );
        setSending(false);
        return;
      }

      // стримим ТОЛЬКО текст (как у нас сделан route.ts)
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      const id = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id, role: "assistant", content: "", ts: Date.now() },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: acc } : m))
        );
      }
    } catch (e) {
      pushMsg(
        "assistant",
        "Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel."
      );
    } finally {
      setSending(false);
    }
  };

  const onEnterSend = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-zinc-950/80 px-3 py-2 backdrop-blur">
        <button
          className="rounded-xl p-2 hover:bg-white/5 active:scale-95 transition"
          onClick={() => setSidebarOpen(true)}
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm opacity-70">Мой ИИ-ассистент</div>
      </div>

      {/* hero надпись */}
      {messages.length === 0 && (
        <div className="px-4 py-8 sm:px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 bg-clip-text text-transparent">
              Чем я могу помочь сегодня?
            </span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Спроси что-нибудь — поддерживаются заголовки, списки, жирный текст,
            формулы LaTeX и код.
          </p>
        </div>
      )}

      {/* messages */}
      <div className="mx-auto max-w-3xl px-3 pb-36 sm:px-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "mt-3 flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={clsx(
                "group relative rounded-2xl px-4 py-3 shadow",
                m.role === "user"
                  ? "bg-zinc-900 text-zinc-100"
                  : "bg-zinc-800/80 text-zinc-100"
              )}
            >
              {/* копировать */}
              <button
                className="absolute -right-2 -top-2 hidden rounded-full bg-zinc-700 p-2 text-white/90 shadow group-hover:block active:scale-95 transition"
                onClick={() => copyText(m.id, m.content)}
                aria-label="Копировать"
                title="Копировать"
              >
                {copiedId === m.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>

              {m.role === "assistant" ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* input bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-zinc-950/90 backdrop-blur">
        {/* attached chips */}
        {attachedNames.length > 0 && (
          <div className="mx-auto max-w-3xl px-3 pt-3 sm:px-4">
            <div className="flex flex-wrap gap-2">
              {attachedNames.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            {/* paperclip */}
            <button
              className="rounded-2xl bg-zinc-900 p-3 text-zinc-200 hover:bg-zinc-800 active:scale-95 transition"
              onClick={onPickFile}
              aria-label="Прикрепить файл"
              title="Прикрепить файл"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFilesChosen}
            />

            {/* input */}
            <input
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-white/50 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400/70"
              placeholder="Спросите что-нибудь…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onEnterSend}
            />

            {/* mic */}
            <button
              className={clsx(
                "rounded-2xl p-3 active:scale-95 transition",
                recOn
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              )}
              onClick={toggleMic}
              aria-label="Голосовой ввод"
              title="Голосовой ввод"
            >
              <Mic className="h-5 w-5" />
            </button>

            {/* send */}
            <button
              className="rounded-2xl bg-white px-4 py-3 text-zinc-900 hover:bg-zinc-200 active:scale-95 transition disabled:opacity-50"
              onClick={send}
              disabled={sending}
              aria-label="Отправить"
              title="Отправить"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* sidebar */}
      {sidebarOpen && (
        <>
          {/* overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          {/* panel */}
          <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-zinc-900 text-white shadow-xl">
            <div className="p-3">
              <input
                type="search"
                placeholder="Поиск по чатам…"
                className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-white placeholder:text-white/60 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400/70"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="mt-3 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 active:scale-95 transition"
                onClick={() =>
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "user",
                      content: "Новый чат",
                      ts: Date.now(),
                    },
                  ])
                }
              >
                Новый чат
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-3 pb-6">
              {filtered
                .filter((m) => m.role === "user")
                .slice()
                .reverse()
                .map((m) => (
                  <div
                    key={m.id}
                    className="mt-2 truncate rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    title={m.content}
                  >
                    {m.content}
                  </div>
                ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
