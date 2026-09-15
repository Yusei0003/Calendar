import { NextResponse } from "next/server";

import { handleError, isResponse, jsonError, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseCategoryBody } from "@/lib/master-input";
import type { CategoryInput } from "@/lib/types";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const { id } = await params;
    const store = getStore();

    const existing = await store.listCategories(true);
    if (!existing.some((category) => category.id === id)) {
      return jsonError("分類が見つかりません。", 404);
    }

    const patch = parseCategoryBody(await request.json(), true) as Partial<CategoryInput>;
    const updated = await store.updateCategory(id, patch);
    return NextResponse.json({ category: updated });
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

    const existing = await store.listCategories(true);
    if (!existing.some((category) => category.id === id)) {
      return jsonError("分類が見つかりません。", 404);
    }

    // 使われている分類を消すと、その予定が分類を失ってしまう。
    // 代わりに「非表示」にしてもらう（仕様書 2.3）。
    const used = await store.countEventsByCategory(id);
    if (used > 0) {
      return jsonError(
        `この分類は${used}件の予定で使われているため削除できません。非表示にすると、新しい予定では選べなくなります。`,
        409,
      );
    }

    await store.deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
