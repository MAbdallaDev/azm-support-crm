import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Sla } from "@/api/types";
import { SlaBar } from "@/components/ui/SlaBar";

import "@/i18n";

const sla = (over: Partial<Sla> = {}): Sla => ({
  state: "ok",
  seconds_remaining: 3600,
  target_minutes: 120,
  policy_name: "Gold response",
  ...over,
});

/**
 * Fake timers are installed **inside** the tests that advance the clock, and
 * torn down after an explicit `unmount()` in the same test.
 *
 * A file-level `beforeEach(vi.useFakeTimers)` deadlocks here: Testing
 * Library's auto-cleanup awaits React 19's `act` queue, which cannot drain
 * while the clock is frozen, so every test after the first times out in its
 * hook rather than in an assertion — a failure that looks nothing like its
 * cause.
 */
const withFakeTimers = (body: () => void) => {
  vi.useFakeTimers();
  try {
    body();
  } finally {
    vi.useRealTimers();
  }
};

describe("SlaBar", () => {
  it("renders the OK state with time left", () => {
    render(<SlaBar sla={sla()} />);

    expect(screen.getByTestId("sla-ok")).toBeInTheDocument();
    expect(screen.getByText("1h 00m left")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders the approaching state", () => {
    render(<SlaBar sla={sla({ state: "approaching", seconds_remaining: 2280 })} />);

    expect(screen.getByTestId("sla-approaching")).toBeInTheDocument();
    expect(screen.getByText("38m left")).toBeInTheDocument();
  });

  it("renders breached styling and wording for a NEGATIVE seconds_remaining", () => {
    render(<SlaBar sla={sla({ state: "breached", seconds_remaining: -840 })} />);

    // The sign is the whole contract: one signed number renders both
    // sentences, so a component that took Math.abs() upstream would show
    // "14m left" on a ticket that is fourteen minutes late.
    expect(screen.getByTestId("sla-breached")).toBeInTheDocument();
    expect(screen.getByText("Breached 14m")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows a no-policy line instead of a bar when the API sends nulls", () => {
    render(<SlaBar sla={sla({ seconds_remaining: null, target_minutes: null })} />);

    expect(screen.getByTestId("sla-none")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("ticks its own countdown down, with no re-render from the parent", () => {
    withFakeTimers(() => {
      const { unmount } = render(<SlaBar sla={sla({ seconds_remaining: 3660 })} />);
      expect(screen.getByText("1h 01m left")).toBeInTheDocument();

      act(() => void vi.advanceTimersByTime(60_000));

      expect(screen.getByText("1h 00m left")).toBeInTheDocument();
      unmount();
    });
  });

  it("crosses into breached live, without waiting for a refetch", () => {
    withFakeTimers(() => {
      const { unmount } = render(
        <SlaBar sla={sla({ state: "approaching", seconds_remaining: 2 })} />,
      );

      act(() => void vi.advanceTimersByTime(4000));

      expect(screen.getByTestId("sla-breached")).toBeInTheDocument();
      unmount();
    });
  });

  it("clears its interval on unmount", () => {
    withFakeTimers(() => {
      const clearSpy = vi.spyOn(window, "clearInterval");
      const { unmount } = render(<SlaBar sla={sla()} />);

      unmount();

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
