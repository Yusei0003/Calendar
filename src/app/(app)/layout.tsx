import { redirect } from "next/navigation";

import { getActorId, isSignedIn } from "@/lib/auth";
import { getStore } from "@/lib/db";

/**
 * ログインが必要な画面の入り口。
 * 合言葉が未確認、または名乗りが未選択ならログイン画面へ戻す。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSignedIn())) redirect("/login");

  const actorId = await getActorId();
  if (!actorId) redirect("/login");

  // 名乗っているスタッフが削除・改名された場合にも備えて実在を確かめる
  const staff = await getStore().listStaff();
  if (!staff.some((member) => member.id === actorId)) redirect("/login");

  return <>{children}</>;
}
