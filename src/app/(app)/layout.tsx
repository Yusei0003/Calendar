import { redirect, unstable_rethrow } from "next/navigation";

import { ServerProblem } from "@/components/server-problem";
import { getActorId, isSignedIn } from "@/lib/auth";
import { listAllStaffForRequest } from "@/lib/db/cached";

/**
 * ログインが必要な画面の入り口。
 * 合言葉が未確認、または名乗りが未選択ならログイン画面へ戻す。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSignedIn())) redirect("/login");

  const actorId = await getActorId();
  if (!actorId) redirect("/login");

  // 名乗っているスタッフが削除・改名された場合にも備えて実在を確かめる
  let staff;
  try {
    staff = await listAllStaffForRequest();
  } catch (error) {
    // Next.js 内部の合図（動的な描画への切り替え等）は握りつぶさずに通す
    unstable_rethrow(error);
    console.error("[app]", error);
    return <ServerProblem error={error} />;
  }
  if (!staff.some((member) => member.id === actorId && member.active)) redirect("/login");

  return <>{children}</>;
}
