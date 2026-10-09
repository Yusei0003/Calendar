import { isSupabaseConfigured } from "@/lib/db";

/**
 * サーバー側でデータを読めなかったときに出す画面。
 *
 * 何も出さずに真っ白なエラー画面になると、原因（データベースが止まっている、
 * 環境変数が足りない など）が分からないので、理由と確認する場所を日本語で示す。
 * ログイン済みの人にしか出ない経路で使うこと（中身はエラー文そのもの）。
 */
export function ServerProblem({ error }: { error: unknown }) {
  const detail = error instanceof Error ? error.message : String(error);
  const usingSupabase = isSupabaseConfigured();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        className="card w-full max-w-lg p-7 sm:p-9"
        style={{ boxShadow: "inset 0 4px 0 var(--danger), var(--shadow-card)" }}
      >
        <h1 className="text-xl font-bold">データを読み込めませんでした</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          サーバーからデータの保存先に接続できませんでした。少し待ってから再読み込みしても直らない場合は、
          次を確認してください。
        </p>

        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted">
          {usingSupabase ? (
            <li>Supabase のプロジェクトが一時停止（Paused）していないか</li>
          ) : (
            <li>
              Vercel の環境変数に <code>SUPABASE_URL</code> と{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> が入っているか（今は設定されていません）
            </li>
          )}
          <li>Vercel の環境変数を変えたあとに Redeploy したか</li>
        </ul>

        <p className="mt-5 text-xs font-semibold text-ink-faint">エラーの内容</p>
        <pre
          className="mt-1 whitespace-pre-wrap break-all rounded-xl px-3 py-2 text-xs leading-relaxed"
          style={{ background: "var(--surface-3)", color: "var(--ink)" }}
        >
          {detail}
        </pre>

        <a
          href="/login"
          className="mt-5 inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
          style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
        >
          再読み込み
        </a>
      </div>
    </main>
  );
}
