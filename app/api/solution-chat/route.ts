import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import {
  SOLUTION_VOICE,
  REPLY_STYLE,
  SAFETY_GUARDRAILS,
  CTA_POLICY,
  REPLY_SCAFFOLD,
} from "@/lib/solutionPersona";
import {
  SOLUTION_MODES,           // 既存のモード定義はそのまま利用（ヒントとして渡す）
  SOLUTION_SHARED_RULES,
} from "@/lib/solutionModes";

// Edge ではなく Node.js（Hobbyの制限下でも安定）
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"]; // 任意

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

function withTimeout<T>(p: Promise<T>, ms: number, label = "request"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const lastUser = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

    // ルータをやめて、SYSTEM内で“自動で最適モードを推定して話す”ように指示
    const SYSTEM = [
      SOLUTION_VOICE,
      REPLY_STYLE,
      SAFETY_GUARDRAILS,
      SOLUTION_SHARED_RULES,
      // モード説明は“ヒント”として埋め込み、本文には出さない
      "【内部ヒント（本文に出さない）】可能なら次から最も合う観点を選び、構成に反映: " +
        Object.entries(SOLUTION_MODES)
          .map(([k, v]) => `(${k}) ${v.replace(/\n/g, " ")}`) // 1行化
          .join(" / "),
      CTA_POLICY,
      REPLY_SCAFFOLD,
      "【重要】モード名は本文に出さない。返答は簡潔（~250〜500字）。",
    ].join("\n");

    const chat = await withTimeout(
      openai.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.5,               // 速さ＆安定重視
        max_tokens: 480,                 // 長すぎ抑止（Hobbyの実行時間対策）
        messages: [
          { role: "system", content: SYSTEM },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
      }),
      9000, // Hobbyの上限(~10s)内に収める
      "chat"
    );

    let reply = chat.choices[0]?.message?.content ?? "";

    // 企業サイト風の整形
    function formatCorporate(t: string) {
      t = t.replace(/^#{1,6}\s*/gm, "");
      t = t.replace(/^\s*\d+[\)\.、]\s*/gm, "・ ");
      t = t.replace(/^\s*[-*]\s+/gm, "・ ");
      t = t.replace(/([。！？])(?=[^\n])/g, "$1\n");
      t = t.replace(/\n{3,}/g, "\n\n");
      if (t.length > 600) {
        const chunks = t.match(/.{1,400}(?:\s|$)/g) || [t];
        t = chunks.map((s) => s.trim()).join("\n\n");
      }
      t = t.split("\n").map((l) => l.trimEnd()).join("\n");
      return t.trim();
    }
    reply = formatCorporate(reply);

    // CTAトリガ（費用/見積/導入ワードでON）
    const needsContact = /(料金|費用|値段|価格|見積|詳細|導入|資料|相談|依頼|契約|価格表|金額)/.test(String(lastUser));
    if (needsContact) {
      reply += `

---
%%CTA_CONTACT%%`;
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("solution-chat api error:", err?.message || err);
    const fallback =
      "ただいま応答が不安定です。少し時間をおいて再度お試しください。必要であれば『無料相談フォーム』やお電話（06-6203-0222）もご利用いただけます。";
    return NextResponse.json({ reply: fallback }, { status: 200 });
  }
}
