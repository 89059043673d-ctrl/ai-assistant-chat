import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1) Основной путь — через n8n
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://dmitriy1987.app.n8n.cloud/webhook/7ee22f40-e39f-4185-b0d0-dab130b2259d';

const N8N_API_KEY = process.env.N8N_API_KEY || ''; // мы уже задали на Vercel

// 2) Фолбэк — напрямую в OpenAI (ключ уже есть у тебя в Vercel)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

async function askN8N(query: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': N8N_API_KEY,
    },
    body: JSON.stringify({ user_id: 'site', query }),
    signal,
  });

  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }

  if (!res.ok) throw new Error(`n8n HTTP ${res.status} ${res.statusText} — ${raw || '(empty)'}`);

  const answer = typeof data?.answer === 'string' ? data.answer : (raw || '');
  return (answer || '').trim() || null;
}

async function askOpenAI(query: string, signal: AbortSignal): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'Отвечай кратко. Повтори текст пользователя своими словами.' },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
    }),
    signal,
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI HTTP ${r.status} ${r.statusText} — ${t || '(empty)'}`);
  }

  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content ?? '';
  return String(text || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Msg[] } = await req.json();

    // Берём последнее пользовательское сообщение из фронта
    const lastUser = [...(messages || [])].reverse().find(m => m.role === 'user');
    const query = (lastUser?.content || '').trim();

    if (!query) {
      return new Response('Пустой запрос', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Ставим общий таймаут на поход в n8n
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    try {
      const viaN8n = await askN8N(query, controller.signal);
      clearTimeout(timer);
      if (viaN8n) {
        return new Response(viaN8n, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      // если пусто — валимся в фолбэк
      throw new Error('n8n returned empty answer');
    } catch (n8nErr: any) {
      clearTimeout(timer);
      // Фолбэк в OpenAI
      try {
        const viaOpenAI = await askOpenAI(query, new AbortController().signal);
        return new Response(viaOpenAI, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      } catch (openaiErr: any) {
        const msg = `Сбой n8n (${n8nErr?.message || n8nErr}); затем сбой OpenAI (${openaiErr?.message || openaiErr})`;
        return new Response(msg, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    }
  } catch (e: any) {
    const msg = `Серверн
