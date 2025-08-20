'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Paperclip,
  Mic,
  Send,
  Menu,
  Plus,
  Search,
} from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };
type ChatLite = { id: string; title: string; createdAt: number };

const LS_LIST = 'chats';
const LS_CHAT = (id: string) => `chat:${id}`;

export default function Chat() {
  // ===== История чатов =====
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<ChatLite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ===== Сообщения текущего чата =====
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);

  // ===== Инициализация из localStorage =====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const list: ChatLite[] = JSON.parse(localStorage.getItem(LS_LIST) || '[]');
    if (list.length === 0) {
      const id = crypto.randomUUID();
      const first: ChatLite = { id, title: 'Новый чат', createdAt: Date.now() };
      localStorage.setItem(LS_LIST, JSON.stringify([first]));
      localStorage.setItem(LS_CHAT(id), JSON.stringify([]));
      setChats([first]);
      setActiveId(id);
      setMessages([]);
    } else {
      setChats(list);
      const id = list[0].id;
      setActiveId(id);
      const msgs: Msg[] = JSON.parse(localStorage.getItem(LS_CHAT(id)) || '[]');
      setMessages(msgs);
    }
  }, []);

  // Сохранение сообщений активного чата
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeId) return;
    localStorage.setItem(LS_CHAT(activeId), JSON.stringify(messages));
  }, [messages, activeId]);

  // ===== Утилиты работы с чатами =====
  const persistChats = (next: ChatLite[]) => {
    setChats(next);
    if (typeof window !== 'undefined') localStorage.setItem(LS_LIST, JSON.stringify(next));
  };

  const newChat = () => {
    const id = crypto.randomUUID();
    const item: ChatLite = { id, title: 'Новый чат', createdAt: Date.now() };
    persistChats([item, ...chats]);
    setActiveId(id);
    setMessages([]);
    if (typeof window !== 'undefined') localStorage.setItem(LS_CHAT(id), JSON.stringify([]));
    setSidebarOpen(false);
  };

  const openChat = (id: string) => {
    setActiveId(id);
    const msgs: Msg[] = JSON.parse(localStorage.getItem(LS_CHAT(id)) || '[]');
    setMessages(msgs);
    setSidebarOpen(false);
  };

  // Автопрокрутка
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Enter — отправка, Shift+Enter — перенос
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  };

  // ===== ЕДИНСТВЕННОЕ место отправки (без onClick у стрелки) =====
  const handleSend = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      if (e) e.preventDefault();
      if (sendingRef.current) return;

      const text = input.trim();
      if (!text || !activeId) return;

      // Для нового чата сразу зададим заголовок по первому сообщению
      const idx = chats.findIndex(c => c.id === activeId);
      if (idx >= 0 && (chats[idx].title === 'Новый чат' || !chats[idx].title)) {
        const next = [...chats];
        next[idx] = { ...next[idx], title: text.slice(0, 30) + (text.length > 30 ? '…' : '') };
        persistChats(next);
      }

      const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: text };
      setMessages(prev => [...prev, userMsg]);
      setInput('');

      sendingRef.current = true;
      setIsSending(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMsg],
            input: text,
            message: text,
          }),
        });

        let replyText = '';
        try {
          const data = await res.json();
          replyText =
            data?.reply ??
            data?.message ??
            data?.content ??
            (typeof data === 'string' ? data : '');
        } catch {
          replyText = replyText || (await res.text());
        }

        if (!res.ok || !replyText) throw new Error('empty');

        const botMsg: Msg = { id: crypto.randomUUID(), role: 'assistant', content: replyText };
        setMessages(prev => [...prev, botMsg]);
      } catch {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.',
          },
        ]);
      } finally {
        setIsSending(false);
        sendingRef.current = false;
      }
    },
    [input, messages, activeId, chats]
  );

  // ===== Прикрепление файла =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => fileInputRef.current?.click();

  // ===== Микрофон (Web Speech API) — без TS-типов =====
  const recRef = useRef<any>(null);
  const [recOn, setRecOn] = useState(false);
  useEffect(() => {
    if (!recOn) return;
    if (typeof window === 'undefined') return;

    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setRecOn(false);
      return;
    }
    const rec: any = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: any) => {
      const text = ev?.results?.[0]?.[0]?.transcript?.trim();
      if (text) setInput((prev: string) => (prev ? `${prev} ${text}` : text));
    };
    rec.onend = () => setRecOn(false);
    rec.onerror = () => setRecOn(false);

    recRef.current = rec;
    try {
      rec.start();
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

  // Фильтр списка чатов
  const filtered = chats.filter(c =>
    c.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Верхняя панель */}
      <div className="relative flex items-center justify-center border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Гамбургер слева */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Меню"
          title="Меню"
        >
          <Menu size={18} />
        </button>

        <div className="text-sm font-medium">Мой ИИ-ассистент</div>
      </div>

      {/* Контент */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-[680px] px-4 text-center text-xl font-semibold text-zinc-400">
            Чем я могу помочь?
          </div>
        )}

        <div className="mx-auto w-full max-w-[880px] space-y-3 px-4 py-4">
          {messages.map(m => (
            <div
              key={m.id}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-50 dark:bg-zinc-800'
                  : 'mr-auto max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 dark:bg-zinc-900/50'
              }
            >
              {m.content}
            </div>
          ))}
        </div>
      </div>

      {/* Панель ввода */}
      <form
        onSubmit={handleSend}
        className="border-t border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mx-auto flex w-full max-w-[880px] items-center gap-2">
          {/* Скрепка */}
          <button
            type="button"
            onClick={onPickFile}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            aria-label="Прикрепить файл"
          >
            <Paperclip size={18} />
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={() => {}} />

          {/* Поле ввода + микрофон */}
          <div className="flex min-h-10 flex-1 items-center rounded-xl border border-zinc-200/70 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              className="h-10 w-full bg-transparent outline-none placeholder:text-zinc-400"
              placeholder="Спросите что-нибудь…"
            />
            <button
              type="button"
              onClick={() => setRecOn(v => !v)}
              className={`ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg ${recOn ? 'bg-zinc-200 dark:bg-zinc-800' : ''}`}
              aria-label="Диктовка"
              title="Диктовка"
            >
              <Mic size={18} />
            </button>
          </div>

          {/* Стрелка отправки (submit) */}
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            aria-label="Отправить"
            title="Отправить"
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      {/* ===== ЛЕВАЯ ШТОРКА (меню) ===== */}
      {/* Подложка */}
      {sidebarOpen && (
        <button
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Панель */}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-[82%] max-w-[340px] transform bg-white shadow-xl transition-transform duration-200 ease-out dark:bg-zinc-900 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-2 top-2.5 opacity-60" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-sm outline-none placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Поиск по чатам…"
            />
          </div>
          <button
            onClick={newChat}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            title="Новый чат"
            aria-label="Новый чат"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="h-[calc(100%-52px)] overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-sm text-zinc-400">Чаты не найдены</div>
          ) : (
            <ul className="space-y-1">
              {filtered.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => openChat(c.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      c.id === activeId ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                    }`}
                    title={new Date(c.createdAt).toLocaleString()}
                  >
                    {c.title || 'Без названия'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
