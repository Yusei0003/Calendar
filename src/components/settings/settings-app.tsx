"use client";

import { useCallback, useState } from "react";

import { Avatar } from "@/components/avatar";
import { CategoryIcon } from "@/components/calendar/event-chip";
import { Toast, type ToastMessage } from "@/components/calendar/toast";
import { ColorPicker, IconPicker, OrderButtons, Switch } from "@/components/settings/pickers";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  createCategory,
  createStaff,
  deleteCategory,
  updateCategory,
  updateStaff,
} from "@/lib/client/api";
import { ACCENT_COLORS, type AccentColor, type Category, type Staff } from "@/lib/types";

/** 次に使う色。すでに使われていない色から選ぶ。 */
function nextColor(used: AccentColor[]): AccentColor {
  return ACCENT_COLORS.find((color) => !used.includes(color)) ?? "slate";
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b px-5 py-4" style={{ background: "var(--surface-2)" }}>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
      </header>
      {children}
    </section>
  );
}

const nameInputClass = "h-10 w-full rounded-xl border px-3 text-sm outline-none sm:max-w-56";
const nameInputStyle = {
  background: "var(--surface-2)",
  borderColor: "var(--line)",
  color: "var(--ink)",
};

export function SettingsApp({
  initialStaff,
  initialCategories,
}: {
  initialStaff: Staff[];
  initialCategories: Category[];
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [categories, setCategories] = useState(initialCategories);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [newStaffName, setNewStaffName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = useCallback((text: string) => {
    setToast({ id: Date.now(), text, tone: "info" });
  }, []);

  const fail = useCallback((cause: unknown) => {
    setToast({
      id: Date.now(),
      text: cause instanceof Error ? cause.message : "うまくいきませんでした。",
      tone: "error",
    });
  }, []);

  /* --- スタッフ --- */

  const patchStaff = async (id: string, patch: Partial<Staff>) => {
    const before = staff;
    setStaff((current) => current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    try {
      await updateStaff(id, patch);
    } catch (cause) {
      setStaff(before);
      fail(cause);
    }
  };

  const moveStaff = async (id: string, direction: -1 | 1) => {
    const index = staff.findIndex((m) => m.id === id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= staff.length) return;

    const next = [...staff];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    // 並べ替えたあとの位置を、そのまま並び順として振り直す
    const renumbered = next.map((member, position) => ({ ...member, sortOrder: position + 1 }));
    setStaff(renumbered);

    try {
      await Promise.all(
        [renumbered[index], renumbered[swapWith]].map((member) =>
          updateStaff(member.id, { sortOrder: member.sortOrder }),
        ),
      );
    } catch (cause) {
      setStaff(staff);
      fail(cause);
    }
  };

  const addStaff = async () => {
    const name = newStaffName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createStaff({
        name,
        color: nextColor(staff.map((m) => m.color)),
        sortOrder: staff.length + 1,
        active: true,
      });
      setStaff((current) => [...current, created]);
      setNewStaffName("");
      notify(`${created.name}さんを追加しました。`);
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  /* --- 分類 --- */

  const patchCategory = async (id: string, patch: Partial<Category>) => {
    const before = categories;
    setCategories((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try {
      await updateCategory(id, patch);
    } catch (cause) {
      setCategories(before);
      fail(cause);
    }
  };

  const moveCategory = async (id: string, direction: -1 | 1) => {
    const index = categories.findIndex((c) => c.id === id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= categories.length) return;

    const next = [...categories];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    const renumbered = next.map((category, position) => ({ ...category, sortOrder: position + 1 }));
    setCategories(renumbered);

    try {
      await Promise.all(
        [renumbered[index], renumbered[swapWith]].map((category) =>
          updateCategory(category.id, { sortOrder: category.sortOrder }),
        ),
      );
    } catch (cause) {
      setCategories(categories);
      fail(cause);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createCategory({
        name,
        color: nextColor(categories.map((c) => c.color)),
        icon: "dot",
        sortOrder: categories.length + 1,
        hidden: false,
      });
      setCategories((current) => [...current, created]);
      setNewCategoryName("");
      notify(`分類「${created.name}」を追加しました。`);
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = async (category: Category) => {
    try {
      await deleteCategory(category.id);
      setCategories((current) => current.filter((c) => c.id !== category.id));
      notify(`分類「${category.name}」を削除しました。`);
    } catch (cause) {
      fail(cause);
    }
  };

  return (
    <div className="min-h-dvh">
      <header
        className="sticky z-30 border-b"
        style={{ top: "env(safe-area-inset-top, 0px)", background: "var(--surface)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a
            href="/calendar"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            カレンダー
          </a>
          <h1 className="text-lg font-bold">設定</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        <Section
          title="スタッフ"
          description="名前と色を決めます。色はカレンダー上でその人の予定に使われます。退職した人は「在籍」を切ると新しい予定で選べなくなりますが、過去の予定はそのまま残ります。"
        >
          <ul>
            {staff.map((member, index) => (
              <li key={member.id} className="border-b px-5 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={member.name} color={member.color} />
                  <input
                    defaultValue={member.name}
                    maxLength={40}
                    aria-label={`${member.name}の名前`}
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name && name !== member.name) void patchStaff(member.id, { name });
                      else event.target.value = member.name;
                    }}
                    className={nameInputClass}
                    style={nameInputStyle}
                  />
                  <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      在籍
                      <Switch
                        checked={member.active}
                        label={`${member.name}の在籍`}
                        onChange={(active) => void patchStaff(member.id, { active })}
                      />
                    </label>
                    <OrderButtons
                      canUp={index > 0}
                      canDown={index < staff.length - 1}
                      onUp={() => void moveStaff(member.id, -1)}
                      onDown={() => void moveStaff(member.id, 1)}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <ColorPicker
                    label={`${member.name}の色`}
                    value={member.color}
                    onChange={(color) => void patchStaff(member.id, { color })}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 px-5 py-4" style={{ background: "var(--surface-2)" }}>
            <input
              value={newStaffName}
              onChange={(event) => setNewStaffName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addStaff();
              }}
              placeholder="追加する人の名前"
              maxLength={40}
              className={nameInputClass}
              style={{ ...nameInputStyle, background: "var(--surface)" }}
            />
            <button
              type="button"
              onClick={() => void addStaff()}
              disabled={busy || !newStaffName.trim()}
              className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
            >
              追加
            </button>
          </div>
        </Section>

        <Section
          title="分類"
          description="予定の種類です。いつでも増やせます。使われている分類は削除できないため、代わりに「表示」を切ると新しい予定で選べなくなります。"
        >
          <ul>
            {categories.map((category, index) => (
              <li key={category.id} className="border-b px-5 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`a-${category.color} flex h-10 w-10 shrink-0 items-center justify-center rounded-full`}
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent-ink)",
                      boxShadow: "inset 0 0 0 1.5px var(--accent)",
                    }}
                  >
                    <CategoryIcon icon={category.icon} className="h-4 w-4" />
                  </span>
                  <input
                    defaultValue={category.name}
                    maxLength={40}
                    aria-label={`${category.name}の名前`}
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name && name !== category.name) void patchCategory(category.id, { name });
                      else event.target.value = category.name;
                    }}
                    className={nameInputClass}
                    style={nameInputStyle}
                  />
                  <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      表示
                      <Switch
                        checked={!category.hidden}
                        label={`${category.name}を使う`}
                        onChange={(visible) => void patchCategory(category.id, { hidden: !visible })}
                      />
                    </label>
                    <OrderButtons
                      canUp={index > 0}
                      canDown={index < categories.length - 1}
                      onUp={() => void moveCategory(category.id, -1)}
                      onDown={() => void moveCategory(category.id, 1)}
                    />
                    <button
                      type="button"
                      onClick={() => void removeCategory(category)}
                      aria-label={`${category.name}を削除`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors"
                      style={{ background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--danger)" }}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <ColorPicker
                    label={`${category.name}の色`}
                    value={category.color}
                    onChange={(color) => void patchCategory(category.id, { color })}
                  />
                  <IconPicker
                    value={category.icon}
                    onChange={(icon) => void patchCategory(category.id, { icon })}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 px-5 py-4" style={{ background: "var(--surface-2)" }}>
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addCategory();
              }}
              placeholder="追加する分類の名前"
              maxLength={40}
              className={nameInputClass}
              style={{ ...nameInputStyle, background: "var(--surface)" }}
            />
            <button
              type="button"
              onClick={() => void addCategory()}
              disabled={busy || !newCategoryName.trim()}
              className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
            >
              追加
            </button>
          </div>
        </Section>
      </main>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
