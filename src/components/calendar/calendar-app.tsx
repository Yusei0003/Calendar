"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterBar } from "@/components/calendar/filter-bar";
import { MonthView } from "@/components/calendar/month-view";
import { EventPanel, type PanelMode } from "@/components/calendar/event-panel";
import { Toast, type ToastMessage } from "@/components/calendar/toast";
import { Toolbar, type ViewKind } from "@/components/calendar/toolbar";
import {
  createEvent,
  deleteEvent,
  restoreEvent,
  updateEvent,
  type EventDraft,
} from "@/lib/client/api";
import { removeEvent, upsertEvent, useEvents } from "@/lib/client/use-events";
import { eventToForm, newEventForm } from "@/lib/event-form";
import {
  addDays,
  addMonths,
  dateKey,
  formatMonthLabel,
  fromJst,
  monthGrid,
  nowJst,
  startOfDay,
  toInputValue,
  toJst,
} from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

const VIEWS: ViewKind[] = ["month"];

/** 空いている枠を押して新規作成するときの既定の開始時刻。 */
const DEFAULT_START_HOUR = 10;

export function CalendarApp({
  staff,
  categories,
  actor,
}: {
  staff: Staff[];
  categories: Category[];
  actor: Staff;
}) {
  const [view, setView] = useState<ViewKind>("month");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(nowJst()));
  const [today, setToday] = useState<Date>(() => startOfDay(nowJst()));
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<PanelMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // 日付が変わったら「今日」の位置を更新する（画面を開きっぱなしにする使い方のため）
  useEffect(() => {
    const timer = setInterval(() => setToday(startOfDay(nowJst())), 60_000);
    return () => clearInterval(timer);
  }, []);

  const range = useMemo(() => {
    const days = monthGrid(anchor);
    return { from: fromJst(days[0]), to: fromJst(addDays(days[41], 1)) };
  }, [anchor]);

  const { events, error, applyLocal, reload } = useEvents(range.from, range.to);

  const notify = useCallback((text: string, options: Partial<ToastMessage> = {}) => {
    setToast({ id: Date.now(), text, tone: "info", ...options });
  }, []);

  const notifyError = useCallback((cause: unknown) => {
    setToast({
      id: Date.now(),
      text: cause instanceof Error ? cause.message : "うまくいきませんでした。",
      tone: "error",
    });
  }, []);

  /* --- 絞り込み --- */

  const visibleEvents = useMemo(() => {
    if (selectedStaff.size === 0 && selectedCategories.size === 0) return events;
    return events.filter((event) => {
      const staffOk =
        selectedStaff.size === 0 || (event.staffId ? selectedStaff.has(event.staffId) : false);
      const categoryOk =
        selectedCategories.size === 0 || selectedCategories.has(event.categoryId);
      return staffOk && categoryOk;
    });
  }, [events, selectedStaff, selectedCategories]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  /* --- 予定を開く --- */

  const openCreate = useCallback(
    (day: Date, hour = DEFAULT_START_HOUR) => {
      const at = new Date(startOfDay(day).getTime() + hour * 60 * 60 * 1000);
      setPanel({
        kind: "create",
        form: newEventForm({
          at,
          staffId: actor.id,
          categoryId: categories[0]?.id ?? "",
        }),
      });
    },
    [actor.id, categories],
  );

  const openEvent = useCallback((event: CalendarEvent) => {
    setPanel({ kind: "edit", form: eventToForm(event), event });
  }, []);

  /* --- 保存・削除 --- */

  const save = useCallback(
    async (draft: EventDraft) => {
      setSaving(true);
      try {
        if (panel?.kind === "edit") {
          const updated = await updateEvent(panel.event.id, draft);
          applyLocal((current) => upsertEvent(current, updated));
          notify("予定を更新しました。");
        } else {
          const created = await createEvent(draft);
          applyLocal((current) => upsertEvent(current, created));
          notify("予定を追加しました。");
        }
        setPanel(null);
      } catch (cause) {
        notifyError(cause);
      } finally {
        setSaving(false);
      }
    },
    [panel, applyLocal, notify, notifyError],
  );

  const remove = useCallback(
    async (event: CalendarEvent) => {
      setPanel(null);
      try {
        await deleteEvent(event.id);
        applyLocal((current) => removeEvent(current, event.id));
        notify(`「${event.title}」を削除しました。`, {
          undo: () => {
            void (async () => {
              try {
                const restored = await restoreEvent(event.id);
                applyLocal((current) => upsertEvent(current, restored));
                notify("削除を取り消しました。");
              } catch (cause) {
                notifyError(cause);
              }
            })();
          },
        });
      } catch (cause) {
        notifyError(cause);
      }
    },
    [applyLocal, notify, notifyError],
  );

  /** 同じ内容で別の日に。既定では翌日を開いた状態にする。 */
  const duplicate = useCallback((event: CalendarEvent) => {
    const form = eventToForm(event);
    const nextStart = addDays(toJst(event.startsAt), 1);
    const nextEnd = addDays(toJst(event.endsAt), 1);
    setPanel({
      kind: "create",
      form: {
        ...form,
        start: toInputValue(nextStart),
        end: toInputValue(nextEnd),
        startDate: dateKey(nextStart),
        // 終日の予定は翌日0:00までを範囲として持つので、表示上は1日戻す
        endDate: dateKey(form.allDay ? addDays(nextEnd, -1) : nextEnd),
      },
    });
  }, []);

  /* --- 期間の移動 --- */

  const step = (direction: 1 | -1) => setAnchor((current) => addMonths(current, direction));

  return (
    <div className="min-h-dvh">
      <Toolbar
        title={formatMonthLabel(anchor)}
        subtitle={`${visibleEvents.length}件の予定`}
        view={view}
        views={VIEWS}
        actor={actor}
        onChangeView={setView}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchor(startOfDay(nowJst()))}
        onOpenAdmin={() => notify("設定画面はこのあとの段階で追加します。")}
        onSwitchUser={() => {
          window.location.href = "/login/switch";
        }}
      />

      <main className="mx-auto max-w-[1400px] px-3 py-3 sm:px-5 sm:py-4">
        <div className="mb-3">
          <FilterBar
            staff={staff}
            categories={categories}
            selectedStaff={selectedStaff}
            selectedCategories={selectedCategories}
            onToggleStaff={(id) => setSelectedStaff((current) => toggle(current, id))}
            onToggleCategory={(id) => setSelectedCategories((current) => toggle(current, id))}
            onReset={() => {
              setSelectedStaff(new Set());
              setSelectedCategories(new Set());
            }}
          />
        </div>

        {error ? (
          <div
            className="mb-3 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm"
            style={{
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void reload()}
              className="ml-auto rounded-lg px-3 py-1 text-xs font-semibold"
              style={{ background: "color-mix(in srgb, var(--danger) 18%, transparent)" }}
            >
              再読み込み
            </button>
          </div>
        ) : null}

        <MonthView
          anchor={anchor}
          today={today}
          events={visibleEvents}
          staff={staff}
          categories={categories}
          onOpenEvent={openEvent}
          onCreateAt={(day) => openCreate(day)}
          onOpenDay={(day) => setAnchor(day)}
        />
      </main>

      {/* スマホで片手でも押せるよう、追加ボタンは右下に固定する */}
      <button
        type="button"
        onClick={() => openCreate(today)}
        aria-label="予定を追加"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 ease-swift active:scale-95"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          background: "var(--brand)",
          color: "var(--brand-ink)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {panel ? (
        <EventPanel
          mode={panel}
          staff={staff}
          categories={categories}
          saving={saving}
          onClose={() => setPanel(null)}
          onSave={(draft) => void save(draft)}
          onDelete={(event) => void remove(event)}
          onDuplicate={duplicate}
        />
      ) : null}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
