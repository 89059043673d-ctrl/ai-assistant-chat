import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs'; // оставим node-окружение

function systemPrompt() {
  return (
    'Ты вежливый и точный ИИ-помощник по коксохим-производству. ' +
    'Отвечай кратко и по делу. Если вопрос вне темы — предупреди и постарайся ' +
    'переформулировать так, чтобы вернуться к тематике коксохимии. ' +
    'Если пользователь присылает изображение, сначала опиши, что видишь, ' +
    'затем дай полезные замечания по теме.'
  );
}

export async function POST(req: Request) {
  try {
    const { message, imageBase64, imageType } = await req.json();

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.MODEL || 'gpt-4o-mini';

    const userContent: any[] = [{ type: 'text', text: String(message || '') }];
    if (imageBase64 && imageType) {
      userContent.push({
        type: 'input_image',
        image_base64: imageBase64,
        mime_type: imageType,
      });
    }

    const resp = await client.responses.create({
      model,
      input: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
    });

    const text = (resp as any).output_text || '…';
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'failed', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
