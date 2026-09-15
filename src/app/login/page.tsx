import { redirect } from "next/navigation";

import { PasscodeForm, StaffPicker } from "@/components/login-forms";
import { getActorId, isPasscodeConfigured, isSignedIn } from "@/lib/auth";
import { getStore } from "@/lib/db";

export default async function LoginPage() {
  const signedIn = await isSignedIn();
  const actorId = await getActorId();

  // 合言葉も名乗りも済んでいればカレンダーへ
  if (signedIn && actorId) redirect("/calendar");

  const staff = signedIn ? await getStore().listStaff() : [];
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

      <div className="card relative w-full max-w-md p-7 sm:p-9">
        <header className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">
            KESEN LARUS
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
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
