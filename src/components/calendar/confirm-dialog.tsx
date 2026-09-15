"use client";

import { useEffect, useRef } from "react";

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 取り返しのつく操作でも、意図しない結果になりそうなときに一度止めるための確認。 */
export function ConfirmDialog({ request }: { request: ConfirmRequest }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") request.onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={request.title}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={request.onCancel}
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(8,11,20,0.45)" }}
      />
      <div className="card relative w-full max-w-sm p-5" style={{ boxShadow: "var(--shadow-pop)" }}>
        <h2 className="text-base font-bold">{request.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{request.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={request.onCancel}
            className="h-10 rounded-xl px-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            style={{ background: "var(--surface-3)" }}
          >
            やめる
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={request.onConfirm}
            className="h-10 rounded-xl px-4 text-sm font-semibold"
            style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
