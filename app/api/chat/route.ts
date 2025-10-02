import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Только через n8n
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://dmitriy1987.app.n8n.cloud/webhook/7ee22f40-e39f-4185-b0d0-dab130b2259d';

const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Унифицированное сообщение для пользователя при сбое n8n
const DOWN_MSG =
  '⚠️ Временные неполадки: сценарий обработки сейчас недоступен. ' +
  'Попробуйте ещё раз через 1–2 минуты. Если ошибка повторяется — напишите нам.';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages || [];
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const query = String(lastUser?.content || '').trim();

    if (!query) {
      return new Response('Пустой запрос', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Таймаут 25с на поход в n8n
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': N8N_API_KEY,
      },
      body: JSON.stringify({ user_id: 'site', query }),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Не удалось достучаться до n8n: ${e?.message || e}`);
    });

    clearTimeout(timer);

    const raw = await res.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* оставим raw */ }

    if (!res.ok) {
      // Честно говорим пользователю, но без техподробностей
      return new Response(DOWN_MSG, {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const answer = typeof data?.answer === 'string' ? data.answer : (raw || '');
    return new Response(String(answer || '').trim(), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    // Любая ошибка (таймаут, сеть, парсинг, выключенный воркфлоу) — единое сообщение
    return new Response(DOWN_MSG, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
