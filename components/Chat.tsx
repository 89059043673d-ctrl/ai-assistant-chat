'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  Search,
  Plus,
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
} from 'lucide-react';

type Role = 'user' | 'assistant';
type Message = { role: Role; content: string };

type ChatMeta = {
  id: string;
  title: string;
  createdAt: number;
};

type ChatThread = {
  meta: ChatMeta;
  messages: Message[];
};

const SIDEBAR_WIDTH = 320;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const STORAGE_KEY = 'ai-chat-threads';
const CURRENT_ID_KEY = 'ai-chat-current-id';

export default function Chat() {
  // sidebar
  const [open, setOpen] = useState(false);

  // threads
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // compose
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  // voice
  const [recOn, setRecOn] = useState(false);
  const recRef = useRef<any>(null);

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as ChatThread[]) : [];
      setThreads(saved);

      const savedId = localStorage.getItem(CURRENT_ID_KEY);
      if (savedId && saved.some(t => t.meta.id === savedId)) {
        setCurrentId(savedId);
      } else {
        const first = createThread('Новый чат');
        setThreads([first]);
        setCurrentId(first.meta.id);
        persist([first], first.meta.id);
      }
    } catch {
      const first = createThread('Новый чат');
      setThreads([first]);
      setCurrentId(first.meta.id);
      persist([first], first.meta.id);
    }
  }, []);

  // speech recognition (без SSR)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const phrase = e.results?.[0]?.[0]?.transcript || '';
      if (phrase) setText(prev => (prev ? prev + ' ' : '') + phrase);
    };
    rec.onend = () => setRecOn(false);
    rec.onerror = () => setRecOn(false);
    recRef.current = rec;
  }, []);

  const current = useMemo(
    () => threads.find(t => t.meta.id === currentId) || null,
    [threads, currentId]
  );

  function persist(list: ChatThread[], id: string | null) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (id) localStorage.setItem(CURRENT_ID_KEY, id);
  }

  function createThread(title: string): ChatThread {
    return {
      meta: { id: uid(), title, createdAt: Date.now() },
      messages: [],
    };
  }

  function addThread() {
    const t = createThread('Новый чат');
    const next = [t, ...threads];
    setThreads(next);
    setCurrentId(t.meta.id);
    persist(next, t.meta.id);
    setOpen(false);
  }

  function setActive(id: string) {
    setCurrentId(id);
    persist(threads, id);
    setOpen(false);
  }

  function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function toggleRec() {
    if (!recRef.current) return;
    if (recOn) {
      try {
        recRef.current.stop();
      } catch {}
      setRecOn(false);
    } else {
      try {
        recRef.current.start();
        setRecOn(true);
      } catch {}
    }
  }

  async function sendMessage() {
    if (!text.trim() && !file) return;
    if (!current) return;

    const userMsg: Message = { role: 'user', content: text.trim() || '(файл)' };
    const updated: ChatThread[] = threads.map(t =>
      t.meta.id === current.meta.id
        ? { ...t, messages: [...t.messages, userMsg] }
        : t
    );
    setThreads(updated);
    setText('');
    setFile(null);
    setSending(true);
    try {
      const form = new FormData();
      form.append('message', userMsg.content);
      if (file) form.append('file', file);

      const res = await fetch('/api/chat', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      const reply: Message =
        data?.message
          ? { role: 'assistant', content: data.message as string }
          : {
              role: 'assistant',
              content:
                res.status === 429
                  ? 'Лимит API. Проверьте биллинг OpenAI или ключ OPENAI_API_KEY.'
                  : 'Не удалось получить ответ от модели.',
            };

      const after: ChatThread[] = (prev => {
        const idx = prev.findIndex(t => t.meta.id === current.meta.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        const t = copy[idx];
        // первый ответ — формируем заголовок чата
        const title =
          t.messages.length === 0 && userMsg.content
            ? userMsg.content.slice(0, 40)
            : t.meta.title;
        copy[idx] = {
          meta: { ...t.meta, title: title || t.meta.title },
          messages: [...t.messages, userMsg, reply],
        };
        return copy;
      })(updated);

      setThreads(after);
      persist(after, current.meta.id);
    } catch {
      const failed: ChatThread[] = threads.map(t =>
        t.meta.id === current.meta.id
          ? {
              ...t,
              messages: [
                ...t.messages,
                { role: 'assistant', content: 'Ошибка сети.' },
              ],
            }
          : t
      );
      setThreads(failed);
      persist(failed, current.meta.id);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Sidebar */}
      <div
        className="fixed inset-y-0 left-0 z-40 w-[--sb] -translate-x-full bg-white shadow-lg transition-transform duration-300 ease-out dark:bg-zinc-900 md:translate-x-0"
        style={
          {
            // CSS var управляет шириной
            ['--sb' as any]: `${SIDEBAR_WIDTH}px`,
            transform: open ? 'translateX(0)' : undefined,
          } as React.CSSProperties
        }
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              placeholder="Поиск по чатам"
              className="w-full bg-transparent outline-none placeholder:text-zinc-400"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const all = JSON.parse(raw) as ChatThread[];
                const filtered = all.filter(t =>
                  (t.meta.title || '').toLowerCase().includes(q)
                );
                setThreads(filtered.length ? filtered : all);
              }}
            />
          </div>

          <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
            <button
              onClick={addThread}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />
              Новый чат
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {threads.map((t) => (
              <button
                key={t.meta.id}
                onClick={() => setActive(t.meta.id)}
                className={`mb-1 w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  currentId === t.meta.id
                    ? 'bg-zinc-100 dark:bg-zinc-800'
                    : ''
                }`}
              >
                {t.meta.title || 'Без названия'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay для мобильного */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      {/* Main */}
      <div
        className="ml-0 flex min-h-[100dvh] w-full flex-col md:ml-[--sb]"
        style={{ ['--sb' as any]: `${SIDEBAR_WIDTH}px` } as React.CSSProperties}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white/80 px-3 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 md:px-5">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium">Мой ИИ-ассистент</div>
        </div>

        {/* Content */}
        <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 pb-[112px] pt-6 md:px-5">
          {(!current || current.messages.length === 0) && (
            <h1 className="mx-auto mt-8 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Чем я могу помочь?
            </h1>
          )}

          {current?.messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'ml-auto bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>

        {/* Composer (нижняя панель) */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 md:gap-3">
            {/* Скрепка вне поля ввода */}
            <label className="inline-flex">
              <input type="file" className="hidden" onChange={onAttach} />
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                title="Прикрепить файл"
              >
                <Paperclip className="h-5 w-5" />
              </div>
            </label>

            {/* Поле ввода */}
            <div className="flex min-h-10 flex-1 items-center rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Спросите что-нибудь…"
                className="max-h-40 w-full resize-none bg-transparent py-2 outline-none placeholder:text-zinc-400"
              />
              {/* Микрофон справа внутри поля */}
              <button
                type="button"
                onClick={toggleRec}
                className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                title={recOn ? 'Остановить запись' : 'Говорить'}
              >
                {recOn ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            </div>

            {/* Кнопка «Отправить» стрелкой вверх, чёрный фон */}
            <button
              onClick={sendMessage}
              disabled={sending || (!text.trim() && !file)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-50 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              title="Отправить (Enter)"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>

          {/* Выбранный файл (мини-лейбл) */}
          {file && (
            <div className="mx-auto mt-2 w-full max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
              Прикреплено: <span className="truncate">{file.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
