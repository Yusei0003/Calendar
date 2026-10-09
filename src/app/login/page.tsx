import { redirect, unstable_rethrow } from "next/navigation";

import { PasscodeForm, StaffPicker } from "@/components/login-forms";
import { ServerProblem } from "@/components/server-problem";
import { getActorId, isPasscodeConfigured, isSignedIn } from "@/lib/auth";
import { getStore } from "@/lib/db";
import type { Staff } from "@/lib/types";

// 毎回 Cookie を見て描く（ビルド時に固定しない）
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let signedIn = false;
  let actorId: string | null = null;
  let staff: Staff[] = [];
  try {
    signedIn = await isSignedIn();
    actorId = await getActorId();
    if (signedIn && !actorId) staff = await getStore().listStaff();
  } catch (error) {
    // 真っ白なエラー画面にせず、原因を表示する
    // Next.js 内部の合図（動的な描画への切り替え等）は握りつぶさずに通す
    unstable_rethrow(error);
    console.error("[login]", error);
    return <ServerProblem error={error} />;
  }

  // 合言葉も名乗りも済んでいればカレンダーへ
  if (signedIn && actorId) redirect("/calendar");

  const configured = isPasscodeConfigured();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* 背景の光。装飾なので読み上げ対象から外す */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[-18%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--brand), transparent 62%)" }}
        />
      </div>

      <div
        className="card relative w-full max-w-md overflow-hidden p-7 sm:p-9"
        // ユニフォームの襟のような、チームカラーの帯
        style={{ boxShadow: "inset 0 4px 0 var(--brand), var(--shadow-card)" }}
      >
        <header className="mb-7">
          <span
            role="img"
            aria-label="KESEN LARUS"
            className="brand-logo w-32 sm:w-36"
            style={{ color: "var(--brand)" }}
          />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            {signedIn ? "あなたは誰ですか？" : "スタッフカレンダー"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {signedIn
              ? "名前を選ぶと、あなたの予定がすぐ開くようになります。"
              : "スタッフ共通の合言葉を入力してください。"}
          </p>
        </header>

        {!configured && !signedIn ? (
          <div
            className="rounded-xl px-4 py-3 text-sm leading-relaxed"
            style={{
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
            }}
          >
            合言葉が設定されていません。環境変数 <code>APP_PASSCODE_HASH</code>（または
            <code>APP_PASSCODE</code>）を設定してから、もう一度開いてください。
          </div>
        ) : signedIn ? (
          <StaffPicker staff={staff} />
        ) : (
          <PasscodeForm />
        )}
      </div>
    </main>
  );
}
