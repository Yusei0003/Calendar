import { NextResponse, type NextRequest } from "next/server";

import { handleError, isResponse, requireActor, requireActorContext } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseEventBody } from "@/lib/event-input";
import { readRange } from "@/lib/range-param";

/**
 * このアプリに登録された予定。
 * Google カレンダーから取り込む予定は応答が遅いことがあるので、
 * 別の窓口（/api/events/google）から後追いで取りに行く。
 */
export async function GET(request: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const events = await getStore().listEvents(readRange(request));
    return NextResponse.json({ events });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const context = await requireActorContext();
  if (isResponse(context)) return context;

  try {
    const input = await parseEventBody(await request.json(), context.staff);
    const event = await getStore().createEvent(input, context.actor.name);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
