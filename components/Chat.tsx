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
  const han
