'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type Role = 'user' | 'assistant';

type Msg = {
  id: string;
  role: Role;
  content: string;
  imagePreview?: string | null;
};

const STORAGE_KEY = 'chat-history-v1';
const THEME_ATTR = 'data-theme';

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Переключатель "распознавание в браузере" (оставляем как визуальный тумблер)
  const [browserSTT, setBrowserSTT] = useState(true);

  // Тема (light/dark), хранится на <html data-theme="...">
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return (document.documentElement.getAttribute(THEME_ATTR) as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  // === История: поднимаем при монтировании ===
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Msg[] = JSON.parse(raw);
        setMessages(parsed);
      } else {
        // Если истории нет — показываем привет от бота
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'Привет! Я твой личный ИИ-помощник по **коксохим-производству**. ' +
              'Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.',
          },
        ]);
      }
    } catch {
      // игнор
    }
  }, []);

  // Сохраняем историю после любого изменения
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // игнор
    }
  }, [messages]);

  // Тема — сразу на html
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(THEME_ATTR, theme);
    }
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !file) return;

    // Подготовим превью для UI
    let preview: string | null = null;
    if (file) {
      preview = URL.createObjectURL(file);
    }

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed || (file ? '(изображение)' : ''),
      imagePreview: preview,
    };
    setMessages((m) => [...m, userMsg]);
    setText('');
    setIsSending(true);

    // Готовим картинку в base64 для API
    let imageBase64: string | null = null;
    let imageType: string | null = null;
    if (file) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      imageBase64 = btoa(String.fromCharCode(...bytes));
      imageType = file.type || 'image/png';
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          imageBase64,
          imageType,
          browserSTT, // просто прокинем флажок (на будущее)
        }),
      });

      if (!res.ok) throw new Error('bad response');
      const data = await res.json();

      const bot: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: String(data.text || '…'),
      };
      setMessages((m) => [...m, bot]);
    } catch (e) {
      const err: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Не удалось получить ответ от модели. Проверьте баланс API-ключа в OpenAI Billing и переменную `OPENAI_API_KEY` на Vercel.',
      };
      setMessages((m) => [...m, err]);
    } finally {
      setIsSending(false);
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function newChat() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Привет! Я твой личный ИИ-помощник по **коксохим-производству**. ' +
          'Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.',
      },
    ]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return (
    <div className="chat-root">
      {/* Шапка */}
      <div className="chat-topbar">
        <div className="title">Ваш ассистент</div>
        <div className="actions">
          <label className="check">
            <input
              type="checkbox"
              checked={browserSTT}
              onChange={(e) => setBrowserSTT(e.target.checked)}
            />
            <span>Распознавание в браузере</span>
          </label>

          <button className="btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная'}
          </button>

          <button className="btn ghost" onClick={newChat}>
            Новый чат
          </button>
        </div>
      </div>

      {/* Лента */}
      <div className="chat-list">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}>
            {m.imagePreview && (
              <div className="img">
                {/* превью вложения пользователя */}
                <img src={m.imagePreview} alt="attachment" />
              </div>
            )}
            {m.content && (
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {m.content}
              </ReactMarkdown>
            )}
          </div>
        ))}
      </div>

      {/* Композер */}
      <div className="composer">
        <label className="file">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? 'Файл: ' + file.name : '📎 Прикрепить фото'}
        </label>

        <textarea
          placeholder="Спросите что-нибудь…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <button className="btn primary" onClick={handleSend} disabled={isSending}>
          {isSending ? 'Отправка…' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}

/* ====== Стили компонента (минимально, под переменные темы) ====== */
