import "server-only";

import { localStore } from "@/lib/db/local";
import { supabaseStore } from "@/lib/db/supabase";
import type { Store } from "@/lib/db/store";

/**
 * Supabase の環境変数が両方そろっていれば Supabase を、
 * そうでなければローカルファイル（開発用）を使う。
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getStore(): Store {
  return isSupabaseConfigured() ? supabaseStore : localStore;
}

export type { Store, EventQuery } from "@/lib/db/store";
