import { redirect, unstable_rethrow } from "next/navigation";

import { CalendarApp } from "@/components/calendar/calendar-app";
import { ServerProblem } from "@/components/server-problem";
import { getActorId } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listAllStaffForRequest } from "@/lib/db/cached";

// 常に最新のスタッフ・分類で描く（ビルド時に固定しない）
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const store = getStore();
  let loaded;
  try {
    loaded = await Promise.all([listAllStaffForRequest(), store.listCategories(), getActorId()]);
  } catch (error) {
    // Next.js 内部の合図（動的な描画への切り替え等）は握りつぶさずに通す
    unstable_rethrow(error);
    console.error("[calendar]", error);
    return <ServerProblem error={error} />;
  }
  const [allStaff, categories, actorId] = loaded;
  const staff = allStaff.filter((member) => member.active);

  const actor = staff.find((member) => member.id === actorId);
  if (!actor) redirect("/login");

  return <CalendarApp staff={staff} categories={categories} actor={actor} />;
}
