"use client";

import type {
  CalendarEvent,
  Category,
  CategoryInput,
  EventInput,
  Staff,
  StaffInput,
} from "@/lib/types";

/** サーバーが返したエラー。status で種類（409 = ほかの人が先に変更 など）を見分ける。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** ほかの人が先に変更していたために保存できなかったか。 */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/** サーバーが返したエラーメッセージをそのまま画面に出せるようにする。 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

  if (response.status === 401) {
    // 合言葉の有効期限が切れた、または名乗りが外れた
    window.location.href = "/login";
    throw new Error("ログインし直してください。");
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(
      body?.error ?? "通信に失敗しました。時間をおいてお試しください。",
      response.status,
    );
  }
  return body as T;
}

export type EventDraft = Omit<EventInput, "recurrenceRule" | "recurrenceUntil" | "parentEventId">;

export async function fetchEvents(from: string, to: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ from, to });
  const body = await request<{ events: CalendarEvent[] }>(`/api/events?${params}`, { signal });
  return body.events;
}

/** 各スタッフの Google カレンダーから取り込んだ予定（読み取り専用）。 */
export async function fetchGoogleEvents(from: string, to: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ from, to });
  return request<{ events: CalendarEvent[]; ownLinkFailed: boolean }>(
    `/api/events/google?${params}`,
    { signal },
  );
}

export async function createEvent(draft: EventDraft) {
  const body = await request<{ event: CalendarEvent }>("/api/events", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return body.event;
}

/**
 * 予定を更新する。ifUpdatedAt に「画面が読み込んだ時点の更新日時」を渡すと、
 * その後ほかの人が変更していた場合は上書きせず 409（isConflict）で失敗する。
 */
export async function updateEvent(id: string, patch: Partial<EventDraft>, ifUpdatedAt?: string) {
  const body = await request<{ event: CalendarEvent }>(`/api/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(ifUpdatedAt ? { ...patch, ifUpdatedAt } : patch),
  });
  return body.event;
}

export async function deleteEvent(id: string) {
  await request<{ ok: true }>(`/api/events/${id}`, { method: "DELETE" });
}

export async function restoreEvent(id: string) {
  const body = await request<{ event: CalendarEvent }>(`/api/events/${id}/restore`, {
    method: "POST",
  });
  return body.event;
}

/* --- スタッフ・分類のマスタ --- */

export async function createStaff(input: StaffInput) {
  const body = await request<{ staff: Staff }>("/api/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.staff;
}

export async function updateStaff(id: string, patch: Partial<StaffInput>) {
  const body = await request<{ staff: Staff }>(`/api/staff/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return body.staff;
}

export async function createCategory(input: CategoryInput) {
  const body = await request<{ category: Category }>("/api/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.category;
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>) {
  const body = await request<{ category: Category }>(`/api/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return body.category;
}

export async function deleteCategory(id: string) {
  await request<{ ok: true }>(`/api/categories/${id}`, { method: "DELETE" });
}

/* --- 本人の Google カレンダー連携 --- */

export async function getGoogleCalendarStatus() {
  return request<{ connected: boolean; problem?: string | null }>("/api/me/google-calendar");
}

export async function connectGoogleCalendar(url: string) {
  return request<{ connected: true; eventCount: number }>("/api/me/google-calendar", {
    method: "PUT",
    body: JSON.stringify({ url }),
  });
}

export async function disconnectGoogleCalendar() {
  return request<{ connected: false }>("/api/me/google-calendar", { method: "DELETE" });
}
