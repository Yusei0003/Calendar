import type { EventDraft } from "@/lib/client/api";
import {
  addMinutes,
  dateKey,
  endOfDay,
  fromInputValue,
  fromJst,
  makeJst,
  startOfDay,
  toInputValue,
  toJst,
} from "@/lib/time";
import type { CalendarEvent, EventScope } from "@/lib/types";

/** 入力欄が扱う形。日時は日本時間の文字列で持つ。 */
export interface EventForm {
  scope: EventScope;
  staffId: string;
  title: string;
  allDay: boolean;
  /** 終日でないとき: "2026-09-15T14:30" */
  start: string;
  end: string;
  /** 終日のとき: "2026-09-15" */
  startDate: string;
  endDate: string;
  categoryId: string;
  location: string;
  note: string;
}

/** 新規作成の初期値。空いている枠を押したときはその日時から始める。 */
export function newEventForm({
  at,
  staffId,
  categoryId,
}: {
  at: Date;
  staffId: string;
  categoryId: string;
}): EventForm {
  const start = at;
  const end = addMinutes(start, 60);
  return {
    scope: "staff",
    staffId,
    title: "",
    allDay: false,
    start: toInputValue(start),
    end: toInputValue(end),
    startDate: dateKey(start),
    endDate: dateKey(start),
    categoryId,
    location: "",
    note: "",
  };
}

export function eventToForm(event: CalendarEvent): EventForm {
  const start = toJst(event.startsAt);
  const end = toJst(event.endsAt);
  // 終日の予定は翌日0:00までを範囲として持つので、表示上は1日前に戻す
  const lastDay = event.allDay ? addMinutes(end, -1) : end;

  return {
    scope: event.scope,
    staffId: event.staffId ?? "",
    title: event.title,
    allDay: event.allDay,
    start: toInputValue(start),
    end: toInputValue(end),
    startDate: dateKey(start),
    endDate: dateKey(lastDay),
    categoryId: event.categoryId,
    location: event.location,
    note: event.note,
  };
}

export class FormError extends Error {}

/** 入力欄の内容を、保存できる形（UTC）に変換する。 */
export function formToDraft(form: EventForm): EventDraft {
  const title = form.title.trim();
  if (!title) throw new FormError("件名を入力してください。");
  if (form.scope === "staff" && !form.staffId) {
    throw new FormError("担当するスタッフを選んでください。");
  }
  if (!form.categoryId) throw new FormError("分類を選んでください。");

  let startsAt: string;
  let endsAt: string;

  if (form.allDay) {
    const from = parseDate(form.startDate, "開始日");
    const to = parseDate(form.endDate, "終了日");
    if (to.getTime() < from.getTime()) throw new FormError("終了日は開始日以降にしてください。");
    startsAt = fromJst(startOfDay(from));
    // 終了日の終わり（＝翌日0:00）までを範囲とする
    endsAt = fromJst(endOfDay(to));
  } else {
    const from = fromInputValue(form.start);
    const to = fromInputValue(form.end);
    if (Number.isNaN(from.getTime())) throw new FormError("開始日時を入力してください。");
    if (Number.isNaN(to.getTime())) throw new FormError("終了日時を入力してください。");
    if (to.getTime() < from.getTime()) {
      throw new FormError("終了日時は開始日時より後にしてください。");
    }
    startsAt = fromJst(from);
    endsAt = fromJst(to);
  }

  return {
    scope: form.scope,
    staffId: form.scope === "staff" ? form.staffId : form.staffId || null,
    title,
    startsAt,
    endsAt,
    allDay: form.allDay,
    categoryId: form.categoryId,
    location: form.location.trim(),
    note: form.note,
  };
}

function parseDate(value: string, label: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new FormError(`${label}を入力してください。`);
  return makeJst(year, month, day);
}

/**
 * 開始を動かしたら、同じ長さのまま終了もずらす。
 * 「10時から11時」を「14時から」に変えたとき、終了が15時になってほしいため。
 */
export function shiftEnd(form: EventForm, nextStart: string): EventForm {
  const previousStart = fromInputValue(form.start);
  const previousEnd = fromInputValue(form.end);
  const next = fromInputValue(nextStart);

  if (Number.isNaN(next.getTime()) || Number.isNaN(previousStart.getTime())) {
    return { ...form, start: nextStart };
  }

  const durationMs = Math.max(previousEnd.getTime() - previousStart.getTime(), 0);
  return {
    ...form,
    start: nextStart,
    end: toInputValue(new Date(next.getTime() + durationMs)),
  };
}
