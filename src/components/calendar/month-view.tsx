"use client";

import { EventChip } from "@/components/calendar/event-chip";
import { byId, eventAccent } from "@/lib/display";
import {
  WEEKDAY_LABELS,
  dateKey,
  jstDay,
  jstMonth,
  monthGrid,
  overlapsDay,
  toJst,
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
}: {
  anchor: Date;
  today: Date;
  events: CalendarEvent[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date) => void;
  onOpenDay: (day: Date) => void;
}) {
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
              onClick={() => onCreateAt(day)}
              role="gridcell"
              aria-label={`${jstMonth(day)}月${jstDay(day)}日 予定${dayEvents.length}件`}
              className="min-h-[5.5rem] cursor-pointer border-b border-r p-1 transition-colors duration-150 last:border-r-0 sm:min-h-[7.5rem] sm:p-1.5"
              style={{
                background: isToday
                  ? "var(--grid-today)"
                  : weekday === 0 || weekday === 6
                    ? "var(--grid-weekend)"
                    : "var(--surface)",
                opacity: outside ? 0.45 : 1,
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
                    onOpen={onOpenEvent}
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
    </div>
  );
}
