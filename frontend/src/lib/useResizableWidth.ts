import * as React from "react";

type Options = { storageKey: string; defaultWidth: number; min: number; max: number };

const STEP = 16;

/**
 * A user-resizable panel width, persisted per `storageKey` across reloads.
 *
 * The handle sits on the panel's *inline-end* edge, which is the document's
 * left edge in Arabic — dragging left (or pressing the arrow key that points
 * toward that edge) must still grow the panel, so the raw pointer/key delta
 * is negated whenever `document.dir` is "rtl". Arrow-key resizing on the
 * handle follows WAI-ARIA's separator pattern.
 *
 * The width persisted to `localStorage` is always computed directly from the
 * gesture (a plain closure variable for a drag, a direct calculation for a
 * keypress) — never read back from React state after the fact. State updates
 * are asynchronous; reading state (or a ref synced from it) for "the final
 * value" risks persisting the previous tick's width if that sync hasn't
 * committed yet by the time the gesture ends.
 */
export function useResizableWidth({ storageKey, defaultWidth, min, max }: Options) {
  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  const [width, setWidth] = React.useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      return stored >= min && stored <= max ? stored : defaultWidth;
    } catch {
      return defaultWidth;
    }
  });

  const persist = (value: number) => {
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      /* memory-only for this tab */
    }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const rtl = document.documentElement.dir === "rtl";
    let latest = startWidth;

    const onMove = (moveEvent: PointerEvent) => {
      const rawDelta = moveEvent.clientX - startX;
      latest = clamp(startWidth + (rtl ? -rawDelta : rawDelta));
      setWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      persist(latest);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const rtl = document.documentElement.dir === "rtl";
    const sign = event.key === "ArrowRight" ? 1 : -1;
    const next = clamp(width + (rtl ? -sign : sign) * STEP);
    setWidth(next);
    persist(next);
    event.preventDefault();
  };

  const reset = () => {
    setWidth(defaultWidth);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  return { width, min, max, onPointerDown, onKeyDown, reset };
}
