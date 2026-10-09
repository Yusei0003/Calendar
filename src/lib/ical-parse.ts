import ical, { type VEvent } from "node-ical";

import { fromJst, makeJst } from "@/lib/time";

/**
 * ICS（iCalendar）の解析・URL妥当性チェックの純粋な部分。
 *
 * サーバー限定の処理（fetch・キャッシュ）は google-calendar.ts に置き、
 * ここには外部通信を含まないロジックだけを置く（テストしやすくするため）。
 */

const ALLOWED_HOST = "calendar.google.com";
const ALLOWED_PATH_PREFIX = "/calendar/ical/";

/** これを超える件数は展開しない（壊れた/巨大な繰り返し設定への保険）。 */
export const MAX_INSTANCES = 500;

/** 「秘密のアドレス（iCal形式）」として妥当な URL か。 */
export function isAllowedGoogleIcalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === ALLOWED_HOST &&
    url.pathname.startsWith(ALLOWED_PATH_PREFIX)
  );
}

export interface GoogleEventInstance {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "val" in value) {
    return textOf((value as { val: unknown }).val);
  }
  return "";
}

/**
 * 終日予定（VALUE=DATE）の日時をこのアプリの終日の扱いに合わせ直す。
 *
 * ICS の日付だけの値（例: DTSTART;VALUE=DATE:20260920）はタイムゾーンを
 * 持たない「暦の上の日付」で、node-ical はこれを「サーバーの現地時刻の0時」
 * として Date にしている。一方このアプリの終日予定は「日本時間の0時」を
 * 基準に保存している（2026-09-19T15:00:00Z）。この差をそのままにすると、
 * Google の終日予定が月表示などで前後の日にずれて（またがって）表示されて
 * しまうため、ここで「暦の日付」だけを取り出し、日本時間の日付として作り直す。
 * （現地時刻で読むので、サーバーのタイムゾーンが UTC でも日本でも同じ結果になる）
 */
function toIso(value: Date, allDay: boolean): string {
  if (!allDay) return value.toISOString();
  return fromJst(makeJst(value.getFullYear(), value.getMonth() + 1, value.getDate()));
}

/** 解析済みの ICS。取得結果のキャッシュに入れておき、毎回の解析を省く。 */
export type ParsedIcs = VEvent[];

export function parseIcs(icsText: string): ParsedIcs {
  const parsed = ical.sync.parseICS(icsText);
  return Object.values(parsed).filter(
    (component): component is VEvent => Boolean(component) && component?.type === "VEVENT",
  );
}

/**
 * 解析済みの予定から、指定した期間にかかる回を展開する。
 * 繰り返し予定（RRULE）・除外日（EXDATE）・1回だけの変更（RECURRENCE-ID）は
 * node-ical の expandRecurringEvent がまとめて面倒を見てくれる。
 * 期間より前に始まって期間中も続いている予定（数日間の旅行など）も含める。
 */
export function expandEvents(events: ParsedIcs, from: Date, to: Date): GoogleEventInstance[] {
  const results: GoogleEventInstance[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const component of events) {
    const instances = ical.expandRecurringEvent(component, { from, to, expandOngoing: true });
    for (const instance of instances) {
      const startsAt = toIso(instance.start, instance.isFullDay);
      const endsAt = toIso(instance.end, instance.isFullDay);
      // 境界ちょうどで終わる・始まる回は期間に重なっていないので外す
      if (Date.parse(endsAt) <= fromMs || Date.parse(startsAt) >= toMs) continue;

      results.push({
        uid: `${component.uid}:${instance.start.toISOString()}`,
        title: textOf(instance.summary) || "（件名なし）",
        startsAt,
        endsAt,
        allDay: instance.isFullDay,
      });
      if (results.length >= MAX_INSTANCES) return results;
    }
  }

  return results;
}

/** ICS の文字列から、指定した期間にかかる予定を展開する。 */
export function parseIcsToEvents(icsText: string, from: Date, to: Date): GoogleEventInstance[] {
  return expandEvents(parseIcs(icsText), from, to);
}
