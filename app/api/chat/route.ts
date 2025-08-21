// app/api/chat/route.ts
import OpenAI from 'openai';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs'; // нормальный стрим на Vercel

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt, history = [] } = await req.json();

    // Берём только user/assistant из истории
    const safeHistory =
      Array.isArray(history)
        ? history
            .filter(
              (m: any) =>
                m && typeof m.content === 'string' &&
                (m.role === 'user' || m.role === 'assistant')
            )
            .map((m: any) => ({ role: m.role, content: m.content }))
        : [];

    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Ты дружелюбный помощник. Отвечай на языке последнего сообщения пользователя. Поддерживай LaTeX в $...$ и $$...$$.',
        },
        ...safeHistory,
        { role: 'user', content: String(prompt ?? '') },
      ],
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            const delta = part.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Ошибка обращения к модели', { status: 500 });
  }
}
