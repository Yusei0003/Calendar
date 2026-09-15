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
}
