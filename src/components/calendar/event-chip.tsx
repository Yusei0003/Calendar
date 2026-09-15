"use client";

import { categoryIconPath } from "@/lib/display";
import { formatTime, toJst } from "@/lib/time";
import type { AccentColor, CalendarEvent, Category } from "@/lib/types";

export function CategoryIcon({ icon, className = "" }: { icon: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={categoryIconPath(icon)} />
    </svg>
  );
}

/** Google カレンダーから読み取り専用で取り込んだ予定であることを示す印。 */
export function GoogleSourceIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9a8 8 0 0 1 14-4.9M20 15a8 8 0 0 1-14 4.9" />
      <path d="M18 4v4.5H13.5M6 20v-4.5H10.5" />
    </svg>
  );
}

/**
 * 月表示・リスト表示で使う予定のひとかたまり。
 * 左端の帯と背景がスタッフ（または分類）の色になる。
 */
export function EventChip({
  event,
  accent,
  category,
  staffName,
  onOpen,
  onPointerDown,
  compact = false,
}: {
  event: CalendarEvent;
  accent: AccentColor;
  category: Category | undefined;
  staffName: string | null;
  onOpen: (event: CalendarEvent) => void;
  onPointerDown?: (down: React.PointerEvent<HTMLElement>) => void;
  compact?: boolean;
}) {
  const isGoogle = event.source === "google";
  const time = event.allDay ? "終日" : formatTime(toJst(event.startsAt));
  const label = [time, staffName, event.title, isGoogle ? "（Googleカレンダー・読み取り専用）" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onOpen(event);
      }}
      style={{
        ...(onPointerDown ? { touchAction: "none" } : undefined),
        ...(isGoogle ? { borderLeftStyle: "dashed" } : undefined),
      }}
      aria-label={label}
      title={label}
      className={`a-${accent} chip flex w-full items-center gap-1.5 overflow-hidden rounded-md text-left ${
        compact ? "px-1.5 py-[3px] text-[11px]" : "px-2 py-1 text-xs"
      } ${isGoogle ? "opacity-90" : ""}`}
    >
      {isGoogle ? (
        <GoogleSourceIcon className="h-3 w-3 shrink-0 opacity-80" />
      ) : category ? (
        <CategoryIcon icon={category.icon} className="h-3 w-3 shrink-0 opacity-80" />
      ) : null}
      <span className="tabular shrink-0 font-semibold opacity-80">{time}</span>
      <span className="truncate font-medium">{event.title}</span>
      {staffName && !compact ? (
        <span className="ml-auto shrink-0 truncate text-[10px] opacity-70">{staffName}</span>
      ) : null}
    </button>
  );
}
