// app/api/chat/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const { history = [], message } = await req.json();

    const msgs: ChatMsg[] = [
      {
        role: "system",
        content:
          "Ты дружелюбный ассистент. Отвечай по-русски. Разрешено использовать Markdown. Формулы выводи в формате LaTeX и обрамляй $$ ... $$.",
      },
      ...(Array.isArray(history) ? history : []),
      ...(message ? [{ role: "user", content: String(message) }] : []),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: msgs,
      stream: true,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of completion) {
            const delta = part.choices?.[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // чтобы браузер не пытался кэшировать
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response("Ошибка запроса к модели.", { status: 500 });
  }
}
