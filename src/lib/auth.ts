import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 合言葉によるログイン。
 *
 * 照合は必ずこのファイル（サーバー側）で行う。ブラウザへ合言葉を渡してはいけない。
 * 照合に成功したら、有効期限を署名した文字列を httpOnly Cookie として渡す。
 */

export const SESSION_COOKIE = "klc_session";
/** 名乗り（どのスタッフとして使っているか）。認証ではないので httpOnly にしない。 */
export const ACTOR_COOKIE = "klc_actor";

// 毎回合言葉を打ち直す手間を減らすため長めに保つ。端末を手放すときは
// ログアウトするか、合言葉を変更すれば無効にできる。
const SESSION_DAYS = 365;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/* ------------------------------------------------------------------ */
/* 合言葉                                                              */
/* ------------------------------------------------------------------ */

const SCRYPT_KEYLEN = 32;

/** `scrypt$<ソルト>$<ハッシュ>` の形式でハッシュを作る（npm run passcode で使用）。 */
export function hashPasscode(passcode: string, salt = randomBytes(16).toString("hex")): string {
  const derived = scryptSync(passcode.normalize("NFKC"), salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // 長さが違うと timingSafeEqual が例外を投げるため、先に長さを比べる。
  // 長さの一致・不一致は秘密ではないので、ここで早く返して問題ない。
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function verifyAgainstHash(passcode: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const derived = scryptSync(passcode.normalize("NFKC"), salt, SCRYPT_KEYLEN).toString("hex");
  return equals(derived, digest);
}

/** 設定されている合言葉。ハッシュ（推奨）と平文の両方に対応する。 */
function configuredPasscode(): { kind: "hash" | "plain"; value: string } | null {
  const hash = process.env.APP_PASSCODE_HASH?.trim();
  if (hash) return { kind: "hash", value: hash };
  const plain = process.env.APP_PASSCODE?.trim();
  if (plain) return { kind: "plain", value: plain };
  return null;
}

export function isPasscodeConfigured(): boolean {
  return configuredPasscode() !== null;
}

export function checkPasscode(input: string): boolean {
  const configured = configuredPasscode();
  if (!configured) return false;
  const normalized = input.normalize("NFKC");
  return configured.kind === "hash"
    ? verifyAgainstHash(normalized, configured.value)
    : equals(normalized, configured.value.normalize("NFKC"));
}

/* ------------------------------------------------------------------ */
/* セッション（署名付き Cookie）                                        */
/* ------------------------------------------------------------------ */

/**
 * 署名鍵。SESSION_SECRET に加えて、現在の合言葉そのものを材料に混ぜている。
 * これにより合言葉を変更すると過去の Cookie がすべて無効になり、
 * 「合言葉を変えたら全員が入り直す」という運用どおりの挙動になる。
 */
function signingKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET が設定されていません。`openssl rand -base64 32` の出力を設定してください。",
    );
  }
  const configured = configuredPasscode();
  return createHmac("sha256", secret).update(configured?.value ?? "").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = now + SESSION_MAX_AGE * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!equals(signature, sign(payload))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** 名乗っているスタッフの ID。未選択なら null。 */
export async function getActorId(): Promise<string | null> {
  const store = await cookies();
  return (await isSignedIn()) ? (store.get(ACTOR_COOKIE)?.value ?? null) : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function actorCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/* ------------------------------------------------------------------ */
/* 総当たり対策                                                        */
/* ------------------------------------------------------------------ */

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * 同一 IP からの連続失敗を数える。
 *
 * サーバーのメモリ上に持つだけなので、再起動やインスタンスの切り替わりで
 * 数はリセットされる。5人規模での誤入力・いたずら対策としては十分だが、
 * 本格的な攻撃を完全に防ぐものではない。
 */
const attempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLock(ip: string, now = Date.now()): { locked: boolean; retryAfterSec: number } {
  const record = attempts.get(ip);
  if (record && record.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordFailure(ip: string, now = Date.now()): void {
  const record = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCK_MS;
    record.count = 0;
  }
  attempts.set(ip, record);

  // 古い記録が溜まり続けないよう、時々掃除する
  if (attempts.size > 500) {
    for (const [key, value] of attempts) {
      if (value.lockedUntil < now) attempts.delete(key);
    }
  }
}

export function clearFailures(ip: string): void {
  attempts.delete(ip);
}
