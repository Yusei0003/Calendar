import { addDays, startOfDay, toJst } from "@/lib/time";
import type { CalendarEvent } from "@/lib/types";

/** 予定が短すぎて潰れないよう、最低この分数ぶんの高さを確保する。 */
const MIN_MINUTES = 20;

export interface Slot {
  event: CalendarEvent;
  /** その日の0:00からの分数 */
  startMin: number;
  endMin: number;
  /** 横に並べるときの位置（0 始まり） */
  lane: number;
  /** 同時に重なっている本数。lane とあわせて幅を決める。 */
  lanes: number;
}

/**
 * 1日ぶんの時間帯表示で、重なった予定を横に並べるための計算。
 *
 * 重なり合う予定のかたまりごとに、必要な列数を求めて振り分ける。
 * 日をまたぐ予定は、その日にかかっている部分だけを切り出す。
 */
export function layoutDay(events: CalendarEvent[], day: Date): Slot[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();

  const slots: Slot[] = [];
  for (const event of events) {
    if (event.allDay) continue;

    const start = toJst(event.startsAt).getTime();
    const end = toJst(event.endsAt).getTime();
    if (start >= dayEnd || Math.max(end, start + 1) <= dayStart) continue;

    const startMin = Math.max(0, Math.round((start - dayStart) / 60_000));
    const rawEndMin = Math.min(1440, Math.round((end - dayStart) / 60_000));
    slots.push({
      event,
      startMin,
      endMin: Math.min(1440, Math.max(rawEndMin, startMin + MIN_MINUTES)),
      lane: 0,
      lanes: 1,
    });
  }

  // 開始が同じなら長い予定を先に置き、左側に来るようにする
  slots.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  // 重なりが途切れるところでかたまりに分け、かたまりごとに列を割り当てる
  let cluster: Slot[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    for (const slot of cluster) {
      let lane = laneEnds.findIndex((end) => end <= slot.startMin);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(slot.endMin);
      } else {
        laneEnds[lane] = slot.endMin;
      }
      slot.lane = lane;
    }
    for (const slot of cluster) slot.lanes = laneEnds.length;
    cluster = [];
    clusterEnd = -1;
  };

  for (const slot of slots) {
    if (cluster.length > 0 && slot.startMin >= clusterEnd) flush();
    cluster.push(slot);
    clusterEnd = Math.max(clusterEnd, slot.endMin);
  }
  flush();

  return slots;
}

/** その日にかかる終日の予定。時間帯表示の上部に並べる。 */
export function allDayEvents(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return events.filter((event) => {
    if (!event.allDay) return false;
    const start = toJst(event.startsAt).getTime();
    const end = toJst(event.endsAt).getTime();
    return start < dayEnd && end > dayStart;
  });
}
