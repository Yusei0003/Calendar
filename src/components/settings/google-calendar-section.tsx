"use client";

import { useEffect, useState } from "react";

import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} from "@/lib/client/api";

const inputClass = "h-10 w-full rounded-xl border px-3 text-sm outline-none";
const inputStyle = { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" };

/**
 * 自分の Google カレンダーとの連携（読み取り専用）を設定する。
 *
 * 必ず「今ログインしている本人」だけを対象にする。他のスタッフの
 * 連携状況は見えないし、変更もできない（サーバー側で保証している）。
 */
export function GoogleCalendarSection({ actorName }: { actorName: string }) {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  /** 連携はしているが、今は読み込めない理由（Google 側でURLを作り直した等）。 */
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGoogleCalendarStatus()
      .then((body) => {
        if (cancelled) return;
        setStatus(body.connected ? "connected" : "disconnected");
        setProblem(body.problem ?? null);
      })
      .catch(() => {
        if (!cancelled) setStatus("disconnected");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = await connectGoogleCalendar(trimmed);
      setStatus("connected");
      setProblem(null);
      setUrl("");
      setMessage({
        text:
          body.eventCount > 0
            ? `連携しました。直近30日で${body.eventCount}件の予定が見つかりました。`
            : "連携しました。直近30日の予定は見つかりませんでした（この先の予定はカレンダーに反映されます）。",
        tone: "info",
      });
    } catch (cause) {
      setMessage({
        text: cause instanceof Error ? cause.message : "連携できませんでした。",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await disconnectGoogleCalendar();
      setStatus("disconnected");
      setProblem(null);
      setMessage({ text: "連携を解除しました。", tone: "info" });
    } catch (cause) {
      setMessage({
        text: cause instanceof Error ? cause.message : "解除できませんでした。",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="border-b px-5 py-4" style={{ background: "var(--surface-2)" }}>
        <h2 className="text-base font-bold">自分の Google カレンダー連携</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {actorName} さんご本人だけの設定です。あなたの Google カレンダーの予定を、
          読み取り専用でこのカレンダーに重ねて表示します（編集は Google カレンダー側で行ってください）。
        </p>
      </header>

      <div className="flex flex-col gap-3 px-5 py-4">
        {status === "loading" ? (
          <p className="text-sm text-ink-faint">確認しています…</p>
        ) : null}

        {status === "connected" ? (
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: problem
                  ? "color-mix(in srgb, var(--danger) 12%, transparent)"
                  : "var(--surface-3)",
                color: problem ? "var(--danger)" : "var(--ink)",
              }}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ background: problem ? "var(--danger)" : "var(--brand)" }}
              />
              {problem ? "連携中（読み込めていません）" : "連携中"}
            </span>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="h-9 rounded-xl px-3 text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ color: "var(--danger)" }}
            >
              連携を解除
            </button>
          </div>
        ) : null}

        {problem ? (
          <p
            role="alert"
            className="rounded-xl px-3 py-2 text-xs leading-relaxed"
            style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
          >
            {problem}
            Googleカレンダーで「秘密のアドレス」を作り直した場合は、新しいURLを下に貼り直してください。
          </p>
        ) : null}

        {status === "disconnected" || (status === "connected" && problem) ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className={inputClass}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy || !url.trim()}
              className="h-10 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
            >
              {busy ? "確認中…" : problem ? "貼り直す" : "連携する"}
            </button>
          </div>
        ) : null}

        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className="rounded-xl px-3 py-2 text-xs leading-relaxed"
            style={
              message.tone === "error"
                ? { background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }
                : { background: "var(--surface-3)", color: "var(--ink-muted)" }
            }
          >
            {message.text}
          </p>
        ) : null}

        <details className="text-xs leading-relaxed text-ink-faint">
          <summary className="cursor-pointer select-none font-medium text-ink-muted">
            URLの調べ方
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Googleカレンダーをパソコンのブラウザで開く</li>
            <li>左側の「他のカレンダー」からご自分のカレンダーの「⋮」→「設定と共有」</li>
            <li>「カレンダーの統合」の中の「秘密のアドレス（iCal形式）」をコピーする</li>
            <li>そのURLを上の欄に貼り付けて「連携する」を押す</li>
          </ol>
          <p className="mt-2">
            このURLは他人に見せると、あなたの個人カレンダーの内容を見られてしまいます。
            取り扱いにはご注意ください。
          </p>
        </details>
      </div>
    </section>
  );
}
