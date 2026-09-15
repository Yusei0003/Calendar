import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { ACTOR_COOKIE } from "@/lib/auth";

/**
 * 名乗りだけを外して、名前の選び直しに戻る。
 * 合言葉の確認は済んだままなので、入力し直しにはならない。
 */
export default async function SwitchUserPage() {
  const store = await cookies();
  store.delete(ACTOR_COOKIE);
  redirect("/login");
}
