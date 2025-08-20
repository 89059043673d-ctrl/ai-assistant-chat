'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Mic, Send } from 'lucide-react';

type Msg = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export default function Chat() {
  // Сообщения и ввод
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // === Антидубль: пока идёт отправка — вторую не пускаем ===
  const sendingRef = useRef(false);

  // Автопрокрутка вниз
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Enter — отправить; Shift+Enter — перенос
  const enterToSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  };

  // ЕДИНСТВЕННЫЙ обработчик отправки (только через onSubmit формы)
  const handleSend = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      if (e) e.preventDefault();
      if (sendingRef.current) return;

      const text = input.trim();
      if (!text) return;

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
    [input, messages]
  );

  // Прикрепление файла (иконка слева)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => fileInputRef.current?.click();

  // Микрофон (Web Speech API) — типы убраны, всё подстраховано
  const recRef = useRef<any>(null);
  const [recOn, setRecOn] = useState(false);

  useEffect(() => {
    if (!recOn) return;
    if (typeof window === 'undefined') return;

    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Верхняя панель */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-medium">Мой ИИ-ассистент</div>
      </div>

      {/* Список сообщений */}
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

      {/* Панель ввода снизу — только onSubmit формы */}
      <form onSubmit={handleSend} className="border-t border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
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
              onKeyDown={enterToSubmit}
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

          {/* Стрелка «Отправить» — НЕТ onClick, только submit */}
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
    </div>
  );
}
