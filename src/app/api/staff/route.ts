import { NextResponse } from "next/server";

import { handleError, isResponse, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseStaffBody } from "@/lib/master-input";
import type { StaffInput } from "@/lib/types";

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    // 管理画面では退職者も含めて見せる
    const staff = await getStore().listStaff(true);
    return NextResponse.json({ staff });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const store = getStore();
    const input = parseStaffBody(await request.json(), false) as unknown as StaffInput;

    // 並び順の指定がなければ末尾に置く
    if (!input.sortOrder) {
      const existing = await store.listStaff(true);
      input.sortOrder = existing.length + 1;
    }

    const created = await store.createStaff(input);
    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
