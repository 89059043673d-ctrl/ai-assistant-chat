// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мой ИИ-ассистент",
  description: "Чат с ассистентом",
};

// Скрипт ставит класс 'light' или 'dark' на <html> ДО отрисовки,
// чтобы тема не «прыгалa» при загрузке.
const themeInitScript = `
;(() => {
  try {
    const KEY = 'theme';
    const saved = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = (saved === 'light' || saved === 'dark') ? saved : (prefersDark ? 'dark' : 'light');
    const root = document.documentElement;
    root.classList.remove('light','dark');
    root.classList.add(mode);
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script id="__theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
