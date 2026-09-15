import { NextResponse } from "next/server";

import { handleError, isResponse, jsonError, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";

interface Context {
  params: Promise<{ id: string }>;
}

/** 削除の取り消し。 */
export async function POST(_request: Request, { params }: Context) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const { id } = await params;
    const store = getStore();

    const existing = await store.getEvent(id);
    if (!existing) return jsonError("予定が見つかりません。", 404);

    const event = await store.restoreEvent(id, actor.name);
    return NextResponse.json({ event });
  } catch (error) {
    return handleError(error);
  }
}
