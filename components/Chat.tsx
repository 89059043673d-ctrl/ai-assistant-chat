'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Mic, Send, Menu } from 'lucide-react';
import clsx from 'clsx';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Автоскролл вниз
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    // Добавляем сообщение пользователя
    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPending(true);

    try {
      // Готовим историю без каких-либо приветствий/системных фраз
      const historyToSend = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, history: historyToSend }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Bad response from server');
      }

      // Пустой ответ ассистента — будем наполнять по мере стрима
      let assistant: Msg = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistant]);
      const assistantIndex = messages.length + 1; // индекс только что добавленного ассистента

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        setMessages(prev => {
          const next = [...prev];
          const current = next[assistantIndex];
          if (current && current.role === 'assistant') {
            next[assistantIndex] = { ...current, content: current.content + chunk };
          }
          return next;
        });
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.',
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-neutral-50 text-neutral-900">
      {/* Кнопка выезда меню (само меню у вас уже есть) */}
      <button className="p-3" aria-label="menu">
        <Menu />
      </button>

      <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-2 px-3">
        {/* Заголовок */}
        <div className="py-3 text-center text-sm font-semibold">Мой ИИ-ассистент</div>

        {/* Приветствие — показываем только когда нет истории */}
        {messages.length === 0 && (
          <div className="pb-1 text-center text-sm text-neutral-500">Чем я могу помочь?</div>
        )}

        {/* Лента сообщений */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto rounded-lg bg-white p-3 shadow-sm"
        >
          {messages.map((m, i) => (
            <div key={i} className={clsx('mb-2 flex', m.role === 'user' ? 'justify-start' : 'justify-start')}>
              <div
                className={clsx(
                  'max-w-[85%] rounded-xl px-4 py-2',
                  m.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'
                )}
              >
                {m.content || (m.role === 'assistant' && pending ? '…' : '')}
              </div>
            </div>
          ))}
          {pending && (
            <div className="text-neutral-400 text-sm px-2">Модель печатает…</div>
          )}
        </div>

        {/* Поле ввода */}
        <form onSubmit={handleSend} className="flex items-center gap-2 py-3">
          <button
            type="button"
            className="rounded-full bg-white p-2 shadow-sm"
            aria-label="attach"
            title="Прикрепить"
          >
            <Paperclip size={18} />
          </button>

          <div className="relative flex-1">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Спросите что-нибудь…"
              className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 pr-20 shadow-sm outline-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button type="button" className="rounded-full p-2 text-neutral-500" title="Голос">
                <Mic size={18} />
              </button>
              <button
                type="submit"
                className="rounded-full bg-neutral-900 p-2 text-white disabled:opacity-50"
                disabled={pending || !input.trim()}
                title="Отправить"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
