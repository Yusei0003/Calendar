import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMonths,
  dateKey,
  formatDayLabel,
  formatMonthLabel,
  fromInputValue,
  fromJst,
  makeJst,
  monthGrid,
  overlapsDay,
  snapToQuarter,
  startOfWeek,
  toInputValue,
  toJst,
  weekGrid,
} from "./time.ts";

describe("UTC と日本時間の変換", () => {
  it("UTC の 00:00 は日本時間の同日 09:00", () => {
    assert.equal(toInputValue(toJst("2026-09-15T00:00:00.000Z")), "2026-09-15T09:00");
  });

  it("UTC の 15:00 は日本時間の翌日 00:00", () => {
    assert.equal(toInputValue(toJst("2026-09-15T15:00:00.000Z")), "2026-09-16T00:00");
  });

  it("往復させても元に戻る", () => {
    const iso = "2026-03-01T22:45:00.000Z";
    assert.equal(fromJst(toJst(iso)), iso);
  });

  it("夏でも冬でも時差は9時間で変わらない", () => {
    assert.equal(toInputValue(toJst("2026-07-01T00:00:00.000Z")), "2026-07-01T09:00");
    assert.equal(toInputValue(toJst("2026-12-01T00:00:00.000Z")), "2026-12-01T09:00");
  });

  it("入力欄の文字列を日本時間として読む", () => {
    assert.equal(fromJst(fromInputValue("2026-09-15T14:30")), "2026-09-15T05:30:00.000Z");
  });
});

describe("月の移動", () => {
  it("移動先に同じ日が無ければ月末に寄せる", () => {
    assert.equal(dateKey(addMonths(makeJst(2026, 1, 31), 1)), "2026-02-28");
    assert.equal(dateKey(addMonths(makeJst(2024, 1, 31), 1)), "2024-02-29");
  });

  it("年をまたぐ", () => {
    assert.equal(dateKey(addMonths(makeJst(2026, 12, 15), 1)), "2027-01-15");
    assert.equal(dateKey(addMonths(makeJst(2026, 1, 15), -1)), "2025-12-15");
  });
});

describe("カレンダーの升目", () => {
  it("月表示は常に6週ぶん（42日）", () => {
    for (const month of [1, 2, 5, 8, 11]) {
      assert.equal(monthGrid(makeJst(2026, month, 1)).length, 42);
    }
  });

  it("月表示は日曜始まり", () => {
    const grid = monthGrid(makeJst(2026, 9, 1));
    assert.equal(dateKey(grid[0]), "2026-08-30");
    assert.equal(grid[0].getUTCDay(), 0);
  });

  it("2月がちょうど4週でも6週ぶん返す", () => {
    const grid = monthGrid(makeJst(2021, 2, 1));
    assert.equal(dateKey(grid[0]), "2021-01-31");
    assert.equal(dateKey(grid[41]), "2021-03-13");
  });

  it("週表示は日曜から土曜", () => {
    const week = weekGrid(makeJst(2026, 9, 15));
    assert.equal(dateKey(week[0]), "2026-09-13");
    assert.equal(dateKey(week[6]), "2026-09-19");
  });

  it("日曜を基準にしても週はその日から始まる", () => {
    assert.equal(dateKey(startOfWeek(makeJst(2026, 9, 13))), "2026-09-13");
  });
});

describe("予定と日付の重なり", () => {
  const day = makeJst(2026, 9, 15);

  it("その日に始まる予定は含む", () => {
    assert.equal(overlapsDay("2026-09-15T01:00:00.000Z", "2026-09-15T02:00:00.000Z", day), true);
  });

  it("日をまたぐ予定は両方の日に出る", () => {
    // 日本時間 9/14 23:00 〜 9/15 01:00
    const starts = "2026-09-14T14:00:00.000Z";
    const ends = "2026-09-14T16:00:00.000Z";
    assert.equal(overlapsDay(starts, ends, makeJst(2026, 9, 14)), true);
    assert.equal(overlapsDay(starts, ends, day), true);
  });

  it("前日に終わる予定は含まない", () => {
    assert.equal(overlapsDay("2026-09-13T01:00:00.000Z", "2026-09-13T02:00:00.000Z", day), false);
  });

  it("翌日0:00ちょうどに終わる予定は翌日に出さない", () => {
    // 日本時間 9/15 22:00 〜 9/16 00:00
    const starts = "2026-09-15T13:00:00.000Z";
    const ends = "2026-09-15T15:00:00.000Z";
    assert.equal(overlapsDay(starts, ends, day), true);
    assert.equal(overlapsDay(starts, ends, makeJst(2026, 9, 16)), false);
  });

  it("時間の幅がない予定もその日に出る", () => {
    const at = "2026-09-15T03:00:00.000Z";
    assert.equal(overlapsDay(at, at, day), true);
  });
});

describe("表示の書式", () => {
  it("曜日を添えた日付", () => {
    assert.equal(formatDayLabel(makeJst(2026, 9, 15)), "9月15日(火)");
  });

  it("月の見出し", () => {
    assert.equal(formatMonthLabel(makeJst(2026, 9, 15)), "2026年9月");
  });
});

describe("15分への吸着", () => {
  it("近い方の15分に寄せる", () => {
    assert.equal(toInputValue(snapToQuarter(makeJst(2026, 9, 15, 10, 7))), "2026-09-15T10:00");
    assert.equal(toInputValue(snapToQuarter(makeJst(2026, 9, 15, 10, 8))), "2026-09-15T10:15");
    assert.equal(toInputValue(snapToQuarter(makeJst(2026, 9, 15, 10, 53))), "2026-09-15T11:00");
  });

  it("日付をまたぐ吸着でも日付が正しく進む", () => {
    assert.equal(toInputValue(snapToQuarter(makeJst(2026, 9, 15, 23, 58))), "2026-09-16T00:00");
  });
});

/* --- 入力フォームの変換 --------------------------------------------- */

import { eventToForm, formToDraft, newEventForm, shiftEnd } from "./event-form.ts";
import type { CalendarEvent } from "./types.ts";

function sampleEvent(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    scope: "staff",
    staffId: "s1",
    title: "打合せ",
    startsAt: "2026-09-15T01:00:00.000Z",
    endsAt: "2026-09-15T02:00:00.000Z",
    allDay: false,
    categoryId: "c1",
    location: "",
    note: "",
    createdBy: "脇坂健吾",
    updatedBy: "脇坂健吾",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    recurrenceRule: null,
    recurrenceUntil: null,
    parentEventId: null,
    ...patch,
  };
}

describe("予定と入力欄の往復", () => {
  it("時刻つきの予定を往復させても変わらない", () => {
    const event = sampleEvent();
    const draft = formToDraft(eventToForm(event));
    assert.equal(draft.startsAt, event.startsAt);
    assert.equal(draft.endsAt, event.endsAt);
    assert.equal(draft.allDay, false);
  });

  it("終日の予定は翌日0:00までを範囲として保存する", () => {
    const form = eventToForm(
      sampleEvent({
        allDay: true,
        // 日本時間 9/15 0:00 〜 9/16 0:00（＝9/15 の1日）
        startsAt: "2026-09-14T15:00:00.000Z",
        endsAt: "2026-09-15T15:00:00.000Z",
      }),
    );
    // 表示上は開始日・終了日ともに 9/15
    assert.equal(form.startDate, "2026-09-15");
    assert.equal(form.endDate, "2026-09-15");

    const draft = formToDraft(form);
    assert.equal(draft.startsAt, "2026-09-14T15:00:00.000Z");
    assert.equal(draft.endsAt, "2026-09-15T15:00:00.000Z");
  });

  it("複数日にまたがる終日の予定も往復する", () => {
    const event = sampleEvent({
      allDay: true,
      startsAt: "2026-09-14T15:00:00.000Z", // 9/15
      endsAt: "2026-09-17T15:00:00.000Z", // 9/17 の終わり
    });
    const form = eventToForm(event);
    assert.equal(form.startDate, "2026-09-15");
    assert.equal(form.endDate, "2026-09-17");
    assert.equal(formToDraft(form).endsAt, event.endsAt);
  });

  it("件名が空なら保存させない", () => {
    assert.throws(() => formToDraft({ ...eventToForm(sampleEvent()), title: "  " }), /件名/);
  });

  it("終了が開始より前なら保存させない", () => {
    const form = { ...eventToForm(sampleEvent()), end: "2026-09-15T09:00" };
    assert.throws(() => formToDraft(form), /終了日時/);
  });

  it("担当者のいないスタッフ予定は保存させない", () => {
    assert.throws(() => formToDraft({ ...eventToForm(sampleEvent()), staffId: "" }), /スタッフ/);
  });
});

describe("開始を動かしたときの終了時刻", () => {
  it("長さを保ったままずれる", () => {
    const form = newEventForm({ at: makeJst(2026, 9, 15, 10, 0), staffId: "s1", categoryId: "c1" });
    assert.equal(form.end, "2026-09-15T11:00");

    const moved = shiftEnd(form, "2026-09-15T14:00");
    assert.equal(moved.end, "2026-09-15T15:00");
  });

  it("日をまたぐ移動でも長さを保つ", () => {
    const form = newEventForm({ at: makeJst(2026, 9, 15, 23, 0), staffId: "s1", categoryId: "c1" });
    assert.equal(form.end, "2026-09-16T00:00");
    assert.equal(shiftEnd(form, "2026-09-30T23:30").end, "2026-10-01T00:30");
  });
});
