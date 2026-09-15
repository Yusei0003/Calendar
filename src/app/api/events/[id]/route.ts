import { NextResponse } from "next/server";

import { handleError, isResponse, jsonError, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseEventBody } from "@/lib/event-input";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const { id } = await params;
    const store = getStore();

    const existing = await store.getEvent(id);
    if (!existing || existing.deletedAt) return jsonError("予定が見つかりません。", 404);

    // 部分更新でも中身の整合性を保つため、既存の値と重ねてから検証する
    const body = (await request.json()) as Record<string, unknown>;
    const merged = {
      scope: existing.scope,
      staffId: existing.staffId,
      title: existing.title,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      allDay: existing.allDay,
      categoryId: existing.categoryId,
      location: existing.location,
      note: existing.note,
      ...body,
    };

    const input = await parseEventBody(merged);
    const event = await store.updateEvent(id, input, actor.name);
    return NextResponse.json({ event });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const { id } = await params;
    const store = getStore();

    const existing = await store.getEvent(id);
    if (!existing) return jsonError("予定が見つかりません。", 404);

    // 実データは残すので、間違えて消しても復元できる
    await store.softDeleteEvent(id, actor.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
