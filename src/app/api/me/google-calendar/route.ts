import { NextResponse } from "next/server";

import { handleError, isResponse, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { fetchIcsTextFresh, GoogleCalendarError } from "@/lib/google-calendar";
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
    return NextResponse.json({ connected: Boolean(url) });
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

    await getStore().setGoogleIcalUrl(actor.id, url);
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
    await getStore().setGoogleIcalUrl(actor.id, null);
    return NextResponse.json({ connected: false });
  } catch (error) {
    return handleError(error);
  }
}
