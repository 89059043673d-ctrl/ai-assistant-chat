// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мой ИИ-ассистент",
  description: "Чат с ассистентом: текст, файлы, голос. Светлая/тёмная тема, история диалогов.",
};

const themeInit = `
(function() {
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const t = saved || (prefersDark ? "dark" : "light");
    document.documentElement.dataset.theme = t;
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
