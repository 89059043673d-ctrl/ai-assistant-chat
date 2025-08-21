import OpenAI from "openai";

export const runtime = "nodejs";         // на Vercel используем Node.js
export const dynamic = "force-dynamic";  // без кэша

type ChatRole = "system" | "user" | "assistant";
type ChatMsg = { role: ChatRole; content: string };

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { ok: false, error: "Missing OPENAI_API_KEY" },
        { status: 200 },
      );
    }

    // Парсим тело
    const body: any = await req.json().catch(() => ({}));
    const userText = String(body?.text ?? "").trim();
    const rawHistory = Array.isArray(body?.history) ? body.history : [];

    // Нормализуем историю: оставляем только допустимые роли и строковый контент
    const history: ChatMsg[] = rawHistory.map((m: any) => {
      const r = m?.role;
      const role: ChatRole =
        r === "system" || r === "user" || r === "assistant" ? r : "user";
      const content = String(m?.content ?? "");
      return { role, content };
    });

    // Собираем сообщения с корректными типами
    const messages: ChatMsg[] = [
      { role: "system", content: "You are a helpful assistant." },
      ...history,
      ...(userText ? [{ role: "user" as const, content: userText }] : []),
    ];

    const openai = new OpenAI({ apiKey });

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",               // можно поменять на твою модель
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.3,
    });

    const answer = resp.choices?.[0]?.message?.content ?? "";
    return Response.json({ ok: true, content: answer }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/chat error:", err);
    return Response.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 200 },
    );
  }
}
