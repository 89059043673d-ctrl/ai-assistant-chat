import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Можешь вынести в переменную окружения N8N_WEBHOOK_URL на Vercel, но для простоты оставлю дефолт
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://dmitriy1987.app.n8n.cloud/webhook/7ee22f40-e39f-4185-b0d0-dab130b2259d';

// Если решишь включить проверку токена в n8n Code-node — добавь тут:
// const N8N_API_KEY = process.env.N8N_API_KEY || 'ТВОЙ_СЕКРЕТ';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Msg[] } = await req.json();

    // Берём последнее пользовательское сообщение как query
    const lastUser = [...(messages || [])].reverse().find(m => m.role === 'user');
    const query = (lastUser?.content || '').trim();
    if (!query) {
      return new Response('Пустой запрос', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Таймаут 25с
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Если включишь проверку токена в n8n:
        // 'X-API-KEY': N8N_API_KEY,
      },
      body: JSON.stringify({
        user_id: 'site',   // можно подставлять свой ID/куку, если нужно
        query,
      }),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Не удалось достучаться до n8n: ${e?.message || e}`);
    });

    clearTimeout(timer);

    const raw = await res.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* оставим raw */ }

    if (!res.ok) {
      const msg = `n8n HTTP ${res.status} ${res.statusText} — ${raw || '(пусто)'}`;
      return new Response(msg, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Ждём { answer: "..." } из твоего Respond to Webhook
    const answer = typeof data?.answer === 'string' ? data.answer : (raw || '');
    return new Response(answer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    const msg = `Сбой прокси до n8n: ${e?.message || e}`;
    return new Response(msg, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
