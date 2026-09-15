"use client";

/**
 * ドラッグの開始判定をまとめたもの。
 *
 * マウスでは少し動かした時点で、指では長押ししてから開始する。
 * 指ですぐ開始してしまうと、画面をスクロールしたいだけの操作で
 * 予定が動いてしまうため（仕様書 3.2.1）。
 */

/** 指で押したまま、この時間が過ぎたらドラッグとみなす */
const LONG_PRESS_MS = 350;
/** マウスでこの距離を超えて動いたらドラッグとみなす */
const MOUSE_THRESHOLD_PX = 4;
/** 長押しの判定中にこれ以上動いたら、スクロールとみなして中止する */
const CANCEL_THRESHOLD_PX = 10;

export interface GestureCallbacks {
  /** ドラッグが始まったとき（長押し成立、またはマウスが動いたとき） */
  onActivate: (event: PointerEvent) => void;
  onMove: (event: PointerEvent) => void;
  /** 指を離したとき。dragged が false なら、ただのタップ・クリック。 */
  onEnd: (dragged: boolean) => void;
}

export function startGesture(
  down: React.PointerEvent<HTMLElement>,
  callbacks: GestureCallbacks,
): void {
  const target = down.currentTarget;
  const pointerId = down.pointerId;
  const startX = down.clientX;
  const startY = down.clientY;
  const isTouch = down.pointerType === "touch";

  let active = false;
  let finished = false;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;

  const distance = (event: PointerEvent) =>
    Math.hypot(event.clientX - startX, event.clientY - startY);

  const activate = (event: PointerEvent) => {
    if (active || finished) return;
    active = true;
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // 対応していない環境でも window のイベントで追えるので続行する
    }
    callbacks.onActivate(event);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;

    if (!active) {
      if (isTouch) {
        // 長押しの前に動いたらスクロールとみなして中止
        if (distance(event) > CANCEL_THRESHOLD_PX) finish(false);
        return;
      }
      if (distance(event) > MOUSE_THRESHOLD_PX) activate(event);
      if (!active) return;
    }

    event.preventDefault();
    callbacks.onMove(event);
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    finish(active);
  };

  function finish(dragged: boolean) {
    if (finished) return;
    finished = true;
    clearTimeout(longPressTimer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    try {
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    } catch {
      // 解放できなくても後続の操作に影響はない
    }
    callbacks.onEnd(dragged);
  }

  const onCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    finish(false);
  };

  if (isTouch) {
    longPressTimer = setTimeout(() => {
      activate(down.nativeEvent);
      // 長押しが成立したことを振動で知らせる（対応端末のみ）
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  }

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
