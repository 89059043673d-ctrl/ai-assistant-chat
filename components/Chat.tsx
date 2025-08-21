"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Paperclip, Send, Mic, Copy, Check, Trash2 } from "lucide-react";
import Markdown from "./Markdown";
import clsx from "clsx";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };
type ChatSession = { id: string; title: string; created: number; messages: Msg[] };

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const LS_OLD = "chat.history.v1";
const LS_SESS = "chat.sessions.v1";

export default function Chat() {
  // ---------- sessions ----------
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // ---------- input state ----------
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // attachments
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedNames, setAttachedNames] = useState<string[]>([]);

  // mic
  const recRef = useRef<any>(null);
  const [recOn, setRecOn] = useState(false);
  const lastFinalRef = useRef<string>("");

  // ---------- init / migration ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SESS);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length) {
          setSessions(parsed);
          setCurrentId(parsed[0].id);
          return;
        }
      }
      const oldRaw = localStorage.getItem(LS_OLD);
      if (oldRaw) {
        const msgs = JSON.parse(oldRaw) as Msg[];
        const title =
          msgs.find((m) => m.role === "user")?.content?.slice(0, 40) ||
          "Новый чат";
        const sess: ChatSession = {
          id: crypto.randomUUID(),
          title,
          created: Date.now(),
          messages: Array.isArray(msgs) ? msgs : [],
        };
        setSessions([sess]);
        setCurrentId(sess.id);
        localStorage.setItem(LS_SESS, JSON.stringify([sess]));
      } else {
        const sess: ChatSession = {
          id: crypto.randomUUID(),
          title: "Новый чат",
          created: Date.now(),
          messages: [],
        };
        setSessions([sess]);
        setCurrentId(sess.id);
        localStorage.setItem(LS_SESS, JSON.stringify([sess]));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sessions.length) localStorage.setItem(LS_SESS, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  const current = useMemo(
    () => sessions.find((s) => s.id === currentId) || null,
    [sessions, currentId]
  );

  const setCurrentMessages = (fn: (prev: Msg[]) => Msg[]) => {
    if (!current) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === current.id ? { ...s, messages: fn(s.messages) } : s
      )
    );
  };

  // ---------- helpers ----------
  const copyText = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 900);
    } catch {}
  };

  const onPickFile = () => fileInputRef.current?.click();
  const onFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    if (names.length) setAttachedNames(names);
  };

  const newChat = () => {
    const sess: ChatSession = {
      id: crypto.randomUUID(),
      title: "Новый чат",
      created: Date.now(),
      messages: [],
    };
    setSessions((prev) => [sess, ...prev]);
    setCurrentId(sess.id);
    setText("");
    setAttachedNames([]);
    setSidebarOpen(false);
  };

  const deleteChat = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const nextId = next[0]?.id ?? null;
      setCurrentId(nextId);
      return next;
    });
  };

  const ensureTitle = (firstUserText: string) => {
    if (!current) return;
    if (!current.title || current.title === "Новый чат") {
      const title = firstUserText.replace(/\s+/g, " ").trim().slice(0, 40);
      setSessions((prev) =>
        prev.map((s) => (s.id === current.id ? { ...s, title } : s))
      );
    }
  };

  // ---------- mic without duplicates ----------
  useEffect(() => {
    if (!recOn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
      const r = e.results[e.results.length - 1];
      if (!r) return;
      const phrase = (r[0]?.transcript || "").trim();
      if (!phrase) return;
      if (r.isFinal) {
        if (phrase !== lastFinalRef.current) {
          setText((t) => (t ? t + " " : "") + phrase);
          lastFinalRef.current = phrase;
        }
      }
    };
    rec.onerror = () => setRecOn(false);
    rec.onend = () => setRecOn(false);

    try {
      rec.start();
      recRef.current = rec;
    } catch {
      setRecOn(false);
    }
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
      } else {
        lastFinalRef.current = "";
      }
      return !v;
    });
  };

  // ---------- send ----------
  const send = async () => {
    if (!current) return;
    const userText = text.trim();
    if (!userText || sending) return;

    const withAttach =
      attachedNames.length > 0
        ? `${userText}\n\n[Вложения: ${attachedNames.join(", ")}]`
        : userText;

    ensureTitle(userText);

    setSending(true);
    setCurrentMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: withAttach, ts: Date.now() },
    ]);
    setText("");
    setAttachedNames([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: withAttach,
          history: current.messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        setCurrentMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.",
            ts: Date.now(),
          },
        ]);
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const id = crypto.randomUUID();
      let acc = "";

      setCurrentMessages((prev) => [
        ...prev,
        { id, role: "assistant", content: "", ts: Date.now() },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setCurrentMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: acc } : m))
        );
      }
    } catch {
      setCurrentMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.",
          ts: Date.now(),
        },
      ]);
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

  const filteredSessions = useMemo(() => {
    const qv = q.trim().toLowerCase();
    if (!qv) return sessions;
    return sessions.filter((s) => {
      if (s.title.toLowerCase().includes(qv)) return true;
      return s.messages.some((m) => m.content.toLowerCase().includes(qv));
    });
  }, [sessions, q]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/* top */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-zinc-900/90 px-3 py-2 backdrop-blur">
        <button
          className="rounded-xl p-2 hover:bg-white/5 active:scale-95 transition"
          onClick={() => setSidebarOpen(true)}
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm opacity-70">Мой ИИ-ассистент</div>
      </div>

      {/* welcome */}
      {current && current.messages.length === 0 && (
        <div className="px-4 py-10 sm:px-6">
          <h1 className="text-center text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-200">
            Чем я могу помочь сегодня?
          </h1>
          <p className="mt-3 text-center text-sm text-zinc-400">
            Поддерживаются заголовки, списки, **жирный текст**, формулы LaTeX и код.
          </p>
        </div>
      )}

      {/* messages */}
      <div className="mx-auto max-w-3xl px-3 pb-36 sm:px-4">
        {current?.messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "mt-3 flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={clsx(
                "group relative rounded-2xl px-4 py-3 shadow max-w-[90%]",
                m.role === "user"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800/90 text-zinc-100"
              )}
            >
              {/* copy */}
              <button
                className={clsx(
                  "absolute -right-2 -top-2 hidden rounded-full p-2 text-white/90 shadow transition group-hover:block active:scale-95",
                  "bg-zinc-700"
                )}
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

              {/* Markdown — и для ассистента, и для пользователя */}
              <Markdown
                className={clsx(
                  "prose max-w-none prose-headings:mt-3 prose-p:my-2 prose-li:my-1",
                  m.role === "user" ? "prose-zinc" : "prose-invert"
                )}
              >
                {m.content}
              </Markdown>
            </div>
          </div>
        ))}
      </div>

      {/* input bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-zinc-900/95 backdrop-blur">
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
            <button
              className="rounded-2xl bg-zinc-800 p-3 text-zinc-200 hover:bg-zinc-700 active:scale-95 transition"
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

            <input
              className="flex-1 rounded-2xl bg-zinc-800 px-4 py-3 text-base text-white placeholder:text-white/60 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400/70"
              placeholder="Спросите что-нибудь…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onEnterSend}
            />

            <button
              className={clsx(
                "rounded-2xl p-3 active:scale-95 transition",
                recOn
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              )}
              onClick={toggleMic}
              aria-label="Голосовой ввод"
              title="Голосовой ввод"
            >
              <Mic className="h-5 w-5" />
            </button>

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
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-zinc-900 text-white shadow-xl">
            <div className="p-3 border-b border-white/10">
              <input
                type="search"
                placeholder="Поиск по чатам…"
                className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-white placeholder:text-white/60 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400/70"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="mt-3 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 active:scale-95 transition"
                onClick={newChat}
              >
                Новый чат
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-3 pb-6">
              {filteredSessions.map((s) => (
                <div
                  key={s.id}
                  className={clsx(
                    "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 transition",
                    s.id === currentId
                      ? "bg-emerald-600/20 ring-1 ring-emerald-500/50"
                      : "bg-zinc-800 hover:bg-zinc-700"
                  )}
                >
                  <button
                    className="flex-1 truncate text-left"
                    title={s.title}
                    onClick={() => {
                      setCurrentId(s.id);
                      setSidebarOpen(false);
                    }}
                  >
                    {s.title || "Новый чат"}
                  </button>
                  <button
                    className="rounded-md p-1 text-zinc-300 hover:bg-zinc-700 hover:text-white active:scale-95 transition"
                    title="Удалить чат"
                    onClick={() => {
                      if (confirm("Удалить этот чат?")) deleteChat(s.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
