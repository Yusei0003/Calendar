"use client";

import { Avatar } from "@/components/avatar";
import { CategoryIcon } from "@/components/calendar/event-chip";
import type { Category, Staff } from "@/lib/types";

/**
 * スタッフ・分類での絞り込み。
 * 何も選んでいない状態を「すべて表示」として扱う（選ぶほど絞られる）。
 */
export function FilterBar({
  staff,
  categories,
  selectedStaff,
  selectedCategories,
  onToggleStaff,
  onToggleCategory,
  onReset,
}: {
  staff: Staff[];
  categories: Category[];
  selectedStaff: Set<string>;
  selectedCategories: Set<string>;
  onToggleStaff: (id: string) => void;
  onToggleCategory: (id: string) => void;
  onReset: () => void;
}) {
  const filtering = selectedStaff.size > 0 || selectedCategories.size > 0;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <div className="flex shrink-0 items-center gap-1.5">
        {staff.map((member) => {
          const active = selectedStaff.has(member.id);
          return (
            <button
              key={member.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleStaff(member.id)}
              title={member.name}
              className={`a-${member.color} flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-medium transition-all duration-200`}
              style={
                active
                  ? { background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                  : { background: "var(--surface)", borderColor: "var(--line)" }
              }
            >
              <Avatar name={member.name} color={member.color} size="sm" />
              <span className="hidden sm:inline">{member.name}</span>
            </button>
          );
        })}
      </div>

      <span className="h-5 w-px shrink-0" style={{ background: "var(--line)" }} />

      <div className="flex shrink-0 items-center gap-1.5">
        {categories.map((category) => {
          const active = selectedCategories.has(category.id);
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleCategory(category.id)}
              className={`a-${category.color} flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all duration-200`}
              style={
                active
                  ? { background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                  : { background: "var(--surface)", borderColor: "var(--line)" }
              }
            >
              <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
              {category.name}
            </button>
          );
        })}
      </div>

      {filtering ? (
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          style={{ background: "var(--surface-3)" }}
        >
          絞り込みを解除
        </button>
      ) : null}
    </div>
  );
}
