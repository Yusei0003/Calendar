import type { AccentColor, CalendarEvent, Category, Staff } from "@/lib/types";

/**
 * 予定に使う色。
 * スタッフ予定は担当者の色、全体予定は分類の色を使う（仕様書 2.4）。
 */
export function eventAccent(
  event: CalendarEvent,
  staffById: Map<string, Staff>,
  categoryById: Map<string, Category>,
): AccentColor {
  if (event.scope === "staff" && event.staffId) {
    const staff = staffById.get(event.staffId);
    if (staff) return staff.color;
  }
  return categoryById.get(event.categoryId)?.color ?? "slate";
}

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** 分類のアイコン。色が見分けにくい人にも区別できるようにするためのもの。 */
export function categoryIconPath(icon: string): string {
  switch (icon) {
    case "rest": // 三日月
      return "M14.5 3.5a6.5 6.5 0 1 0 6 6 5.2 5.2 0 0 1-6-6Z";
    case "out": // 右向きの矢印
      return "M4 12h12m0 0-4-4m4 4-4 4M18 4v16";
    case "guest": // 人
      return "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 9a7 7 0 0 1 14 0";
    case "meeting": // 吹き出し
      return "M4 5h16v10H9l-5 4V5Z";
    case "event": // 星
      return "m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8L12 3Z";
    case "delivery": // 箱
      return "M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8";
    default: // 丸
      return "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z";
  }
}
