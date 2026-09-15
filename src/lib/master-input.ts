import "server-only";

import { InvalidInput, requireString } from "@/lib/api";
import {
  ACCENT_COLORS,
  CATEGORY_ICONS,
  type AccentColor,
  type CategoryIcon,
} from "@/lib/types";

function requireColor(value: unknown): AccentColor {
  if (typeof value !== "string" || !(ACCENT_COLORS as readonly string[]).includes(value)) {
    throw new InvalidInput("色の指定が正しくありません。");
  }
  return value as AccentColor;
}

function requireIcon(value: unknown): CategoryIcon {
  if (typeof value !== "string" || !(CATEGORY_ICONS as readonly string[]).includes(value)) {
    throw new InvalidInput("アイコンの指定が正しくありません。");
  }
  return value as CategoryIcon;
}

function requireOrder(value: unknown): number {
  const order = Number(value);
  if (!Number.isFinite(order)) throw new InvalidInput("並び順の指定が正しくありません。");
  return Math.trunc(order);
}

function requireFlag(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new InvalidInput(`${label}の指定が正しくありません。`);
  return value;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new InvalidInput("送信された内容を読み取れませんでした。");
  }
  return body as Record<string, unknown>;
}

/** スタッフの入力。update では送られてきた項目だけを取り出す。 */
export function parseStaffBody(body: unknown, partial: boolean) {
  const input = asRecord(body);
  const result: Record<string, unknown> = {};

  if (!partial || "name" in input) result.name = requireString(input.name, "名前", 40);
  if (!partial || "color" in input) result.color = requireColor(input.color);
  if (!partial || "sortOrder" in input) result.sortOrder = requireOrder(input.sortOrder ?? 0);
  if (!partial || "active" in input) result.active = requireFlag(input.active ?? true, "在籍");

  if (partial && Object.keys(result).length === 0) {
    throw new InvalidInput("変更する項目がありません。");
  }
  return result;
}

/** 分類の入力。 */
export function parseCategoryBody(body: unknown, partial: boolean) {
  const input = asRecord(body);
  const result: Record<string, unknown> = {};

  if (!partial || "name" in input) result.name = requireString(input.name, "分類名", 40);
  if (!partial || "color" in input) result.color = requireColor(input.color);
  if (!partial || "icon" in input) result.icon = requireIcon(input.icon ?? "dot");
  if (!partial || "sortOrder" in input) result.sortOrder = requireOrder(input.sortOrder ?? 0);
  if (!partial || "hidden" in input) result.hidden = requireFlag(input.hidden ?? false, "非表示");

  if (partial && Object.keys(result).length === 0) {
    throw new InvalidInput("変更する項目がありません。");
  }
  return result;
}
