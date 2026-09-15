"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Avatar } from "@/components/avatar";
import { chooseStaff, signIn, type LoginState } from "@/app/login/actions";
import type { Staff } from "@/lib/types";

const INITIAL: LoginState = { error: null };

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl px-3 py-2 text-sm"
      style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
    >
      {message}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl font-semibold transition-all duration-200 ease-swift disabled:opacity-60"
      style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
    >
      {pending ? "確認中…" : children}
    </button>
  );
}

/** 手順1: 合言葉を入力する。 */
export function PasscodeForm() {
  const [state, action] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="passcode" className="text-sm font-medium text-ink-muted">
        合言葉
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="h-12 w-full rounded-xl border px-4 text-base outline-none transition-colors"
        style={{ background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--ink)" }}
        placeholder="スタッフ共通の合言葉"
      />
      <ErrorNote message={state.error} />
      <SubmitButton>次へ</SubmitButton>
    </form>
  );
}

/** 手順2: 自分の名前を選ぶ（端末に記憶される）。 */
export function StaffPicker({ staff }: { staff: Staff[] }) {
  const [state, action] = useActionState(chooseStaff, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {staff.map((member) => (
          <button
            key={member.id}
            type="submit"
            name="staffId"
            value={member.id}
            className={`a-${member.color} flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ease-swift hover:-translate-y-0.5`}
            style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
          >
            <Avatar name={member.name} color={member.color} />
            <span className="font-medium">{member.name}</span>
          </button>
        ))}
      </div>
      <ErrorNote message={state.error} />
      <p className="text-xs leading-relaxed text-ink-faint">
        選んだ名前はこの端末に記憶され、予定の登録者として記録されます。あとから変更できます。
      </p>
    </form>
  );
}
