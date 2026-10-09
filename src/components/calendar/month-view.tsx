"use client";

import { useRef, useState } from "react";

import { CategoryIcon, EventChip, GoogleSourceIcon } from "@/components/calendar/event-chip";
import { startGesture } from "@/lib/client/drag-gesture";
import { byId, eventAccent } from "@/lib/display";
import { isUnchanged, moveToDay, type DragPatch, type DragPreview } from "@/lib/drag";
import { layoutWeek, type BarSegment } from "@/lib/month-layout";
import {
  WEEKDAY_LABELS,
  addDays,
  dateKey,
  formatDayLabel,
  formatTime,
  jstDay,
  jstMonth,
  monthGrid,
  startOfDay,
  toJst,
} from "@/lib/time";
import type { AccentColor, CalendarEvent, Category, Staff } from "@/lib/types";

/** 1日の枠に並べる予定（帯＋1日の予定）の上限。超えたぶんは「ほか◯件」にまとめる。 */
const MAX_ITEMS = 3;
/** 複数日の帯を何段まで重ねるか。 */
const MAX_LANES = 2;
/** 帯1段ぶんの高さ（px）。帯の高さ＋すき間。 */
const LANE_PX = 23;

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

  // 6週それぞれについて、複数日の帯と1日の予定の並べ方を決める
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const weekDays = days.slice(index * 7, index * 7 + 7);
    return { days: weekDays, layout: layoutWeek(weekDays, events, MAX_LANES) };
  });

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

    // 何日にもまたがる帯の途中をつかんだときは、つかんだ位置と開始日の差を保って動かす
    const grabbedDay = dayAt(down.clientX, down.clientY);
    const grabOffset = grabbedDay
      ? Math.round(
          (startOfDay(grabbedDay).getTime() - startOfDay(toJst(event.startsAt)).getTime()) /
            86_400_000,
        )
      : 0;

    const update = (pointer: PointerEvent) => {
      const day = dayAt(pointer.clientX, pointer.clientY);
      if (!day || !dragging.current) return;
      const patch = moveToDay(event, addDays(day, -grabOffset));
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

      {/* 6週×7日。週ごとに、複数日の帯を日の枠の上に重ねて描く */}
      {weeks.map((week) => (
        <div key={dateKey(week.days[0])} className="relative grid grid-cols-7">
          {week.days.map((day, col) => {
            const key = dateKey(day);
            const singles = week.layout.singles[col];
            const outside = jstMonth(day) !== currentMonth;
            const isToday = key === todayKey;
            const weekday = day.getUTCDay();
            const room = Math.max(1, MAX_ITEMS - week.layout.laneCount);
            const shown = singles.slice(0, room);
            const hidden = singles.length - shown.length + week.layout.hiddenBars[col];
            const total =
              singles.length +
              week.layout.hiddenBars[col] +
              week.layout.bars.filter((bar) => bar.startCol <= col && col <= bar.endCol).length;

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
                aria-label={`${jstMonth(day)}月${jstDay(day)}日 予定${total}件`}
                className="min-h-[5.5rem] cursor-pointer border-b border-r p-1 transition-colors duration-150 last:border-r-0 sm:min-h-[7.5rem] sm:p-1.5"
                style={{
                  background:
                    hoverKey === key
                      ? "var(--surface-3)"
                      : outside
                        ? "var(--canvas)"
                        : isToday
                        ? "var(--grid-today)"
                        : weekday === 0 || weekday === 6
                          ? "var(--grid-weekend)"
                          : "var(--surface)",
                  boxShadow: hoverKey === key ? "inset 0 0 0 2px var(--brand)" : undefined,
                }}
              >
                <div
                  className="mb-1 flex h-5 items-center justify-between px-0.5"
                  style={{ opacity: outside ? 0.45 : 1 }}
                >
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

                {/* 帯のぶんの場所をあけておく */}
                <div aria-hidden="true" style={{ height: week.layout.laneCount * LANE_PX }} />

                <div
                  className="flex flex-col gap-[3px]"
                  style={{ opacity: outside ? 0.55 : 1 }}
                >
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

          {/* 複数日の帯。日の番号の下に、週の行をまたいで重ねる */}
          <div className="pointer-events-none absolute inset-x-0 top-[28px] sm:top-[30px]">
            {week.layout.bars.map((bar) => (
              <SpanBar
                key={`${dateKey(week.days[0])}-${bar.event.id}`}
                bar={bar}
                accent={eventAccent(bar.event, staffById, categoryById)}
                category={categoryById.get(bar.event.categoryId)}
                staffName={
                  bar.event.staffId ? (staffById.get(bar.event.staffId)?.name ?? null) : null
                }
                onOpen={openUnlessDragging}
                onPointerDown={
                  bar.event.source === "google" ? undefined : (down) => beginDrag(down, bar.event)
                }
              />
            ))}
          </div>
        </div>
      ))}

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

/** 何日にもまたがる予定の帯。週をまたぐときは端を角にして「続き」を表す。 */
function SpanBar({
  bar,
  accent,
  category,
  staffName,
  onOpen,
  onPointerDown,
}: {
  bar: BarSegment;
  accent: AccentColor;
  category: Category | undefined;
  staffName: string | null;
  onOpen: (event: CalendarEvent) => void;
  onPointerDown?: (down: React.PointerEvent<HTMLElement>) => void;
}) {
  const { event } = bar;
  const isGoogle = event.source === "google";
  // 途中の週から続いている帯では、時刻は出さない（始まりの週だけに出す）
  const time =
    event.allDay || bar.continuesBefore ? null : formatTime(toJst(event.startsAt));
  const label = [
    event.allDay ? "終日" : formatTime(toJst(event.startsAt)),
    staffName,
    event.title,
    isGoogle ? "（Googleカレンダー・読み取り専用）" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const span = bar.endCol - bar.startCol + 1;
  const inset = 3;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onOpen(event);
      }}
      aria-label={label}
      title={label}
      className={`a-${accent} chip pointer-events-auto absolute flex h-5 items-center gap-1.5 overflow-hidden px-1.5 text-left text-[11px] ${
        isGoogle ? "opacity-90" : ""
      }`}
      style={{
        top: bar.lane * LANE_PX,
        left: `calc(${bar.startCol} * 100% / 7 + ${bar.continuesBefore ? 0 : inset}px)`,
        width: `calc(${span} * 100% / 7 - ${(bar.continuesBefore ? 0 : inset) + (bar.continuesAfter ? 0 : inset)}px)`,
        borderTopLeftRadius: bar.continuesBefore ? 0 : 6,
        borderBottomLeftRadius: bar.continuesBefore ? 0 : 6,
        borderTopRightRadius: bar.continuesAfter ? 0 : 6,
        borderBottomRightRadius: bar.continuesAfter ? 0 : 6,
        borderLeftWidth: bar.continuesBefore ? 0 : undefined,
        borderLeftStyle: isGoogle ? "dashed" : undefined,
        ...(onPointerDown ? { touchAction: "none" } : undefined),
      }}
    >
      {bar.continuesBefore ? (
        <span aria-hidden="true" className="shrink-0 opacity-70">
          ‹
        </span>
      ) : isGoogle ? (
        <GoogleSourceIcon className="hidden h-3 w-3 shrink-0 opacity-80 sm:block" />
      ) : category ? (
        <CategoryIcon icon={category.icon} className="hidden h-3 w-3 shrink-0 opacity-80 sm:block" />
      ) : null}
      {time ? <span className="tabular hidden shrink-0 font-semibold opacity-80 sm:inline">{time}</span> : null}
      <span className="truncate font-semibold">{event.title}</span>
      {staffName && span > 1 ? (
        <span className="hidden shrink-0 truncate text-[10px] opacity-70 sm:inline">{staffName}</span>
      ) : null}
      {bar.continuesAfter ? (
        <span aria-hidden="true" className="ml-auto shrink-0 opacity-70">
          ›
        </span>
      ) : null}
    </button>
  );
}
