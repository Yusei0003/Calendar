import "server-only";

import { NextResponse } from "next/server";

import { getActorId, isSignedIn } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { Staff } from "@/lib/types";

/** 入力が期待どおりでなかったことを表す。呼び出し側で 400 として返す。 */
export class InvalidInput extends Error {}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * ログイン済みかを確かめ、名乗っているスタッフを返す。
 * すべての API はこれを最初に呼ぶ。
 */
export async function requireActor(): Promise<Staff | NextResponse> {
  if (!(await isSignedIn())) return jsonError("ログインが必要です。", 401);

  const actorId = await getActorId();
  if (!actorId) return jsonError("名前が選ばれていません。", 401);

  const staff = await getStore().listStaff(true);
  const actor = staff.find((member) => member.id === actorId);
  if (!actor) return jsonError("名前が選ばれていません。", 401);

  return actor;
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** 予期しない例外を握りつぶさず、利用者に読める形で返す。 */
export function handleError(error: unknown) {
  if (error instanceof InvalidInput) return jsonError(error.message, 400);
  const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
  console.error("[api]", error);
  return jsonError(message, 500);
}

/* --- 入力の検証 ------------------------------------------------------ */

export function requireString(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string") throw new InvalidInput(`${label}を入力してください。`);
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidInput(`${label}を入力してください。`);
  if (trimmed.length > max) throw new InvalidInput(`${label}は${max}文字以内で入力してください。`);
  return trimmed;
}

export function optionalString(value: unknown, label: string, max = 2000): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new InvalidInput(`${label}の形式が正しくありません。`);
  if (value.length > max) throw new InvalidInput(`${label}は${max}文字以内で入力してください。`);
  return value;
}

export function requireIso(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new InvalidInput(`${label}の形式が正しくありません。`);
  }
  return new Date(value).toISOString();
}

export function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new InvalidInput(`${label}の形式が正しくありません。`);
  return value;
}
