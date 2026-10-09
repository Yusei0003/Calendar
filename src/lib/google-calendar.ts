import "server-only";

import {
  expandEvents,
  isAllowedGoogleIcalUrl,
  parseIcs,
  type GoogleEventInstance,
  type ParsedIcs,
} from "@/lib/ical-parse";
import { GOOGLE_CATEGORY_ID } from "@/lib/types";
import type { CalendarEvent } from "@/lib/types";

export { isAllowedGoogleIcalUrl };

/**
 * スタッフ本人の Google カレンダー（秘密のiCal URL）を読み取り専用で取り込む。
 *
 * このファイルがサーバーから外部URLへアクセスする唯一の場所。
 * SSRF（サーバーに任意の場所へアクセスさせる攻撃）を防ぐため、
 * アクセス先は isAllowedGoogleIcalUrl で Google カレンダーの配信ドメインだけに
 * 固定している（ical-parse.ts 参照）。
 */

const FETCH_TIMEOUT_MS = 6_000;
/** これを超える応答は読み込まない（異常に大きい ICS を弾く安全弁）。 */
const MAX_RESPONSE_CHARS = 2 * 1024 * 1024;
/** 取得結果を覚えておく時間。Google 側の更新も数時間おきなので十分。 */
const CACHE_TTL_MS = 15 * 60 * 1000;
/**
 * 取得に失敗したことを覚えておく時間。これがないと、URL が無効になった人が
 * いるだけで、30秒ごとの自動更新のたびに全員ぶん Google へ問い合わせ直し、
 * 応答を待たされることになる。
 */
const FAILURE_TTL_MS = 5 * 60 * 1000;

export class GoogleCalendarError extends Error {}

/* ------------------------------------------------------------------ */
/* 取得（キャッシュなし・失敗したら例外を投げる版。保存時の確認に使う） */
/* ------------------------------------------------------------------ */

export async function fetchIcsTextFresh(url: string): Promise<string> {
  if (!isAllowedGoogleIcalUrl(url)) {
    throw new GoogleCalendarError(
      "そのURLは受け付けられません。Googleカレンダーの「設定」→「カレンダーの統合」→" +
        "「秘密のアドレス（iCal形式）」のURLを貼り付けてください。",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "KesenLarusCalendar/1.0 (+iCal import)" },
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new GoogleCalendarError("Google カレンダーへの接続がタイムアウトしました。");
    }
    throw new GoogleCalendarError("Google カレンダーに接続できませんでした。");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new GoogleCalendarError(
      `Google カレンダーの取得に失敗しました（${response.status}）。URLをご確認ください。`,
    );
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) {
    throw new GoogleCalendarError("カレンダーの内容が大きすぎて読み込めませんでした。");
  }
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new GoogleCalendarError("iCal形式のデータとして読み取れませんでした。URLをご確認ください。");
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* 取得（キャッシュあり・失敗したら null。予定の合成に使う）           */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  fetchedAt: number;
  /** 解析済みの予定。取得・解析に失敗したときは null。 */
  parsed: ParsedIcs | null;
}

/**
 * プロセス内メモリのキャッシュ。サーバーレス環境では実行環境が入れ替わると
 * 消えるが、その場合は次回また取得し直されるだけなので実害はない。
 * 文字列ではなく解析済みの形で持つので、30秒ごとの自動更新のたびに
 * 大きな ICS を解析し直すことはない。
 */
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ParsedIcs | null>>();

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  if (!entry) return false;
  const ttl = entry.parsed ? CACHE_TTL_MS : FAILURE_TTL_MS;
  return Date.now() - entry.fetchedAt < ttl;
}

async function getParsedCached(url: string): Promise<ParsedIcs | null> {
  const cached = cache.get(url);
  if (isFresh(cached)) return cached.parsed;

  const pending = inflight.get(url);
  if (pending) return pending;

  const promise = fetchIcsTextFresh(url)
    .then((text) => parseIcs(text))
    .catch((error) => {
      console.error("[google-calendar] 取得に失敗しました:", (error as Error).message);
      return null;
    })
    .then((parsed) => {
      cache.set(url, { fetchedAt: Date.now(), parsed });
      return parsed;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}

/** 連携を変えたとき（貼り直し・解除）に古い結果を使わないようにする。 */
export function forgetCached(url: string): void {
  cache.delete(url);
}

/* ------------------------------------------------------------------ */
/* CalendarEvent への変換                                              */
/* ------------------------------------------------------------------ */

function toCalendarEvent(staffId: string, instance: GoogleEventInstance): CalendarEvent {
  const now = new Date().toISOString();
  return {
    id: `google:${staffId}:${instance.uid}`,
    scope: "staff",
    staffId,
    title: instance.title,
    startsAt: instance.startsAt,
    endsAt: instance.endsAt,
    allDay: instance.allDay,
    categoryId: GOOGLE_CATEGORY_ID,
    location: "",
    note: "",
    createdBy: "Google カレンダー",
    updatedBy: "Google カレンダー",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    recurrenceRule: null,
    recurrenceUntil: null,
    parentEventId: null,
    source: "google",
  };
}

/**
 * 1人ぶんの Google カレンダーの予定を取ってくる。
 * 通信・解析のどちらで失敗しても例外は投げず、ok: false と空の予定を返す
 * （1人の連携が壊れていても、他の人の予定表示に影響させないため）。
 */
export async function fetchGoogleEventsForStaff(
  staffId: string,
  url: string,
  from: Date,
  to: Date,
): Promise<{ ok: boolean; events: CalendarEvent[] }> {
  const parsed = await getParsedCached(url);
  if (!parsed) return { ok: false, events: [] };

  try {
    const events = expandEvents(parsed, from, to).map((instance) =>
      toCalendarEvent(staffId, instance),
    );
    return { ok: true, events };
  } catch (error) {
    console.error("[google-calendar] 展開に失敗しました:", (error as Error).message);
    return { ok: false, events: [] };
  }
}
