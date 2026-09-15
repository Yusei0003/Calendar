import { NextResponse, type NextRequest } from "next/server";

import { handleError, isResponse, jsonError, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseEventBody } from "@/lib/event-input";

/** 一度に取得できる期間の上限。広すぎる問い合わせで負荷が増えるのを防ぐ。 */
const MAX_RANGE_DAYS = 400;

export async function GET(request: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const params = request.nextUrl.searchParams;
    const from = params.get("from");
    const to = params.get("to");
    if (!from || !to) return jsonError("期間（from, to）を指定してください。", 400);
    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
      return jsonError("期間の形式が正しくありません。", 400);
    }
    if (Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return jsonError("一度に取得できる期間を超えています。", 400);
    }

    const events = await getStore().listEvents({ from, to });
    return NextResponse.json({ events });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const input = await parseEventBody(await request.json());
    const event = await getStore().createEvent(input, actor.name);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
