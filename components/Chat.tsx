'use client';

import {
  useEffect, useMemo, useRef, useState, useCallback,
} from 'react';
import clsx from 'clsx';
import Markdown from './Markdown'; // Убедитесь, что путь к этому компоненту верный
import {
  Copy, Mic, Paperclip, Send, Trash2, Plus, Menu, Search, Clock, List,
} from 'lucide-react';

// ---------- TYPES ----------
type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; messages: Msg[]; updatedAt: number };

const STORAGE_KEY = 'chats_v2';

// ---------- HELPERS ----------
const genId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const emptyChat = (): Chat => ({
  id: genId(),
  title: 'Новый чат',
  messages: [],
  updatedAt: Date.now(),
});

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function copyToClipboard(content: string) {
  try {
    await navigator.clipboard.writeText(content);
  } catch (e) {
    console.error('Failed to copy text: ', e);
  }
}

// ---------- CUSTOM HOOKS ----------

/**
 * Хук для синхронизации состояния с Local Storage.
 */
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

/**
 * Хук для управления логикой чатов.
 */
function useChatManager() {
  const [chats, setChats] = useLocalStorage<Chat[]>(STORAGE_KEY, []);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Инициализация и выбор первого чата при загрузке
  useEffect(() => {
    if (chats.length > 0) {
      const ordered = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
      if (JSON.stringify(ordered) !== JSON.stringify(chats)) {
        setChats(ordered);
      }
      if (!currentId || !chats.some(c => c.id === currentId)) {
        setCurrentId(ordered[0].id);
      }
    } else {
      const init = emptyChat();
      setChats([init]);
      setCurrentId(init.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Запускается только один раз

  const currentChat = useMemo(() => chats.find((c) => c.id === currentId) || null, [chats, currentId]);

  const touchChat = useCallback((id: string, updater: (c: Chat) => Partial<Chat>) => {
    setChats((arr) =>
      arr
        .map((c) => (c.id === id ? { ...c, ...updater(c), updatedAt: Date.now() } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }, [setChats]);

  const pushMessage = useCallback((id: string, msg: Msg) => {
    touchChat(id, (c) => ({ messages: [...c.messages, msg] }));
  }, [touchChat]);

  const pushPartial = useCallback((id: string, text: string) => {
    touchChat(id, (c) => {
      const last = c.messages[c.messages.length - 1];
      if (!last || last.role !== 'assistant') {
        return { messages: [...c.messages, { role: 'assistant', content: text }] };
      }
      const updated = [...c.messages];
      updated[updated.length - 1] = { ...last, content: text };
      return { messages: updated };
    });
  }, [touchChat]);

  const newChat = useCallback(() => {
    const nc = emptyChat();
    setChats((arr) => [nc, ...arr]);
    setCurrentId(nc.id);
  }, [setChats]);

  const deleteChat = useCallback((id: string) => {
    setChats((arr) => {
      const filtered = arr.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const nc = emptyChat();
        setCurrentId(nc.id);
        return [nc];
      }
      if (currentId === id) {
        setCurrentId(filtered[0].id);
      }
      return filtered;
    });
  }, [currentId, setChats]);

  return {
    chats,
    currentChat,
    currentId,
    setCurrentId,
    newChat,
    deleteChat,
    pushMessage,
    pushPartial,
  };
}

/**
 * Хук для распознавания речи.
 */
function useSpeechRecognition({ onResult }: { onResult: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef<any>(null);

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (isRecording && !recRef.current) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = 'ru-RU';
      r.onresult = (e: any) => {
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript;
          }
        }
        if (final) onResult(final);
      };
      r.onend = () => {
        setIsRecording(false);
        recRef.current = null;
      };
      recRef.current = r;
      r.start();
    }

    if (!isRecording && recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
  }, [isRecording, onResult]);

  return { isRecording, toggleRecording };
}

/**
 * Хук для автоматического изменения высоты textarea и отслеживания высоты контейнера.
 */
function useAutoResize<T extends HTMLElement>(ref: React.RefObject<T>) {
  const [height, setHeight] = useState(88); // Дефолтная высота

  const measureHeight = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setHeight(Math.max(56, Math.round(rect.height)));
  }, [ref]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const ro = new ResizeObserver(measureHeight);
    ro.observe(node);

    window.addEventListener('resize', measureHeight);
    measureHeight(); // Первоначальное измерение

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureHeight);
    };
  }, [ref, measureHeight]);

  return height;
}


// ---------- MAIN COMPONENT ----------

export default function Chat() {
  const {
    chats,
    currentChat,
    currentId,
    setCurrentId,
    newChat,
    deleteChat,
    pushMessage,
    pushPartial,
  } = useChatManager();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState('');

  const { isRecording, toggleRecording } = useSpeechRecognition({
    onResult: (text) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerH = useAutoResize(composerRef);

  // Авто-высота textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0px';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Автопрокрутка к низу при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages.length]);

  const sendMessage = useCallback(async () => {
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
        body: JSON.stringify({ messages: [...currentChat.messages, userMsg] }),
      });

      if (!res.ok) {
        const err = await safeText(res);
        pushMessage(currentChat.id, {
          role: 'assistant',
          content: `Ошибка ответа сервера.\n\n${err || '(пусто)'}`,
        });
      } else if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          pushPartial(currentChat.id, acc);
        }
      } else {
        pushMessage(currentChat.id, {
          role: 'assistant',
          content: 'Пустой ответ сервера.',
        });
      }
    } catch (e: any) {
      pushMessage(currentChat.id, {
        role: 'assistant',
        content: `Ошибка сети: ${String(e?.message ?? e)}`,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [currentChat, input, sending, pushMessage, pushPartial]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleNewChat = () => {
    newChat();
    setInput('');
    textareaRef.current?.focus();
  }

  const filteredChats = useMemo(() =>
    chats.filter((c) =>
      (c.title || 'Новый чат').toLowerCase().includes(query.toLowerCase())
    ), [chats, query]);

  const showGreeting = (currentChat?.messages.length ?? 0) === 0;
  const mainClasses = clsx(
    'flex-1 min-w-0 flex flex-col bg-bg transition-[margin] duration-200',
    { 'md:ml-72': sidebarOpen }
  );

  return (
    <div className="relative min-h-[100dvh]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {!sidebarOpen && (
        <button
          className="fab-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="Открыть меню"
          title="Меню"
        >
          <Menu size={18} />
        </button>
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-panel transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="font-semibold">Диалоги</div>
            <button
              className="p-2 rounded hover:bg-panelAlt"
              onClick={() => setSidebarOpen(false)}
              title="Скрыть"
              aria-label="Скрыть меню"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-200 text-zinc-900 hover:opacity-90"
            >
              <Plus size={16} />
              Новый чат
            </button>
          </div>

          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-subtext" size={16} />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-panelAlt outline-none focus:ring-1 focus:ring-zinc-600"
                placeholder="Поиск по чатам…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1">
             <div className="flex items-center gap-2 text-sm text-subtext mb-2">
               <Clock size={16} /> Недавние
             </div>
            {filteredChats.map((c) => (
              <div
                key={c.id}
                className={clsx(
                  'w-full p-3 rounded-lg hover:bg-panelAlt cursor-pointer group',
                  currentId === c.id && 'bg-panelAlt'
                )}
                onClick={() => setCurrentId(c.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 text-left truncate">{c.title || 'Новый чат'}</div>
                  <button
                    className="p-1 rounded text-subtext hover:bg-zinc-800 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                    title="Удалить чат"
                    aria-label="Удалить чат"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-subtext truncate mt-1">
                  {c.messages[c.messages.length - 1]?.content || 'Пусто'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className={mainClasses}>
        <header className="safe-top flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            className="p-2 rounded hover:bg-panelAlt"
            onClick={() => setSidebarOpen((s) => !s)}
            title="Меню"
            aria-label="Меню"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-lg font-semibold truncate">{currentChat?.title || 'AI Assistant Chat'}</h1>
        </header>

        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ paddingBottom: composerH + 16 }}
        >
          <div className="max-w-3xl mx-auto">
            {showGreeting && (
              <div className="mt-10 text-center animate-fadeIn">
                <h2 className="text-3xl font-semibold mb-2">Здравствуйте, чем могу помочь?</h2>
                <p className="text-subtext">Введите вопрос ниже, чтобы начать диалог.</p>
              </div>
            )}
            {currentChat?.messages.map((m, i) => (
              <div key={i} className={clsx('group mb-4', m.role === 'user' && 'flex justify-end')}>
                <div className={clsx('msg', m.role === 'user' ? 'msg-user' : 'msg-assistant')}>
                  {m.role === 'assistant' ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                  <div className="msg-actions">
                    <button
                      className="inline-flex items-center gap-1 hover:text-zinc-200"
                      onClick={() => copyToClipboard(m.content)}
                      title="Скопировать"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      <div
        ref={composerRef}
        className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-panel"
      >
        <div className="max-w-3xl mx-auto p-3">
          <div className="flex items-end gap-2">
            <button
              className={clsx('icon-btn', isRecording && 'bg-panelAlt text-red-500')}
              onClick={toggleRecording}
              title="Микрофон"
            >
              <Mic size={18} />
            </button>
            <button className="icon-btn" title="Прикрепить файл (не работает)">
              <Paperclip size={18} />
            </button>

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                className="w-full max-h-52 resize-none rounded-xl border border-border bg-panelAlt p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                rows={1}
                placeholder="Напишите сообщение…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            <button
              className="p-3 rounded-xl bg-zinc-200 text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              title="Отправить"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
