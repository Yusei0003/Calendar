/**
 * 日時の扱い。
 *
 * 保存は UTC、表示は日本時間に固定する（仕様書 5章）。
 * 日本には夏時間がないため、時差は年間を通して +09:00 で変わらない。
 * そこで「UTC に9時間足した Date を、UTC のゲッターで読む」という方法で
 * 日本時間の壁時計を表す。タイムゾーン用のライブラリを足さずに済み、
 * ずれも生じない。
 *
 * 以下、この「日本時間の壁時計を表す Date」を JstClock と呼ぶ。
 */

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 保存用の ISO 文字列（UTC）→ 日本時間の壁時計 */
export function toJst(iso: string): Date {
  return new Date(Date.parse(iso) + JST_OFFSET_MS);
}

/** 日本時間の壁時計 → 保存用の ISO 文字列（UTC） */
export function fromJst(clock: Date): string {
  return new Date(clock.getTime() - JST_OFFSET_MS).toISOString();
}

/** 今このときの日本時間 */
export function nowJst(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

/* --- 日付の組み立て・分解 ------------------------------------------- */

export function makeJst(year: number, month1to12: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, hour, minute, 0, 0));
}

export function jstYear(clock: Date): number {
  return clock.getUTCFullYear();
}

/** 1〜12 で返す（JavaScript の 0 始まりに合わせない） */
export function jstMonth(clock: Date): number {
  return clock.getUTCMonth() + 1;
}

export function jstDay(clock: Date): number {
  return clock.getUTCDate();
}

export function jstHour(clock: Date): number {
  return clock.getUTCHours();
}

export function jstMinute(clock: Date): number {
  return clock.getUTCMinutes();
}

/** 0=日曜 … 6=土曜 */
export function jstWeekday(clock: Date): number {
  return clock.getUTCDay();
}

export function startOfDay(clock: Date): Date {
  return new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()));
}

export function endOfDay(clock: Date): Date {
  return addDays(startOfDay(clock), 1);
}

export function addDays(clock: Date, days: number): Date {
  const next = new Date(clock.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addMinutes(clock: Date, minutes: number): Date {
  return new Date(clock.getTime() + minutes * 60_000);
}

export function addMonths(clock: Date, months: number): Date {
  const year = clock.getUTCFullYear();
  const month = clock.getUTCMonth() + months;
  const day = clock.getUTCDate();
  // 1月31日の1か月後のように、移動先に同じ日が無い場合は月末に寄せる
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(day, lastDay), clock.getUTCHours(), clock.getUTCMinutes()),
  );
}

export function startOfMonth(clock: Date): Date {
  return new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), 1));
}

/** その週の日曜日 0:00 */
export function startOfWeek(clock: Date): Date {
  return addDays(startOfDay(clock), -jstWeekday(clock));
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

/* --- 文字列との変換 -------------------------------------------------- */

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** "2026-09-15" 形式。日付の突き合わせに使う。 */
export function dateKey(clock: Date): string {
  return `${pad(jstYear(clock), 4)}-${pad(jstMonth(clock))}-${pad(jstDay(clock))}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return makeJst(year, month, day);
}

/** <input type="datetime-local"> が扱う "2026-09-15T14:30" 形式 */
export function toInputValue(clock: Date): string {
  return `${dateKey(clock)}T${pad(jstHour(clock))}:${pad(jstMinute(clock))}`;
}

export function fromInputValue(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return makeJst(year, month, day, hour, minute);
}

/* --- 表示用の書式 ---------------------------------------------------- */

/** "14:30" */
export function formatTime(clock: Date): string {
  return `${pad(jstHour(clock))}:${pad(jstMinute(clock))}`;
}

/** "9月15日(火)" */
export function formatDayLabel(clock: Date): string {
  return `${jstMonth(clock)}月${jstDay(clock)}日(${WEEKDAY_LABELS[jstWeekday(clock)]})`;
}

/** "2026年9月" */
export function formatMonthLabel(clock: Date): string {
  return `${jstYear(clock)}年${jstMonth(clock)}月`;
}

/** "2026年9月15日(火)" */
export function formatFullDate(clock: Date): string {
  return `${jstYear(clock)}年${formatDayLabel(clock)}`;
}

/* --- カレンダーの升目 ------------------------------------------------ */

/**
 * 月表示用の 42 日（6週×7日）。日曜始まりで、前後の月がはみ出して入る。
 * どの月でも高さが変わらないよう、常に6週分を返す。
 */
export function monthGrid(anchor: Date): Date[] {
  const first = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

/** 週表示用の7日 */
export function weekGrid(anchor: Date): Date[] {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/* --- 予定と日付の重なり判定 ------------------------------------------ */

/**
 * 予定が指定の日に少しでもかかっているか。
 * 終了時刻ちょうどは含めない（14:00〜15:00 の予定は15時の枠に出さない）。
 */
export function overlapsDay(startsAt: string, endsAt: string, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  const start = toJst(startsAt).getTime();
  const end = toJst(endsAt).getTime();
  return start < dayEnd && Math.max(end, start + 1) > dayStart;
}

/** 15分単位に丸める（ドラッグ操作の吸着に使う） */
export function snapToQuarter(clock: Date): Date {
  const minutes = jstHour(clock) * 60 + jstMinute(clock);
  const snapped = Math.round(minutes / 15) * 15;
  return addMinutes(startOfDay(clock), snapped);
}
