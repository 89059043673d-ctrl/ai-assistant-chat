'use client';

import { useCallback, useRef, useState } from 'react';
import { Menu, Paperclip, Mic, Send } from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // флаг-защита от двойной отправки (клик + enter и т.п.)
  const sendingRef = useRef(false);

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();                // ← не даём форме «пузыриться»
    if (sendingRef.current) return;           // ← защита от дабл-клика
    const text = input.trim();
    if (!text) return;

    sendingRef.current = true;
    setIsSending(true);

    // сразу добавим сообщение пользователя в чат
    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      // ⚠️ тут оставь свой действующий вызов API (как у тебя было)
      // Ниже — безопасная заглушка, чтобы не ломать деплой при пустом биллинге
      // const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      // const data = await res.json();
      // const assistantText = data?.reply ?? '...';

      const assistantText =
        'Не удалось получить ответ от модели. Проверьте баланс OpenAI Billing и переменную OPENAI_API_KEY на Vercel.';

      const botMsg: Msg = { id: crypto.randomUUID(), role: 'assistant', content: assistantText };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const botMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Не удалось получить ответ от модели. Проверьте баланс OpenAI Billing и переменную OPENAI_API_KEY на Vercel.',
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  }, [input]);

  // Прикрепление файла — оставь свою реализацию, если уже есть
  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // TODO: твоя отправка файла
  }, []);

  // Микрофон — оставь свою реализацию, если уже есть
  const onMic = useCallback(() => {
    // TODO: твоя диктовка / распознавание
  }, []);

  return (
    <div className="flex h-dvh w-full">
      {/* Левая кнопка-«бургер» (твоя боковая панель истории чатов уже есть) */}
      <button
        type="button"
        className="fixed left-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 md:hidden"
        aria-label="Открыть меню"
      >
        <Menu size={20} />
      </button>

      {/* Основная колонка чата */}
      <div className="mx-auto flex h-full w-full max-w-screen-md flex-col px-3 pb-24 pt-16 md:pt-8">
        {/* Сообщения */}
        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === 'user'
                ? 'ml-auto max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'mr-auto max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-2 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'}
            >
              {m.content}
            </div>
          ))}
        </div>

        {/* ПАНЕЛЬ ВВОДА — единственный путь отправки: onSubmit формы */}
        <form
          onSubmit={handleSend}
          className="fixed inset-x-0 bottom-0 z-10 mx-auto mb-4 flex w-full max-w-screen-md items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_30px_rgba(0,0,0,0.06)] dark:bg-zinc-950"
        >
          {/* Скрепка (вне поля ввода) */}
          <label
            htmlFor="file"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900"
            title="Прикрепить файл"
          >
            <Paperclip size={20} />
            <input id="file" type="file" className="hidden" onChange={onPickFile} />
          </label>

          {/* Само поле: одиночная строка → Enter срабатывает как submit */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Спросите что-нибудь…"
            className="h-12 flex-1 rounded-xl border-0 bg-transparent px-3 text-[15px] outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            autoComplete="off"
            // никаких onKeyDown здесь не нужно — Enter сам запустит onSubmit
          />

          {/* Микрофон (по желанию) */}
          <button
            type="button"
            onClick={onMic}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900"
            title="Диктовка"
          >
            <Mic size={20} />
          </button>

          {/* Кнопка отправки — БЕЗ onClick, только type="submit" */}
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            title="Отправить"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
