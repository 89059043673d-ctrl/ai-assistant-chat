"use client";

import Markdown from "./Markdown";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Paperclip, Send, Mic, Trash2 } from "lucide-react";
import clsx from "clsx";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };
type ChatSession = { id: string; title: string; created: number; messages: Msg[] };

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const LS_OLD = "chat.history.v1";
const LS_SESS = "chat.sessions.v1";

export default function Chat() {
  // ---------- sessions ----------
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // ---------- input state ----------
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // attachments
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedNames, setAttachedNames] = useState<string[]>([]);

  // mic
  const recRef = useRef<any>(null);
  const [recOn, setRecOn] = useState(false);
  const lastFinalRef = useRef<string>("");

  // ---------- refs/state for autoscroll ----------
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showDown, setShowDown] = useState(false);

  function scrollToBottom(smooth = true) {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // ---------- init / migration ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SESS);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length) {
          setSessions(parsed);
          setCurrentId(parsed[0].id);
          return;
        }
      }
      const oldRaw = localStorage.getItem(LS_OLD);
      if (oldRaw) {
        const msgs = JSON.parse(oldRaw) as Msg[];
        const title =
          msgs.find((m) => m.role === "user")?.content?.slice(0, 40) ||
          "Новый чат";
        const sess: ChatSession = {
          id: crypto.randomUUID(),
          title,
          created: Date.now(),
          messages: Array.isArray(msgs) ? msgs : [],
        };
        setSessions([sess]);
        setCurrentId(sess.id);
        localStorage.setItem(LS_SESS, JSON.stringify([sess]));
      } else {
        const sess: ChatSession = {
          id: crypto.randomUUID(),
          title: "Новый чат",
          created: Date.now(),
          messages: [],
        };
        setSessions([sess]);
        setCurrentId(sess.id);
        localStorage.setItem(LS_SESS, JSON.stringify([sess]));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sessions.length) localStorage.setItem(LS_SESS, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  const current = useMemo(
    () => sessions.find((s) => s.id === currentId) || null,
    [sessions, currentId]
  );

  // удобный алиас для массива сообщений
  const messages = current?.messages ?? [];

  // ---------- autoscroll effects ----------
  // Всегда докручивать вниз, когда меняются сообщения
  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  // Показывать/прятать кнопку «вниз» по прокрутке
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
      setShowDown(!nearBottom);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // первичная инициализация
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const setCurrentMessages = (fn: (prev: Msg[]) => Msg[]) => {
    if (!current) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === current.id ? { ...s, messages: fn(s.messages) } : s
      )
    );
  };

  // ---------- helpers ----------
  const onPickFile = () => fileInputRef.current?.click();
  const onFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    if (names.length) setAttachedNames(names);
  };

  const newChat = () => {
    const sess: ChatSession = {
      id: crypto.randomUUID(),
      title: "Новый чат",
      created: Date.now(),
      messages: [],
    };
    setSessions((prev) => [sess, ...prev]);
    setCurrentId(sess.id);
    setText("");
    setAttachedNames([]);
    setSidebarOpen(false);
  };

  const deleteChat = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const nextId = next[0]?.id ?? null;
      setCurrentId(nextId);
      return next;
    });
  };

  const ensureTitle = (firstUserText: string) => {
    if (!current
