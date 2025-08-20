import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мой ИИ-ассистент",
  description: "Чат-ассистент",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){try{var t=localStorage.getItem('ai.chat.theme.v1');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();
          `,
          }}
        />
      </head>
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
