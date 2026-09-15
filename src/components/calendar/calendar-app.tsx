"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog, type ConfirmRequest } from "@/components/calendar/confirm-dialog";
import { FilterBar } from "@/components/calendar/filter-bar";
import { ListView } from "@/components/calendar/list-view";
import { MonthView } from "@/components/calendar/month-view";
import { DayView, WeekView } from "@/components/calendar/week-view";
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
import { isUnchanged, type DragPatch, type DragPreview } from "@/lib/drag";
import { eventToForm, newEventForm } from "@/lib/event-form";
import {
  addDays,
  addMinutes,
  addMonths,
  dateKey,
  formatFullDate,
  formatMonthLabel,
  fromJst,
  monthGrid,
  nowJst,
  startOfDay,
  toInputValue,
  toJst,
  weekGrid,
} from "@/lib/time";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

const VIEWS: ViewKind[] = ["month", "week", "day", "list"];

/** 空いている枠を押して新規作成するときの既定の開始時刻。 */
const DEFAULT_START_HOUR = 10;

/** リスト表示で先に見せる日数 */
const LIST_DAYS = 60;

const VIEW_STORAGE_KEY = "klc-view";

/** 表示中の期間。予定を取り出す範囲と、見出しの文言を決める。 */
function viewRange(view: ViewKind, anchor: Date): { start: Date; end: Date } {
  switch (view) {
    case "month": {
      const days = monthGrid(anchor);
      return { start: days[0], end: addDays(days[41], 1) };
    }
    case "week": {
      const days = weekGrid(anchor);
      return { start: days[0], end: addDays(days[6], 1) };
    }
    case "day":
      return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
    case "list":
      return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), LIST_DAYS) };
  }
}

function viewTitle(view: ViewKind, anchor: Date): string {
  switch (view) {
    case "month":
      return formatMonthLabel(anchor);
    case "week": {
      const days = weekGrid(anchor);
      return `${formatMonthLabel(days[0])} ${days[0].getUTCDate()}日 〜 ${days[6].getUTCDate()}日`;
    }
    case "day":
      return formatFullDate(anchor);
    case "list":
      return "これからの予定";
  }
}

/** 前後の移動幅。表示ごとに自然な単位で動かす。 */
function stepAnchor(view: ViewKind, anchor: Date, direction: 1 | -1): Date {
  switch (view) {
    case "month":
      return addMonths(anchor, direction);
    case "week":
      return addDays(anchor, 7 * direction);
    case "day":
      return addDays(anchor, direction);
    case "list":
      return addDays(anchor, 14 * direction);
  }
}

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
  /** ドラッグ中の見た目。確定前の位置を画面にだけ反映する。 */
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  /** 直前の操作を取り消すための積み重ね。Ctrl+Z でも使う。 */
  const undoStack = useRef<(() => void)[]>([]);

  // スマホはリスト、PCは月から始める。前回選んだ表示があればそれを優先する。
  useEffect(() => {
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(VIEW_STORAGE_KEY);
    } catch {
      /* 保存が使えない場合は画面幅だけで決める */
    }
    if (remembered && (VIEWS as string[]).includes(remembered)) {
      setView(remembered as ViewKind);
    } else if (window.matchMedia("(max-width: 640px)").matches) {
      setView("list");
    }
  }, []);

  const changeView = useCallback((next: ViewKind) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* 保存できなくても表示の切り替えはできる */
    }
  }, []);

  // 日付が変わったら「今日」の位置を更新する（画面を開きっぱなしにする使い方のため）
  useEffect(() => {
    const timer = setInterval(() => setToday(startOfDay(nowJst())), 60_000);
    return () => clearInterval(timer);
  }, []);

  const range = useMemo(() => {
    const { start, end } = viewRange(view, anchor);
    return { from: fromJst(start), to: fromJst(end) };
  }, [view, anchor]);

  const { events, error, applyLocal, reload } = useEvents(range.from, range.to);

  const notify = useCallback((text: string, options: Partial<ToastMessage> = {}) => {
    setToast({ id: Date.now(), text, tone: "info", ...options });
  }, []);

  /** 取り消せる操作を記録し、通知に「元に戻す」を出す。 */
  const notifyUndoable = useCallback(
    (text: string, undo: () => void) => {
      undoStack.current.push(undo);
      setToast({
        id: Date.now(),
        text,
        tone: "info",
        undo: () => {
          const last = undoStack.current.pop();
          last?.();
        },
      });
    },
    [],
  );

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

  /** ドラッグ中の予定だけ、確定前の位置に差し替えて描く。 */
  const displayedEvents = useMemo(() => {
    if (!preview) return visibleEvents;
    return visibleEvents.map((event) =>
      event.id === preview.id
        ? {
            ...event,
            startsAt: preview.startsAt,
            endsAt: preview.endsAt,
            staffId: preview.staffId === undefined ? event.staffId : preview.staffId,
            scope: preview.scope ?? event.scope,
          }
        : event,
    );
  }, [visibleEvents, preview]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  /* --- 予定を開く --- */

  const openCreate = useCallback(
    (day: Date, minutes = DEFAULT_START_HOUR * 60, staffId?: string | null) => {
      const at = addMinutes(startOfDay(day), minutes);
      const form = newEventForm({
        at,
        staffId: staffId === undefined ? actor.id : (staffId ?? ""),
        categoryId: categories[0]?.id ?? "",
      });
      // 日表示の「全体」列から作った場合は全体予定として始める
      setPanel({
        kind: "create",
        form: staffId === null ? { ...form, scope: "store" } : form,
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

  /* --- ドラッグでの移動・時間変更 --- */

  const applyPatch = useCallback(
    async (event: CalendarEvent, patch: DragPatch, message: string) => {
      const before: DragPatch = {
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        staffId: event.staffId,
        scope: event.scope,
      };
      try {
        const updated = await updateEvent(event.id, patch);
        applyLocal((current) => upsertEvent(current, updated));
        notifyUndoable(message, () => {
          void (async () => {
            try {
              const reverted = await updateEvent(event.id, before);
              applyLocal((current) => upsertEvent(current, reverted));
              notify("元に戻しました。");
            } catch (cause) {
              notifyError(cause);
            }
          })();
        });
      } catch (cause) {
        notifyError(cause);
      } finally {
        setPreview(null);
      }
    },
    [applyLocal, notify, notifyError, notifyUndoable],
  );

  const commitDrag = useCallback(
    (event: CalendarEvent, patch: DragPatch) => {
      if (isUnchanged(event, patch, patch.staffId)) {
        setPreview(null);
        return;
      }

      // 過去に動かすのは操作ミスのことが多いので、一度だけ確認する
      const todayStartMs = Date.parse(fromJst(startOfDay(nowJst())));
      const movedToPast = Date.parse(patch.startsAt) < todayStartMs;
      const wasInPast = Date.parse(event.startsAt) < todayStartMs;

      if (movedToPast && !wasInPast) {
        setConfirmRequest({
          title: "過去の日付に移動します",
          body: `「${event.title}」を過ぎた日時に移動しようとしています。よろしいですか？`,
          confirmLabel: "移動する",
          onConfirm: () => {
            setConfirmRequest(null);
            void applyPatch(event, patch, `「${event.title}」を移動しました。`);
          },
          onCancel: () => {
            setConfirmRequest(null);
            setPreview(null);
          },
        });
        return;
      }

      void applyPatch(event, patch, `「${event.title}」を移動しました。`);
    },
    [applyPatch],
  );

  // Ctrl+Z / Cmd+Z でも直前の操作を取り消せるようにする
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "z" || !(keyEvent.ctrlKey || keyEvent.metaKey) || keyEvent.shiftKey) {
        return;
      }
      const target = keyEvent.target as HTMLElement | null;
      // 入力中の取り消しはブラウザ本来の動きに任せる
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const last = undoStack.current.pop();
      if (!last) return;
      keyEvent.preventDefault();
      last();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const remove = useCallback(
    async (event: CalendarEvent) => {
      setPanel(null);
      try {
        await deleteEvent(event.id);
        applyLocal((current) => removeEvent(current, event.id));
        notifyUndoable(`「${event.title}」を削除しました。`, () => {
          void (async () => {
            try {
              const restored = await restoreEvent(event.id);
              applyLocal((current) => upsertEvent(current, restored));
              notify("削除を取り消しました。");
            } catch (cause) {
              notifyError(cause);
            }
          })();
        });
      } catch (cause) {
        notifyError(cause);
      }
    },
    [applyLocal, notify, notifyError, notifyUndoable],
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

  const step = (direction: 1 | -1) =>
    setAnchor((current) => stepAnchor(view, current, direction));

  return (
    <div className="min-h-dvh">
      <Toolbar
        title={viewTitle(view, anchor)}
        subtitle={`${visibleEvents.length}件の予定`}
        view={view}
        views={VIEWS}
        actor={actor}
        onChangeView={changeView}
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

        {view === "month" ? (
          <MonthView
            anchor={anchor}
            today={today}
            events={displayedEvents}
            staff={staff}
            categories={categories}
            onOpenEvent={openEvent}
            onCreateAt={(day) => openCreate(day)}
            onOpenDay={(day) => {
              setAnchor(day);
              changeView("day");
            }}
            onDragPreview={setPreview}
            onCommitDrag={commitDrag}
          />
        ) : view === "week" ? (
          <WeekView
            anchor={anchor}
            today={today}
            events={displayedEvents}
            staff={staff}
            categories={categories}
            onOpenEvent={openEvent}
            onCreateAt={openCreate}
            onDragPreview={setPreview}
            onCommitDrag={commitDrag}
          />
        ) : view === "day" ? (
          <DayView
            anchor={anchor}
            today={today}
            events={displayedEvents}
            staff={staff}
            categories={categories}
            onOpenEvent={openEvent}
            onCreateAt={openCreate}
            onDragPreview={setPreview}
            onCommitDrag={commitDrag}
          />
        ) : (
          <ListView
            from={startOfDay(anchor)}
            days={LIST_DAYS}
            today={today}
            events={displayedEvents}
            staff={staff}
            categories={categories}
            onOpenEvent={openEvent}
          />
        )}
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
          defaultStaffId={actor.id}
          saving={saving}
          onClose={() => setPanel(null)}
          onSave={(draft) => void save(draft)}
          onDelete={(event) => void remove(event)}
          onDuplicate={duplicate}
        />
      ) : null}

      {confirmRequest ? <ConfirmDialog request={confirmRequest} /> : null}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
