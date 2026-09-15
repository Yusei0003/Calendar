"use client";

import { useEffect } from "react";

import { CategoryIcon } from "@/components/calendar/event-chip";
import { formatFullDate, formatTime, toJst } from "@/lib/time";
import type { CalendarEvent } from "@/lib/types";

/**
 * Google カレンダーから取り込んだ予定を開いたときの表示。
 * 読み取り専用であることをはっきり伝え、編集・削除の導線は出さない。
 */
export function GoogleEventPreview({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const start = toJst(event.startsAt);
  const end = toJst(event.endsAt);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(8,11,20,0.45)" }}
      />

      <div
        className="relative w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl"
        style={{
          background: "var(--surface)",
          boxShadow: "var(--shadow-pop)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
        }}
      >
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "var(--surface-3)", color: "var(--ink-muted)" }}
        >
          <CategoryIcon icon="dot" className="h-3 w-3" />
          Google カレンダーの予定
        </div>

        <h2 className="text-base font-bold leading-snug">{event.title}</h2>

        <p className="tabular mt-2 text-sm text-ink-muted">
          {event.allDay ? (
            <>{formatFullDate(start)}（終日）</>
          ) : (
            <>
              {formatFullDate(start)} {formatTime(start)}〜{formatTime(end)}
            </>
          )}
        </p>

        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          この予定は本人の Google カレンダーから読み取り専用で表示しています。
          内容の変更は Google カレンダー側で行ってください。
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl text-sm font-semibold"
          style={{ background: "var(--surface-3)", color: "var(--ink)" }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
