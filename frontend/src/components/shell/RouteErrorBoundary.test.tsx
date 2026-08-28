import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import RouteErrorBoundary from "@/components/shell/RouteErrorBoundary";

/**
 * Criterion 7: the boundary must actually catch a render error and show a
 * reporting screen, not a blank one — and must log rather than swallow it.
 * This is the permanent regression version of the plan's "throw deliberately,
 * verify, then remove the throw" manual check.
 */

function Boom(): never {
  throw new Error("deliberate render failure for the test");
}

describe("RouteErrorBoundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React itself also logs the error to console.error via its own dev
    // overlay machinery; spying rather than asserting call count keeps this
    // test about *our* logging, not about suppressing React's.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders the fallback screen instead of a blank page when a child throws", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RouteErrorBoundary>
          <Boom />
        </RouteErrorBoundary>
      </I18nextProvider>,
    );

    expect(screen.getByTestId("route-error-boundary")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/deliberate render failure for the test/)).toBeInTheDocument();
  });

  it("logs the error rather than swallowing it", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RouteErrorBoundary>
          <Boom />
        </RouteErrorBoundary>
      </I18nextProvider>,
    );

    expect(errorSpy).toHaveBeenCalled();
    const loggedSomethingUseful = errorSpy.mock.calls.some((call: unknown[]) =>
      call.some((arg) => arg instanceof Error || (typeof arg === "string" && arg.includes("RouteErrorBoundary"))),
    );
    expect(loggedSomethingUseful).toBe(true);
  });

  it("renders children normally when nothing throws", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RouteErrorBoundary>
          <p>all fine</p>
        </RouteErrorBoundary>
      </I18nextProvider>,
    );

    expect(screen.getByText("all fine")).toBeInTheDocument();
    expect(screen.queryByTestId("route-error-boundary")).not.toBeInTheDocument();
  });
});
