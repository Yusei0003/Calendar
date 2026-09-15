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
 * 持たない「暦の上の日付」で、node-ical はこれを UTC の 0時として
 * Date にしている（2026-09-20T00:00:00Z）。一方このアプリの終日予定は
 * 「日本時間の0時」を基準に保存している（2026-09-19T15:00:00Z）。
 * この差（9時間）をそのままにすると、Google の終日予定が月表示などで
 * 前後の日にずれて（またがって）表示されてしまうため、ここで
 * 「暦の日付」だけを取り出し、日本時間の日付として作り直す。
 */
function toIso(value: Date, allDay: boolean): string {
  if (!allDay) return value.toISOString();
  return fromJst(makeJst(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()));
}

/**
 * ICS の文字列から、指定した期間にかかる予定を展開する。
 * 繰り返し予定（RRULE）・除外日（EXDATE）・1回だけの変更（RECURRENCE-ID）は
 * node-ical の expandRecurringEvent がまとめて面倒を見てくれる。
 */
export function parseIcsToEvents(icsText: string, from: Date, to: Date): GoogleEventInstance[] {
  const parsed = ical.sync.parseICS(icsText);
  const results: GoogleEventInstance[] = [];

  for (const [uid, component] of Object.entries(parsed)) {
    if (!component || component.type !== "VEVENT") continue;

    const instances = ical.expandRecurringEvent(component as VEvent, { from, to });
    for (const instance of instances) {
      const title = textOf(instance.summary) || "（件名なし）";
      const startsAt = toIso(instance.start, instance.isFullDay);
      const endsAt = toIso(instance.end, instance.isFullDay);
      results.push({
        uid: `${uid}:${instance.start.toISOString()}`,
        title,
        startsAt,
        endsAt,
        allDay: instance.isFullDay,
      });
      if (results.length >= MAX_INSTANCES) return results;
    }
  }

  return results;
}
