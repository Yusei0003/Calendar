import { addMinutes, fromJst, startOfDay, toJst } from "@/lib/time";
import type { CalendarEvent, EventScope } from "@/lib/types";

/** ドラッグで作れる最短の長さ。これ以上は縮められない。 */
export const MIN_DURATION_MIN = 15;

/** 吸着の単位（仕様書 3.2.1）。 */
export const SNAP_MIN = 15;

export interface Range {
  startsAt: string;
  endsAt: string;
}

/** 分数を15分単位に丸める。 */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
}

/** 画面上の位置（その日の0時からの分数）から、日本時間の時刻を作る。 */
export function minutesToClock(day: Date, minutes: number): Date {
  return addMinutes(startOfDay(day), minutes);
}

function durationMs(event: CalendarEvent): number {
  return Math.max(Date.parse(event.endsAt) - Date.parse(event.startsAt), 0);
}

/**
 * 予定を丸ごと動かす。長さは変えない。
 * newStart は日本時間の壁時計。
 */
export function moveTo(event: CalendarEvent, newStart: Date): Range {
  const startsAt = fromJst(newStart);
  return {
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + durationMs(event)).toISOString(),
  };
}

/** 上端を引っ張って開始時刻を変える。終了時刻は動かさない。 */
export function resizeStart(event: CalendarEvent, newStart: Date): Range {
  const endMs = Date.parse(event.endsAt);
  const latest = endMs - MIN_DURATION_MIN * 60_000;
  const startMs = Math.min(fromJstMs(newStart), latest);
  return { startsAt: new Date(startMs).toISOString(), endsAt: event.endsAt };
}

/** 下端を引っ張って終了時刻を変える。開始時刻は動かさない。 */
export function resizeEnd(event: CalendarEvent, newEnd: Date): Range {
  const startMs = Date.parse(event.startsAt);
  const earliest = startMs + MIN_DURATION_MIN * 60_000;
  const endMs = Math.max(fromJstMs(newEnd), earliest);
  return { startsAt: event.startsAt, endsAt: new Date(endMs).toISOString() };
}

function fromJstMs(clock: Date): number {
  return Date.parse(fromJst(clock));
}

/** 月表示のドラッグ: 時刻はそのままに、日付だけを移す。 */
export function moveToDay(event: CalendarEvent, targetDay: Date): Range {
  const start = toJst(event.startsAt);
  const dayDiff = Math.round(
    (startOfDay(targetDay).getTime() - startOfDay(start).getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return { startsAt: event.startsAt, endsAt: event.endsAt };

  const shiftMs = dayDiff * 86_400_000;
  return {
    startsAt: new Date(Date.parse(event.startsAt) + shiftMs).toISOString(),
    endsAt: new Date(Date.parse(event.endsAt) + shiftMs).toISOString(),
  };
}

/** 変更が実際にあったか。無ければ保存もしない。 */
export function isUnchanged(event: CalendarEvent, range: Range, staffId?: string | null): boolean {
  const sameStaff = staffId === undefined || staffId === event.staffId;
  return range.startsAt === event.startsAt && range.endsAt === event.endsAt && sameStaff;
}

/** ドラッグ中・確定時に渡す変更内容。 */
export interface DragPatch extends Range {
  /** 日表示で列をまたいだときの担当者。変更しない場合は undefined。 */
  staffId?: string | null;
  /** 担当者が外れた（または付いた）ときの種別。 */
  scope?: EventScope;
}

/** 画面に出すドラッグ中の予定。 */
export interface DragPreview extends DragPatch {
  id: string;
}

/**
 * 担当者の変更にあわせて種別を決める。
 * 日表示の「全体」列に落としたら全体予定に、スタッフ列に落としたらスタッフ予定にする。
 */
export function scopeForStaff(staffId: string | null | undefined): EventScope | undefined {
  if (staffId === undefined) return undefined;
  return staffId ? "staff" : "store";
}
