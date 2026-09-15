import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  CalendarEvent,
  Category,
  CategoryInput,
  EventInput,
  Staff,
  StaffInput,
} from "@/lib/types";
import { SEED_CATEGORIES, SEED_STAFF } from "@/lib/db/seed";
import type { EventQuery, Store } from "@/lib/db/store";

/**
 * 開発用のデータ保存先。Supabase の環境変数が未設定のときに使われる。
 * プロジェクト直下の .data/db.json に JSON で書き出すだけの簡易実装。
 */

interface Snapshot {
  staff: Staff[];
  categories: Category[];
  events: CalendarEvent[];
}

const FILE = process.env.LOCAL_DB_PATH ?? join(process.cwd(), ".data", "db.json");

function emptySnapshot(): Snapshot {
  return {
    staff: SEED_STAFF.map((s) => ({ ...s })),
    categories: SEED_CATEGORIES.map((c) => ({ ...c })),
    events: [],
  };
}

/** 書き込みが重ならないよう、直前の処理の完了を待ってから次を実行する。 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Snapshot> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    return {
      staff: parsed.staff ?? [],
      categories: parsed.categories ?? [],
      events: parsed.events ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh = emptySnapshot();
      await save(fresh);
      return fresh;
    }
    throw error;
  }
}

async function save(snapshot: Snapshot): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  // 書き込み途中で壊れたファイルが残らないよう、一時ファイルへ書いてから差し替える
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  await rename(tmp, FILE);
}

function mutate<T>(fn: (snapshot: Snapshot) => T | Promise<T>): Promise<T> {
  return serialize(async () => {
    const snapshot = await load();
    const result = await fn(snapshot);
    await save(snapshot);
    return result;
  });
}

function read<T>(fn: (snapshot: Snapshot) => T): Promise<T> {
  return serialize(async () => fn(await load()));
}

function byOrder<T extends { sortOrder: number; name: string }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ja");
}

export const localStore: Store = {
  async listStaff(includeInactive = false) {
    return read((db) =>
      db.staff.filter((s) => includeInactive || s.active).sort(byOrder),
    );
  },

  async createStaff(input) {
    return mutate((db) => {
      const staff: Staff = { id: randomUUID(), ...input };
      db.staff.push(staff);
      return staff;
    });
  },

  async updateStaff(id, patch) {
    return mutate((db) => {
      const found = db.staff.find((s) => s.id === id);
      if (!found) throw new Error(`スタッフが見つかりません: ${id}`);
      Object.assign(found, patch);
      return found;
    });
  },

  async listCategories(includeHidden = false) {
    return read((db) =>
      db.categories.filter((c) => includeHidden || !c.hidden).sort(byOrder),
    );
  },

  async createCategory(input) {
    return mutate((db) => {
      const category: Category = { id: randomUUID(), ...input };
      db.categories.push(category);
      return category;
    });
  },

  async updateCategory(id, patch) {
    return mutate((db) => {
      const found = db.categories.find((c) => c.id === id);
      if (!found) throw new Error(`分類が見つかりません: ${id}`);
      Object.assign(found, patch);
      return found;
    });
  },

  async countEventsByCategory(categoryId) {
    return read((db) => db.events.filter((e) => e.categoryId === categoryId).length);
  },

  async deleteCategory(id) {
    await mutate((db) => {
      const index = db.categories.findIndex((c) => c.id === id);
      if (index >= 0) db.categories.splice(index, 1);
    });
  },

  async listEvents({ from, to, includeDeleted = false }) {
    return read((db) =>
      db.events
        .filter((e) => (includeDeleted || !e.deletedAt) && e.endsAt >= from && e.startsAt < to)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  },

  async getEvent(id) {
    return read((db) => db.events.find((e) => e.id === id) ?? null);
  },

  async createEvent(input, actor) {
    return mutate((db) => {
      const now = new Date().toISOString();
      const event: CalendarEvent = {
        id: randomUUID(),
        ...input,
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceUntil: input.recurrenceUntil ?? null,
        parentEventId: input.parentEventId ?? null,
        createdBy: actor,
        updatedBy: actor,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      db.events.push(event);
      return event;
    });
  },

  async updateEvent(id, patch, actor) {
    return mutate((db) => {
      const found = db.events.find((e) => e.id === id);
      if (!found) throw new Error(`予定が見つかりません: ${id}`);
      Object.assign(found, patch, {
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      });
      return found;
    });
  },

  async softDeleteEvent(id, actor) {
    await mutate((db) => {
      const found = db.events.find((e) => e.id === id);
      if (!found) throw new Error(`予定が見つかりません: ${id}`);
      found.deletedAt = new Date().toISOString();
      found.updatedBy = actor;
      found.updatedAt = found.deletedAt;
    });
  },

  async restoreEvent(id, actor) {
    return mutate((db) => {
      const found = db.events.find((e) => e.id === id);
      if (!found) throw new Error(`予定が見つかりません: ${id}`);
      found.deletedAt = null;
      found.updatedBy = actor;
      found.updatedAt = new Date().toISOString();
      return found;
    });
  },
};
