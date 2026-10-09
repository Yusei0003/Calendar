import { dateKey, overlapsDay, startOfDay, toJst } from "@/lib/time";
import type { CalendarEvent } from "@/lib/types";

/**
 * 月表示の1週ぶん（7日）の並べ方を決める。
 *
 * 2日以上にまたがる予定は、日ごとにバラバラに並べるのではなく、
 * 週の行をまたぐ1本の帯（バー）として描く。帯どうしが重ならないよう
 * 上から順に「段（lane）」を割り当てる。1日だけの予定はこれまでどおり
 * 各日の枠に並べる。
 */

export interface BarSegment {
  event: CalendarEvent;
  /** 上から何段目か（0始まり） */
  lane: number;
  /** この週の何日目から何日目までか（0〜6、両端を含む） */
  startCol: number;
  endCol: number;
  /** 前の週から続いている／次の週へ続く（端を角にして、続きであることを示す） */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface WeekLayout {
  /** 表示する帯。maxLanes を超えた段のものは含めない。 */
  bars: BarSegment[];
  /** この週で実際に使っている段の数（maxLanes が上限） */
  laneCount: number;
  /** 各日の、帯にならない（1日だけの）予定。並び順は終日→開始時刻。 */
  singles: CalendarEvent[][];
  /** 段が足りずに表示しきれなかった帯の数（日ごと）。「ほか◯件」に足す。 */
  hiddenBars: number[];
}

/** 予定が最後にかかっている日（終了時刻ちょうどの日は含めない）。 */
function lastDay(event: CalendarEvent): Date {
  const start = Date.parse(event.startsAt);
  const end = Math.max(Date.parse(event.endsAt) - 1, start);
  return startOfDay(toJst(new Date(end).toISOString()));
}

/** 2日以上にまたがる予定か。帯として描くかどうかの判定に使う。 */
export function isMultiDay(event: CalendarEvent): boolean {
  return dateKey(startOfDay(toJst(event.startsAt))) !== dateKey(lastDay(event));
}

export function layoutWeek(days: Date[], events: CalendarEvent[], maxLanes: number): WeekLayout {
  const singles: CalendarEvent[][] = days.map(() => []);
  const hiddenBars = days.map(() => 0);
  const spanning: { event: CalendarEvent; startCol: number; endCol: number }[] = [];

  for (const event of events) {
    const cols: number[] = [];
    days.forEach((day, index) => {
      if (overlapsDay(event.startsAt, event.endsAt, day)) cols.push(index);
    });
    if (cols.length === 0) continue;

    if (isMultiDay(event)) {
      spanning.push({ event, startCol: cols[0], endCol: cols[cols.length - 1] });
    } else {
      for (const col of cols) singles[col].push(event);
    }
  }

  for (const list of singles) {
    list.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startsAt.localeCompare(b.startsAt);
    });
  }

  // 先に始まるもの、同時なら長いものから上の段に置く（見た目が安定する）
  spanning.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - b.startCol - (a.endCol - a.startCol) ||
      a.event.startsAt.localeCompare(b.event.startsAt),
  );

  const lanes: boolean[][] = [];
  const bars: BarSegment[] = [];
  const weekStart = startOfDay(days[0]).getTime();
  const weekLast = startOfDay(days[days.length - 1]).getTime();

  for (const item of spanning) {
    let lane = 0;
    while (true) {
      const row = (lanes[lane] ??= days.map(() => false));
      let free = true;
      for (let col = item.startCol; col <= item.endCol; col++) {
        if (row[col]) {
          free = false;
          break;
        }
      }
      if (free) break;
      lane++;
    }
    for (let col = item.startCol; col <= item.endCol; col++) lanes[lane][col] = true;

    if (lane >= maxLanes) {
      for (let col = item.startCol; col <= item.endCol; col++) hiddenBars[col]++;
      continue;
    }

    bars.push({
      ...item,
      lane,
      continuesBefore: startOfDay(toJst(item.event.startsAt)).getTime() < weekStart,
      continuesAfter: lastDay(item.event).getTime() > weekLast,
    });
  }

  return { bars, laneCount: Math.min(lanes.length, maxLanes), singles, hiddenBars };
}
