import { NextResponse, type NextRequest } from "next/server";

import { ACTOR_COOKIE, actorCookieOptions } from "@/lib/auth";

/**
 * 名乗りだけを外して、名前の選び直しに戻る。
 * 合言葉の確認は済んだままなので、入力し直しにはならない。
 *
 * Cookie を書き換えられるのはルートハンドラかサーバーアクションだけなので、
 * 画面（page）ではなくこの形にしている。
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(ACTOR_COOKIE, "", { ...actorCookieOptions(), maxAge: 0 });
  return response;
}
