import { redirect, unstable_rethrow } from "next/navigation";

import { ServerProblem } from "@/components/server-problem";
import { SettingsApp } from "@/components/settings/settings-app";
import { getActorId } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { listAllStaffForRequest } from "@/lib/db/cached";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const store = getStore();
  // 管理画面では退職者・非表示の分類も含めて扱う
  let loaded;
  try {
    loaded = await Promise.all([listAllStaffForRequest(), store.listCategories(true), getActorId()]);
  } catch (error) {
    // Next.js 内部の合図（動的な描画への切り替え等）は握りつぶさずに通す
    unstable_rethrow(error);
    console.error("[settings]", error);
    return <ServerProblem error={error} />;
  }
  const [staff, categories, actorId] = loaded;

  const actor = staff.find((member) => member.id === actorId);
  if (!actor) redirect("/login");

  return <SettingsApp initialStaff={staff} initialCategories={categories} actor={actor} />;
}
