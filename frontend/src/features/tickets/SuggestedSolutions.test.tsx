import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SuggestedSolutions } from "@/features/tickets/SuggestedSolutions";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { detail } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const solution = (over: Partial<Record<string, unknown>> = {}) => ({
  ticket_id: 42,
  number: "TK-0042",
  subject: "Cannot log in after password reset",
  resolution: "Re-sent the reset link; the first one had expired.",
  resolved_at: "2026-08-26T09:00:00Z",
  ...over,
});

beforeEach(() => {
  mock = installApiMock();
});

afterEach(() => {
  mock.restore();
});

describe("SuggestedSolutions", () => {
  it("does not fetch until the generate button is clicked", () => {
    renderWithProviders(<SuggestedSolutions ticket={detail()} />);

    expect(mock.urls().some((u) => u.includes("/ai/suggested-solutions/"))).toBe(false);
    expect(screen.getByTestId("suggested-solutions-generate")).toBeInTheDocument();
  });

  it("lists results as links to each ticket's detail page", async () => {
    mock.on("/ai/suggested-solutions/", () => ({
      ticket: 1,
      backend: "mock",
      solutions: [solution()],
    }));
    renderWithProviders(<SuggestedSolutions ticket={detail()} />);

    fireEvent.click(screen.getByTestId("suggested-solutions-generate"));

    const link = await screen.findByRole("link", {
      name: /TK-0042.*Cannot log in after password reset/,
    });
    expect(link).toHaveAttribute("href", "/app/tickets/42");
    expect(
      screen.getByText("Re-sent the reset link; the first one had expired."),
    ).toBeInTheDocument();
  });

  it("shows a fallback line when a result has no resolution note", async () => {
    mock.on("/ai/suggested-solutions/", () => ({
      ticket: 1,
      backend: "mock",
      solutions: [solution({ resolution: "" })],
    }));
    renderWithProviders(<SuggestedSolutions ticket={detail()} />);

    fireEvent.click(screen.getByTestId("suggested-solutions-generate"));

    expect(await screen.findByText("Resolved with no note recorded.")).toBeInTheDocument();
  });

  it("shows an empty state when nothing similar is found", async () => {
    mock.on("/ai/suggested-solutions/", () => ({ ticket: 1, backend: "mock", solutions: [] }));
    renderWithProviders(<SuggestedSolutions ticket={detail()} />);

    fireEvent.click(screen.getByTestId("suggested-solutions-generate"));

    expect(
      await screen.findByText("No similar resolved tickets found."),
    ).toBeInTheDocument();
  });

  it("requests the endpoint for this ticket's own id", async () => {
    mock.on("/ai/suggested-solutions/", () => ({ ticket: 7, backend: "mock", solutions: [] }));
    renderWithProviders(<SuggestedSolutions ticket={detail({ id: 7 })} />);

    fireEvent.click(screen.getByTestId("suggested-solutions-generate"));

    await waitFor(() =>
      expect(mock.urls().some((u) => u.includes("/ai/suggested-solutions/"))).toBe(true),
    );
  });
});
