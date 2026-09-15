import { redirect } from "next/navigation";

import { CalendarApp } from "@/components/calendar/calendar-app";
import { getActorId } from "@/lib/auth";
import { getStore } from "@/lib/db";

// 常に最新のスタッフ・分類で描く（ビルド時に固定しない）
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const store = getStore();
  const [staff, categories, actorId] = await Promise.all([
    store.listStaff(),
    store.listCategories(),
    getActorId(),
  ]);

  const actor = staff.find((member) => member.id === actorId);
  if (!actor) redirect("/login");

  return <CalendarApp staff={staff} categories={categories} actor={actor} />;
}
