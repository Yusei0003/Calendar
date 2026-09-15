import "server-only";

import {
  InvalidInput,
  optionalString,
  requireBoolean,
  requireIso,
  requireString,
} from "@/lib/api";
import { getStore } from "@/lib/db";
import type { EventInput, EventScope } from "@/lib/types";

/**
 * 画面から送られてきた予定の内容を検証して、保存できる形に整える。
 * 登録と更新の両方から使う。
 */
export async function parseEventBody(body: unknown): Promise<EventInput> {
  if (typeof body !== "object" || body === null) {
    throw new InvalidInput("送信された内容を読み取れませんでした。");
  }
  const input = body as Record<string, unknown>;

  const scope: EventScope = input.scope === "store" ? "store" : "staff";
  const staffId = typeof input.staffId === "string" && input.staffId ? input.staffId : null;
  if (scope === "staff" && !staffId) {
    throw new InvalidInput("担当するスタッフを選んでください。");
  }

  const startsAt = requireIso(input.startsAt, "開始日時");
  const endsAt = requireIso(input.endsAt, "終了日時");
  if (Date.parse(endsAt) < Date.parse(startsAt)) {
    throw new InvalidInput("終了日時は開始日時より後にしてください。");
  }

  const store = getStore();

  if (staffId) {
    const staff = await store.listStaff(true);
    if (!staff.some((member) => member.id === staffId)) {
      throw new InvalidInput("選ばれたスタッフが見つかりません。");
    }
  }

  const categoryId = requireString(input.categoryId, "分類", 100);
  const categories = await store.listCategories(true);
  if (!categories.some((category) => category.id === categoryId)) {
    throw new InvalidInput("選ばれた分類が見つかりません。");
  }

  return {
    scope,
    staffId,
    title: requireString(input.title, "件名", 120),
    startsAt,
    endsAt,
    allDay: requireBoolean(input.allDay, "終日"),
    categoryId,
    location: optionalString(input.location, "場所", 200),
    note: optionalString(input.note, "メモ"),
    // v1 では繰り返しを扱わないため常に空で保存する
    recurrenceRule: null,
    recurrenceUntil: null,
    parentEventId: null,
  };
}
