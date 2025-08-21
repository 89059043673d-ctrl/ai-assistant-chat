import { NextRequest } from "next/server";
import OpenAI from "openai";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const history = (body?.history ?? []) as { role: string; content: string }[];
    const userText = (body?.text ?? "") as string;

    const messages: ChatMsg[] = [
      {
        role: "system",
        content:
          "Ты полезный ассистент. Отвечай кратко и по делу, без приветствий и без лишних вводных. " +
          "Сохраняй разметку Markdown (жирный, заголовки, списки) и формулы LaTeX. " +
          "По умолчанию отвечай на русском, но если пользователь пишет не по-русски — отвечай на его языке.",
      },
      ...history
        .filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
        .map((m) => ({
          role: (m.role === "user" || m.role === "assistant" ? m.role : "user") as
            | "user"
            | "assistant",
          content: m.content,
        })),
      ...(userText ? [{ role: "user" as const, content: userText }] : []),
    ];

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      stream: true,
    });

    const stream = new ReadableStream({
      start(controller) {
        (async () => {
          try {
            for await (const chunk of resp) {
              const delta = chunk.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(new TextEncoder().encode(delta));
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return new Response(
      "Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.",
      { status: 500 }
    );
  }
}
