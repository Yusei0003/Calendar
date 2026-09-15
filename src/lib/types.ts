/** アクセントカラーの名前。globals.css の .a-<名前> と一対一で対応する。 */
export const ACCENT_COLORS = [
  "cyan",
  "violet",
  "amber",
  "rose",
  "emerald",
  "blue",
  "orange",
  "pink",
  "teal",
  "indigo",
  "slate",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export function isAccentColor(value: string): value is AccentColor {
  return (ACCENT_COLORS as readonly string[]).includes(value);
}

/** 分類に付けるアイコン。色だけに頼らず区別できるようにするためのもの。 */
export const CATEGORY_ICONS = [
  "rest",
  "out",
  "guest",
  "meeting",
  "event",
  "delivery",
  "dot",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export interface Staff {
  id: string;
  name: string;
  color: AccentColor;
  sortOrder: number;
  /** 在籍中か。退職者は false にする（過去の予定は残る）。 */
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: AccentColor;
  icon: CategoryIcon;
  sortOrder: number;
  /** 使用中の分類は削除できないため、代わりに隠す。 */
  hidden: boolean;
}

/** スタッフ個人の予定か、店舗全体の予定（イベント・営業）か。 */
export type EventScope = "staff" | "store";

/**
 * スタッフ本人の Google カレンダーから読み取り専用で取り込んだ予定に付ける
 * 分類ID。実在の分類マスタには存在しない予約語で、これを使うことで
 * カテゴリ絞り込みからは自動的に外れる（絞り込み中に紛れ込まない）。
 */
export const GOOGLE_CATEGORY_ID = "__google__";

export interface CalendarEvent {
  id: string;
  scope: EventScope;
  /** scope が "staff" のとき必須。"store" のときは任意。 */
  staffId: string | null;
  title: string;
  /** ISO 8601 文字列（UTC）。表示時に日本時間へ変換する。 */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  categoryId: string;
  location: string;
  note: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  /** 論理削除。null 以外なら削除済みとして扱う。 */
  deletedAt: string | null;

  /* --- 繰り返し用（v1 では常に空。将来の機能追加でデータを作り直さないため） --- */
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
  parentEventId: string | null;

  /**
   * この予定の出どころ。省略時（DB に保存されている通常の予定）は "app"
   * として扱う。"google" は本人の Google カレンダーから読み取り専用で
   * 取り込んだもので、DB には保存されず毎回その場で合成される。
   * 編集・削除・ドラッグの対象にしてはいけない。
   */
  source?: "app" | "google";
}

export type EventInput = Omit<
  CalendarEvent,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "createdBy" | "updatedBy"
> & {
  recurrenceRule?: string | null;
  recurrenceUntil?: string | null;
  parentEventId?: string | null;
};

export type StaffInput = Omit<Staff, "id">;
export type CategoryInput = Omit<Category, "id">;
