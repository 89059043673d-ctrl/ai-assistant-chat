import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Только через n8n
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://dmitriy1987.app.n8n.cloud/webhook/7ee22f40-e39f-4185-b0d0-dab130b2259d';

const N8N_API_KEY = process.env.N8N_API_KEY || '';

const DOWN_MSG =
  '⚠️ Временные неполадки: сценарий обработки сейчас недоступен. ' +
  'Попробуйте ещё раз через 1–2 минуты. Если ошибка повторяется — напишите нам.';

// ——— helpers ———
function newAnonId(): string {
  // короткий стабильный анонимный id
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'u_';
  for (let i = 0; i < 16; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

function cookieHeader(name: string, value: string, maxAgeDays = 365) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  // secure; samesite=lax чтобы кука жила и на проде
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  // достаём/создаём куку aid
  let aid = req.cookies.get('aid')?.value || '';
  let setCookie = '';
  if (!aid) {
    aid = newAnonId();
    setCookie = cookieHeader('aid', aid);
  }

  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages || [];
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const query = String(lastUser?.content || '').trim();

    if (!query) {
      const r = new Response('Пустой запрос', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
      if (setCookie) r.headers.append('Set-Cookie', setCookie);
      return r;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': N8N_API_KEY,
      },
      body: JSON.stringify({ user_id: aid, query }),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Не удалось достучаться до n8n: ${e?.message || e}`);
    });

    clearTimeout(timer);

    const raw = await res.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* не JSON — тоже ок */ }

    if (!res.ok) {
      const r = new Response(DOWN_MSG, {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
      if (setCookie) r.headers.append('Set-Cookie', setCookie);
      return r;
    }

    const answer = typeof data?.answer === 'string' ? data.answer : (raw || '');
    const r = new Response(String(answer || '').trim(), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
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
