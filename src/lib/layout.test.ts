import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allDayEvents, layoutDay } from "./layout.ts";
import { makeJst } from "./time.ts";
import type { CalendarEvent } from "./types.ts";

/** 日本時間で start〜end の予定を作る（"HH:MM" 表記） */
function ev(id: string, start: string, end: string, allDay = false): CalendarEvent {
  const toIso = (hhmm: string) => {
    const [hour, minute] = hhmm.split(":").map(Number);
    return new Date(makeJst(2026, 9, 15, hour, minute).getTime() - 9 * 3600_000).toISOString();
  };
  return {
    id,
    scope: "staff",
    staffId: "s1",
    title: id,
    startsAt: toIso(start),
    endsAt: toIso(end),
    allDay,
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
  };
}

const day = makeJst(2026, 9, 15);

describe("時間帯表示の配置", () => {
  it("開始からの分数と長さを求める", () => {
    const [slot] = layoutDay([ev("a", "10:00", "11:30")], day);
    assert.equal(slot.startMin, 600);
    assert.equal(slot.endMin, 690);
    assert.equal(slot.lanes, 1);
  });

  it("重ならない予定は同じ列に置く", () => {
    const slots = layoutDay([ev("a", "09:00", "10:00"), ev("b", "10:00", "11:00")], day);
    assert.deepEqual(
      slots.map((s) => [s.event.id, s.lane, s.lanes]),
      [
        ["a", 0, 1],
        ["b", 0, 1],
      ],
    );
  });

  it("重なる予定は横に並べる", () => {
    const slots = layoutDay([ev("a", "10:00", "12:00"), ev("b", "11:00", "13:00")], day);
    assert.deepEqual(
      slots.map((s) => [s.event.id, s.lane, s.lanes]),
      [
        ["a", 0, 2],
        ["b", 1, 2],
      ],
    );
  });

  it("3本重なれば3列になる", () => {
    const slots = layoutDay(
      [ev("a", "10:00", "13:00"), ev("b", "10:30", "11:30"), ev("c", "11:00", "12:00")],
      day,
    );
    assert.equal(new Set(slots.map((s) => s.lane)).size, 3);
    assert.ok(slots.every((s) => s.lanes === 3));
  });

  it("重なりが途切れたら列数を数え直す", () => {
    const slots = layoutDay(
      [ev("a", "09:00", "10:00"), ev("b", "09:30", "10:00"), ev("c", "14:00", "15:00")],
      day,
    );
    const byId = new Map(slots.map((s) => [s.event.id, s]));
    assert.equal(byId.get("a")?.lanes, 2);
    assert.equal(byId.get("c")?.lanes, 1);
  });

  it("空いた列は次の予定に再利用する", () => {
    const slots = layoutDay(
      [ev("a", "09:00", "12:00"), ev("b", "09:00", "10:00"), ev("c", "10:00", "11:00")],
      day,
    );
    const byId = new Map(slots.map((s) => [s.event.id, s]));
    assert.equal(byId.get("b")?.lane, 1);
    assert.equal(byId.get("c")?.lane, 1);
    assert.equal(byId.get("a")?.lane, 0);
  });

  it("短すぎる予定にも最低限の高さを与える", () => {
    const [slot] = layoutDay([ev("a", "10:00", "10:05")], day);
    assert.equal(slot.endMin - slot.startMin, 20);
  });

  it("日をまたぐ予定はその日の部分だけを切り出す", () => {
    // 前日 23:00 から当日 01:00 まで
    const event = ev("a", "23:00", "01:00");
    event.startsAt = new Date(makeJst(2026, 9, 14, 23, 0).getTime() - 9 * 3600_000).toISOString();
    event.endsAt = new Date(makeJst(2026, 9, 15, 1, 0).getTime() - 9 * 3600_000).toISOString();

    const [onDay] = layoutDay([event], day);
    assert.equal(onDay.startMin, 0);
    assert.equal(onDay.endMin, 60);

    const [onPrev] = layoutDay([event], makeJst(2026, 9, 14));
    assert.equal(onPrev.startMin, 1380);
    assert.equal(onPrev.endMin, 1440);
  });

  it("終日の予定は時間帯に置かない", () => {
    assert.equal(layoutDay([ev("a", "00:00", "00:00", true)], day).length, 0);
  });

  it("別の日の予定は含めない", () => {
    assert.equal(layoutDay([ev("a", "10:00", "11:00")], makeJst(2026, 9, 16)).length, 0);
  });
});

describe("終日の予定の抽出", () => {
  it("終日の予定だけを返す", () => {
    const allDay = ev("a", "00:00", "00:00", true);
    allDay.startsAt = new Date(makeJst(2026, 9, 15).getTime() - 9 * 3600_000).toISOString();
    allDay.endsAt = new Date(makeJst(2026, 9, 16).getTime() - 9 * 3600_000).toISOString();

    assert.deepEqual(
      allDayEvents([allDay, ev("b", "10:00", "11:00")], day).map((e) => e.id),
      ["a"],
    );
    assert.equal(allDayEvents([allDay], makeJst(2026, 9, 16)).length, 0);
  });
});
