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

const hasWindow = () =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
const now = () => Date.now();

/** Safe localStorage helpers (не трогаем на сервере) */
function loadThreads(): Thread[] {
  if (!hasWindow()) return [];
  try {
    const raw = localStorage.getItem(LS_THREADS);
    return raw ? (JSON.parse(raw) as Thread[]) : [];
  } catch {
    return [];
  }
}
function saveThreads(list: Thread[]) {
  if (!hasWindow()) return;
  localStorage.setItem(LS_THREADS, JSON.stringify(list));
}
function loadActiveId(): string | null {
  if (!hasWindow()) return null;
  return localStorage.getItem(LS_ACTIVE);
}
function saveActiveId(id: string) {
  if (!hasWindow()) return;
  localStorage.setItem(LS_ACTIVE, id);
}
function loadTheme(): "light" | "dark" {
  if (!hasWindow()) return "light";
  const t = localStorage.getItem(LS_THEME);
  return t === "dark" ? "dark" : "light";
}
function saveTheme(t: "light" | "dark") {
  if (!hasWindow()) return;
  localStorage.setItem(LS_THEME, t);
}

export default function Chat() {
  // --------- состояние
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light"); // дефолт без localStorage

  const endRef = useRef<HTMLDivElement | null>(null);

  // --------- инициализация (только в браузере)
  useEffect(() => {
    // тема
    setTheme(loadTheme());

    // история
    const t = loadThreads();
    const id = loadActiveId();
    if (t.length === 0) {
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

  // применяем тему без перезагрузки
  useEffect(() => {
    if (!hasWindow()) return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    saveTheme(theme);
  }, [theme]);

  const active = useMemo(
    () => threads.find((x) => x.id === activeId) ?? null,
    [threads, activeId]
  );

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
            "Готов! Напиши вопрос — и я постараюсь помочь. (Если ответа нет — проверь баланс OpenAI и `OPENAI_API_KEY` на Vercel.)",
        },
      ],
    };
    const next = [th, ...threads];
    setThreads(next);
    setActiveId(th.id);
    saveThreads(next);
    saveActiveId(th.id);
  }

  function renameThread(id: string, title: string) {
    const next = threads.map((t) => (t.id === id ? { ...t, title } : t));
    setThreads(next);
    saveThreads(next);
  }

  function removeThread(id: string) {
    const next = threads.filter((t) => t.id !== id);
    setThreads(next);
    saveThreads(next);
    if (activeId === id) {
      const newActive = next[0]?.id ?? null;
      setActiveId(newActive);
      if (newActive) saveActiveId(newActive);
      else localStorage.removeItem(LS_ACTIVE);
    }
  }

  // --------- отправка
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!active || !content || sending) return;

    setSending(true);
    setInput("");

    const userMsg: Msg = { id: uid(), role: "user", content };
    const updA = { ...active, messages: [...active.messages, userMsg] };
    const updThreads = threads.map((t) => (t.id === active.id ? updA : t));
    setThreads(updThreads);
    saveThreads(updThreads);

    if (active.title === "Новый чат" || active.title === "Привет =)") {
      renameThread(active.id, content.slice(0, 30));
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updA.messages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      let replyText = "";
      try {
        const data = await res.json();
        replyText =
          data?.reply ??
          data?.message ??
          data?.content ??
          (typeof data === "string" ? data : JSON.stringify(data));
      } catch {
        replyText = await res.text();
      }

      const botMsg: Msg = {
        id: uid(),
        role: res.ok ? "assistant" : "error",
        content: replyText || (res.ok ? "" : "Не удалось получить ответ."),
      };

      const updB = { ...updA, messages: [...updA.messages, botMsg] };
      const updThreads2 = threads.map((t) => (t.id === active.id ? updB : t));
      setThreads(updThreads2);
      saveThreads(updThreads2);
    } catch (e: any) {
      const botMsg: Msg = {
        id: uid(),
        role: "error",
        content:
          e?.message ??
          "Не удалось получить ответ от модели. Проверьте `OPENAI_API_KEY` и баланс в OpenAI Billing.",
      };
      const updB = { ...active, messages: [...active.messages, userMsg, botMsg] };
      const updThreads2 = threads.map((t) => (t.id === active.id ? updB : t));
      setThreads(updThreads2);
      saveThreads(updThreads2);
    } finally {
      setSending(false);
    }
  }

  // --------- диктовка (без типов, чтобы сборка не падала)
  function toggleVoice() {
    // @ts-ignore
    const Rec =
      typeof window !== "undefined"
        ? (window as any).webkitSpeechRecognition ||
          (window as any).SpeechRecognition
        : null;

    if (!Rec) {
      alert("Распознавание речи не поддерживается этим браузером.");
      return;
    }
    // @ts-ignore
    const rec = new Rec();
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    if (!recording) {
      setRecording(true);
      rec.start();
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript as string;
        setRecording(false);
        sendMessage(text);
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
    } else {
      try {
        // @ts-ignore
        rec.stop();
      } catch {}
      setRecording(false);
    }
  }

  // --------- прикрепление файла (минимум)
  async function onAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !active) return;
    const note: Msg = {
      id: uid(),
      role: "user",
      content: `📎 Прикреплён файл: **${f.name}** (${Math.round(
        f.size / 1024
      )} КБ)`,
    };
    const upd = { ...active, messages: [...active.messages, note] };
    const list = threads.map((t) => (t.id === active.id ? upd : t));
    setThreads(list);
    saveThreads(list);
    e.target.value = "";
  }

  // --------- отрисовка
  return (
    <div className="flex h-[100dvh] w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Левая колонка — история */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 md:flex md:flex-col">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">История</div>
          <button
            onClick={newThread}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Новый чат
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveId(t.id);
                saveActiveId(t.id);
              }}
              className={`w-full rounded-md px-2 py-2 text-left text-sm transition ${
                t.id === activeId
                  ? "bg-zinc-200 dark:bg-zinc-800"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
              title={new Date(t.createdAt).toLocaleString()}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="line-clamp-1">{t.title}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const nv = prompt("Название чата:", t.title)?.trim();
                      if (nv) renameThread(t.id, nv);
                    }}
                    className="rounded px-1 text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    title="Переименовать"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Удалить чат?")) removeThread(t.id);
                    }}
                    className="rounded px-1 text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            title="Переключить тему"
          >
            Тема: {theme === "light" ? "светлая" : "тёмная"}
          </button>
        </div>
      </aside>

      {/* Центральная колонка — чат */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Верхняя панель */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium">Ваш ассистент</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="rounded-md px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Переключить тему"
            >
              {theme === "light" ? "🌞" : "🌙"}
            </button>
          </div>
        </div>

        {/* Лента сообщений */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {active?.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80ch] rounded-lg border px-3 py-2 text-sm leading-6 ${
                m.role === "user"
                  ? "ml-auto border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                  : m.role === "assistant"
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  : "border-red-300 bg-red-50 text-red-900 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-200"
              }`}
            >
              {m.content}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Нижняя панель ввода */}
        <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 px-2 py-2 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              📎
              <input type="file" onChange={onAttachFile} className="hidden" />
              <span>Прикрепить</span>
            </label>

            <button
              onClick={toggleVoice}
              className={`rounded-md border px-2 py-2 text-xs transition ${
                recording
                  ? "border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-200"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
              title="Распознавание речи в браузере"
            >
              🎤
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Спросите что-нибудь…"
              rows={1}
              className="min-h-[44px] flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:ring-zinc-700"
            />

            <button
              onClick={() => sendMessage()}
              disabled={sending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Отправить
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
