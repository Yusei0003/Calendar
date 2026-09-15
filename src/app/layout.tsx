import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "KESEN LARUS カレンダー",
  description: "KESEN LARUS スタッフの予定共有カレンダー",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#070a12" },
  ],
};

/**
 * 画面が描かれる前にテーマを決めるためのスクリプト。
 * これがないと、ダーク設定の端末で一瞬だけ白い画面が出てしまう。
 */
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("klc-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {
    /* プライベートモードなどで localStorage が使えない場合は端末設定に従う */
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
