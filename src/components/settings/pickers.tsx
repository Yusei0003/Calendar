"use client";

import { CategoryIcon } from "@/components/calendar/event-chip";
import { ACCENT_COLORS, CATEGORY_ICONS, type AccentColor, type CategoryIcon as IconName } from "@/lib/types";

/** 色を選ぶ。丸を並べて、選んでいるものに枠を付ける。 */
export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: AccentColor;
  onChange: (color: AccentColor) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {ACCENT_COLORS.map((color) => {
        const active = color === value;
        return (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={active}
            onClick={() => onChange(color)}
            className={`a-${color} h-6 w-6 rounded-full transition-transform duration-150 hover:scale-110`}
            style={{
              background: "var(--accent)",
              boxShadow: active ? "0 0 0 2px var(--surface), 0 0 0 4px var(--accent)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/** 分類のアイコンを選ぶ。色が見分けにくい人にも区別できるようにするためのもの。 */
export function IconPicker({
  value,
  onChange,
}: {
  value: IconName;
  onChange: (icon: IconName) => void;
}) {
  return (
    <div role="group" aria-label="アイコン" className="flex flex-wrap gap-1.5">
      {CATEGORY_ICONS.map((icon) => {
        const active = icon === value;
        return (
          <button
            key={icon}
            type="button"
            aria-label={icon}
            aria-pressed={active}
            onClick={() => onChange(icon)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors"
            style={{
              background: active ? "var(--surface-3)" : "var(--surface-2)",
              borderColor: active ? "var(--brand)" : "var(--line)",
              color: "var(--ink)",
            }}
          >
            <CategoryIcon icon={icon} className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

/** 上下に並べ替えるボタン。 */
export function OrderButtons({
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const base =
    "flex h-7 w-7 items-center justify-center rounded-lg border text-ink-muted transition-colors disabled:opacity-30";
  const style = { background: "var(--surface-2)", borderColor: "var(--line)" };

  return (
    <div className="flex gap-1">
      <button type="button" onClick={onUp} disabled={!canUp} aria-label="上へ" className={base} style={style}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
      <button type="button" onClick={onDown} disabled={!canDown} aria-label="下へ" className={base} style={style}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

/** 入り／切りの切り替え。 */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? "var(--brand)" : "var(--surface-3)" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200 ease-swift"
        style={{
          left: checked ? "1.375rem" : "0.125rem",
          background: checked ? "var(--brand-ink)" : "var(--ink-faint)",
        }}
      />
    </button>
  );
}
