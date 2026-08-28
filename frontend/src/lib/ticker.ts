import { useSyncExternalStore } from "react";

/**
 * One interval for the whole app, subscribed to via `useSyncExternalStore`.
 *
 * Story 06's `SlaBar` owned a per-component `setInterval`, and its as-built
 * note defended that choice: fifty rows must not re-render a page each second.
 * Story 07 asks for a single shared timer. **Both are right, and they are not
 * in conflict** — the expensive thing was never the timer, it was a
 * *page-level* state update.
 *
 * An external store gives the third option. One `setInterval` publishes a tick;
 * each subscriber re-renders only itself, because `useSyncExternalStore` wakes
 * exactly the components that called it and nothing above them.
 *
 * The interval starts on the first subscriber and stops on the last, so a
 * screen with no countdowns runs no timer at all — which is also what makes
 * the "one interval for three bars" test meaningful rather than incidental.
 */

const TICK_MS = 1000;

let seconds = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  if (intervalId === null) {
    intervalId = setInterval(() => {
      seconds += 1;
      // A copy, because a listener unsubscribing during the loop would
      // otherwise mutate the set being iterated.
      for (const notify of [...listeners]) notify();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

/**
 * The snapshot must be a **primitive that only changes on a tick**. Returning
 * `Date.now()` here would differ on every read and drive `useSyncExternalStore`
 * into an infinite re-render loop — the classic mistake with this hook.
 */
const getSnapshot = () => seconds;

/** Server rendering has no clock; a frozen zero is the honest answer. */
const getServerSnapshot = () => 0;

/** Seconds elapsed since this tab started ticking. Monotonic, shared. */
export const useSecondsTick = (): number =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/** Test-only introspection. Nothing in `src/` outside tests should call these. */
export const __ticker = {
  isRunning: () => intervalId !== null,
  listenerCount: () => listeners.size,
  reset: () => {
    if (intervalId !== null) clearInterval(intervalId);
    intervalId = null;
    listeners.clear();
    seconds = 0;
  },
};
