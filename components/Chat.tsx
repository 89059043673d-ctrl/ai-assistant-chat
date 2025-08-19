'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Role = 'user' | 'assistant' | 'system';

type Msg = {
  id: string;
  role: Role;
  content: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Chat() {
  // История чатов (простая заглушка: один активный чат)
  const [threads, setThreads] = useState([{ id: 't1', title: 'Привет =)' }]);
  const [activeThreadId] = useState('t1');

  // Сообщения
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: uid(),
      role: 'assistant',
      content:
        'Привет! Я твой личный ИИ-помощник по **коксохим-производству**. Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.',
    },
  ]);

  // Ввод
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Файл (прикрепление)
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Автоскролл вниз
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Локально добавим сообщение пользователя
    const userMsg: Msg = { id: uid(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      // Собираем тело запроса
      const body: any = {
        messages: [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      // Если прикреплён файл — отправим как multipart/form-data (бэкенд должен уметь)
      let res: Response;

      if (file) {
        const form = new FormData();
        form.append('messages', JSON.stringify(body.messages));
        form.append('file', file);
        res = await fetch('/api/chat', { method: 'POST', body: form });
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantText: string =
        data?.message?.content ??
        data?.content ??
        '429 You exceeded your current quota, please check your plan and billing details.';

      const aiMsg: Msg = { id: uid(), role: 'assistant', content: assistantText };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      const aiMsg: Msg = {
        id: uid(),
        role: 'assistant',
        content:
          e?.message && /quota|429/i.test(e.message)
            ? '429 You exceeded your current quota, please check your plan and billing details.'
            : 'Не удалось получить ответ от модели. Проверьте баланс API-ключа в OpenAI Billing и переменную OPENAI_API_KEY на Vercel.',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setSending(false);
    }
  }, [file, input, messages, sending]);

  // Enter — отправить, Shift+Enter — новая строка
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Выбор файла
  const onPickFile = useCallback(() => fileInputRef.current?.click(), []);
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  // Тема (мгновенное переключение без перезагрузки)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Сохраним в localStorage
    try {
      localStorage.setItem('ai-theme', theme);
    } catch {}
  }, [theme]);
  // Восстановление темы
  useEffect(() => {
    try {
      const t = localStorage.getItem('ai-theme') as 'light' | 'dark' | null;
      if (t) setTheme(t);
    } catch {}
  }, []);

  // Вёрстка
  return (
    <div className="h-[100dvh] w-full flex bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Сайдбар с историей */}
      <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-3 hidden md:flex md:flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">История</div>
          <button
            className="text-xs px-2 py-1 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            onClick={() => {
              // Новый «чат» (пока просто меняем заголовок первого)
              setThreads((prev) => [{ id: 't1', title: 'Новый чат' }, ...prev.slice(1)]);
              setMessages([
                {
                  id: uid(),
                  role: 'assistant',
                  content:
                    'Привет! Я твой личный ИИ-помощник по **коксохим-производству**. Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.',
                },
              ]);
            }}
          >
            Новый чат
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`rounded px-2 py-2 text-sm cursor-default ${
                t.id === activeThreadId
                  ? 'bg-zinc-200 dark:bg-zinc-800 font-medium'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
              title={t.title}
            >
              {t.title}
            </div>
          ))}
        </div>

        {/* Переключатель темы */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <button
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            className="w-full rounded px-3 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm"
          >
            Тема: {theme === 'light' ? 'Светлая' : 'Тёмная'}
          </button>
        </div>
      </aside>

      {/* Основная область чата */}
      <main className="flex-1 flex flex-col">
        {/* Верхняя панель */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-medium">Ваш ассистент</div>
          <div className="hidden md:block">
            <span className="text-xs opacity-70">Голос: готов</span>
          </div>
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80ch] rounded-md px-3 py-2 ${
                m.role === 'assistant'
                  ? 'bg-zinc-100 dark:bg-zinc-800'
                  : 'bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
              }`}
            >
              {m.content}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Нижняя панель ввода */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <div className="mx-auto max-w-4xl flex items-end gap-2">
            {/* Кнопки слева */}
            <div className="flex items-center gap-1 pb-1">
              {/* Прикрепить файл */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFileChange}
              />
              <button
                onClick={onPickFile}
                className="h-9 w-9 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center"
                title={file ? `Файл: ${file.name}` : 'Прикрепить файл'}
              >
                📎
              </button>
              {/* Микрофон (заглушка UI) */}
              <button
                className="h-9 w-9 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center"
                title="Диктовка (в разработке)"
              >
                🎙️
              </button>
            </div>

            {/* Поле ввода */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Спросите что-нибудь…"
              className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600"
            />

            {/* Отправить */}
            <button
              disabled={sending || !input.trim()}
              onClick={handleSend}
              className="h-9 shrink-0 rounded-md bg-black px-4 text-sm text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {sending ? 'Отправка…' : 'Отправить'}
            </button>
          </div>

          {/* Инфострока под инпутом */}
          <div className="mx-auto max-w-4xl mt-2 text-[12px] opacity-60">
            Enter — отправить, Shift+Enter — новая строка. Прикрепление файла — по клику на 📎.
          </div>
        </div>
      </main>
    </div>
  );
}
