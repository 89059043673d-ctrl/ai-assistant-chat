// app/api/chat/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
// Максимально допустимая длительность выполнения функции на Vercel.
// Выставлено на 180 (3 мин).
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS ?? '180000'); // дефолт: 3 мин

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://dmitriy1987.app.n8n.cloud/webhook/7ee22f40-e39f-4185-b0d0-dab130b2259d';

const N8N_API_KEY = process.env.N8N_API_KEY || '';

const DOWN_MSG =
  '⚠️ Временные неполадки: сценарий обработки сейчас недоступен. ' +
  'Попробуйте ещё раз через 1–2 минуты. Если ошибка повторяется — напишите нам.';

function genId(len = 16) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

function cookieHeader(name: string, value: string, maxAgeDays = 365) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  let aid = req.cookies.get('aid')?.value || '';
  let setCookie: string | null = null;
  if (!aid) {
    aid = genId(16);
    setCookie = cookieHeader('aid', aid);
  }

  let query = '';
  try {
    const body = (await req.json()) as { messages?: Msg[] } | undefined;
    const msgs = body?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'user') {
        query = String(msgs[i].content ?? '').trim();
        break;
      }
    }
  } catch {}

  if (!query) {
    const r = new Response('Пустой запрос.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    if (setCookie) r.headers.append('Set-Cookie', setCookie);
    return r;
  }

  try {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (CHAT_TIMEOUT_MS > 0) {
      timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
    }

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY ? { 'X-API-KEY': N8N_API_KEY } : {}),
      },
      body: JSON.stringify({ user_id: aid, query }),
      signal: CHAT_TIMEOUT_MS > 0 ? controller.signal : undefined,
    });

    if (timer) clearTimeout(timer);

    const r = new Response(res.body ?? (await res.text()), {
      status: res.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });

    if (setCookie) r.headers.append('Set-Cookie', setCookie);
    return r;
  } catch {
    const r = new Response(DOWN_MSG, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    if (setCookie) r.headers.append('Set-Cookie', setCookie);
    return r;
  }
}
