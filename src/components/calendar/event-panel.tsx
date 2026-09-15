"use client";

import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { CategoryIcon } from "@/components/calendar/event-chip";
import { FormError, formToDraft, shiftEnd, type EventForm } from "@/lib/event-form";
import type { EventDraft } from "@/lib/client/api";
import type { CalendarEvent, Category, Staff } from "@/lib/types";

export type PanelMode =
  | { kind: "create"; form: EventForm }
  | { kind: "edit"; form: EventForm; event: CalendarEvent };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border px-3 text-sm outline-none transition-colors";

function inputStyle() {
  return { background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--ink)" };
}

export function EventPanel({
  mode,
  staff,
  categories,
  saving,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
}: {
  mode: PanelMode;
  staff: Staff[];
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: EventDraft) => void;
  onDelete: (event: CalendarEvent) => void;
  onDuplicate: (event: CalendarEvent) => void;
}) {
  const [form, setForm] = useState<EventForm>(mode.form);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // 別の予定を開いたら入力欄を差し替える
  const key = mode.kind === "edit" ? mode.event.id : "new";
  useEffect(() => {
    setForm(mode.form);
    setError(null);
    // 新規作成のときだけ件名にカーソルを置く（編集では勝手に触らない）
    if (mode.kind === "create") titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Esc で閉じる
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const patch = (next: Partial<EventForm>) => setForm((current) => ({ ...current, ...next }));

  const submit = () => {
    try {
      onSave(formToDraft(form));
      setError(null);
    } catch (cause) {
      setError(cause instanceof FormError ? cause.message : "入力内容を確認してください。");
    }
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="予定の入力">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(8,11,20,0.45)" }}
      />

      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[27rem] md:max-h-none md:rounded-none"
        style={{
          background: "var(--surface)",
          boxShadow: "var(--shadow-pop)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-bold">
            {mode.kind === "create" ? "予定を追加" : "予定を編集"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full p-2 text-ink-muted transition-colors hover:text-ink"
            style={{ background: "var(--surface-3)" }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          <div className="flex flex-col gap-4">
            {/* 種別 */}
            <div
              role="radiogroup"
              aria-label="予定の種別"
              className="grid grid-cols-2 gap-1 rounded-xl p-1"
              style={{ background: "var(--surface-3)" }}
            >
              {(
                [
                  { value: "staff", label: "スタッフの予定" },
                  { value: "store", label: "全体・イベント" },
                ] as const
              ).map((option) => {
                const active = form.scope === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => patch({ scope: option.value })}
                    className="rounded-lg py-2 text-sm font-medium transition-colors duration-200"
                    style={
                      active
                        ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-card)" }
                        : { color: "var(--ink-muted)" }
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* 担当スタッフ */}
            <Field label={form.scope === "staff" ? "担当スタッフ" : "担当スタッフ（任意）"}>
              <div className="flex flex-wrap gap-1.5">
                {form.scope === "store" ? (
                  <button
                    type="button"
                    onClick={() => patch({ staffId: "" })}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={
                      form.staffId === ""
                        ? { background: "var(--ink)", color: "var(--canvas)", borderColor: "var(--ink)" }
                        : { background: "var(--surface-2)", borderColor: "var(--line)" }
                    }
                  >
                    指定なし
                  </button>
                ) : null}
                {staff.map((member) => {
                  const active = form.staffId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => patch({ staffId: member.id })}
                      className={`a-${member.color} flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-all duration-200`}
                      style={
                        active
                          ? { background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                          : { background: "var(--surface-2)", borderColor: "var(--line)" }
                      }
                    >
                      <Avatar name={member.name} color={member.color} size="sm" />
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="件名">
              <input
                ref={titleRef}
                value={form.title}
                onChange={(event) => patch({ title: event.target.value })}
                maxLength={120}
                placeholder="例: ◯◯様 打合せ"
                className={inputClass}
                style={inputStyle()}
              />
            </Field>

            {/* 日時 */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(event) => patch({ allDay: event.target.checked })}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--brand)" }}
                />
                終日
              </label>

              {form.allDay ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="開始日">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) => {
                        const startDate = event.target.value;
                        patch({
                          startDate,
                          // 終了日が開始日より前になったら合わせる
                          endDate: form.endDate < startDate ? startDate : form.endDate,
                        });
                      }}
                      className={inputClass}
                      style={inputStyle()}
                    />
                  </Field>
                  <Field label="終了日">
                    <input
                      type="date"
                      value={form.endDate}
                      min={form.startDate}
                      onChange={(event) => patch({ endDate: event.target.value })}
                      className={inputClass}
                      style={inputStyle()}
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="開始">
                    <input
                      type="datetime-local"
                      value={form.start}
                      step={900}
                      onChange={(event) => setForm(shiftEnd(form, event.target.value))}
                      className={inputClass}
                      style={inputStyle()}
                    />
                  </Field>
                  <Field label="終了">
                    <input
                      type="datetime-local"
                      value={form.end}
                      step={900}
                      min={form.start}
                      onChange={(event) => patch({ end: event.target.value })}
                      className={inputClass}
                      style={inputStyle()}
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* 分類 */}
            <Field label="分類">
              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => {
                  const active = form.categoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => patch({ categoryId: category.id })}
                      className={`a-${category.color} flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200`}
                      style={
                        active
                          ? { background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                          : { background: "var(--surface-2)", borderColor: "var(--line)" }
                      }
                    >
                      <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="場所（任意）">
              <input
                value={form.location}
                onChange={(event) => patch({ location: event.target.value })}
                maxLength={200}
                placeholder="例: 本社2階 会議室"
                className={inputClass}
                style={inputStyle()}
              />
            </Field>

            <Field label="メモ（任意）">
              <textarea
                value={form.note}
                onChange={(event) => patch({ note: event.target.value })}
                rows={3}
                className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
            </Field>

            {error ? (
              <p
                role="alert"
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                  color: "var(--danger)",
                }}
              >
                {error}
              </p>
            ) : null}

            {mode.kind === "edit" ? (
              <p className="text-[11px] leading-relaxed text-ink-faint">
                登録: {mode.event.createdBy || "不明"}
                {mode.event.updatedBy && mode.event.updatedBy !== mode.event.createdBy
                  ? ` / 最終更新: ${mode.event.updatedBy}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>

        <footer
          className="flex items-center gap-2 border-t px-5 py-3"
          style={{
            background: "var(--surface)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
          }}
        >
          {mode.kind === "edit" ? (
            <>
              <button
                type="button"
                onClick={() => onDelete(mode.event)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                style={{ color: "var(--danger)" }}
              >
                削除
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(mode.event)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                複製
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="ml-auto h-11 min-w-28 rounded-xl px-5 text-sm font-semibold transition-all duration-200 disabled:opacity-60"
            style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </footer>
      </div>
    </div>
  );
}
