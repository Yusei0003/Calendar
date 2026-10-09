import "server-only";

import { cache } from "react";

import { getStore } from "@/lib/db";

/**
 * 画面を1回描くあいだ、スタッフ一覧の取得を1回にまとめる。
 * 共通レイアウト（ログイン確認）とページ本体の両方が使うため、
 * そのままだとデータベースに同じ問い合わせが2回飛ぶ。
 * 退職者も含めて取り、在籍者だけが要る場面では呼び出し側で絞る。
 */
export const listAllStaffForRequest = cache(() => getStore().listStaff(true));
