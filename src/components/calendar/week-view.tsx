"use client";

import { Avatar } from "@/components/avatar";
import { TimeGrid, type GridColumn } from "@/components/calendar/time-grid";
import type { DragPatch, DragPreview } from "@/lib/drag";
import { WEEKDAY_LABELS, dateKey, jstDay, jstWeekday, weekGrid } from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

/** 縦が時間、横が曜日。1週間を俯瞰する。 */
export function WeekView({
  anchor,
  today,
  events,
  staff,
  categories,
  onOpenEvent,
  onCreateAt,
  onDragPreview,
  onCommitDrag,
}: {
  anchor: Date;
  today: Date;
  events: CalendarEvent[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date, minutes: number, staffId?: string | null) => void;
  onDragPreview: (preview: DragPreview | null) => void;
  onCommitDrag: (event: CalendarEvent, patch: DragPatch) => void;
}) {
  const todayKey = dateKey(today);

  const columns: GridColumn[] = weekGrid(anchor).map((day) => {
    const weekday = jstWeekday(day);
    const isToday = dateKey(day) === todayKey;
    return {
      key: dateKey(day),
      day,
      events,
      isToday,
      header: (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[10px] font-semibold"
            style={{
              color:
                weekday === 0 ? "var(--now-line)" : weekday === 6 ? "var(--brand)" : "var(--ink-faint)",
            }}
          >
            {WEEKDAY_LABELS[weekday]}
          </span>
          <span
            className={`tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm ${
              isToday ? "font-bold" : "font-medium"
            }`}
            style={
              isToday
                ? { background: "var(--brand)", color: "var(--brand-ink)" }
                : { color: "var(--ink)" }
            }
          >
            {jstDay(day)}
          </span>
        </div>
      ),
    };
  });

  return (
    <TimeGrid
      columns={columns}
      staff={staff}
      categories={categories}
      onOpenEvent={onOpenEvent}
      onCreateAt={onCreateAt}
      onDragPreview={onDragPreview}
      onCommitDrag={onCommitDrag}
    />
  );
}

/** 縦が時間、横がスタッフ。その日に誰が何をしているかを見る。 */
export function DayView({
  anchor,
  today,
  events,
  staff,
  categories,
  onOpenEvent,
  onCreateAt,
  onDragPreview,
  onCommitDrag,
}: {
  anchor: Date;
  today: Date;
  events: CalendarEvent[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date, minutes: number, staffId?: string | null) => void;
  onDragPreview: (preview: DragPreview | null) => void;
  onCommitDrag: (event: CalendarEvent, patch: DragPatch) => void;
}) {
  const isToday = dateKey(anchor) === dateKey(today);

  const columns: GridColumn[] = staff.map((member) => ({
    key: member.id,
    day: anchor,
    staffId: member.id,
    isToday,
    events: events.filter((event) => event.staffId === member.id),
    header: (
      <div className="flex items-center justify-center gap-1.5">
        <Avatar name={member.name} color={member.color} size="sm" />
        <span className="hidden truncate text-xs font-medium sm:inline">{member.name}</span>
      </div>
    ),
  }));

  // 担当者のいない全体予定を最後の列にまとめる
  columns.push({
    key: "__store__",
    day: anchor,
    staffId: null,
    isToday,
    events: events.filter((event) => !event.staffId),
    header: <span className="text-xs font-medium text-ink-muted">全体</span>,
  });

  return (
    <TimeGrid
      columns={columns}
      staff={staff}
      categories={categories}
      onOpenEvent={onOpenEvent}
      onCreateAt={onCreateAt}
      onDragPreview={onDragPreview}
      onCommitDrag={onCommitDrag}
    />
  );
}
