"use client";

import { Avatar } from "@/components/avatar";
import { CategoryIcon, GoogleSourceIcon } from "@/components/calendar/event-chip";
import { byId, eventAccent } from "@/lib/display";
import {
  WEEKDAY_LABELS,
  addDays,
  dateKey,
  formatTime,
  jstDay,
  jstMonth,
  jstWeekday,
  overlapsDay,
  toJst,
} from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

/**
 * 今日から先の予定を時系列に並べる。スマホでの既定の表示。
 * 予定のない日は詰めて表示する。
 */
export function ListView({
  from,
  days,
  today,
  events,
  staff,
  categories,
  onOpenEvent,
}: {
  from: Date;
  days: number;
  today: Date;
  events: CalendarEvent[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const staffById = byId(staff);
  const categoryById = byId(categories);
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));

  const groups = Array.from({ length: days }, (_, index) => addDays(from, index))
    .map((day) => ({
      day,
      events: events
        .filter((event) => overlapsDay(event.startsAt, event.endsAt, day))
        .sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
          return a.startsAt.localeCompare(b.startsAt);
        }),
    }))
    .filter((group) => group.events.length > 0);

  if (groups.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
        <p className="text-sm font-medium text-ink-muted">この期間に予定はありません。</p>
        <p className="text-xs text-ink-faint">右下の＋から追加できます。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ day, events: dayEvents }) => {
        const key = dateKey(day);
        const weekday = jstWeekday(day);
        const label = key === todayKey ? "今日" : key === tomorrowKey ? "明日" : null;

        return (
          <section key={key} className="card overflow-hidden">
            <header
              className="flex items-baseline gap-2 border-b px-4 py-2"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="tabular text-sm font-bold">
                {jstMonth(day)}月{jstDay(day)}日
              </span>
              <span
                className="text-xs font-semibold"
                style={{
                  color:
                    weekday === 0
                      ? "var(--now-line)"
                      : weekday === 6
                        ? "var(--brand)"
                        : "var(--ink-muted)",
                }}
              >
                {WEEKDAY_LABELS[weekday]}
              </span>
              {label ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
                >
                  {label}
                </span>
              ) : null}
              <span className="ml-auto text-[11px] text-ink-faint">{dayEvents.length}件</span>
            </header>

            <ul>
              {dayEvents.map((event) => {
                const accent = eventAccent(event, staffById, categoryById);
                const category = categoryById.get(event.categoryId);
                const member = event.staffId ? staffById.get(event.staffId) : undefined;
                const isGoogle = event.source === "google";

                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onOpenEvent(event)}
                      title={isGoogle ? "Googleカレンダー・読み取り専用" : undefined}
                      className={`a-${accent} flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-2)] ${isGoogle ? "opacity-90" : ""}`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-9 w-1 shrink-0 rounded-full"
                        style={{
                          background: "var(--accent)",
                          ...(isGoogle
                            ? {
                                background: "transparent",
                                border: "1.5px dashed var(--accent)",
                              }
                            : undefined),
                        }}
                      />

                      <span className="tabular w-[4.5rem] shrink-0 text-xs font-semibold text-ink-muted">
                        {event.allDay ? (
                          "終日"
                        ) : (
                          <>
                            {formatTime(toJst(event.startsAt))}
                            <span className="block text-[10px] font-normal text-ink-faint">
                              {formatTime(toJst(event.endsAt))}
                            </span>
                          </>
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{event.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                          {isGoogle ? (
                            <span className="flex items-center gap-1">
                              <GoogleSourceIcon className="h-3 w-3" />
                              Googleカレンダー
                            </span>
                          ) : category ? (
                            <span className="flex items-center gap-1">
                              <CategoryIcon icon={category.icon} className="h-3 w-3" />
                              {category.name}
                            </span>
                          ) : null}
                          {event.location ? <span className="truncate">{event.location}</span> : null}
                        </span>
                      </span>

                      {member ? (
                        <span className="flex shrink-0 items-center gap-1.5">
                          <Avatar name={member.name} color={member.color} size="sm" />
                          <span className="hidden text-xs text-ink-muted sm:inline">
                            {member.name}
                          </span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-ink-faint">全体</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
