import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мой ИИ-ассистент",
  description: "Чат с голосом, файлами и формулами",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-[100dvh] bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
