import { NextResponse } from "next/server";

import { handleError, isResponse, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { fetchIcsTextFresh, forgetCached, GoogleCalendarError } from "@/lib/google-calendar";
import { parseIcsToEvents } from "@/lib/ical-parse";

/**
 * 本人の Google カレンダー連携。
 *
 * 3つの操作すべてで staffId は受け取らず、必ず「合言葉ログイン中に
 * 名乗っている本人」（requireActor の戻り値）だけを対象にする。
 * これにより、他人の秘密のURLを覗いたり書き換えたりする経路が
 * そもそも存在しない。
 */

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const url = await getStore().getGoogleIcalUrl(actor.id);
    // URL そのものは返さない（設定画面を開いた人全員に秘密の文字列が
    // 見えてしまうのを避けるため）。連携しているかどうかだけ知らせる。
    if (!url) return NextResponse.json({ connected: false });

    // Google 側で「秘密のアドレス」を作り直すと、登録済みの URL は使えなくなる。
    // 設定画面を開いたときに実際に読めるか確かめ、壊れていれば知らせる。
    try {
      forgetCached(url);
      await fetchIcsTextFresh(url);
      return NextResponse.json({ connected: true, problem: null });
    } catch (error) {
      const problem =
        error instanceof GoogleCalendarError ? error.message : "読み込みを確認できませんでした。";
      return NextResponse.json({ connected: true, problem });
    }
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json(
        { error: "GoogleカレンダーのURLを入力してください。" },
        { status: 400 },
      );
    }

    // 保存する前に、実際に読み込めるURLかその場で確認する
    const text = await fetchIcsTextFresh(url);
    const now = new Date();
    const previewTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const eventCount = parseIcsToEvents(text, now, previewTo).length;

    const store = getStore();
    const previous = await store.getGoogleIcalUrl(actor.id);
    if (previous) forgetCached(previous);
    await store.setGoogleIcalUrl(actor.id, url);
    return NextResponse.json({ connected: true, eventCount });
  } catch (error) {
    if (error instanceof GoogleCalendarError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleError(error);
  }
}

export async function DELETE() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const store = getStore();
    const previous = await store.getGoogleIcalUrl(actor.id);
    if (previous) forgetCached(previous);
    await store.setGoogleIcalUrl(actor.id, null);
    return NextResponse.json({ connected: false });
  } catch (error) {
    return handleError(error);
  }
}
