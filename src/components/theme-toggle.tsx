"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";

const OPTIONS: { value: Theme; label: string; title: string }[] = [
  { value: "auto", label: "自動", title: "端末の設定に合わせる" },
  { value: "light", label: "ライト", title: "常に明るい配色" },
  { value: "dark", label: "ダーク", title: "常に暗い配色" },
];

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
  try {
    if (theme === "auto") localStorage.removeItem("klc-theme");
    else localStorage.setItem("klc-theme", theme);
  } catch {
    // プライベートモードなどで保存できない場合は、この画面の間だけ反映される
  }
}

/** 配色を切り替える。compact ではアイコン1つで順に切り替える（スマホ用）。 */
export function ThemeToggle({ compact = false }: { compact?: boolean } = {}) {
  const [theme, setTheme] = useState<Theme>("auto");

  // 保存済みの選択を読むのは画面が出てから（サーバー側では localStorage が無いため）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("klc-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* 読めなければ自動のまま */
    }
  }, []);

  if (compact) {
    const next = OPTIONS[(OPTIONS.findIndex((o) => o.value === theme) + 1) % OPTIONS.length];
    return (
      <button
        type="button"
        onClick={() => {
          setTheme(next.value);
          apply(next.value);
        }}
        aria-label={`配色: ${OPTIONS.find((o) => o.value === theme)?.label}。押すと${next.label}に切り替わります`}
        title={`配色: ${OPTIONS.find((o) => o.value === theme)?.label}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors"
        style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
      >
        {theme === "light" ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : theme === "dark" ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8m-4-4v4" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="配色"
      className="flex items-center gap-0.5 rounded-full p-0.5"
      style={{ background: "var(--surface-3)" }}
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => {
              setTheme(option.value);
              apply(option.value);
            }}
            className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200"
            style={
              active
                ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-card)" }
                : { color: "var(--ink-muted)" }
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
