'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Markdown from './Markdown';
import { Copy, Mic, Paperclip, Send, Trash2, Plus, Menu, ChevronDown, Loader2 } from 'lucide-react';

type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; messages: Msg[] };

const STORAGE_KEY = 'chats_v1';
const SAVE_DELAY = 500; // Задержка для debounced сохранения

// Генерация уникальных ID
const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

// Типы для Web Speech API
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult?: (e: any) => void;
  onend?: () => void;
  onerror?: (e: any) => void;
  start: () => void;
  stop: () => void;
} | null;

// Вспомогательные функции
const emptyChat = (): Chat => ({
  id: genId(),
  title: 'Новый чат',
  messages: []
});

const safeText = async (res: Response): Promise<string> => {
  try {
    return await res.text();
  } catch {
    return '';
  }
};

export default function Chat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recOn, setRecOn] = useState(false);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentId) || null,
    [chats, currentId]
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<SpeechRec>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ------------------ ЗАГРУЗКА ДАННЫХ ------------------
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
    } catch (err) {
      console.error('Ошибка загрузки чатов:', err);
      const init = emptyChat();
      setChats([init]);
      setCurrentId(init.id);
    }
  }, []);

  // ------------------ СОХРАНЕНИЕ С DEBOUNCE ------------------
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
      } catch (err) {
        console.error('Ошибка сохранения чатов:', err);
      }
    }, SAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chats]);

  // ------------------ АВТОПРОКРУТКА ------------------
  useEffect(() => {
    if (streaming || sending) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [currentChat?.messages, streaming, sending]);

  // ------------------ ОТПРАВКА СООБЩЕНИЯ ------------------
  const sendMessage = useCallback(async () => {
    if (!currentChat || sending || streaming) return;
    const text = input.trim();
    if (!text) return;

    setSending(true);
    setStreaming(false);
    setInput('');

    const userMsg: Msg = { role: 'user', content: text };
    pushMessage(currentChat.id, userMsg);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentChat.messages, userMsg],
        }),
      });

      if (!res.ok) {
        const err = await safeText(res);
        pushMessage(currentChat.id, {
          role: 'assistant',
          content: `⚠️ Ошибка ответа сервера (${res.status}).\n\n${err || 'Нет описания ошибки'}`,
        });
      } else {
        const reader = res.body?.getReader();
        if (!reader) {
          pushMessage(currentChat.id, {
            role: 'assistant',
            content: '⚠️ Пустой ответ от сервера.',
          });
        } else {
          setStreaming(true);
          let acc = '';
          const decoder = new TextDecoder();
          
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              acc += decoder.decode(value, { stream: true });
              pushPartial(currentChat.id, acc);
            }
          } finally {
            setStreaming(false);
          }
        }
      }
    } catch (e: any) {
      pushMessage(currentChat.id, {
        role: 'assistant',
        content: `❌ Ошибка сети: ${e?.message || 'Неизвестная ошибка'}`,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [currentChat, sending, streaming, input]);

  // ------------------ ФУНКЦИИ РАБОТЫ С ЧАТАМИ ------------------
  const pushMessage = useCallback((id: string, msg: Msg) => {
    setChats((arr) =>
      arr.map((c) => {
        if (c.id !== id) return c;
        
        // Обновляем заголовок чата на основе первого сообщения
        const messages = [...c.messages, msg];
        let title = c.title;
        if (messages.length === 1 && msg.role === 'user') {
          title = msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : '');
        }
        
        return { ...c, messages, title };
      })
    );
  }, []);

  const pushPartial = useCallback((id: string, text: string) => {
    setChats((arr) =>
      arr.map((c) => {
        if (c.id !== id) return c;
        
        const last = c.messages[c.messages.length - 1];

        // Если последним был пользователь или нет сообщений - создаём новое от ассистента
        if (!last || last.role !== 'assistant') {
          return { ...c, messages: [...c.messages, { role: 'assistant', content: text }] };
        }

        // Обновляем последнее сообщение ассистента
        const updated = [...c.messages];
        updated[updated.length - 1] = { ...last, content: text };
        return { ...c, messages: updated };
      })
    );
  }, []);

  const clearChat = useCallback((id: string) => {
    setChats((arr) => arr.map((c) => (c.id === id ? { ...c, messages: [] } : c)));
  }, []);

  const newChat = useCallback(() => {
    const nc = emptyChat();
    setChats((arr) => [nc, ...arr]);
    setCurrentId(nc.id);
    setInput('');
    textareaRef.current?.focus();
  }, []);

  const deleteChat = useCallback((id: string) => {
    setChats((arr) => {
      const filtered = arr.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const nc = emptyChat();
        setCurrentId(nc.id);
        return [nc];
      }
      if (currentId === id) setCurrentId(filtered[0].id);
      return filtered;
    });
  }, [currentId]);

  // ------------------ КОПИРОВАНИЕ В БУФЕР ------------------
  const copyMessage = useCallback(async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyNotification(msgId);
      setTimeout(() => setCopyNotification(null), 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
    }
  }, []);

  // ------------------ МИКРОФОН ------------------
  const toggleRec = useCallback(() => {
    setRecOn((on) => !on);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (recOn && !recRef.current) {
      const r: SpeechRec = new SR();
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
        if (final) {
          setInput((prev) => (prev ? prev + ' ' + final : final));
        }
      };
      
      r.onerror = (e: any) => {
        console.error('Ошибка распознавания речи:', e);
        setRecOn(false);
      };
      
      r.onend = () => {
        setRecOn(false);
        recRef.current = null;
      };
      
      recRef.current = r;
      try {
        r.start();
      } catch (err) {
        console.error('Не удалось запустить распознавание речи:', err);
        setRecOn(false);
      }
    }
    
    if (!recOn && recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
  }, [recOn]);

  // ------------------ ОБРАБОТКА КЛАВИАТУРЫ ------------------
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ------------------ АВТОИЗМЕНЕНИЕ ВЫСОТЫ TEXTAREA ------------------
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // ------------------ РЕНДЕР ------------------
  return (
    <div className="flex h-full">
      {/* Сайдбар */}
      <aside
        className={`border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 w-72 shrink-0 transition-all duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-72'
        }`}
      >
        <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="font-semibold text-zinc-800 dark:text-zinc-100">Диалоги</div>
          <button
            className="p-2 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => setSidebarOpen((s) => !s)}
            title="Скрыть/показать"
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="p-2 space-y-2">
          <button
            onClick={newChat}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-zinc-100 hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Новый чат
          </button>

          <div className="mt-2 space-y-1 max-h-[calc(100vh-120px)] overflow-y-auto">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  currentId === c.id
                    ? 'bg-zinc-200/70 dark:bg-zinc-800'
                    : 'hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate flex-1">{c.title || 'Новый чат'}</span>
                  <button
                    className="p-1 rounded hover:bg-zinc-300/60 dark:hover:bg-zinc-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(c.id);
                    }}
                    title="Удалить чат"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {c.messages.length > 0 
                    ? `${c.messages.length} сообщений`
                    : 'Пусто'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Основная панель */}
      <main className="flex-1 min-h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded hover:bg-zinc-800 md:hidden transition-colors"
              onClick={() => setSidebarOpen((s) => !s)}
            >
              <Menu size={18} />
            </button>
            <h1 className="text-lg font-semibold">AI Assistant Chat</h1>
          </div>
          {streaming && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 size={14} className="animate-spin" />
              <span>Генерация ответа...</span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {currentChat?.messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <div className="text-center">
                <p className="text-lg mb-2">Начните новый диалог</p>
                <p className="text-sm">Введите сообщение ниже</p>
              </div>
            </div>
          )}
          
          {currentChat?.messages.map((m, i) => {
            const messageId = `${currentChat.id}-${i}`;
            return (
              <div
                key={i}
                className={`mb-4 max-w-3xl ${
                  m.role === 'user' ? 'ml-auto' : ''
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    m.role === 'user'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'bg-zinc-100 text-zinc-900'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 transition-colors"
                    onClick={() => copyMessage(messageId, m.content)}
                  >
                    <Copy size={14} />
                    {copyNotification === messageId ? 'Скопировано!' : 'Копировать'}
                  </button>
                </div>
              </div>
            );
          })}
          
          {sending && !streaming && (
            <div className="mb-4 max-w-3xl">
              <div className="rounded-2xl px-4 py-3 bg-zinc-100 text-zinc-900">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Обработка запроса...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>

        <footer className="border-t border-zinc-800 p-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <button
              className={`p-2 rounded-lg border border-zinc-700 transition-colors ${
                recOn 
                  ? 'bg-red-900 border-red-700 text-red-100' 
                  : 'hover:bg-zinc-800'
              }`}
              onClick={toggleRec}
              title={recOn ? 'Остановить запись' : 'Начать запись'}
              disabled={sending}
            >
              <Mic size={18} />
            </button>
            <button
              className="p-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
              title="Прикрепить файл"
              disabled={sending}
            >
              <Paperclip size={18} />
            </button>
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-500 transition-all"
                rows={1}
                placeholder={recOn ? "Говорите..." : "Напишите сообщение…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={sending}
              />
            </div>
            <button
              className="p-3 rounded-xl bg-zinc-100 text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
              onClick={sendMessage}
              disabled={sending || streaming || !input.trim()}
              title="Отправить"
            >
              {sending || streaming ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          
          {currentChat && currentChat.messages.length > 0 && (
            <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between">
              <button
                className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
                onClick={() => clearChat(currentChat.id)}
                title="Очистить историю текущего диалога"
              >
                <Trash2 size={14} /> Очистить чат
              </button>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}
