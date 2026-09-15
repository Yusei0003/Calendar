import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AccentColor,
  CalendarEvent,
  Category,
  CategoryIcon,
  EventScope,
  Staff,
} from "@/lib/types";
import type { EventQuery, Store } from "@/lib/db/store";

/**
 * 本番のデータ保存先。
 *
 * サービスロールキーを使うため、このファイルは必ずサーバー側でのみ読み込むこと。
 * ブラウザに渡ると誰でもデータベースを操作できてしまう。
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定されていません。");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Supabase のエラーをそのまま投げると原因が分かりにくいので、文脈を添える。 */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}に失敗しました: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}の結果が空でした。`);
  return result.data;
}

/* --- テーブルの列名（snake_case）とアプリ側の名前（camelCase）の変換 --- */

interface StaffRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  hidden: boolean;
}

interface EventRow {
  id: string;
  scope: string;
  staff_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  category_id: string;
  location: string;
  note: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  recurrence_rule: string | null;
  recurrence_until: string | null;
  parent_event_id: string | null;
}

function toStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    name: row.name,
    color: row.color as AccentColor,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color as AccentColor,
    icon: row.icon as CategoryIcon,
    sortOrder: row.sort_order,
    hidden: row.hidden,
  };
}

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    scope: row.scope as EventScope,
    staffId: row.staff_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    categoryId: row.category_id,
    location: row.location,
    note: row.note,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    recurrenceRule: row.recurrence_rule,
    recurrenceUntil: row.recurrence_until,
    parentEventId: row.parent_event_id,
  };
}

function staffColumns(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("name" in patch) out.name = patch.name;
  if ("color" in patch) out.color = patch.color;
  if ("sortOrder" in patch) out.sort_order = patch.sortOrder;
  if ("active" in patch) out.active = patch.active;
  return out;
}

function categoryColumns(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("name" in patch) out.name = patch.name;
  if ("color" in patch) out.color = patch.color;
  if ("icon" in patch) out.icon = patch.icon;
  if ("sortOrder" in patch) out.sort_order = patch.sortOrder;
  if ("hidden" in patch) out.hidden = patch.hidden;
  return out;
}

function eventColumns(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("scope" in patch) out.scope = patch.scope;
  if ("staffId" in patch) out.staff_id = patch.staffId;
  if ("title" in patch) out.title = patch.title;
  if ("startsAt" in patch) out.starts_at = patch.startsAt;
  if ("endsAt" in patch) out.ends_at = patch.endsAt;
  if ("allDay" in patch) out.all_day = patch.allDay;
  if ("categoryId" in patch) out.category_id = patch.categoryId;
  if ("location" in patch) out.location = patch.location;
  if ("note" in patch) out.note = patch.note;
  if ("recurrenceRule" in patch) out.recurrence_rule = patch.recurrenceRule;
  if ("recurrenceUntil" in patch) out.recurrence_until = patch.recurrenceUntil;
  if ("parentEventId" in patch) out.parent_event_id = patch.parentEventId;
  return out;
}

const EVENT_FIELDS =
  "id, scope, staff_id, title, starts_at, ends_at, all_day, category_id, location, note, created_by, updated_by, created_at, updated_at, deleted_at, recurrence_rule, recurrence_until, parent_event_id";

export const supabaseStore: Store = {
  async listStaff(includeInactive = false) {
    let query = db().from("staff").select("*").order("sort_order");
    if (!includeInactive) query = query.eq("active", true);
    return unwrap<StaffRow[]>(await query, "スタッフの取得").map(toStaff);
  },

  async createStaff(input) {
    const result = await db()
      .from("staff")
      .insert(staffColumns({ ...input }))
      .select("*")
      .single();
    return toStaff(unwrap<StaffRow>(result, "スタッフの追加"));
  },

  async updateStaff(id, patch) {
    const result = await db()
      .from("staff")
      .update(staffColumns({ ...patch }))
      .eq("id", id)
      .select("*")
      .single();
    return toStaff(unwrap<StaffRow>(result, "スタッフの更新"));
  },

  async listCategories(includeHidden = false) {
    let query = db().from("categories").select("*").order("sort_order");
    if (!includeHidden) query = query.eq("hidden", false);
    return unwrap<CategoryRow[]>(await query, "分類の取得").map(toCategory);
  },

  async createCategory(input) {
    const result = await db()
      .from("categories")
      .insert(categoryColumns({ ...input }))
      .select("*")
      .single();
    return toCategory(unwrap<CategoryRow>(result, "分類の追加"));
  },

  async updateCategory(id, patch) {
    const result = await db()
      .from("categories")
      .update(categoryColumns({ ...patch }))
      .eq("id", id)
      .select("*")
      .single();
    return toCategory(unwrap<CategoryRow>(result, "分類の更新"));
  },

  async countEventsByCategory(categoryId) {
    const { count, error } = await db()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);
    if (error) throw new Error(`分類の利用状況の確認に失敗しました: ${error.message}`);
    return count ?? 0;
  },

  async deleteCategory(id) {
    const { error } = await db().from("categories").delete().eq("id", id);
    if (error) throw new Error(`分類の削除に失敗しました: ${error.message}`);
  },

  async listEvents({ from, to, includeDeleted = false }: EventQuery) {
    let query = db()
      .from("events")
      .select(EVENT_FIELDS)
      // 表示期間に少しでも重なる予定を拾う
      .gte("ends_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    if (!includeDeleted) query = query.is("deleted_at", null);
    return unwrap<EventRow[]>(await query, "予定の取得").map(toEvent);
  },

  async getEvent(id) {
    const { data, error } = await db()
      .from("events")
      .select(EVENT_FIELDS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`予定の取得に失敗しました: ${error.message}`);
    return data ? toEvent(data as EventRow) : null;
  },

  async createEvent(input, actor) {
    const result = await db()
      .from("events")
      .insert({
        ...eventColumns({ ...input }),
        created_by: actor,
        updated_by: actor,
      })
      .select(EVENT_FIELDS)
      .single();
    return toEvent(unwrap<EventRow>(result, "予定の登録"));
  },

  async updateEvent(id, patch, actor) {
    const result = await db()
      .from("events")
      .update({ ...eventColumns({ ...patch }), updated_by: actor })
      .eq("id", id)
      .select(EVENT_FIELDS)
      .single();
    return toEvent(unwrap<EventRow>(result, "予定の更新"));
  },

  async softDeleteEvent(id, actor) {
    const { error } = await db()
      .from("events")
      .update({ deleted_at: new Date().toISOString(), updated_by: actor })
      .eq("id", id);
    if (error) throw new Error(`予定の削除に失敗しました: ${error.message}`);
  },

  async restoreEvent(id, actor) {
    const result = await db()
      .from("events")
      .update({ deleted_at: null, updated_by: actor })
      .eq("id", id)
      .select(EVENT_FIELDS)
      .single();
    return toEvent(unwrap<EventRow>(result, "予定の復元"));
  },

  // 以下、本人の Google カレンダー連携。
  // 必ず対象の列だけを select / update し、Staff 型（一覧APIが返す形）を
  // 経由しないこと。他のスタッフの秘密の URL が混ざって漏れるのを防ぐ。

  async getGoogleIcalUrl(staffId) {
    const { data, error } = await db()
      .from("staff")
      .select("google_ical_url")
      .eq("id", staffId)
      .maybeSingle();
    if (error) throw new Error(`連携状況の取得に失敗しました: ${error.message}`);
    return (data as { google_ical_url: string | null } | null)?.google_ical_url ?? null;
  },

  async setGoogleIcalUrl(staffId, url) {
    const { error } = await db()
      .from("staff")
      .update({ google_ical_url: url })
      .eq("id", staffId);
    if (error) throw new Error(`連携の保存に失敗しました: ${error.message}`);
  },

  async listGoogleIcalLinks() {
    const { data, error } = await db()
      .from("staff")
      .select("id, google_ical_url")
      .not("google_ical_url", "is", null);
    if (error) throw new Error(`連携一覧の取得に失敗しました: ${error.message}`);
    return (data as { id: string; google_ical_url: string }[]).map((row) => ({
      staffId: row.id,
      url: row.google_ical_url,
    }));
  },
};
