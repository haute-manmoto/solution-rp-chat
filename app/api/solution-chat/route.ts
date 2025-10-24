import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const lastUser = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const chat = await client.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    temperature: 0.7,
    messages,
  });

  let reply = chat.choices[0]?.message?.content ?? "";

  function formatCorporate(t: string) {
    t = t.replace(/^#{1,6}\s*/gm, "");
    t = t.replace(/^\s*\d+[\)\.、]\s*/gm, "・ ");
    t = t.replace(/^\s*[-*]\s+/gm, "・ ");
    t = t.replace(/([。！？])(?=[^\n])/g, "$1\n");
    t = t.replace(/\n{3,}/g, "\n\n");
    if (t.length > 600) {
      const chunks = t.match(/.{1,400}(?:\s|$)/g) || [t];
      t = chunks.map(s => s.trim()).join("\n\n");
    }
    t = t.split("\n").map(l => l.trimEnd()).join("\n");
    return t.trim();
  }

  reply = formatCorporate(reply);

  const needsContact = /(料金|費用|値段|価格|見積|詳細|導入|資料|相談|依頼|契約|価格表|金額)/.test(String(lastUser));
  if (needsContact) {
    reply += `

---
%%CTA_CONTACT%%`;
  }

  return NextResponse.json({ reply });
}
