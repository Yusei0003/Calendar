import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Supabase 版のデータ層は、PostgREST 越しにしか動かせないため
 * 自動テストで実際に読み書きできない。
 * そこで、SQL の列名と TypeScript 側で使っている列名が食い違っていないかだけは
 * ここで突き合わせておく（打ち間違いは本番で初めて分かると痛いため）。
 */

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const sql = readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const source = readFileSync(path.join(root, "src", "lib", "db", "supabase.ts"), "utf8");

/** SQL から、テーブルごとの列名を取り出す。 */
function columnsOf(table: string): Set<string> {
  const start = sql.indexOf(`create table if not exists public.${table} (`);
  assert.notEqual(start, -1, `${table} テーブルの定義が見つかりません`);

  const body = sql.slice(sql.indexOf("(", start) + 1, sql.indexOf("\n);", start));
  const columns = new Set<string>();
  for (const line of body.split("\n")) {
    const match = /^\s{2}([a-z_]+)\s+\S/.exec(line);
    // 制約の宣言は列ではない
    if (match && !["constraint", "primary", "unique", "check", "foreign"].includes(match[1])) {
      columns.add(match[1]);
    }
  }
  return columns;
}

/** TypeScript の型定義から、使っている列名を取り出す。 */
function fieldsOf(interfaceName: string): Set<string> {
  const start = source.indexOf(`interface ${interfaceName} {`);
  assert.notEqual(start, -1, `${interfaceName} が見つかりません`);

  const body = source.slice(start, source.indexOf("\n}", start));
  return new Set([...body.matchAll(/^\s{2}([a-z_]+):/gm)].map((match) => match[1]));
}

const cases: [string, string][] = [
  ["staff", "StaffRow"],
  ["categories", "CategoryRow"],
  ["events", "EventRow"],
];

describe("SQL と TypeScript の列名の突き合わせ", () => {
  for (const [table, interfaceName] of cases) {
    it(`${table} の列がすべて ${interfaceName} に対応している`, () => {
      const columns = columnsOf(table);
      const fields = fieldsOf(interfaceName);

      for (const field of fields) {
        assert.ok(columns.has(field), `${interfaceName}.${field} に対応する列が SQL にありません`);
      }
      for (const column of columns) {
        // created_at はスタッフ・分類では画面に出さないので持たない
        if (column === "created_at" && table !== "events") continue;
        assert.ok(fields.has(column), `${table}.${column} が ${interfaceName} にありません`);
      }
    });
  }

  it("events の取得に指定する列がすべて実在する", () => {
    const match = /const EVENT_FIELDS =\s*"([^"]+)"/.exec(source);
    assert.ok(match, "EVENT_FIELDS が見つかりません");

    const columns = columnsOf("events");
    for (const field of match[1].split(",").map((name) => name.trim())) {
      assert.ok(columns.has(field), `EVENT_FIELDS の ${field} が SQL にありません`);
    }
  });

  it("書き込み時に組み立てる列名がすべて実在する", () => {
    const all = new Set([...columnsOf("staff"), ...columnsOf("categories"), ...columnsOf("events")]);
    // out.xxx = ... の形で列名を組み立てている箇所
    for (const [, name] of source.matchAll(/^\s+out\.([a-z_]+) = /gm)) {
      assert.ok(all.has(name), `書き込みに使う列 ${name} が SQL にありません`);
    }
    // .eq("列名", ...) や .is("列名", ...) などの絞り込み
    for (const [, name] of source.matchAll(/\.(?:eq|is|gte|lt|order)\("([a-z_]+)"/g)) {
      assert.ok(all.has(name), `絞り込みに使う列 ${name} が SQL にありません`);
    }
  });

  it("初期データのスタッフが仕様どおり5名そろっている", () => {
    for (const name of ["脇坂健吾", "和田悠晟", "小山裕介", "熊谷大輔", "今野和倫"]) {
      assert.ok(sql.includes(`('${name}'`), `${name} が初期データにありません`);
    }
  });

  it("初期データの分類が仕様どおりそろっている", () => {
    for (const name of ["休み", "外出", "来客・打合せ", "会議", "イベント・催事", "その他"]) {
      assert.ok(sql.includes(`('${name}'`), `${name} が初期データにありません`);
    }
  });
});
