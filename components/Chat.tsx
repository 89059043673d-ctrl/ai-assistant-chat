'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown';
import { v4 as uuid } from 'uuid';
import { Copy, Mic, Paperclip, Send, Trash2, Plus, Menu, ChevronDown } from 'lucide-react';

type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; messages: Msg[] };

const STORAGE_KEY = 'chats_v1';

export default function Chat() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Автоскролл
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showJump, setShowJump] = useState(false);

  // Микрофон
  const recRef = useRef<SpeechRecognition | null>(null);
  const [recOn, setRecOn] = useState(false);

  // ---------- ИНИЦИАЛИЗАЦИЯ ----------
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed: Chat[] = JSON.parse(raw);
        setChats(parsed);
        setCurrentId(parsed[0]?.id ?? newChatId());
      } catch {
        setChats([emptyChat()]);
        setCurrentId(newChatId());
      }
    } else {
      const c = emptyChat();
      setChats([c]);
      setCurrentId(c.id);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentId, chats]);

  // Показ стрелки, если ушли наверх
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowJump(!nearBottom);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Микрофон инициализация
  useEffect(() => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recOn && !recRef.current) {
      const r: SpeechRecognition = new SR();
      r.lang = 'ru-RU';
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        // Берем ТОЛЬКО финальный результат один раз
        const res = e.results?.[0]?.[0]?.transcript;
        if (res) setInput((t) => (t ? t + ' ' : '') + res);
      };
      r.onend = () => setRecOn(false);
      r.onerror = () => setRecOn(false);
      recRef.current = r;
      r.start();
    }
    if (!recOn && recRef.current) {
      try {
        recRef.current.stop();
      } catch {}
      recRef.current = null;
    }
  }, [recOn]);

  const current = useMemo(
    () => chats.find((c) => c.id === currentId) ?? emptyChat(),
    [chats, currentId]
  );

  // ---------- ВСПОМОГАТЕЛЬНОЕ ----------
  function emptyChat(): Chat {
    return { id: uuid(), title: 'Новый чат', messages: [] };
  }
  function newChatId() {
    return uuid();
  }

  function updateCurrent(updater: (draft: Chat) => void) {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === currentId);
      if (idx === -1) return prev;
      const copy = [...prev];
      const draft = { ...copy[idx], messages: [...copy[idx].messages] };
      updater(draft);
      copy[idx] = draft;
      // заголовок — первое пользовательское сообщение
      if (draft.title === 'Новый чат') {
        const firstUser = draft.messages.find((m) => m.role === 'user');
        if (firstUser) {
          copy[idx].title =
            firstUser.content.length > 40
              ? firstUser.content.slice(0, 40) + '…'
              : firstUser.content;
        }
      }
      return copy;
    });
  }

  function createChat() {
    const c = emptyChat();
    setChats((prev) => [c, ...prev]);
    setCurrentId(c.id);
    setDrawerOpen(false);
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      const newId = filtered[0]?.id ?? emptyChat().id;
      if (!filtered.length) {
        const c = emptyChat();
        setCurrentId(c.id);
        return [c];
      }
      setCurrentId(newId);
      return filtered;
    });
  }

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    // Добавляем мое сообщение
    updateCurrent((d) => d.messages.push({ role: 'user', content: text }));

    // Сразу создаем пустой ответ ассистента для стрима
    updateCurrent((d) => d.messages.push({ role: 'assistant', content: '' }));

    // Стрим с сервера
    try {
      const body = JSON.stringify({
        messages: current.messages.concat({ role: 'user', content: text }),
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok || !res.body) {
        updateCurrent((d) => {
          d.messages[d.messages.length - 1].content =
            'Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.';
        });
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const chunk = decoder.decode(value);
            updateCurrent((draft) => {
              draft.messages[draft.messages.length - 1].content += chunk;
            });
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    } catch {
      updateCurrent((d) => {
        d.messages[d.messages.length - 1].content =
          'Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.';
      });
    } finally {
      setSending(false);
    }
  }

  function onAttach(file?: File) {
    if (!file) return;
    const label = `📎 Прикрепил файл: ${file.name}`;
    updateCurrent((d) => d.messages.push({ role: 'user', content: label }));
  }

  function onCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((p) => (p === id ? null : p)), 900);
    });
  }

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  // ---------- РЕНДЕР ----------
  return (
    <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[280px_1fr]">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <aside
        className={`${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:static z-40 inset-y-0 left-0 w-72 bg-zinc-900/95 backdrop-blur border-r border-zinc-800 transition-transform`}
      >
        <div className="p-3 flex items-center gap-2 border-b border-zinc-800">
          <button
            className="lg:hidden rounded p-2 hover:bg-zinc-800"
            onClick={() => setDrawerOpen(false)}
          >
            <Menu size={18} />
          </button>
          <button
            onClick={createChat}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-sm"
          >
            <Plus size={16} /> Новый чат
          </button>
        </div>

        <div className="p-3 border-b border-zinc-800">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по чатам…"
            className="w-full rounded-md bg-zinc-800 text-zinc-100 placeholder-zinc-400 px-3 py-2 outline-none"
          />
        </div>

        <div className="overflow-y-auto h-[calc(100%-118px)]">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-800 ${
                c.id === currentId ? 'bg-zinc-800' : ''
              }`}
              onClick={() => {
                setCurrentId(c.id);
                setDrawerOpen(false);
              }}
            >
              <div className="truncate text-sm">{c.title}</div>
              <button
                className="p-1 rounded hover:bg-zinc-700"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(c.id);
                }}
                title="Удалить чат"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ПРАВАЯ ЧАСТЬ */}
      <main className="relative flex flex-col h-[100dvh]">
        {/* Верхняя полоса */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <button
            className="lg:hidden p-2 rounded hover:bg-zinc-800"
            onClick={() => setDrawerOpen(true)}
            title="Открыть меню"
          >
            <Menu size={18} />
          </button>

          <div className="mx-auto text-zinc-300">
            {current.messages.length === 0 ? (
              <div className="text-center text-xl md:text-2xl font-semibold">
                Чем я могу помочь?
              </div>
            ) : (
              <div className="text-sm opacity-70">Мой ИИ-ассистент</div>
            )}
          </div>

          <div className="w-8" />
        </div>

        {/* СООБЩЕНИЯ */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {current.messages.map((m, i) => {
            const id = `${current.id}-${i}`;
            const isMe = m.role === 'user';
            return (
              <div
                key={id}
                className={`group max-w-3xl ${
                  isMe ? 'ml-auto' : ''
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    isMe
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`}
                >
                  {isMe ? (
                    <div className="whitespace-pre-wrap leading-7">{m.content}</div>
                  ) : (
                    <Markdown className="max-w-none">{m.content}</Markdown>
                  )}
                </div>

                {/* Кнопка копирования */}
                <div className="flex justify-end">
                  <button
                    onClick={() => onCopy(m.content, id)}
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                    title="Скопировать"
                  >
                    {copiedId === id ? 'Скопировано' : <Copy size={14} />}
                  </button>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Стрелка «вниз» */}
        {showJump && (
          <button
            className="absolute right-4 bottom-28 z-10 rounded-full p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 shadow"
            title="Вниз"
            onClick={() =>
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            <ChevronDown />
          </button>
        )}

        {/* ПАНЕЛЬ ВВОДА */}
        <div className="p-3 border-t border-zinc-800">
          <div className="relative flex items-center gap-2">
            <button
              className="p-2 rounded bg-zinc-800 hover:bg-zinc-700"
              onClick={() => fileRef.current?.click()}
              title="Прикрепить файл"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => onAttach(e.target.files?.[0] ?? undefined)}
            />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Спросите что-нибудь… (Shift+Enter — перенос строки)"
              rows={1}
              className="flex-1 resize-none rounded-md bg-zinc-900 text-zinc-100 placeholder-zinc-400 px-3 py-2 outline-none border border-zinc-800 focus:border-zinc-600"
            />

            <button
              className={`p-2 rounded ${
                recOn ? 'bg-rose-700 hover:bg-rose-600' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
              onClick={() => setRecOn((v) => !v)}
              title={recOn ? 'Остановить запись' : 'Голосовой ввод'}
            >
              <Mic size={18} />
            </button>

            <button
              onClick={onSend}
              disabled={sending}
              className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
              title="Отправить"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
