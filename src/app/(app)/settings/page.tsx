import { redirect } from "next/navigation";

import { SettingsApp } from "@/components/settings/settings-app";
import { getActorId } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listAllStaffForRequest } from "@/lib/db/cached";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const store = getStore();
  // 管理画面では退職者・非表示の分類も含めて扱う
  const [staff, categories, actorId] = await Promise.all([
    listAllStaffForRequest(),
    store.listCategories(true),
    getActorId(),
  ]);

  const actor = staff.find((member) => member.id === actorId);
  if (!actor) redirect("/login");

  return <SettingsApp initialStaff={staff} initialCategories={categories} actor={actor} />;
}
