// app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // не Edge, чтобы работал node-fetch и SDK

const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey,
});

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      console.error("[chat] ENV MISSING: OPENAI_API_KEY");
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const userText: string = body?.message ?? "";
    const history: ChatMsg[] = Array.isArray(body?.history) ? body.history : [];

    const messages: ChatMsg[] = [
      { role: "system", content: "You are a helpful assistant." },
      ...history,
      ...(userText ? [{ role: "user", content: userText }] : []),
    ];

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    });

    const text =
      resp.choices?.[0]?.message?.content?.trim() ??
      "(пустой ответ от модели)";

    return NextResponse.json({ ok: true, text });
  } catch (err: any) {
    // В логи Vercel попадёт реальная причина
    console.error("[chat] OpenAI API error:", {
      status: err?.status,
      code: err?.code,
      message: err?.message,
      data: err?.response?.data,
    });

    const status = err?.status || 500;
    const safe =
      err?.response?.data ??
      { message: err?.message || "Unknown error from OpenAI" };

    // Возвращаем реальный статус, чтобы в Vercel Logs было 4xx/5xx, а не 200
    return NextResponse.json({ ok: false, error: safe }, { status });
  }
}
