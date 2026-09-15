"use client";

import { useRef, useState } from "react";

import { EventChip } from "@/components/calendar/event-chip";
import { startGesture } from "@/lib/client/drag-gesture";
import { byId, eventAccent } from "@/lib/display";
import { isUnchanged, moveToDay, type DragPatch, type DragPreview } from "@/lib/drag";
import {
  WEEKDAY_LABELS,
  dateKey,
  formatDayLabel,
  jstDay,
  jstMonth,
  monthGrid,
  overlapsDay,
} from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

/** 1日の枠に並べる予定の上限。これを超えたぶんは「他◯件」にまとめる。 */
const MAX_CHIPS = 3;

export function MonthView({
  anchor,
  today,
  events,
  staff,
  categories,
  onOpenEvent,
  onCreateAt,
  onOpenDay,
  onDragPreview,
  onCommitDrag,
}: {
  anchor: Date;
  today: Date;
  events: CalendarEvent[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date) => void;
  onOpenDay: (day: Date) => void;
  onDragPreview: (preview: DragPreview | null) => void;
  onCommitDrag: (event: CalendarEvent, patch: DragPatch) => void;
}) {
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const dragging = useRef<{ event: CalendarEvent; patch: DragPatch | null } | null>(null);
  const suppressClickUntil = useRef(0);
  const [badge, setBadge] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const days = monthGrid(anchor);
  const staffById = byId(staff);
  const categoryById = byId(categories);
  const currentMonth = jstMonth(anchor);
  const todayKey = dateKey(today);

  // 日ごとに予定を割り振る。日をまたぐ予定は両方の日に出す。
  const byDay = new Map<string, CalendarEvent[]>();
  for (const day of days) byDay.set(dateKey(day), []);
  for (const event of events) {
    for (const day of days) {
      if (overlapsDay(event.startsAt, event.endsAt, day)) {
        byDay.get(dateKey(day))?.push(event);
      }
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startsAt.localeCompare(b.startsAt);
    });
  }

  /** 指・マウスの位置がどの日の枠にあるかを調べる。 */
  const dayAt = (clientX: number, clientY: number): Date | null => {
    for (const day of days) {
      const rect = cellRefs.current.get(dateKey(day))?.getBoundingClientRect();
      if (!rect) continue;
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return day;
      }
    }
    return null;
  };

  const beginDrag = (down: React.PointerEvent<HTMLElement>, event: CalendarEvent) => {
    // Google カレンダーから取り込んだ予定は読み取り専用。動かせない。
    if (event.source === "google") return;
    if (down.button !== 0 && down.pointerType === "mouse") return;
    down.stopPropagation();
    dragging.current = { event, patch: null };

    const update = (pointer: PointerEvent) => {
      const day = dayAt(pointer.clientX, pointer.clientY);
      if (!day || !dragging.current) return;
      const patch = moveToDay(event, day);
      dragging.current.patch = patch;
      setHoverKey(dateKey(day));
      onDragPreview({ id: event.id, ...patch });
      setBadge({ x: pointer.clientX, y: pointer.clientY, text: formatDayLabel(day) + "へ" });
    };

    startGesture(down, {
      onActivate: update,
      onMove: update,
      onEnd: (dragged) => {
        const current = dragging.current;
        dragging.current = null;
        setBadge(null);
        setHoverKey(null);

        if (!dragged || !current?.patch || isUnchanged(current.event, current.patch)) {
          onDragPreview(null);
          return;
        }
        suppressClickUntil.current = Date.now() + 300;
        onCommitDrag(current.event, current.patch);
      },
    });
  };

  const openUnlessDragging = (event: CalendarEvent) => {
    if (Date.now() < suppressClickUntil.current) return;
    onOpenEvent(event);
  };

  return (
    <div className="card overflow-hidden">
      {/* 曜日の見出し */}
      <div className="grid grid-cols-7 border-b" style={{ background: "var(--surface-2)" }}>
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className="tabular py-2 text-center text-xs font-semibold"
            style={{
              color:
                index === 0 ? "var(--now-line)" : index === 6 ? "var(--brand)" : "var(--ink-muted)",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6週×7日 */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = byDay.get(key) ?? [];
          const outside = jstMonth(day) !== currentMonth;
          const isToday = key === todayKey;
          const weekday = day.getUTCDay();
          const shown = dayEvents.slice(0, MAX_CHIPS);
          const hidden = dayEvents.length - shown.length;

          return (
            <div
              key={key}
              ref={(node) => {
                if (node) cellRefs.current.set(key, node);
                else cellRefs.current.delete(key);
              }}
              onClick={() => {
                if (Date.now() < suppressClickUntil.current) return;
                onCreateAt(day);
              }}
              role="gridcell"
              aria-label={`${jstMonth(day)}月${jstDay(day)}日 予定${dayEvents.length}件`}
              className="min-h-[5.5rem] cursor-pointer border-b border-r p-1 transition-colors duration-150 last:border-r-0 sm:min-h-[7.5rem] sm:p-1.5"
              style={{
                background:
                  hoverKey === key
                    ? "var(--surface-3)"
                    : isToday
                      ? "var(--grid-today)"
                      : weekday === 0 || weekday === 6
                        ? "var(--grid-weekend)"
                        : "var(--surface)",
                opacity: outside ? 0.45 : 1,
                boxShadow: hoverKey === key ? "inset 0 0 0 2px var(--brand)" : undefined,
              }}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={`tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                    isToday ? "font-bold" : "font-medium"
                  }`}
                  style={
                    isToday
                      ? { background: "var(--brand)", color: "var(--brand-ink)" }
                      : {
                          color:
                            weekday === 0
                              ? "var(--now-line)"
                              : weekday === 6
                                ? "var(--brand)"
                                : "var(--ink-muted)",
                        }
                  }
                >
                  {jstDay(day)}
                </span>
              </div>

              <div className="flex flex-col gap-[3px]">
                {shown.map((event) => (
                  <EventChip
                    key={`${key}-${event.id}`}
                    event={event}
                    accent={eventAccent(event, staffById, categoryById)}
                    category={categoryById.get(event.categoryId)}
                    staffName={event.staffId ? (staffById.get(event.staffId)?.name ?? null) : null}
                    onOpen={openUnlessDragging}
                    onPointerDown={event.source === "google" ? undefined : (down) => beginDrag(down, event)}
                    compact
                  />
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onOpenDay(day);
                    }}
                    className="rounded px-1.5 py-[2px] text-left text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    ほか{hidden}件
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* ドラッグ中に、離したらどの日になるかを示す */}
      {badge ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[160%] rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-pop"
          style={{ left: badge.x, top: badge.y, background: "var(--ink)", color: "var(--canvas)" }}
        >
          {badge.text}
        </div>
      ) : null}
    </div>
  );
}
