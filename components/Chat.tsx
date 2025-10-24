function startListening() {
  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    alert('Браузер не поддерживает распознавание речи');
    return;
  }
  const rec = new SpeechRecognitionClass();
  rec.lang = 'ru-RU';
  rec.continuous = false;
  rec.interimResults = true;

  rec.onstart = () => setRecOn(true);
  rec.onresult = (e: any) => {
    let interim = '';
    let finalText = '';
    
    // Обрабатываем только новые результаты (с e.resultIndex)
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalText += (finalText ? ' ' : '') + transcript;
      } else {
        interim += transcript;
      }
    }
    
    // Если есть финальный текст - добавляем его один раз
    if (finalText) {
      setInput((p) => p + (p ? ' ' : '') + finalText);
    }
    // Показываем interim результат
    else if (interim) {
      setInput((p) => p + (p ? ' ' : '') + interim);
    }
  };
  rec.onerror = (e: any) => {
    console.error('Ошибка речи:', e.error);
    setRecOn(false);
  };
  rec.onend = () => setRecOn(false);
  rec.start();
  recRef.current = rec;
}
