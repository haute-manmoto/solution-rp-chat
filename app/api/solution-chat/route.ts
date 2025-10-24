import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { SOLUTION_VOICE, REPLY_STYLE, SAFETY_GUARDRAILS, CTA_POLICY, REPLY_SCAFFOLD } from "@/lib/solutionPersona";
import { SOLUTION_MODES, SOLUTION_SHARED_RULES, SolutionModeKey } from "@/lib/solutionModes";

export const runtime = "edge";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const ROUTER_MODEL = process.env.OPENAI_ROUTER_MODEL ?? "gpt-4o-mini";

const MODE_LIST: SolutionModeKey[] = [
  "executive","diagnostics","hr_enablement","facilitation","training","sales_light",
];

const ROUTER_SYSTEM = `
あなたはルータ。ユーザー発話を読み、最も適切な1モードを厳選する。
必ず下記JSONだけを返す:
{"mode":"<executive|diagnostics|hr_enablement|facilitation|training|sales_light>","confidence":0-1}

判定基準例:
- 経営者の意思決定/優先度/投資判断 → executive
- 組織の現状把握・強み発見・ミニ診断 → diagnostics
- 採用/オンボーディング/育成/評価 → hr_enablement
- 会議設計/1on1/合意形成 → facilitation
- 研修/学習転移 → training
- 料金/納期/依頼/問い合わせ → sales_light
`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const lastUser = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

  // 1) ルーティング
  const route = await openai.chat.completions.create({
    model: ROUTER_MODEL,
    messages: [
      { role: "system", content: ROUTER_SYSTEM },
      { role: "user", content: String(lastUser).slice(0, 4000) },
    ],
    temperature: 0,
    response_format: { type: "json_object" } as any,
  });

  let parsed: { mode: SolutionModeKey; confidence: number } = { mode: "executive", confidence: 0.5 };
  try {
    parsed = JSON.parse(route.choices[0]?.message?.content || "{}");
    if (!MODE_LIST.includes(parsed.mode)) parsed.mode = "executive";
  } catch {}

  // 2) 人格（SME強化）＋モードを合体したSYSTEM
  const SYSTEM = [
    SOLUTION_VOICE,
    REPLY_STYLE,
    SAFETY_GUARDRAILS,
    SOLUTION_SHARED_RULES,
    SOLUTION_MODES[parsed.mode],
    CTA_POLICY,
    REPLY_SCAFFOLD,
    `非表示メタ: 現在モード=${parsed.mode}。モード名は本文に出さない。`
  ].join("\n");

  // 3) 返答生成
  const chat = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ],
  });

  // 4) 整形
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

  // 5) CTAトリガ
  const needsContact = /(料金|費用|値段|価格|見積|詳細|導入|資料|相談|依頼|契約|価格表|金額)/.test(String(lastUser));
  if (needsContact) {
    reply += `

---
%%CTA_CONTACT%%`;
  }

  return NextResponse.json({ reply });
}
