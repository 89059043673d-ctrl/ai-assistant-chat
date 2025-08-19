// app/page.tsx
"use client";
import Chat from "@/components/Chat";
import Sidebar from "@/components/Sidebar";
import { ChatProvider } from "@/components/ChatContext";

export default function Page() {
  return (
    <ChatProvider>
      <div className="shell">
        <Sidebar />
        <Chat />
      </div>
    </ChatProvider>
  );
}
