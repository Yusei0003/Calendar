import { NextResponse } from "next/server";

import { handleError, isResponse, jsonError, requireActor } from "@/lib/api";
import { getStore } from "@/lib/db";
import { parseStaffBody } from "@/lib/master-input";
import type { StaffInput } from "@/lib/types";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  try {
    const { id } = await params;
    const store = getStore();

    const existing = await store.listStaff(true);
    if (!existing.some((member) => member.id === id)) {
      return jsonError("スタッフが見つかりません。", 404);
    }

    const patch = parseStaffBody(await request.json(), true) as Partial<StaffInput>;
    const updated = await store.updateStaff(id, patch);
    return NextResponse.json({ staff: updated });
  } catch (error) {
    return handleError(error);
  }
}
