import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мой ИИ-ассистент',
  description: 'AI Assistant Chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
