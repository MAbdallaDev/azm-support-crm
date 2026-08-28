import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Sla } from "@/api/types";
import { SlaBar } from "@/components/ui/SlaBar";
import { __ticker, useSecondsTick } from "@/lib/ticker";

import "@/i18n";

/**
 * The story's criterion: "a single shared timer, not one interval per row."
 *
 * Counting `setInterval` calls is the only assertion that actually proves it —
 * three bars all showing the right number would look identical whether they
 * shared a timer or ran three.
 */

const sla = (over: Partial<Sla> = {}): Sla => ({
  state: "ok",
  seconds_remaining: 3600,
  target_minutes: 120,
  policy_name: "Gold response",
  ...over,
});

const Reader = () => <span>{useSecondsTick()}</span>;

beforeEach(() => __ticker.reset());
afterEach(() => {
  __ticker.reset();
  vi.restoreAllMocks();
});

describe("useSecondsTick", () => {
  it("registers ONE interval for three mounted SlaBars", () => {
    const spy = vi.spyOn(window, "setInterval");

    render(
      <>
        <SlaBar sla={sla({ seconds_remaining: 100 })} />
        <SlaBar sla={sla({ seconds_remaining: 200 })} />
        <SlaBar sla={sla({ seconds_remaining: 300 })} />
      </>,
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(__ticker.listenerCount()).toBe(3);
  });

  it("runs no timer at all until something subscribes", () => {
    expect(__ticker.isRunning()).toBe(false);

    const { unmount } = render(<Reader />);
    expect(__ticker.isRunning()).toBe(true);

    // ...and stops again on the last unsubscribe, so a screen with no
    // countdowns leaves no interval running behind it.
    unmount();
    expect(__ticker.isRunning()).toBe(false);
  });

  it("does not subscribe for a ticket with no SLA policy", () => {
    render(<SlaBar sla={sla({ seconds_remaining: null, target_minutes: null })} />);

    expect(__ticker.isRunning()).toBe(false);
    expect(__ticker.listenerCount()).toBe(0);
  });

  it("keeps the timer alive while any subscriber remains", () => {
    const { unmount } = render(<Reader />);
    const second = render(<Reader />);

    expect(__ticker.listenerCount()).toBe(2);

    unmount();
    expect(__ticker.isRunning()).toBe(true);
    expect(__ticker.listenerCount()).toBe(1);

    second.unmount();
    expect(__ticker.isRunning()).toBe(false);
  });

  it("drives every subscriber from the one tick", () => {
    vi.useFakeTimers();
    try {
      const view = render(
        <>
          <SlaBar sla={sla({ seconds_remaining: 3660 })} />
          <SlaBar sla={sla({ seconds_remaining: 7260 })} />
        </>,
      );

      expect(view.getByText("1h 01m left")).toBeInTheDocument();
      expect(view.getByText("2h 01m left")).toBeInTheDocument();

      act(() => void vi.advanceTimersByTime(60_000));

      expect(view.getByText("1h 00m left")).toBeInTheDocument();
      expect(view.getByText("2h 00m left")).toBeInTheDocument();
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
