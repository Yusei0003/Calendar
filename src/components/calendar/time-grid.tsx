"use client";

import { useEffect, useRef } from "react";

import { CategoryIcon } from "@/components/calendar/event-chip";
import { byId, eventAccent } from "@/lib/display";
import { allDayEvents, layoutDay } from "@/lib/layout";
import { dateKey, formatTime, jstHour, jstMinute, nowJst, toJst } from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

/** 1時間あたりの高さ。24時間ぶんで約1250px になる。 */
const HOUR_PX = 52;
/** 画面を開いたときに見えていてほしい時刻 */
const SCROLL_TO_HOUR = 7;

export interface GridColumn {
  key: string;
  /** 列の見出し */
  header: React.ReactNode;
  /** この列が表す日 */
  day: Date;
  /** この列に出す予定 */
  events: CalendarEvent[];
  /** 日表示でスタッフ別に並べるときの担当者。新規作成の既定値に使う。 */
  staffId?: string | null;
  /** 今日の列か（当日の線を引くかどうか） */
  isToday?: boolean;
}

/**
 * 縦が時間、横が日付（または担当者）の表。週表示と日表示で共用する。
 */
export function TimeGrid({
  columns,
  staff,
  categories,
  onOpenEvent,
  onCreateAt,
}: {
  columns: GridColumn[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date, minutes: number, staffId?: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const staffById = byId(staff);
  const categoryById = byId(categories);

  // 0時から始まると空白ばかりが見えるので、朝の時間帯まで送っておく
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_PX;
  }, []);

  const now = nowJst();
  const nowMinutes = jstHour(now) * 60 + jstMinute(now);
  const hasAllDay = columns.some((column) => allDayEvents(column.events, column.day).length > 0);

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* 見出しの行 */}
      <div className="flex border-b" style={{ background: "var(--surface-2)" }}>
        <div className="w-12 shrink-0 sm:w-14" />
        {columns.map((column) => (
          <div key={column.key} className="min-w-0 flex-1 border-l px-1 py-2 text-center">
            {column.header}
          </div>
        ))}
      </div>

      {/* 終日の予定 */}
      {hasAllDay ? (
        <div className="flex border-b" style={{ background: "var(--surface-2)" }}>
          <div className="flex w-12 shrink-0 items-start justify-end pr-1.5 pt-1.5 text-[10px] text-ink-faint sm:w-14">
            終日
          </div>
          {columns.map((column) => (
            <div key={column.key} className="min-w-0 flex-1 space-y-1 border-l p-1">
              {allDayEvents(column.events, column.day).map((event) => {
                const accent = eventAccent(event, staffById, categoryById);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    title={event.title}
                    className={`a-${accent} chip flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px]`}
                  >
                    <span className="truncate font-medium">{event.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      {/* 時間帯 */}
      <div ref={scrollRef} className="relative max-h-[calc(100dvh-16rem)] overflow-y-auto">
        <div className="flex" style={{ height: `${24 * HOUR_PX}px` }}>
          {/* 時刻の目盛り */}
          <div className="relative w-12 shrink-0 sm:w-14">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="tabular absolute right-1.5 -translate-y-1/2 text-[10px] text-ink-faint"
                style={{ top: `${hour * HOUR_PX}px` }}
              >
                {hour === 0 ? "" : `${hour}:00`}
              </div>
            ))}
          </div>

          {columns.map((column) => {
            const slots = layoutDay(column.events, column.day);
            return (
              <div key={column.key} className="relative min-w-0 flex-1 border-l">
                {/* 1時間ごとの線と、押して新規作成できる領域 */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    onClick={() => onCreateAt(column.day, hour * 60, column.staffId)}
                    className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-3)]"
                    style={{
                      height: `${HOUR_PX}px`,
                      borderColor: "var(--line-soft)",
                    }}
                  />
                ))}

                {/* 現在時刻の線 */}
                {column.isToday ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: `${(nowMinutes / 60) * HOUR_PX}px` }}
                  >
                    <span
                      className="h-2 w-2 -translate-x-1/2 rounded-full"
                      style={{ background: "var(--now-line)" }}
                    />
                    <span className="h-px flex-1" style={{ background: "var(--now-line)" }} />
                  </div>
                ) : null}

                {/* 予定 */}
                {slots.map((slot) => {
                  const accent = eventAccent(slot.event, staffById, categoryById);
                  const category = categoryById.get(slot.event.categoryId);
                  const width = 100 / slot.lanes;
                  const short = slot.endMin - slot.startMin < 45;
                  return (
                    <button
                      key={`${dateKey(column.day)}-${slot.event.id}`}
                      type="button"
                      onClick={() => onOpenEvent(slot.event)}
                      title={`${formatTime(toJst(slot.event.startsAt))} ${slot.event.title}`}
                      className={`a-${accent} chip absolute flex flex-col items-start justify-start overflow-hidden rounded-md px-1.5 py-1 text-left`}
                      style={{
                        top: `${(slot.startMin / 60) * HOUR_PX}px`,
                        height: `${((slot.endMin - slot.startMin) / 60) * HOUR_PX - 2}px`,
                        left: `calc(${slot.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                    >
                      <span
                        className={`flex items-center gap-1 text-[11px] font-semibold leading-tight ${
                          short ? "" : "mb-0.5"
                        }`}
                      >
                        {category ? (
                          <CategoryIcon icon={category.icon} className="h-3 w-3 shrink-0 opacity-80" />
                        ) : null}
                        <span className="truncate">{slot.event.title}</span>
                      </span>
                      {short ? null : (
                        <span className="tabular block truncate text-[10px] opacity-75">
                          {formatTime(toJst(slot.event.startsAt))}–
                          {formatTime(toJst(slot.event.endsAt))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
