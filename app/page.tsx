'use client';
import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

const CTA_MARK = "%%CTA_CONTACT%%";

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "こんにちは。今日はどの課題からご一緒しますか？" }
  ]);
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim()) return;
    const next: Msg[] = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/solution-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    });
    const data = await res.json();
    setMessages([...next, { role: "assistant", content: data.reply ?? "" }]);
    setLoading(false);
  }

  function renderInlineBold(s: string) {
    const parts = s.split(/(\*\*.+?\*\*)/g);
    return parts.map((p, i) => {
      const m = p.match(/^\*\*(.+)\*\*$/);
      if (m) return <strong key={i} className="font-semibold">{m[1]}</strong>;
      return <span key={i}>{p}</span>;
    });
  }

  function renderAssistant(text: string) {
    const hasCTA = text.includes(CTA_MARK);
    const base = text.replace(CTA_MARK, "").trim();
    const lines = base.split("\n");

    const blocks: JSX.Element[] = [];
    let paragraphBuf: string[] = [];
    let listBuf: string[] = [];

    const flushParagraph = () => {
      if (!paragraphBuf.length) return;
      const content = paragraphBuf.join(" ");
      if (/^\*\*.+\*\*$/.test(content)) {
        blocks.push(<h3 key={"h" + blocks.length} className="mt-3 mb-2 font-bold text-[var(--ink)]">{renderInlineBold(content)}</h3>);
      } else {
        blocks.push(<p key={"p" + blocks.length} className="mb-3 leading-relaxed">{renderInlineBold(content)}</p>);
      }
      paragraphBuf = [];
    };

    const flushList = () => {
      if (!listBuf.length) return;
      blocks.push(
        <ul key={"ul" + blocks.length} className="mb-3 list-disc pl-6 space-y-1">
          {listBuf.map((it, i) => <li key={i}>{renderInlineBold(it.replace(/^・\s?/, ""))}</li>)}
        </ul>
      );
      listBuf = [];
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^・\s?/.test(line)) {
        if (paragraphBuf.length) flushParagraph();
        listBuf.push(line);
      } else {
        if (listBuf.length) flushList();
        paragraphBuf.push(line);
      }
    }
    flushList();
    flushParagraph();

    // --- CTAボタン部分 ---
const cta = hasCTA ? (
  <div className="mt-6 mb-2 flex flex-wrap gap-2">
    <a
      href="https://solution-hr.com/contact"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-lg bg-[var(--brand-orange)] px-4 py-2 text-white text-sm font-medium shadow hover:opacity-95"
    >
      無料相談フォーム
    </a>
    <a
      href="tel:0662030222"
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50"
    >
      電話で問い合わせ（06-6203-0222）
    </a>
  </div>
) : null;

    return <>{blocks}{cta}</>;
  }

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-4 flex items-center gap-2">
  <img src="/logo.png" alt="株式会社ソリューション" className="h-6 md:h-7" />
  <h1 className="text-lg font-semibold text-[var(--muted)]">
    自律型組織づくりのAI相談室
  </h1>
</header>
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  "inline-block rounded-2xl px-4 py-3 text-sm md:text-[15px] leading-relaxed " +
                  (m.role === "user"
                    ? "bg-[var(--brand-orange)] text-white"
                    : "bg-[var(--surface-2)] border border-slate-200")
                }
              >
                {m.role === "assistant" ? renderAssistant(m.content) : m.content}
              </div>
            </div>
          ))}
        </div>

        {/* メッセージ一覧のすぐ下に追加 */}
        {loading && (
          <div className="text-left">
            <div className="inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[var(--surface-2)] border border-slate-200">
              <span className="typing">
                <span className="dot">●</span>
                <span className="dot ml-1">●</span>
                <span className="dot ml-1">●</span>
              </span>
            </div>
          </div>
        )}


        <div ref={bottomRef} />

        <div className="mt-6 flex items-end gap-2">
          <textarea
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] shadow-sm
                       placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]
                       resize-none leading-relaxed"
            rows={3}
            placeholder="例）若手の主体性が弱い。まず何から？（Enterで改行、⌘Enter/Ctrl+Enterで送信）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => {
              if (!isComposing && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={loading}
            className="h-[42px] rounded-xl px-5 text-[15px] font-medium text-white
                      bg-[var(--brand-orange)] hover:opacity-95 active:opacity-90 disabled:opacity-60
                      focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]
                      shadow-[0_6px_16px_rgba(255,136,0,0.25)] transition flex items-center gap-2"
          >
            {loading && <span className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
            送信
          </button>

        </div>

        <div className="mt-2 text-xs text-[var(--muted)]">
          Enterで改行／⌘Enter（Mac）または Ctrl+Enter（Windows）で送信できます。
        </div>
      </div>
    </main>
  );
}
