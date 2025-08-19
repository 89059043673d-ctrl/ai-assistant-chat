"use client";

import React, { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Привет! Я твой личный ИИ-помощник по коксохим-производству. Задавай вопросы — помогу с расчётами, формулами и технологическими аспектами.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  // автопрокрутка вниз
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSending) return;

    const text = input.trim();
    if (!text && !file) return;

    // локально добавляем сообщение пользователя
    const nextMessages = [...messages, { role: "user", content: text || "📎 Файл" }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      // формируем тело запроса: текст + (по возможности) имя файла
      const body: any = { messages: nextMessages };
      if (file) {
        body.fileName = file.name;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // читаем ответ: пытаемся понять формат
      let assistantText = "";
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        assistantText =
          data.reply ?? data.message ?? data.content ?? "Не удалось разобрать ответ модели.";
      } else {
        assistantText = await res.text();
      }

      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Не удалось получить ответ от модели. Проверьте баланс API-ключа в OpenAI Billing и переменную окружения OPENAI_API_KEY на Vercel.",
        },
      ]);
    } finally {
      setIsSending(false);
      setFile(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter — отправка, Shift+Enter — новая строка
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Верхняя панель */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-medium">Ваш ассистент</div>
        <div className="text-xs text-zinc-500">Голос: готов</div>
      </div>

      {/* Лента сообщений */}
      <div ref={listRef} className="flex-1 overflow-auto px-3 py-4 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.map((m, i) => (
            <div key={i} className="flex">
              <div
                className={
                  m.role === "assistant"
                    ? "ml-0 mr-auto max-w-[90%] rounded-2xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800"
                    : "ml-auto mr-0 max-w-[90%] rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white"
                }
              >
                {
