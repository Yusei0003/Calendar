"use client";

import { useEffect, useRef, useState } from "react";

import { CategoryIcon, GoogleSourceIcon } from "@/components/calendar/event-chip";
import { startGesture } from "@/lib/client/drag-gesture";
import { byId, eventAccent } from "@/lib/display";
import {
  MIN_DURATION_MIN,
  minutesToClock,
  moveTo,
  resizeEnd,
  resizeStart,
  scopeForStaff,
  snapMinutes,
  type DragPatch,
} from "@/lib/drag";
import { allDayEvents, layoutDay, type Slot } from "@/lib/layout";
import { dateKey, formatDayLabel, formatTime, jstHour, jstMinute, nowJst, toJst } from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

/** 1時間あたりの高さ。24時間ぶんで約1250px になる。 */
const HOUR_PX = 52;
/** 画面を開いたときに見えていてほしい時刻 */
const SCROLL_TO_HOUR = 7;
/** 上端・下端の掴む帯の高さ */
const HANDLE_PX = 7;

export interface GridColumn {
  key: string;
  /** 列の見出し */
  header: React.ReactNode;
  /** この列が表す日 */
  day: Date;
  /** この列に出す予定 */
  events: CalendarEvent[];
  /** 日表示でスタッフ別に並べるときの担当者。新規作成と担当者の変更に使う。 */
  staffId?: string | null;
  /** 今日の列か（当日の線を引くかどうか） */
  isToday?: boolean;
}

type DragKind = "move" | "resize-start" | "resize-end";

interface DragSession {
  event: CalendarEvent;
  kind: DragKind;
  originColumnKey: string;
  /** 掴んだ位置が、予定の開始から何分目だったか */
  grabOffsetMin: number;
  patch: DragPatch | null;
}

/**
 * 縦が時間、横が日付（または担当者）の表。週表示と日表示で共用する。
 * 予定は掴んで動かせ、上下の端を引っ張ると時間を変えられる。
 */
export function TimeGrid({
  columns,
  staff,
  categories,
  onOpenEvent,
  onCreateAt,
  onDragPreview,
  onCommitDrag,
}: {
  columns: GridColumn[];
  staff: Staff[];
  categories: Category[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date, minutes: number, staffId?: string | null) => void;
  onDragPreview: (preview: (DragPatch & { id: string }) | null) => void;
  onCommitDrag: (event: CalendarEvent, patch: DragPatch) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const session = useRef<DragSession | null>(null);
  /** ドラッグ直後のクリックで編集画面が開かないようにするための時刻 */
  const suppressClickUntil = useRef(0);

  const [badge, setBadge] = useState<{ x: number; y: number; text: string; eventId: string } | null>(null);

  const staffById = byId(staff);
  const categoryById = byId(categories);

  // 0時から始まると空白ばかりが見えるので、朝の時間帯まで送っておく
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_PX;
  }, []);

  const now = nowJst();
  const nowMinutes = jstHour(now) * 60 + jstMinute(now);
  const hasAllDay = columns.some((column) => allDayEvents(column.events, column.day).length > 0);

  /* --- ドラッグ --- */

  /** 指・マウスの位置がどの列にあるかを調べる。外に出たら端の列に寄せる。 */
  const columnAt = (clientX: number): GridColumn => {
    let fallback = columns[0];
    for (const column of columns) {
      const rect = columnRefs.current.get(column.key)?.getBoundingClientRect();
      if (!rect) continue;
      if (clientX >= rect.left && clientX <= rect.right) return column;
      if (clientX > rect.right) fallback = column;
    }
    return fallback;
  };

  /** 位置から、その列の0時を基準にした分数を求める。 */
  const minutesAt = (column: GridColumn, clientY: number): number => {
    const rect = columnRefs.current.get(column.key)?.getBoundingClientRect();
    if (!rect) return 0;
    return ((clientY - rect.top) / HOUR_PX) * 60;
  };

  const computePatch = (pointer: PointerEvent): DragPatch | null => {
    const current = session.current;
    if (!current) return null;

    const origin = columns.find((column) => column.key === current.originColumnKey) ?? columns[0];

    if (current.kind === "move") {
      const column = columnAt(pointer.clientX);
      const raw = minutesAt(column, pointer.clientY) - current.grabOffsetMin;
      const start = Math.max(0, Math.min(snapMinutes(raw), 24 * 60 - MIN_DURATION_MIN));
      const range = moveTo(current.event, minutesToClock(column.day, start));
      return {
        ...range,
        staffId: column.staffId,
        scope: scopeForStaff(column.staffId),
      };
    }

    // 時間を伸縮するときは列（＝日や担当者）を変えない
    const minutes = snapMinutes(minutesAt(origin, pointer.clientY));
    const clock = minutesToClock(origin.day, minutes);
    return current.kind === "resize-start"
      ? resizeStart(current.event, clock)
      : resizeEnd(current.event, clock);
  };

  const describe = (patch: DragPatch): string => {
    const start = toJst(patch.startsAt);
    const end = toJst(patch.endsAt);
    return `${formatDayLabel(start)} ${formatTime(start)}–${formatTime(end)}`;
  };

  const beginDrag = (
    down: React.PointerEvent<HTMLElement>,
    slot: Slot,
    column: GridColumn,
    kind: DragKind,
  ) => {
    // Google カレンダーから取り込んだ予定は読み取り専用。動かせない。
    if (slot.event.source === "google") return;
    if (down.button !== 0 && down.pointerType === "mouse") return;
    down.stopPropagation();

    const pointerMin = minutesAt(column, down.clientY);
    session.current = {
      event: slot.event,
      kind,
      originColumnKey: column.key,
      grabOffsetMin: pointerMin - slot.startMin,
      patch: null,
    };

    startGesture(down, {
      onActivate: (pointer) => {
        const patch = computePatch(pointer);
        if (!patch || !session.current) return;
        session.current.patch = patch;
        onDragPreview({ id: slot.event.id, ...patch });
        setBadge({ x: pointer.clientX, y: pointer.clientY, text: describe(patch), eventId: slot.event.id });
      },
      onMove: (pointer) => {
        const patch = computePatch(pointer);
        if (!patch || !session.current) return;
        session.current.patch = patch;
        onDragPreview({ id: slot.event.id, ...patch });
        setBadge({ x: pointer.clientX, y: pointer.clientY, text: describe(patch), eventId: slot.event.id });
      },
      onEnd: (dragged) => {
        const current = session.current;
        session.current = null;
        setBadge(null);

        if (!dragged || !current?.patch) {
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
                const isGoogle = event.source === "google";
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    title={`${event.title}${isGoogle ? "（Googleカレンダー・読み取り専用）" : ""}`}
                    className={`a-${accent} chip flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] ${isGoogle ? "opacity-90" : ""}`}
                    style={isGoogle ? { borderLeftStyle: "dashed" } : undefined}
                  >
                    {isGoogle ? <GoogleSourceIcon className="h-3 w-3 shrink-0 opacity-80" /> : null}
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
              <div
                key={column.key}
                ref={(node) => {
                  if (node) columnRefs.current.set(column.key, node);
                  else columnRefs.current.delete(column.key);
                }}
                className="relative min-w-0 flex-1 border-l"
              >
                {/* 1時間ごとの線と、押して新規作成できる領域 */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    onClick={() => onCreateAt(column.day, hour * 60, column.staffId)}
                    className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-3)]"
                    style={{ height: `${HOUR_PX}px`, borderColor: "var(--line-soft)" }}
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
                  const isGoogle = slot.event.source === "google";
                  const width = 100 / slot.lanes;
                  const height = ((slot.endMin - slot.startMin) / 60) * HOUR_PX - 2;
                  const short = slot.endMin - slot.startMin < 45;
                  const dragging = badge?.eventId === slot.event.id;

                  return (
                    <div
                      key={`${dateKey(column.day)}-${slot.event.id}`}
                      className="absolute"
                      style={{
                        top: `${(slot.startMin / 60) * HOUR_PX}px`,
                        height: `${height}px`,
                        left: `calc(${slot.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        zIndex: dragging ? 20 : undefined,
                      }}
                    >
                      <button
                        type="button"
                        onPointerDown={isGoogle ? undefined : (down) => beginDrag(down, slot, column, "move")}
                        onClick={() => openUnlessDragging(slot.event)}
                        title={`${formatTime(toJst(slot.event.startsAt))} ${slot.event.title}${
                          isGoogle ? "（Googleカレンダー・読み取り専用）" : ""
                        }`}
                        className={`a-${accent} chip flex h-full w-full flex-col items-start justify-start overflow-hidden rounded-md px-1.5 py-1 text-left ${
                          isGoogle ? "cursor-pointer opacity-90" : "cursor-grab active:cursor-grabbing"
                        }`}
                        style={{
                          touchAction: isGoogle ? undefined : "none",
                          opacity: dragging ? 0.85 : undefined,
                          borderLeftStyle: isGoogle ? "dashed" : undefined,
                        }}
                      >
                        <span
                          className={`flex items-center gap-1 text-[11px] font-semibold leading-tight ${
                            short ? "" : "mb-0.5"
                          }`}
                        >
                          {isGoogle ? (
                            <GoogleSourceIcon className="h-3 w-3 shrink-0 opacity-80" />
                          ) : category ? (
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

                      {/* 上下の端: 引っ張って時間を変える（Google の予定は読み取り専用なので出さない） */}
                      {slot.event.allDay || isGoogle ? null : (
                        <>
                          <span
                            role="presentation"
                            onPointerDown={(down) => beginDrag(down, slot, column, "resize-start")}
                            className="absolute inset-x-0 top-0 cursor-ns-resize"
                            style={{ height: `${HANDLE_PX}px`, touchAction: "none" }}
                          />
                          <span
                            role="presentation"
                            onPointerDown={(down) => beginDrag(down, slot, column, "resize-end")}
                            className="absolute inset-x-0 bottom-0 cursor-ns-resize"
                            style={{ height: `${HANDLE_PX}px`, touchAction: "none" }}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ドラッグ中に、離したらどこになるかを示す */}
      {badge ? (
        <div
          aria-live="polite"
          className="tabular pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[160%] rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-pop"
          style={{ left: badge.x, top: badge.y, background: "var(--ink)", color: "var(--canvas)" }}
        >
          {badge.text}
        </div>
      ) : null}
    </div>
  );
}
