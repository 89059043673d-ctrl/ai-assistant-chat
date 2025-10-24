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
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY не установлен, используется текст сообщения');
      const autoTitle = userText.substring(0, 50).split('\n')[0];
      return Response.json({ title: autoTitle || 'Новый чат' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `Создай короткое название для диалога на основе этого текста. Название должно быть 3-7 слов, без кавычек, без объяснений. Только название.

Текст: "${userText}"

Название:`,
          },
        ],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('Ошибка API OpenAI:', response.status, response.statusText);
      const autoTitle = userText.substring(0, 50).split('\n')[0];
      return Response.json({ title: autoTitle || 'Новый чат' });
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message.content) {
      const title = data.choices[0].message.content.trim().substring(0, 100);
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
