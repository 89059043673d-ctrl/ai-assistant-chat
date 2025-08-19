"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useChat } from "./ChatContext";

/* --- ВАЖНО: минимальные тайпинги для Web Speech API, чтобы сборка прошла --- */
type SpeechRecognition = any;
type SpeechRecognitionEvent = any;

/* Ответ API */
type ApiResp = { text?: string; error?: string };

export default function Chat() {
  const { sessions, activeId, addMessage, setSidebarOpen } = useChat();
  const session = sessions.find(s => s.id === activeId);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // автоскролл вниз при новых сообщениях
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length]);

  // Web Speech API (диктовка)
  const [rec, setRec] = useState<SpeechRecognition | null>(null);
  const [recOn, setRecOn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (Ctor) {
      const r: SpeechRecognition = new Ctor();
      r.lang = "ru-RU";
      r.interimResults = true;
      (r as any).onresult = (e: SpeechRecognitionEvent) => {
        const t = Array.from((e as any).results).map((r: any) => r[0].transcript).join(" ");
        setValue(v => (v ? v + " " : "") + t);
      };
      (r as any).onend = () => setRecOn(false);
      setRec(r);
    }
  }, []);

  async function toBase64(f: File): Promise<{ base64: string; type: string }> {
    const buf = await f.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { base64: b64, type: f.type || "image/png" };
  }

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text && !file) return;

    setPending(true);

    let imageBase64: string | undefined, imageType: string | undefined;
    if (file && file.type.startsWith("image/")) {
      const conv = await toBase64(file);
      imageBase64 = conv.base64;
      imageType = conv.type;
    }

    addMessage({ role: "user", text: text || "(изображение)", imageBase64, imageType });

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, imageBase64, imageType }),
      });
      const data: ApiResp = await resp.json();

      if (resp.ok && data.text) {
        addMessage({ role: "assistant", text: data.text });
      } else {
        const reason =
          data?.error ||
          "Не удалось получить ответ от модели. Проверьте баланс API-ключа в OpenAI Billing и переменную OPENAI_API_KEY на Vercel.";
        addMessage({ role: "assistant", text: reason });
      }
    } catch {
      addMessage({ role: "assistant", text: "Сеть недоступна или сервер вернул ошибку." });
    } finally {
      setPending(false);
      setValue("");
      setFile(null);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="chat">
      <div className="chat__top">
        <button className="btn" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="spacer" />
        <div className="tag">Голос: {rec ? (recOn ? "идёт запись…" : "готов") : "недоступен"}</div>
      </div>

      <div className="messages" ref={listRef}>
        {session?.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role === "user" ? "bubble--me" : ""}`}>
            <div className="bubble__role">{m.role === "user" ? "Вы" : "Ассистент"}</div>
            {!!m.imageBase64 && (
              <>
                <img
                  src={`data:${m.imageType};base64,${m.imageBase64}`}
                  alt="изображение пользователя"
                  style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 8 }}
                />
                <hr className="hr" />
              </>
            )}
            <div dangerouslySetInnerHTML={{ __html: safeMd(m.text) }} />
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={onSend}>
        <div className="composer__inner">
          <div className="toolbar">
            {/* вложение */}
            <label className="icon-btn" title="Прикрепить изображение">
              📎
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            {/* микрофон */}
            <button
              type="button"
              className="icon-btn"
              title="Диктовка (Web Speech API)"
              onClick={() => {
                if (!rec) return alert("Браузер не поддерживает распознавание речи");
                if (recOn) { (rec as any).stop(); setRecOn(false); }
                else { setValue(""); (rec as any).start(); setRecOn(true); }
              }}
            >
              🎤
            </button>
          </div>

          <textarea
            ref={inputRef}
            className="input"
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Спросите что-нибудь…"
          />

          <button className="btn btn--primary send-btn" disabled={pending}>
            {pending ? "…" : "Отправить"}
          </button>
        </div>

        {file && (
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <div className="tag">Файл: {file.name}</div>
            <button type="button" className="btn" onClick={() => setFile(null)}>Убрать</button>
          </div>
        )}
      </form>
    </section>
  );
}

/* мини-«рендер Markdown» */
function safeMd(t: string) {
  let s = (t || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`(.+?)`/g, "<code>$1</code>");
  s = s.replace(/\n/g, "<br/>");
  return s;
}
