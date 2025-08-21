import OpenAI from 'openai';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Msg[] } = await req.json();

    const sys: Msg = {
      role: 'system',
      content:
        'Ты дружелюбный помощник. Отвечай в Markdown (заголовки, списки, **жирный**, код). ' +
        'Математику оформляй через LaTeX c двойными долларами $$ ... $$ (KaTeX). ' +
        'Не используй HTML, только markdown.',
    };

    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [sys, ...messages],
      temperature: 0.4,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) controller.enqueue(encoder.encode(token));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return new Response(
      'Не удалось получить ответ от модели. Проверьте Billing и переменную OPENAI_API_KEY на Vercel.',
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
}
