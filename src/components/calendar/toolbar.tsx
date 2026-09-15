"use client";

import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Staff } from "@/lib/types";

export type ViewKind = "month" | "week" | "day" | "list";

export const VIEW_LABELS: Record<ViewKind, string> = {
  month: "月",
  week: "週",
  day: "日",
  list: "リスト",
};

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:text-ink"
      style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  title,
  subtitle,
  view,
  views,
  actor,
  onChangeView,
  onPrev,
  onNext,
  onToday,
  onOpenAdmin,
  onSwitchUser,
}: {
  title: string;
  subtitle: string;
  view: ViewKind;
  views: ViewKind[];
  actor: Staff;
  onChangeView: (view: ViewKind) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenAdmin: () => void;
  onSwitchUser: () => void;
}) {
  return (
    <header
      className="sticky z-30 border-b"
      style={{ top: "env(safe-area-inset-top, 0px)", background: "var(--surface)" }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <h1 className="tabular truncate text-lg font-bold leading-tight sm:text-xl">{title}</h1>
            <p className="truncate text-[11px] text-ink-faint sm:text-xs">{subtitle}</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="スタッフと分類の設定"
              title="スタッフと分類の設定"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:text-ink sm:flex"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onSwitchUser}
              title={`${actor.name}として利用中。押すと名前を変えられます`}
              className="flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-2 text-xs font-medium transition-colors"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              <Avatar name={actor.name} color={actor.color} size="sm" />
              <span className="hidden sm:inline">{actor.name}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label="前へ" onClick={onPrev}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </IconButton>
          <IconButton label="次へ" onClick={onNext}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </IconButton>
          <button
            type="button"
            onClick={onToday}
            className="h-9 rounded-lg px-3 text-xs font-semibold transition-colors"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
          >
            今日
          </button>

          <div
            role="tablist"
            aria-label="表示の切り替え"
            className="ml-auto flex items-center gap-0.5 rounded-lg p-0.5"
            style={{ background: "var(--surface-3)" }}
          >
            {views.map((kind) => {
              const active = view === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onChangeView(kind)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-200"
                  style={
                    active
                      ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-card)" }
                      : { color: "var(--ink-muted)" }
                  }
                >
                  {VIEW_LABELS[kind]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
