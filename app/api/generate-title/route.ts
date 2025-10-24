export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || messages.length === 0) {
      return Response.json({ title: 'Новый чат' }, { status: 400 });
    }

    const firstUserMessage = messages.find((m: any) => m.role === 'user');
    
    if (!firstUserMessage || !firstUserMessage.content) {
      return Response.json({ title: 'Новый чат' }, { status: 400 });
    }

    const userText = String(firstUserMessage.content).trim();

    if (!userText) {
      return Response.json({ title: 'Новый чат' }, { status: 400 });
    }

    // Если API ключ не установлен, используем текст сообщения
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY не установлен, используется текст сообщения');
      const autoTitle = userText.substring(0, 50).split('\n')[0];
      return Response.json({ title: autoTitle || 'Новый чат' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Создай короткое название для диалога на основе этого текста. Название должно быть 3-7 слов, без кавычек, без объяснений. Только название.

Текст: "${userText}"

Название:`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Ошибка API Anthropic:', response.status, response.statusText);
      const autoTitle = userText.substring(0, 50).split('\n')[0];
      return Response.json({ title: autoTitle || 'Новый чат' });
    }

    const data = await response.json();

    if (data.content && data.content.length > 0 && data.content[0].text) {
      const title = data.content[0].text.trim().substring(0, 100);
      if (title) {
        return Response.json({ title });
      }
    }

    const autoTitle = userText.substring(0, 50).split('\n')[0];
    return Response.json({ title: autoTitle || 'Новый чат' });
  } catch (error) {
    console.error('Ошибка при генерации названия:', error);
    return Response.json({ title: 'Новый чат' }, { status: 500 });
  }
}
