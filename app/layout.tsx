import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "株式会社ソリューション チャット窓口",
  description: "企業サイト風の整形で読みやすい、問い合わせ導線つきのAIチャット",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
