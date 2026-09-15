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

export function ThemeToggle() {
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
