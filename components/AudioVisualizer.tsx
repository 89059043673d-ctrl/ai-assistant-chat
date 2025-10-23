// components/AudioVisualizer.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  audioContext?: AudioContext;
  analyser?: AnalyserNode;
}

export default function AudioVisualizer({ isActive, audioContext, analyser }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Инициализация analyser
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    setDataArray(data);

    const draw = () => {
      if (!isActive) {
        // Стираем холст, когда микрофон неактивен
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      analyser.getByteFrequencyData(data);

      // Очищаем холст
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (data[i] / 255) * canvas.height;

        // Градиент цветов (от фиолетового к голубому)
        const hue = (i / bufferLength) * 60 + 240; // 240-300 диапазон (фиолет-голубой)
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={60}
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: '#0a0e27',
        display: isActive ? 'block' : 'none',
      }}
    />
  );
}
