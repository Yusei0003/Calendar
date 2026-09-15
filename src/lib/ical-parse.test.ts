import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedGoogleIcalUrl, parseIcsToEvents } from "./ical-parse.ts";

describe("URL の許可判定（SSRF対策）", () => {
  it("Google カレンダーの秘密のアドレス形式を許可する", () => {
    assert.equal(
      isAllowedGoogleIcalUrl(
        "https://calendar.google.com/calendar/ical/example%40gmail.com/private-abc123/basic.ics",
      ),
      true,
    );
  });

  it("http（暗号化なし）は拒否する", () => {
    assert.equal(
      isAllowedGoogleIcalUrl("http://calendar.google.com/calendar/ical/x/basic.ics"),
      false,
    );
  });

  it("Google 以外のドメインは拒否する（サーバーに任意の場所へアクセスさせられないように）", () => {
    assert.equal(isAllowedGoogleIcalUrl("https://evil.example.com/basic.ics"), false);
    assert.equal(isAllowedGoogleIcalUrl("https://calendar.google.com.evil.com/x"), false);
  });

  it("社内サーバーやローカルホストを指すURLは拒否する", () => {
    assert.equal(isAllowedGoogleIcalUrl("https://169.254.169.254/latest/meta-data"), false);
    assert.equal(isAllowedGoogleIcalUrl("https://localhost/x"), false);
  });

  it("Google の別サービス（カレンダー配信ではないパス）は拒否する", () => {
    assert.equal(isAllowedGoogleIcalUrl("https://calendar.google.com/calendar/render"), false);
  });

  it("壊れた文字列は拒否する", () => {
    assert.equal(isAllowedGoogleIcalUrl("not a url"), false);
    assert.equal(isAllowedGoogleIcalUrl(""), false);
  });
});

describe("ICS の解析・展開", () => {
  const from = new Date("2026-09-01T00:00:00Z");
  const to = new Date("2026-09-30T00:00:00Z");

  it("単発の予定をそのまま返す", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:single-1@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20260916T010000Z",
      "DTEND:20260916T023000Z",
      "SUMMARY:歯医者",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsToEvents(ics, from, to);
    assert.equal(events.length, 1);
    assert.equal(events[0].title, "歯医者");
    assert.equal(events[0].startsAt, "2026-09-16T01:00:00.000Z");
    assert.equal(events[0].endsAt, "2026-09-16T02:30:00.000Z");
    assert.equal(events[0].allDay, false);
  });

  it("終日の予定は日本時間の0時基準に直して保存する（当アプリの保存形式と一致させる）", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:allday-1@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART;VALUE=DATE:20260920",
      "DTEND;VALUE=DATE:20260921",
      "SUMMARY:終日イベント",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const [event] = parseIcsToEvents(ics, from, to);
    assert.equal(event.allDay, true);
    // Google の VALUE=DATE はタイムゾーンを持たない「暦の日付」。
    // このアプリの終日予定と同じ「日本時間の0時」基準に直して保存する
    // （9/20 の日本時間0時 = UTC では 9/19 15:00）。
    assert.equal(event.startsAt, "2026-09-19T15:00:00.000Z");
    assert.equal(event.endsAt, "2026-09-20T15:00:00.000Z");
  });

  it("毎週の繰り返しを展開する", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:weekly-1@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20260908T090000Z",
      "DTEND:20260908T100000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=5",
      "SUMMARY:週次ミーティング",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsToEvents(ics, from, to);
    // 9/8, 9/15, 9/22, 9/29 の4回ぶんが期間内（to=9/30 0:00 の手前まで。10/6 だけ期間外）
    assert.deepEqual(
      events.map((e) => e.startsAt),
      [
        "2026-09-08T09:00:00.000Z",
        "2026-09-15T09:00:00.000Z",
        "2026-09-22T09:00:00.000Z",
        "2026-09-29T09:00:00.000Z",
      ],
    );
    assert.ok(events.every((e) => e.title === "週次ミーティング"));
  });

  it("除外日（EXDATE）はスキップされる", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:weekly-2@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20260908T090000Z",
      "DTEND:20260908T100000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=5",
      "EXDATE:20260915T090000Z",
      "SUMMARY:週次ミーティング",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsToEvents(ics, from, to);
    assert.deepEqual(
      events.map((e) => e.startsAt),
      ["2026-09-08T09:00:00.000Z", "2026-09-22T09:00:00.000Z", "2026-09-29T09:00:00.000Z"],
    );
  });

  it("1回だけ時間変更された回（RECURRENCE-ID）は変更後の内容になる", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:weekly-3@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20260908T090000Z",
      "DTEND:20260908T100000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=5",
      "SUMMARY:週次ミーティング",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:weekly-3@google.com",
      "RECURRENCE-ID:20260915T090000Z",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20260915T140000Z",
      "DTEND:20260915T150000Z",
      "SUMMARY:週次ミーティング（時間変更）",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsToEvents(ics, from, to);
    const changed = events.find((e) => e.startsAt === "2026-09-15T14:00:00.000Z");
    assert.ok(changed, "変更後の回が見つかりません");
    assert.equal(changed?.title, "週次ミーティング（時間変更）");
    // 元の時刻（9:00）ではもう出てこない
    assert.ok(!events.some((e) => e.startsAt === "2026-09-15T09:00:00.000Z"));
  });

  it("期間の外にある予定は含めない", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:far-away@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20261225T010000Z",
      "DTEND:20261225T023000Z",
      "SUMMARY:クリスマス会",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    assert.equal(parseIcsToEvents(ics, from, to).length, 0);
  });

  it("件名が空でも落ちない", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:no-title@google.com",
      "DTSTAMP:20260901T000000Z",
      "DTSTART:20260916T010000Z",
      "DTEND:20260916T023000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const [event] = parseIcsToEvents(ics, from, to);
    assert.equal(event.title, "（件名なし）");
  });
});
