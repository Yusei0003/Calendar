import type {
  CalendarEvent,
  Category,
  CategoryInput,
  EventInput,
  Staff,
  StaffInput,
} from "@/lib/types";

export interface EventQuery {
  /** この日時以降に終わる予定を対象にする（ISO 文字列） */
  from: string;
  /** この日時より前に始まる予定を対象にする（ISO 文字列） */
  to: string;
  /** 削除済みを含めるか。既定は含めない。 */
  includeDeleted?: boolean;
}

/**
 * データの保存先。Supabase とローカルファイルの2つの実装があり、
 * 環境変数の有無で切り替わる（src/lib/db/index.ts 参照）。
 */
export interface Store {
  listStaff(includeInactive?: boolean): Promise<Staff[]>;
  createStaff(input: StaffInput): Promise<Staff>;
  updateStaff(id: string, patch: Partial<StaffInput>): Promise<Staff>;

  listCategories(includeHidden?: boolean): Promise<Category[]>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, patch: Partial<CategoryInput>): Promise<Category>;
  /** その分類を使っている予定の件数。0 件なら削除してよい。 */
  countEventsByCategory(categoryId: string): Promise<number>;
  deleteCategory(id: string): Promise<void>;

  listEvents(query: EventQuery): Promise<CalendarEvent[]>;
  getEvent(id: string): Promise<CalendarEvent | null>;
  createEvent(input: EventInput, actor: string): Promise<CalendarEvent>;
  updateEvent(
    id: string,
    patch: Partial<EventInput>,
    actor: string,
  ): Promise<CalendarEvent>;
  /** 論理削除。実データは残るので復旧できる。 */
  softDeleteEvent(id: string, actor: string): Promise<void>;
  restoreEvent(id: string, actor: string): Promise<CalendarEvent>;

  /**
   * 本人の Google カレンダー連携（秘密のiCal URL）。
   *
   * 必ず「本人が自分の分だけ」操作する前提の API（/api/me/google-calendar）
   * からのみ呼び出すこと。他人の URL を読み書きできる経路を作らない。
   */
  getGoogleIcalUrl(staffId: string): Promise<string | null>;
  setGoogleIcalUrl(staffId: string, url: string | null): Promise<void>;
  /** 予定の合成に使う。URL を設定している全スタッフぶんをまとめて取得する。 */
  listGoogleIcalLinks(): Promise<{ staffId: string; url: string }[]>;
}
