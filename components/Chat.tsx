'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown';
import { Copy, Mic, Paperclip, Send, Trash2, Plus, Menu, ChevronDown } from 'lucide-react';

type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; messages: Msg[] };

const STORAGE_KEY = 'chats_v1';

// Простая генерация уникальных ID без зависимости 'uuid'
const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function Chat() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [recOn, setRecOn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);

  // ------------------ ЗАГРУЗКА / СОХРАНЕНИЕ ------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const init = emptyChat();
        setChats([init]);
        setCurrentId(init.id);
        return;
      }
      const parsed: Chat[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const init = emptyChat();
        setChats([init]);
        setCurrentId(init.id);
      } else {
        setChats(parsed);
        setCurrentId(parsed[0].id);
      }
    } catch {
      const init = emptyChat();
      setChats([init]);
      setCurrentId(init.id);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {}
  }, [chats]);

  // ------------------ ДЕРИВАТЫ ------------------
  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentId) ?? null,
    [chats, currentId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [chats, search]);

  // Автоскролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages.length]);

  // Фокус на textarea после открытия
  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentId]);

  // ------------------ ОБРАБОТЧИКИ ------------------
  async function sendMessage() {
    if (!currentChat || sending) return;
    const text = input.trim();
    if (!text) return;

    setSending(true);
    setInput('');

    const userMsg: Msg = { role: 'user', content: text };
    pushMessage(currentChat.id, userMsg);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...currentChat.messages,
            userMsg,
          ],
        }),
      });

      if (!res.ok) {
        const err = await safeText(res);
        pushMessage(currentChat.id, {
          role: 'assistant',
          content: `Ошибка ответа от сервера: ${res.status} ${err || ''}`.trim(),
        });
      } else {
        const reader = res.body?.getReader();
        if (!reader) {
          pushMessage(currentChat.id, {
            role: 'assistant',
            content: 'Пустой ответ сервера.',
          });
        } else {
          // Читаем стрим чанками
          let acc = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            acc += new TextDecoder().decode(value);
            // Потихоньку отображаем
            pushPartial(currentChat.id, acc);
          }
          // Финализация
          pushMessage(currentChat.id, { role: 'assistant', content: acc });
          clearPartial(currentChat.id);
        }
      }
    } catch (e: any) {
      pushMessage(currentChat.id, {
        role: 'assistant',
        content: `Ошибка сети: ${e?.message || e}`,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ------------------ КЛИПБОРД ------------------
  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    } catch {}
  }

  // ------------------ ФАЙЛЫ ------------------
  function openFileDialog() {
    fileInputRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !currentChat) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const err = await safeText(res);
        pushMessage(currentChat.id, {
          role: 'assistant',
          content: `Ошибка распознавания: ${res.status} ${err || ''}`.trim(),
        });
      } else {
        const text = await res.text();
        setInput((t) => (t ? t + '\n' : '') + text);
      }
    } catch (e: any) {
      pushMessage(currentChat.id, {
        role: 'assistant',
        content: `Ошибка загрузки файла: ${e?.message || e}`,
      });
    } finally {
      setSending(false);
      e.target.value = '';
      textareaRef.current?.focus();
    }
  }

  // ------------------ РЕЙМЫ ЧАТОВ ------------------
  function newChat() {
    const c = emptyChat();
    setChats((arr) => [c, ...arr]);
    setCurrentId(c.id);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function deleteChat(id: string) {
    setChats((arr) => arr.filter((c) => c.id !== id));
    if (currentId === id) {
      const rest = chats.filter((c) => c.id !== id);
      setCurrentId(rest[0]?.id || '');
      if (rest.length === 0) {
        const c = emptyChat();
        setChats([c]);
        setCurrentId(c.id);
      }
    }
  }

  function renameChat(id: string, title: string) {
    setChats((arr) =>
      arr.map((c) => (c.id === id ? { ...c, title: title || 'Без названия' } : c))
    );
  }

  // ------------------ СООБЩЕНИЯ ------------------
  function pushMessage(id: string, msg: Msg) {
    setChats((arr) =>
      arr.map((c) => (c.id === id ? { ...c, messages: [...c.messages, msg] } : c))
    );
  }

  // «стриминговая» подстановка (визуальный прогресс)
  function pushPartial(id: string, text: string) {
    setChats((arr) =>
      arr.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              messages:
                c.messages.length === 0
                  ? [{ role: 'assistant', content: text }]
                  : [
                      ...c.messages.slice(0, -1),
                      { ...c.messages[c.messages.length - 1], content: text },
                    ],
            }
      )
    );
  }

  function clearPartial(id: string) {
    // ничего, т.к. pushMessage финализирует
  }

  // ------------------ МИКРОФОН ------------------
  function toggleRec() {
    setRecOn((on) => !on);
  }

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
      recRef.current.stop();
      recRef.current = null;
    }
  }, [recOn]);

  // ------------------ UI ------------------
  return (
    <div className="flex h-full">
      {/* Сайдбар */}
      <aside
        className={`border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 w-72 shrink-0 transition-transform ${drawerOpen ? 'translate-x-0' : '-translate-x-72'} md:translate-x-0`}
      >
        <div className="p-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            className="md:hidden p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setDrawerOpen(false)}
            aria-label="Закрыть меню"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={newChat}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Новый чат
          </button>
          <div className="ml-auto relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск…"
              className="text-sm rounded-md px-2 py-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-3.25rem)]">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${currentId === c.id ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60'}`}
              onClick={() => setCurrentId(c.id)}
            >
              <span className="truncate">{c.title || 'Без названия'}</span>
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newTitle = prompt('Новое имя чата', c.title);
                    if (newTitle !== null) renameChat(c.id, newTitle);
                  }}
                  aria-label="Переименовать"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <button
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Удалить чат?')) deleteChat(c.id);
                  }}
                  aria-label="Удалить чат"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Контент */}
      <main className="flex-1 flex flex-col h-full">
        <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <button
            className="md:hidden p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-medium">Ассистент</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentChat?.messages.map((m, idx) => (
            <div
              key={idx}
              className={`rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-zinc-100 dark:bg-zinc-800 ml-auto' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}
            >
              {m.role === 'assistant' ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <div>{m.content}</div>
              )}

              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                <button
                  onClick={() => copyMessage(String(idx), m.content)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedId === String(idx) ? 'Скопировано' : 'Копировать'}
                </button>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <div className="flex items-end gap-2">
            <button
              onClick={openFileDialog}
              className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Прикрепить файл"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFilePicked}
              accept="audio/*, .txt, .md, .pdf, .doc, .docx"
              className="hidden"
            />

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Задай вопрос..."
                rows={1}
                className="w-full resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none"
              />
            </div>

            <button
              disabled={sending || !input.trim()}
              onClick={sendMessage}
              className="p-2 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50"
              aria-label="Отправить"
            >
              <Send className="w-5 h-5" />
            </button>

            <button
              onClick={toggleRec}
              className={`p-2 rounded ${recOn ? 'bg-red-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              aria-label="Диктовка"
              title="Голосовой ввод (русский)"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );

  // ---------- ВСПОМОГАТЕЛЬНОЕ ----------
  function emptyChat(): Chat {
    return { id: genId(), title: 'Новый чат', messages: [] };
  }
  function newChatId() {
    return genId();
  }

  function updateCurrent(updater: (draft: Chat) => Chat) {
    setChats((arr) => {
      const idx = arr.findIndex((c) => c.id === currentId);
      if (idx < 0) return arr;
      const copy = [...arr];
      copy[idx] = updater(copy[idx]);
      return copy;
    });
  }
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
