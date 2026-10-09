import { NextResponse, type NextRequest } from "next/server";

import { handleError, isResponse, requireActorContext } from "@/lib/api";
import { getStore } from "@/lib/db";
import { fetchGoogleEventsForStaff } from "@/lib/google-calendar";
import { readRange } from "@/lib/range-param";

/**
 * 各スタッフの Google カレンダーから読み取り専用で取り込んだ予定。
 *
 * 画面はまずアプリの予定（/api/events）を表示し、こちらは後から重ねる。
 * Google の応答が遅くても、カレンダー全体の表示が待たされないようにするため。
 */
export async function GET(request: NextRequest) {
  const context = await requireActorContext();
  if (isResponse(context)) return context;

  try {
    const { from, to } = readRange(request);
    const links = await getStore().listGoogleIcalLinks();

    // 在籍中のスタッフぶんだけ取り込む。退職済みの人の連携は表示に出さない
    // （本人が退職後に URL を消し忘れても勝手には出てこない）。
    const activeIds = new Set(
      context.staff.filter((member) => member.active).map((member) => member.id),
    );
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const results = await Promise.all(
      links
        .filter((link) => activeIds.has(link.staffId))
        .map(async (link) => ({
          staffId: link.staffId,
          ...(await fetchGoogleEventsForStaff(link.staffId, link.url, fromDate, toDate)),
        })),
    );

    return NextResponse.json({
      events: results.flatMap((result) => result.events),
      // 本人の連携が読み込めなかったときだけ知らせる（他人の状態は返さない）
      ownLinkFailed: results.some((result) => result.staffId === context.actor.id && !result.ok),
    });
  } catch (error) {
    return handleError(error);
  }
}
