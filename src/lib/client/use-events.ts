"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchEvents } from "@/lib/client/api";
import type { CalendarEvent } from "@/lib/types";

/** 自動で取り直す間隔。5人規模ならこの程度で十分（仕様書 5章）。 */
const POLL_MS = 30_000;

/**
 * 表示中の期間の予定を持ち、定期的に取り直す。
 *
 * 取得中も前回の内容を表示したままにするので、月を送ったときに
 * 画面が一瞬空になることがない。
 */
export function useEvents(from: string, to: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 最後に画面側でデータを書き換えた時刻。
   * これより前に始まった取得の結果は、自分の変更を巻き戻してしまうので捨てる。
   */
  const lastLocalChange = useRef(0);

  const markLocalChange = useCallback(() => {
    lastLocalChange.current = Date.now();
  }, []);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const startedAt = Date.now();
      try {
        const fetched = await fetchEvents(from, to, signal);
        if (signal?.aborted) return;
        if (startedAt < lastLocalChange.current) return;
        setEvents(fetched);
        setError(null);
      } catch (cause) {
        if (signal?.aborted || (cause as Error)?.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "予定を取得できませんでした。");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [from, to],
  );

  // 表示期間が変わったら取り直す
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  // 一定間隔＋タブに戻ったときに取り直す
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, POLL_MS);

    const onFocus = () => {
      if (document.visibilityState === "visible") void reload();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reload]);

  /** 画面側だけ先に書き換える（サーバーの応答を待たずに反映するため）。 */
  const applyLocal = useCallback(
    (update: (current: CalendarEvent[]) => CalendarEvent[]) => {
      markLocalChange();
      setEvents(update);
    },
    [markLocalChange],
  );

  return { events, loading, error, reload, applyLocal, markLocalChange };
}

export function upsertEvent(list: CalendarEvent[], event: CalendarEvent): CalendarEvent[] {
  const index = list.findIndex((item) => item.id === event.id);
  if (index < 0) return [...list, event];
  const next = [...list];
  next[index] = event;
  return next;
}

export function removeEvent(list: CalendarEvent[], id: string): CalendarEvent[] {
  return list.filter((item) => item.id !== id);
}
