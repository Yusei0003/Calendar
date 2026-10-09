import { NextResponse } from "next/server";

import { handleError, isResponse, jsonError, requireActor, requireActorContext } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseEventBody } from "@/lib/event-input";

interface Context {
  params: Promise<{ id: string }>;
}

/** 画面が開いた時点より後に、ほかの人が変更していたときに返す。 */
const CONFLICT_MESSAGE =
  "ほかの人が先にこの予定を変更しています。最新の内容を確認してから、もう一度お試しください。";

export async function PATCH(request: Request, { params }: Context) {
  const context = await requireActorContext();
  if (isResponse(context)) return context;

  try {
    const { id } = await params;
    const store = getStore();

    const existing = await store.getEvent(id);
    if (!existing || existing.deletedAt) return jsonError("予定が見つかりません。", 404);

    // ifUpdatedAt: 画面が予定を読み込んだ時点の更新日時。今の更新日時と違えば、
    // その間にほかの人が変更しているので、黙って上書きせずに知らせる。
    // （付いていない場合は確認しない。「それでも上書きする」を選んだときなど）
    const { ifUpdatedAt, ...body } = (await request.json()) as Record<string, unknown>;
    if (
      typeof ifUpdatedAt === "string" &&
      Date.parse(ifUpdatedAt) !== Date.parse(existing.updatedAt)
    ) {
      return jsonError(CONFLICT_MESSAGE, 409);
    }

    // 部分更新でも中身の整合性を保つため、既存の値と重ねてから検証する
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

    const input = await parseEventBody(merged, context.staff);
    const event = await store.updateEvent(id, input, context.actor.name);
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
