import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isUnchanged, moveTo, moveToDay, resizeEnd, resizeStart, snapMinutes } from "./drag.ts";
import { makeJst, toInputValue, toJst } from "./time.ts";
import type { CalendarEvent } from "./types.ts";

/** 日本時間 9/15 10:00〜11:30 の予定 */
function sample(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    scope: "staff",
    staffId: "s1",
    title: "打合せ",
    startsAt: "2026-09-15T01:00:00.000Z",
    endsAt: "2026-09-15T02:30:00.000Z",
    allDay: false,
    categoryId: "c1",
    location: "",
    note: "",
    createdBy: "",
    updatedBy: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    recurrenceRule: null,
    recurrenceUntil: null,
    parentEventId: null,
    ...patch,
  };
}

const show = (range: { startsAt: string; endsAt: string }) =>
  [toInputValue(toJst(range.startsAt)), toInputValue(toJst(range.endsAt))];

describe("15分への吸着", () => {
  it("近い方に寄せる", () => {
    assert.equal(snapMinutes(607), 600);
    assert.equal(snapMinutes(608), 615);
    assert.equal(snapMinutes(0), 0);
  });
});

describe("予定を動かす", () => {
  it("長さを保ったまま移る", () => {
    assert.deepEqual(show(moveTo(sample(), makeJst(2026, 9, 16, 14, 0))), [
      "2026-09-16T14:00",
      "2026-09-16T15:30",
    ]);
  });

  it("日をまたいでも長さを保つ", () => {
    assert.deepEqual(show(moveTo(sample(), makeJst(2026, 9, 15, 23, 0))), [
      "2026-09-15T23:00",
      "2026-09-16T00:30",
    ]);
  });
});

describe("上端・下端を引っ張る", () => {
  it("開始だけが動く", () => {
    assert.deepEqual(show(resizeStart(sample(), makeJst(2026, 9, 15, 9, 0))), [
      "2026-09-15T09:00",
      "2026-09-15T11:30",
    ]);
  });

  it("終了だけが動く", () => {
    assert.deepEqual(show(resizeEnd(sample(), makeJst(2026, 9, 15, 13, 0))), [
      "2026-09-15T10:00",
      "2026-09-15T13:00",
    ]);
  });

  it("開始を終了より後にはできない（最短15分を保つ）", () => {
    assert.deepEqual(show(resizeStart(sample(), makeJst(2026, 9, 15, 20, 0))), [
      "2026-09-15T11:15",
      "2026-09-15T11:30",
    ]);
  });

  it("終了を開始より前にはできない（最短15分を保つ）", () => {
    assert.deepEqual(show(resizeEnd(sample(), makeJst(2026, 9, 15, 5, 0))), [
      "2026-09-15T10:00",
      "2026-09-15T10:15",
    ]);
  });
});

describe("月表示での日付の移動", () => {
  it("時刻はそのままに日付だけ移る", () => {
    assert.deepEqual(show(moveToDay(sample(), makeJst(2026, 9, 20))), [
      "2026-09-20T10:00",
      "2026-09-20T11:30",
    ]);
  });

  it("月をまたいでも移せる", () => {
    assert.deepEqual(show(moveToDay(sample(), makeJst(2026, 10, 1))), [
      "2026-10-01T10:00",
      "2026-10-01T11:30",
    ]);
  });

  it("日をまたぐ予定は、開始日を基準にまとめて移る", () => {
    // 日本時間 9/15 23:00 〜 9/16 01:00
    const event = sample({
      startsAt: "2026-09-15T14:00:00.000Z",
      endsAt: "2026-09-15T16:00:00.000Z",
    });
    assert.deepEqual(show(moveToDay(event, makeJst(2026, 9, 20))), [
      "2026-09-20T23:00",
      "2026-09-21T01:00",
    ]);
  });

  it("同じ日に落としたら何も変わらない", () => {
    const event = sample();
    const range = moveToDay(event, makeJst(2026, 9, 15));
    assert.equal(isUnchanged(event, range), true);
  });
});

describe("変更の有無", () => {
  it("担当者だけが変わった場合も変更とみなす", () => {
    const event = sample();
    const range = { startsAt: event.startsAt, endsAt: event.endsAt };
    assert.equal(isUnchanged(event, range, "s2"), false);
    assert.equal(isUnchanged(event, range, "s1"), true);
    assert.equal(isUnchanged(event, range), true);
  });
});
