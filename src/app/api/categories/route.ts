import { NextResponse } from "next/server";

import { handleError, isResponse, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseCategoryBody } from "@/lib/master-input";
import type { CategoryInput } from "@/lib/types";

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    // 管理画面では非表示のものも含めて見せる
    const categories = await getStore().listCategories(true);
    return NextResponse.json({ categories });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const store = getStore();
    const input = parseCategoryBody(await request.json(), false) as unknown as CategoryInput;

    if (!input.sortOrder) {
      const existing = await store.listCategories(true);
      input.sortOrder = existing.length + 1;
    }

    const created = await store.createCategory(input);
    return NextResponse.json({ category: created }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
