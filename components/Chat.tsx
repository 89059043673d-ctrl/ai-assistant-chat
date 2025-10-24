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
  let lastResultIndex = -1;

  rec.onstart = () => setRecOn(true);
  rec.onresult = (e: any) => {
    // Обрабатываем только результаты после lastResultIndex
    if (e.resultIndex <= lastResultIndex) return;
    
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        setInput((p) => p + (p ? ' ' : '') + transcript);
        lastResultIndex = i;
      }
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
