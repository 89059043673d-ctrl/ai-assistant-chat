import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Primary: go through n8n
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://dmitriy1987.app.n8n.cloud/webhook/7ee22f40-e39f-4185-b0d0-dab130b2259d';

const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Fallback: direct OpenAI
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
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore JSON parse errors, will use raw
  }

  if (!res.ok) {
    throw new Error(`n8n HTTP ${res.status} ${res.statusText} — ${raw || '(empty)'}`);
  }

  const answer = typeof data?.answer === 'string' ? data.answer : (raw || '');
  const trimmed = (answer || '').trim();
  return trimmed || null;
}

async function askOpenAI(query: string, signal: AbortSignal): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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
  const text: string = j?.choices?.[0]?.message?.content ?? '';
  return String(text || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages || [];
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const query = String(lastUser?.content || '').trim();

    if (!query) {
      return new Response('Пустой запрос', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Try n8n first with a timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    try {
      const viaN8n = await askN8N(query, controller.signal);
      clearTimeout(timer);

      if (viaN8n) {
        return new Response(viaN8n, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }

      // Empty answer from n8n -> fallback
      throw new Error('n8n returned empty answer');
    } catch (n8nErr: any) {
      clearTimeout(timer);

      // Fallback to OpenAI
      try {
        const viaOpenAI = await askOpenAI(query, new AbortController().signal);
        return new Response(viaOpenAI, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      } catch (openaiErr: any) {
        const msg = `Сбой n8n (${n8nErr?.message || n8nErr}); затем сбой OpenAI (${openaiErr?.message || openaiErr})`;
        return new Response(msg, {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
  } catch (e: any) {
    const msg = `Серверный сбой: ${e?.message || e}`;
    return new Response(msg, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
