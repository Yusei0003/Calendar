import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isMultiDay, layoutWeek } from "./month-layout.ts";
import { addDays, makeJst } from "./time.ts";
import type { CalendarEvent } from "./types.ts";

/** 日本時間で指定した予定を作る */
function event(id: string, start: [number, number, number], end: [number, number, number], allDay = false): CalendarEvent {
  const iso = ([m, d, h]: [number, number, number]) =>
    new Date(makeJst(2026, m, d, h).getTime() - 9 * 3600_000).toISOString();
  return {
    id,
    scope: "staff",
    staffId: "s1",
    title: id,
    startsAt: iso(start),
    endsAt: iso(end),
    allDay,
    categoryId: "c1",
    location: "",
    note: "",
    createdBy: "",
    updatedBy: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    recurrenceRule: null,
    recurrenceUntil: null,
    parentEventId: null,
  };
}

// 2026/10/4（日）〜10/10（土）の週
const week = Array.from({ length: 7 }, (_, i) => addDays(makeJst(2026, 10, 4), i));

describe("複数日の予定の判定", () => {
  it("1日の終日予定（翌日0時まで）は複数日ではない", () => {
    assert.equal(isMultiDay(event("a", [10, 5, 0], [10, 6, 0], true)), false);
  });

  it("2日間の終日予定は複数日", () => {
    assert.equal(isMultiDay(event("a", [10, 5, 0], [10, 7, 0], true)), true);
  });

  it("日付をまたぐ夜の予定は複数日", () => {
    assert.equal(isMultiDay(event("a", [10, 5, 22], [10, 6, 2])), true);
  });

  it("ふつうの時間の予定は複数日ではない", () => {
    assert.equal(isMultiDay(event("a", [10, 5, 10], [10, 5, 11])), false);
  });
});

describe("月表示の週の並べ方", () => {
  it("複数日の予定は帯になり、1日の予定は各日に並ぶ", () => {
    const layout = layoutWeek(
      week,
      [event("trip", [10, 5, 0], [10, 8, 0], true), event("mtg", [10, 6, 10], [10, 6, 11])],
      3,
    );
    assert.equal(layout.bars.length, 1);
    assert.deepEqual(
      [layout.bars[0].startCol, layout.bars[0].endCol, layout.bars[0].lane],
      [1, 3, 0],
    );
    assert.equal(layout.laneCount, 1);
    assert.deepEqual(layout.singles[2].map((e) => e.id), ["mtg"]);
    assert.equal(layout.singles[1].length, 0);
  });

  it("重なる帯は別の段に、重ならない帯は同じ段に置く", () => {
    const layout = layoutWeek(
      week,
      [
        event("a", [10, 4, 0], [10, 7, 0], true), // 日〜火
        event("b", [10, 5, 0], [10, 7, 0], true), // 月〜火（a と重なる）
        event("c", [10, 8, 0], [10, 10, 0], true), // 木〜金（a と重ならない）
      ],
      3,
    );
    const laneOf = (id: string) => layout.bars.find((bar) => bar.event.id === id)?.lane;
    assert.equal(laneOf("a"), 0);
    assert.equal(laneOf("b"), 1);
    assert.equal(laneOf("c"), 0);
    assert.equal(layout.laneCount, 2);
  });

  it("週をまたぐ予定は、続きであることが分かる", () => {
    const layout = layoutWeek(week, [event("camp", [10, 2, 0], [10, 13, 0], true)], 3);
    const [bar] = layout.bars;
    assert.deepEqual([bar.startCol, bar.endCol], [0, 6]);
    assert.equal(bar.continuesBefore, true);
    assert.equal(bar.continuesAfter, true);
  });

  it("段が足りないぶんは隠し、その日の「ほか◯件」に数える", () => {
    const layout = layoutWeek(
      week,
      [
        event("a", [10, 5, 0], [10, 7, 0], true),
        event("b", [10, 5, 0], [10, 7, 0], true),
        event("c", [10, 5, 0], [10, 7, 0], true),
      ],
      2,
    );
    assert.equal(layout.bars.length, 2);
    assert.equal(layout.laneCount, 2);
    assert.deepEqual(layout.hiddenBars, [0, 1, 1, 0, 0, 0, 0]);
  });
});
