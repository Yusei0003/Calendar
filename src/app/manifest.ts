import type { MetadataRoute } from "next";

/** 「ホーム画面に追加」したときの名前・アイコン・色。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KESEN LARUS カレンダー",
    short_name: "LARUS",
    description: "KESEN LARUS スタッフの予定共有カレンダー",
    start_url: "/calendar",
    display: "standalone",
    background_color: "#f3f5f8",
    theme_color: "#2a6198",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
