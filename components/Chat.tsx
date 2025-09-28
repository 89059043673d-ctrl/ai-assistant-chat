'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import clsx from 'clsx';
import Markdown from './Markdown';
import {
  Copy, Mic, Paperclip, Send, Trash2, Plus, Menu, Search, Clock, List,
  Check, RefreshCw, Download, Upload, Sun, Moon, Loader2
} from 'lucide-react';

// Enums и константы
enum Role {
  User = 'user',
  Assistant = 'assistant'
}

enum Theme {
  Light = 'light',
  Dark = 'dark'
}

const STORAGE_KEY = 'chats_v3';
const THEME_KEY = 'chat_theme';
const SHORTCUTS = {
  NEW_CHAT: 'ctrl+alt+n',
  TOGGLE_SIDEBAR: 'ctrl+alt+s',
  SEARCH: 'ctrl+k'
};

// Типы
interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  createdAt: number;
}

interface ChatState {
  chats: Chat[];
  currentId: string | null;
  theme: Theme;
}

// Утилиты
const genId = (): string => {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дней назад`;
  return date.toLocaleDateString('ru-RU');
};

const generateChatTitle = (firstMessage: string): string => {
  const cleaned = firstMessage.trim();
  if (cleaned.length <= 50) return cleaned;
  return cleaned.slice(0, 50) + '...';
};

// Компонент сообщения (мемоизированный)
const MessageItem = memo(({ 
  message, 
  onCopy, 
  onRegenerate 
}: { 
  message: Message; 
  onCopy: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content, onCopy]);

  return (
    <div className={clsx('group mb-4 animate-fadeIn', message.role === Role.User && 'ml-auto max-w-[80%]')}>
      <div className={clsx('msg', message.role === Role.User ? 'msg-user' : 'msg-assistant')}>
        {message.role === Role.Assistant ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
      <div className="msg-actions flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="inline-flex items-center gap-1 text-xs hover:text-zinc-200 transition-colors"
          onClick={handleCopy}
          title="Скопировать"
          aria-label="Скопировать сообщение"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Скопировано' : 'Скопировать'}
        </button>
        {message.role === Role.Assistant && onRegenerate && (
          <button
            className="inline-flex items-center gap-1 text-xs hover:text-zinc-200 transition-colors"
            onClick={() => onRegenerate(message.id)}
            title="Регенерировать"
            aria-label="Регенерировать ответ"
          >
            <RefreshCw size={14} /> Повторить
          </button>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// Основной компонент
export default function Chat() {
  // State
  const [state, setState] = useState<ChatState>({
    chats: [],
    currentId: null,
    theme: Theme.Dark
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recOn, setRecOn] = useState(false);
  const [query, setQuery] = useState('');
  const [composerH, setComposerH] = useState<number>(88);
  const [isTyping, setIsTyping] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Memoized values
  const currentChat = useMemo(
    () => state.chats.find((c) => c.id === state.currentId) || null,
    [state.chats, state.currentId]
  );

  const filteredChats = useMemo(
    () => state.chats.filter((c) =>
      (c.title || 'Новый чат').toLowerCase().includes(query.toLowerCase())
    ),
    [state.chats, query]
  );

  // Загрузка данных при монтировании
  useEffect(() => {
    loadFromStorage();
    loadTheme();
    setupKeyboardShortcuts();
  }, []);

  // Сохранение данных
  useEffect(() => {
    saveToStorage();
  }, [state.chats]);

  // Автопрокрутка
  useEffect(() => {
    if (currentChat?.messages.length) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [currentChat?.messages.length]);

  // Автовысота textarea
  useEffect(() => {
    adjustTextareaHeight();
    measureComposer();
  }, [input]);

  // Наблюдение за размером композитора
  useEffect(() => {
    if (!composerRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => measureComposer());
    resizeObserver.observe(composerRef.current);
    
    const handleResize = () => measureComposer();
    window.addEventListener('resize', handleResize);
    
    measureComposer();
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Голосовой ввод
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recOn && !recRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setInput((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
        }
      };
      
      recognition.onerror = () => {
        setRecOn(false);
        recRef.current = null;
      };
      
      recognition.onend = () => {
        setRecOn(false);
        recRef.current = null;
      };
      
      recRef.current = recognition;
      recognition.start();
    } else if (!recOn && recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
  }, [recOn]);

  // Функции
  const loadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initialChat = createEmptyChat();
        setState(prev => ({
          ...prev,
          chats: [initialChat],
          currentId: initialChat.id
        }));
        return;
      }
      
      const parsed: Chat[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sorted = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        setState(prev => ({
          ...prev,
          chats: sorted,
          currentId: sorted[0].id
        }));
      } else {
        const initialChat = createEmptyChat();
        setState(prev => ({
          ...prev,
          chats: [initialChat],
          currentId: initialChat.id
        }));
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      const initialChat = createEmptyChat();
      setState(prev => ({
        ...prev,
        chats: [initialChat],
        currentId: initialChat.id
      }));
    }
  }, []);

  const saveToStorage = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats));
    } catch (error) {
      console.error('Failed to save chats:', error);
    }
  }, [state.chats]);

  const loadTheme = useCallback(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
    if (savedTheme) {
      setState(prev => ({ ...prev, theme: savedTheme }));
      document.documentElement.classList.toggle('light-theme', savedTheme === Theme.Light);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setState(prev => {
      const newTheme = prev.theme === Theme.Dark ? Theme.Light : Theme.Dark;
      localStorage.setItem(THEME_KEY, newTheme);
      document.documentElement.classList.toggle('light-theme', newTheme === Theme.Light);
      return { ...prev, theme: newTheme };
    });
  }, []);

  const setupKeyboardShortcuts = useCallback(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        switch(e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            createNewChat();
            break;
          case 's':
            e.preventDefault();
            setSidebarOpen(prev => !prev);
            break;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.search-input')?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '0px';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const measureComposer = useCallback(() => {
    const node = composerRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      setComposerH(Math.max(56, Math.round(rect.height)));
    }
  }, []);

  const createEmptyChat = useCallback((): Chat => {
    const now = Date.now();
    return {
      id: genId(),
      title: 'Новый чат',
      messages: [],
      updatedAt: now,
      createdAt: now
    };
  }, []);

  const createNewChat = useCallback(() => {
    const newChat = createEmptyChat();
    setState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
      currentId: newChat.id
    }));
    setInput('');
    textareaRef.current?.focus();
  }, [createEmptyChat]);

  const deleteChat = useCallback((id: string) => {
    setState(prev => {
      const filtered = prev.chats.filter(c => c.id !== id);
      if (filtered.length === 0) {
        const newChat = createEmptyChat();
        return {
          ...prev,
          chats: [newChat],
          currentId: newChat.id
        };
      }
      const newCurrentId = prev.currentId === id ? filtered[0].id : prev.currentId;
      return {
        ...prev,
        chats: filtered,
        currentId: newCurrentId
      };
    });
  }, [createEmptyChat]);

  const updateChat = useCallback((id: string, updater: (chat: Chat) => Chat) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats
        .map(c => c.id === id ? { ...updater(c), updatedAt: Date.now() } : c)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    }));
  }, []);

  const sendMessage = useCallback(async () => {
    if (!currentChat || sending) return;
    
    const text = input.trim();
    if (!text) return;

    setSending(true);
    setInput('');
    setIsTyping(true);

    const userMessage: Message = {
      id: genId(),
      role: Role.User,
      content: text,
      timestamp: Date.now()
    };

    // Автогенерация заголовка для первого сообщения
    const shouldGenerateTitle = currentChat.messages.length === 0;
    
    updateChat(currentChat.id, chat => ({
      ...chat,
      messages: [...chat.messages, userMessage],
      title: shouldGenerateTitle ? generateChatTitle(text) : chat.title
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...currentChat.messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      setIsTyping(false);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Неизвестная ошибка');
        const errorMessage: Message = {
          id: genId(),
          role: Role.Assistant,
          content: `Ошибка сервера: ${errorText}`,
          timestamp: Date.now()
        };
        updateChat(currentChat.id, chat => ({
          ...chat,
          messages: [...chat.messages, errorMessage]
        }));
      } else {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        let accumulatedContent = '';
        const assistantMessageId = genId();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          accumulatedContent += decoder.decode(value, { stream: true });
          
          updateChat(currentChat.id, chat => {
            const existingMessages = [...chat.messages];
            const lastMessage = existingMessages[existingMessages.length - 1];
            
            if (lastMessage?.role === Role.Assistant && lastMessage.id === assistantMessageId) {
              existingMessages[existingMessages.length - 1] = {
                ...lastMessage,
                content: accumulatedContent
              };
            } else {
              existingMessages.push({
                id: assistantMessageId,
                role: Role.Assistant,
                content: accumulatedContent,
                timestamp: Date.now()
              });
            }
            
            return { ...chat, messages: existingMessages };
          });
        }
      }
    } catch (error) {
      setIsTyping(false);
      const errorMessage: Message = {
        id: genId(),
        role: Role.Assistant,
        content: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        timestamp: Date.now()
      };
      updateChat(currentChat.id, chat => ({
        ...chat,
        messages: [...chat.messages, errorMessage]
      }));
    } finally {
      setSending(false);
      setIsTyping(false);
      textareaRef.current?.focus();
    }
  }, [currentChat, sending, input, updateChat]);

  const regenerateMessage = useCallback(async (messageId: string) => {
    if (!currentChat || sending) return;
    
    const messageIndex = currentChat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Удаляем сообщение ассистента и все после него
    const messagesBeforeAssistant = currentChat.messages.slice(0, messageIndex);
    const lastUserMessage = [...messagesBeforeAssistant].reverse().find(m => m.role === Role.User);
    
    if (!lastUserMessage) return;
    
    updateChat(currentChat.id, chat => ({
      ...chat,
      messages: messagesBeforeAssistant
    }));
    
    // Повторно отправляем последнее сообщение пользователя
    setInput(lastUserMessage.content);
    setTimeout(() => sendMessage(), 100);
  }, [currentChat, sending, updateChat, sendMessage]);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const exportChats = useCallback(() => {
    const dataStr = JSON.stringify(state.chats, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chats_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [state.chats]);

  const importChats = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          setState(prev => ({
            ...prev,
            chats: [...imported, ...prev.chats].sort((a, b) => b.updatedAt - a.updatedAt)
          }));
        }
      } catch (error) {
        console.error('Failed to import chats:', error);
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // UI
  const showGreeting = !currentChat?.messages.length;
  const mainClasses = clsx(
    'flex-1 min-w-0 flex flex-col bg-bg transition-[margin] duration-200',
    sidebarOpen && 'md:ml-72'
  );

  return (
    <div className="relative min-h-[100dvh]">
      {/* Мобильный бекдроп */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Кнопка меню (когда скрыто) */}
      {!sidebarOpen && (
        <button
          className="fab-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="Открыть меню"
          title="Меню (Ctrl+Alt+S)"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Сайдбар */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-panel transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="font-semibold">Диалоги</div>
          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded hover:bg-panelAlt"
              onClick={toggleTheme}
              title="Сменить тему"
              aria-label="Сменить тему"
            >
              {state.theme === Theme.Dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="p-2 rounded hover:bg-panelAlt"
              onClick={exportChats}
              title="Экспорт чатов"
              aria-label="Экспорт"
            >
              <Download size={16} />
            </button>
            <label className="p-2 rounded hover:bg-panelAlt cursor-pointer">
              <Upload size={16} />
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={importChats}
              />
            </label>
            <button
              className="p-2 rounded hover:bg-panelAlt"
              onClick={() => setSidebarOpen(false)}
              title="Скрыть (Ctrl+Alt+S)"
              aria-label="Скрыть меню"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          <button
            onClick={createNewChat}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-200 text-zinc-900 hover:opacity-90"
            title="Новый чат (Ctrl+Alt+N)"
          >
            <Plus size={16} />
            Новый чат
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-subtext" size={16} />
            <input
              className="search-input w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-panelAlt outline-none focus:ring-1 focus:ring-zinc-600"
              placeholder="Поиск (Ctrl+K)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-subtext">
            <Clock size={16} /> Недавние
          </div>

          <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg hover:bg-panelAlt cursor-pointer transition-colors',
                  state.currentId === chat.id && 'bg-panelAlt'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="flex-1 text-left truncate"
                    onClick={() => setState(prev => ({ ...prev, currentId: chat.id }))}
                    title={chat.title}
                  >
                    {chat.title || 'Новый чат'}
                  </button>
                  <button
                    className="p-1 rounded hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    title="Удалить чат"
                    aria-label="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-subtext truncate">
                  {chat.messages[chat.messages.length - 1]?.content || 'Пусто'}
                </div>
                <div className="text-xs text-subtext/70 mt-1">
                  {formatDate(chat.updatedAt)}
                </div>
              </div>
            ))}
          </div>

          {filteredChats.length === 0 && (
            <div className="text-center text-sm text-subtext py-4">
              Чаты не найдены
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-subtext pt-2 border-t border-border">
            <List size={16} /> Всего: {state.chats.length}
          </div>
        </div>
      </aside>

      {/* Основная панель */}
      <main className={mainClasses}>
        <header className="safe-top flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            className="p-2 rounded hover:bg-panelAlt"
            onClick={() => setSidebarOpen(prev => !prev)}
            title="Меню (Ctrl+Alt+S)"
            aria-label="Меню"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-lg font-semibold flex-1">
            {currentChat?.title || 'AI Assistant Chat'}
          </h1>
          {currentChat && (
            <div className="text-xs text-subtext">
              {currentChat.messages.length} сообщений
            </div>
          )}
        </header>

        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ paddingBottom: composerH + 16 }}
        >
          {showGreeting && (
            <div className="max-w-3xl mx-auto mt-10 text-center animate-fadeIn">
              <h2 className="text-3xl font-semibold mb-2">Здравствуйте! Чем могу помочь?</h2>
              <p className="text-subtext mb-4">Введите вопрос ниже, чтобы начать диалог</p>
              <div className="text-xs text-subtext/70 space-y-1">
                <div>💡 Совет: используйте Shift+Enter для новой строки</div>
                <div>⌨️ Горячие клавиши: Ctrl+Alt+N (новый чат), Ctrl+K (поиск)</div>
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto">
            {currentChat?.messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onCopy={copyToClipboard}
                onRegenerate={message.role === Role.Assistant ? regenerateMessage : undefined}
              />
            ))}
            
            {isTyping && (
              <div className="flex items-center gap-2 text-subtext mb-4 animate-fadeIn">
                <Loader2 className="animate-spin" size={16} />
                <span>Ассистент печатает...</span>
              </div>
            )}
            
            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      {/* Композитор */}
      <div
        ref={composerRef}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel"
      >
        <div className="max-w-3xl mx-auto p-3">
          <div className="flex items-end gap-2">
            <button
              className={clsx('icon-btn', recOn && 'bg-red-900 text-red-100')}
              onClick={() => setRecOn(prev => !prev)}
              title="Голосовой ввод"
              aria-label="Микрофон"
            >
              <Mic size={18} />
            </button>
            
            <button 
              className="icon-btn" 
              title="Прикрепить файл" 
              aria-label="Прикрепить"
            >
              <Paperclip size={18} />
            </button>

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                className="w-full max-h-52 resize-none rounded-xl border border-border bg-panelAlt p-3 outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
                rows={1}
                placeholder={recOn ? "Говорите..." : "Нап
