import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

function systemPrompt() {
  return (
    "Ты вежливый и точный ИИ-помощник по коксохим-производству. " +
    "Отвечай кратко и по делу. Если вопрос вне темы — предупреди и предложи " +
    "формулировку, чтобы вернуться к тематике коксохимии. "
  );
}

export async function POST(req: Request) {
  try {
    const { message, imageBase64, imageType } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "На Vercel не задан OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.MODEL || "gpt-4o-mini";

    // Самый совместимый вызов (chat.completions)
    const messages: any[] = [
      { role: "system", content: systemPrompt() },
      { role: "user", content: String(message || "") }
    ];

    // (Опционально) если картинка есть — кратко упомянем в тексте
    if (imageBase64 && imageType) {
      messages.push({
        role: "user",
        content: `К сообщению приложено изображение (${imageType}, base64). Дай комментарии по теме.`
      });
    }

    const resp = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
    });

    const text = resp.choices?.[0]?.message?.content?.trim() || "…";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
