import type { Category, Staff } from "@/lib/types";

/** 初期スタッフ。Supabase 側の supabase/schema.sql と同じ内容。 */
export const SEED_STAFF: Staff[] = [
  { id: "stf-wakisaka", name: "脇坂健吾", color: "indigo", sortOrder: 1, active: true },
  { id: "stf-wada", name: "和田悠晟", color: "cyan", sortOrder: 2, active: true },
  { id: "stf-koyama", name: "小山裕介", color: "emerald", sortOrder: 3, active: true },
  { id: "stf-kumagai", name: "熊谷大輔", color: "amber", sortOrder: 4, active: true },
  { id: "stf-konno", name: "今野和倫", color: "rose", sortOrder: 5, active: true },
];

/** 初期の分類。管理画面から随時追加・変更できる。 */
export const SEED_CATEGORIES: Category[] = [
  { id: "cat-rest", name: "休み", color: "slate", icon: "rest", sortOrder: 1, hidden: false },
  { id: "cat-out", name: "外出", color: "blue", icon: "out", sortOrder: 2, hidden: false },
  { id: "cat-guest", name: "来客・打合せ", color: "violet", icon: "guest", sortOrder: 3, hidden: false },
  { id: "cat-meeting", name: "会議", color: "teal", icon: "meeting", sortOrder: 4, hidden: false },
  { id: "cat-event", name: "イベント・催事", color: "orange", icon: "event", sortOrder: 5, hidden: false },
  { id: "cat-other", name: "その他", color: "pink", icon: "dot", sortOrder: 6, hidden: false },
];
