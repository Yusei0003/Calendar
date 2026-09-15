#!/usr/bin/env node
/**
 * 合言葉のハッシュを作るスクリプト。
 *
 *   npm run passcode -- 実際の合言葉
 *
 * 出力された `scrypt$...` の文字列を、環境変数 APP_PASSCODE_HASH に設定する。
 */
import { randomBytes, scryptSync } from "node:crypto";

const passcode = process.argv[2];

if (!passcode) {
  console.error("使い方: npm run passcode -- <合言葉>");
  process.exit(1);
}

if (passcode.length < 6) {
  console.error("合言葉は6文字以上にしてください。");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const digest = scryptSync(passcode.normalize("NFKC"), salt, 32).toString("hex");

console.log("\n環境変数に次の値を設定してください:\n");
console.log(`APP_PASSCODE_HASH=scrypt$${salt}$${digest}\n`);
