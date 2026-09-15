"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTOR_COOKIE,
  SESSION_COOKIE,
  actorCookieOptions,
  checkLock,
  checkPasscode,
  clearFailures,
  createSessionToken,
  isPasscodeConfigured,
  isSignedIn,
  recordFailure,
  sessionCookieOptions,
} from "@/lib/auth";
import { getStore } from "@/lib/db";

export interface LoginState {
  error: string | null;
}

/** 接続元の識別。プロキシ越しでも実際の利用者の IP を拾えるようにする。 */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isPasscodeConfigured()) {
    return { error: "合言葉がまだ設定されていません。管理者に連絡してください。" };
  }

  const ip = await clientIp();
  const lock = checkLock(ip);
  if (lock.locked) {
    const minutes = Math.ceil(lock.retryAfterSec / 60);
    return { error: `入力を続けて間違えたため、${minutes}分ほどお待ちください。` };
  }

  const passcode = String(formData.get("passcode") ?? "");
  if (!passcode) {
    return { error: "合言葉を入力してください。" };
  }

  if (!checkPasscode(passcode)) {
    recordFailure(ip);
    return { error: "合言葉が違います。" };
  }

  clearFailures(ip);
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  redirect("/login");
}

export async function chooseStaff(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!(await isSignedIn())) {
    redirect("/login");
  }

  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) {
    return { error: "名前を選んでください。" };
  }

  // 実在するスタッフか確かめる（存在しない ID が登録者として残らないように）
  const staff = await getStore().listStaff();
  if (!staff.some((member) => member.id === staffId)) {
    return { error: "選んだスタッフが見つかりません。画面を再読み込みしてください。" };
  }

  const store = await cookies();
  store.set(ACTOR_COOKIE, staffId, actorCookieOptions());
  redirect("/calendar");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(ACTOR_COOKIE);
  redirect("/login");
}

/** 名乗りだけを外す（端末を人に渡すときなど）。 */
export async function forgetActor(): Promise<void> {
  const store = await cookies();
  store.delete(ACTOR_COOKIE);
  redirect("/login");
}
