cat > /mnt/user-data/outputs/Chat_ИСПРАВЛЕННЫЙ_С_ОТЛАДКОЙ.tsx << 'EOF'
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Markdown from './Markdown';
import AudioVisualizer from './AudioVisualizer';
import {
  Copy, Mic, Send, Trash2, Plus, Menu, Search, Clock, List,
} from 'lucide-react';

type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; messages: Msg[]; updatedAt: number };

const STORAGE_KEY = 'chats_v2';

const genId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export default function Chat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recOn, setRecOn] = useState(false);
  const [query, setQuery] = useState('');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const [composerH, setComposerH] = useState<number>(88);

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentId) || null,
    [chats, currentId]
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<any>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // ---------- загрузка/сохранение ----------
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
        const ordered = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        setChats(ordered);
        setCurrentId(ordered[0].id);
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

  // автопрокрутка к низу при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [currentChat?.messages.length]);

  // ---------- авто-высота textarea ----------
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0px';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
    measureComposer();
  }, [input]);

  useEffect(() => {
    if (!composerRef.current) return;
    const ro = new ResizeObserver(() => measureComposer());
    ro.observe(composerRef.current);
    const onResize = () => measureComposer();
    window.addEventListener('resize', onResize);
    measureComposer();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [composerRef.current]);

  function measureComposer() {
    const node = composerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setComposerH(Math.max(56, Math.round(rect.height)));
  }

  // ---------- отправка ----------
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
        body: JSON.stringify({ messages: [...currentChat.messages, userMsg] }),
      });

      if (!res.ok) {
        const err = await safeText(res);
        pushMessage(currentChat.id, {
          role: 'assistant',
          content: `Ошибка ответа сервера.\n\n${err || '(пусто)'}`,
        });
      } else {
        const reader = res.body?.getReader();
        if (!reader) {
          pushMessage(currentChat.id, {
            role: 'assistant',
            content: 'Пустой ответ сервера.',
          });
        } else {
          let acc = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            acc += new TextDecoder().decode(value);
            pushPartial(currentChat.id, acc);
          }
        }
      }
    } catch (e: any) {
      pushMessage(currentChat.id, {
        role: 'assistant',
        content: `Сеть/исключение: ${String(e?.message ?? e)}`,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  // ---------- мутации чата ----------
  function touchChat(id: string, updater: (c: Chat) => Chat) {
    setChats((arr) =>
      arr
        .map((c) => (c.id === id ? updater({ ...c }) : c))
        .map((c) => (c.id === id ? { ...c, updatedAt: Date.now() } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }

  function pushMessage(id: string, msg: Msg) {
    touchChat(id, (c) => ({ ...c, messages: [...c.messages, msg] }));
  }

  function pushPartial(id: string, text: string) {
    touchChat(id, (c) => {
      const last = c.messages[c.messages.length - 1];
      if (!last || last.role !== 'assistant') {
        return { ...c, messages: [...c.messages, { role: 'assistant', content: text }] };
      }
      const updated = [...c.messages];
      updated[updated.length - 1] = { ...last, content: text };
      return { ...c, messages: updated };
    });
  }

  function newChat() {
    const nc = emptyChat();
    setChats((arr) => [nc, ...arr]);
    setCurrentId(nc.id);
    setInput('');
    textareaRef.current?.focus();
  }

  function deleteChat(id: string) {
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
  }

  // ---------- микрофон с эквалайзером ----------
  function toggleRec() {
    console.log('🎤 Toggle rec, current recOn:', recOn);
    setRecOn((on) => !on);
  }

  useEffect(() => {
    console.log('🎤 Mic effect, recOn:', recOn);
    
    if (typeof window === 'undefined') return;
    
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.error('❌ SpeechRecognition не поддерживается браузером');
      return;
    }

    if (recOn && !recRef.current) {
      console.log('🎤 Запуск микрофона...');
      
      // Получаем доступ к микрофону
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          console.log('✅ Микрофон получен:', stream);
          streamRef.current = stream;
          
          // Инициализируем AudioContext
          const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyserNode = ac.createAnalyser();
          analyserNode.fftSize = 256;
          
          // Подключаем поток к анализатору
          const source = ac.createMediaStreamAudioSource(stream);
          sourceRef.current = source;
          source.connect(analyserNode);
          analyserNode.connect(ac.destination);
          
          setAudioContext(ac);
          setAnalyser(analyserNode);
          
          console.log('✅ AudioContext инициализирован');
          
          // Запускаем Speech Recognition
          const r = new SR();
          r.continuous = true;
          r.interimResults = true;
          r.lang = 'ru-RU';
          
          r.onstart = () => {
            console.log('✅ Speech Recognition запущен');
          };
          
          r.onresult = (e: any) => {
            console.log('📝 Результат распознавания:', e.results);
            let final = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const chunk = e.results[i][0].transcript;
              console.log('  └─ Транскрипт:', chunk, 'Final:', e.results[i].isFinal);
              if (e.results[i].isFinal) {
                final += chunk + ' ';
              }
            }
            if (final) {
              console.log('✅ Финальный текст:', final);
              setInput((prev) => (prev ? prev + ' ' + final : final));
            }
          };
          
          r.onerror = (e: any) => {
            console.error('❌ Ошибка Speech Recognition:', e.error);
          };
          
          r.onend = () => {
            console.log('⏹️  Speech Recognition закончился');
            setRecOn(false);
            recRef.current = null;
          };
          
          r.start();
          recRef.current = r;
          console.log('✅ Speech Recognition запущен');
        })
        .catch((err) => {
          console.error('❌ Ошибка доступа к микрофону:', err);
          alert('Микрофон не доступен. Проверь разрешения браузера в настройках.');
          setRecOn(false);
        });
    } else if (!recOn && recRef.current) {
      console.log('⏹️  Остановка микрофона...');
      
      if (recRef.current) {
        recRef.current.stop();
        recRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          console.log('⏹️  Останавливаю трек:', track.kind);
          track.stop();
        });
        streamRef.current = null;
      }
      
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      
      console.log('✅ Микрофон остановлен');
    }
  }, [recOn]);

  // ---------- UI ----------
  const showGreeting = (currentChat?.messages.length ?? 0) === 0;
  const filteredChats = chats.filter((c) =>
    (c.title || 'Новый чат').toLowerCase().includes(query.toLowerCase())
  );

  const mainClasses = clsx(
    'flex-1 min-w-0 flex flex-col bg-bg transition-[margin] duration-200',
    { 'md:ml-72': sidebarOpen }
  );

  return (
    <div className="relative min-h-[100dvh]">
      {/* Мобильный бекдроп для закрытия меню тапом */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Плавающая кнопка гамбургера (когда меню скрыто) */}
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

      {/* Сайдбар */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-panel transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!sidebarOpen}
      >
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

        <div className="p-3 space-y-3">
          <button
            onClick={newChat}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-200 text-zinc-900 hover:opacity-90"
          >
            <Plus size={16} />
            Новый чат
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-2.5" size={16} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-panelAlt outline-none focus:ring-1 focus:ring-zinc-600"
              placeholder="Поиск по чатам…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-subtext">
            <Clock size={16} /> Недавние
          </div>

          <div className="space-y-1">
            {filteredChats.map((c) => (
              <div
                key={c.id}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg hover:bg-panelAlt cursor-pointer',
                  currentId === c.id && 'bg-panelAlt'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="flex-1 text-left truncate"
                    onClick={() => setCurrentId(c.id)}
                    title="Открыть чат"
                  >
                    {c.title || 'Новый чат'}
                  </button>
                  <button
                    className="p-1 rounded hover:bg-zinc-800"
                    onClick={() => deleteChat(c.id)}
                    title="Удалить чат"
                    aria-label="Удалить чат"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-subtext truncate">
                  {c.messages[c.messages.length - 1]?.content || 'Пусто'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-subtext pt-2 border-t border-border">
            <List size={16} /> Все чаты
          </div>
        </div>
      </aside>

      {/* Основная панель */}
      <main className={mainClasses}>
        {/* Верхняя линия */}
        <header className="safe-top flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            className="p-2 rounded hover:bg-panelAlt"
            onClick={() => setSidebarOpen((s) => !s)}
            title="Меню"
            aria-label="Меню"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-lg font-semibold">AI Assistant Chat</h1>
        </header>

        {/* Сообщения: отдельная прокрутка, нижний паддинг = высоте композитора */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden p-4"
          style={{ paddingBottom: composerH + 16 }}
        >
          {/* Приветственный экран */}
          {showGreeting && (
            <div className="max-w-3xl mx-auto mt-10 text-center animate-fadeIn">
              <h2 className="text-3xl font-semibold mb-2">Здравствуйте, чем могу помочь сегодня?</h2>
              <p className="text-subtext">Введите вопрос ниже — и начнём.</p>
            </div>
          )}

          {/* Сообщения */}
          <div className="max-w-3xl mx-auto">
            {currentChat?.messages.map((m, i) => (
              <div key={i} className={clsx('group mb-4 max-w-3xl', m.role === 'user' && 'ml-auto')}>
                <div className={clsx('msg', m.role === 'user' ? 'msg-user' : 'msg-assistant')}>
                  {m.role === 'assistant' ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                <div className="msg-actions flex items-center gap-3">
                  <button
                    className="inline-flex items-center gap-1 hover:text-zinc-200"
                    onClick={() => copyToClipboard(m.content)}
                    title="Скопировать"
                    aria-label="Скопировать сообщение"
                  >
                    <Copy size={14} /> Скопировать
                  </button>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      {/* НИЖНЯЯ ПАНЕЛЬ */}
      <div
        ref={composerRef}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel"
      >
        <div className="max-w-3xl mx-auto p-3">
          {/* Эквалайзер (если микрофон активен) */}
          {recOn && (
            <div className="mb-3 flex justify-center">
              <AudioVisualizer isActive={recOn} audioContext={audioContext || undefined} analyser={analyser || undefined} />
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Большая кнопка микрофона слева */}
            <button
              className={clsx(
                'p-4 rounded-xl border-2 transition-all duration-200 flex-shrink-0',
                recOn
                  ? 'bg-red-500 border-red-600 hover:bg-red-600 scale-110'
                  : 'bg-panel border-border hover:bg-panelAlt'
              )}
              onClick={toggleRec}
              title={recOn ? 'Остановить запись' : 'Начать запись'}
              aria-label="Микрофон"
            >
              <Mic size={28} className={recOn ? 'text-white' : 'text-text'} />
            </button>

            {/* Поле для ввода текста в центре */}
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

            {/* Кнопка отправки справа */}
            <button
              className="p-4 rounded-xl bg-zinc-200 text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              title="Отправить"
              aria-label="Отправить"
            >
              <Send size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------- helpers ----------
  async function copyToClipboard(content: string) {
    try { await navigator.clipboard.writeText(content); } catch {}
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }

  function emptyChat(): Chat {
    return { id: genId(), title: 'Новый чат', messages: [], updatedAt: Date.now() };
  }
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ''; }
}
EOF
cat /mnt/user-data/outputs/Chat_ИСПРАВЛЕННЫЙ_С_ОТЛАДКОЙ.tsx | head -50
Output

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Markdown from './Markdown';
import AudioVisualizer from './AudioVisualizer';
import {
  Copy, Mic, Send, Trash2, Plus, Menu, Search, Clock, List,
} from 'lucide-react';

type Role = 'user' | 'assistant';
type Msg = { role: Role; content: string };
type Chat = { id: string; title: string; messages: Msg[]; updatedAt: number };

const STORAGE_KEY = 'chats_v2';

const genId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export default function Chat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recOn, setRecOn] = useState(false);
  const [query, setQuery] = useState('');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const [composerH, setComposerH] = useState<number>(88);

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentId) || null,
    [chats, currentId]
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<any>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // ---------- загрузка/сохранение ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
