import "server-only";

import type { NextRequest } from "next/server";

import { InvalidInput } from "@/lib/api";

/** 一度に取得できる期間の上限。広すぎる問い合わせで負荷が増えるのを防ぐ。 */
const MAX_RANGE_DAYS = 400;

/** ?from=...&to=... を読み取り、正しい期間かを確かめる。 */
export function readRange(request: NextRequest): { from: string; to: string } {
  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) throw new InvalidInput("期間（from, to）を指定してください。");
  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw new InvalidInput("期間の形式が正しくありません。");
  }
  if (Date.parse(to) < Date.parse(from)) {
    throw new InvalidInput("期間の終わりが始まりより前になっています。");
  }
  if (Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new InvalidInput("一度に取得できる期間を超えています。");
  }
  return { from, to };
}
