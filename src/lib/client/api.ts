"use client";

import type {
  CalendarEvent,
  Category,
  CategoryInput,
  EventInput,
  Staff,
  StaffInput,
} from "@/lib/types";

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
    throw new Error(body?.error ?? "通信に失敗しました。時間をおいてお試しください。");
  }
  return body as T;
}

export type EventDraft = Omit<EventInput, "recurrenceRule" | "recurrenceUntil" | "parentEventId">;

export async function fetchEvents(from: string, to: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ from, to });
  const body = await request<{ events: CalendarEvent[] }>(`/api/events?${params}`, { signal });
  return body.events;
}

export async function createEvent(draft: EventDraft) {
  const body = await request<{ event: CalendarEvent }>("/api/events", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return body.event;
}

export async function updateEvent(id: string, patch: Partial<EventDraft>) {
  const body = await request<{ event: CalendarEvent }>(`/api/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
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
  return request<{ connected: boolean }>("/api/me/google-calendar");
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
