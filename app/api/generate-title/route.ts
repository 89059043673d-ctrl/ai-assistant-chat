export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || messages.length === 0) {
      return Response.json({ title: 'Новый чат' });
    }

    // Берём первое сообщение пользователя
    const firstUserMessage = messages.find((m: any) => m.role === 'user');
    
    if (!firstUserMessage) {
      return Response.json({ title: 'Новый чат' });
    }

    const userText = firstUserMessage.content;

    // Отправляем запрос в API для генерации названия
    const response = await fetch('https://api.anthropic.com/v1/messages/create', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 50,
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

    const data = await response.json();

    if (data.content && data.content.length > 0) {
      const title = data.content[0].text.trim().substring(0, 50);
      return Response.json({ title });
    }

    return Response.json({ title: userText.substring(0, 50) });
  } catch (error) {
    console.error('Ошибка при генерации названия:', error);
    return Response.json({ title: 'Новый чат' });
  }
}
