"use client";

import { useEffect } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "error";
  /** 「元に戻す」を押したときの処理。省略すると取り消しボタンを出さない。 */
  undo?: () => void;
}

const VISIBLE_MS = 8000;

/**
 * 画面下部の通知。削除やドラッグ移動のあとに「元に戻す」を出すために使う。
 */
export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  const isError = message.tone === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
    >
      <div
        className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-full py-2.5 pl-5 pr-2.5 text-sm shadow-pop"
        style={{
          background: isError ? "var(--danger)" : "var(--ink)",
          color: isError ? "#fff" : "var(--canvas)",
        }}
      >
        <span className="truncate">{message.text}</span>
        {message.undo ? (
          <button
            type="button"
            onClick={() => {
              message.undo?.();
              onDismiss();
            }}
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(127,127,127,0.28)", color: "inherit" }}
          >
            元に戻す
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="閉じる"
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(127,127,127,0.28)", color: "inherit" }}
          >
            閉じる
          </button>
        )}
      </div>
    </div>
  );
}
