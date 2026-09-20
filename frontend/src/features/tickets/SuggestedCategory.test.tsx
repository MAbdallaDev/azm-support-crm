import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Category } from "@/api/types";
import { SuggestedCategory } from "@/features/tickets/SuggestedCategory";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { detail } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

import "@/i18n";

vi.mock("@/components/ui/toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/toast")>(
    "@/components/ui/toast",
  );
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
  };
});

const { toast } = await import("@/components/ui/toast");

let mock: ApiMock;

const billing: Category = {
  id: 5,
  slug: "billing-invoice",
  name_en: "Billing & Invoices",
  name_ar: "الفواتير",
  default_priority: "normal",
};

const technical: Category = {
  id: 6,
  slug: "technical-fault",
  name_en: "Technical",
  name_ar: "عطل",
  default_priority: "high",
};

beforeEach(() => {
  mock = installApiMock();
  mock.on("/categories/", () => page([billing, technical]));
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe("SuggestedCategory", () => {
  it("does not call the endpoint until 'Check category' is clicked", () => {
    renderWithProviders(<SuggestedCategory ticket={detail()} />);

    expect(mock.urls().some((u) => u.includes("/ai/categorize/"))).toBe(false);
    expect(screen.getByTestId("suggested-category-generate")).toBeInTheDocument();
  });

  it("shows nothing to apply before a suggestion has ever been generated", () => {
    renderWithProviders(<SuggestedCategory ticket={detail({ ai_suggested_category: null })} />);

    expect(screen.getByText("Category not checked yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("suggested-category-apply")).not.toBeInTheDocument();
  });

  it("generates a suggestion, showing its confidence and rationale", async () => {
    mock.on("/ai/categorize/", () => ({
      ticket: 1,
      backend: "mock",
      category_id: 5,
      category_slug: "billing-invoice",
      confidence: 0.87,
      rationale: "Matched wording associated with 'billing-invoice'.",
    }));

    renderWithProviders(<SuggestedCategory ticket={detail({ id: 1, category: technical })} />);
    fireEvent.click(screen.getByTestId("suggested-category-generate"));

    expect(await screen.findByText("Billing & Invoices")).toBeInTheDocument();
    expect(screen.getByText("(87% confidence)")).toBeInTheDocument();
    expect(
      screen.getByText("Matched wording associated with 'billing-invoice'."),
    ).toBeInTheDocument();
  });

  it("offers Apply only when the suggestion differs from the current category", () => {
    renderWithProviders(
      <SuggestedCategory ticket={detail({ category: technical, ai_suggested_category: billing })} />,
    );

    expect(screen.getByTestId("suggested-category-apply")).toBeInTheDocument();
  });

  it("shows 'matches' instead of Apply when the suggestion already IS the current category", () => {
    renderWithProviders(
      <SuggestedCategory ticket={detail({ category: billing, ai_suggested_category: billing })} />,
    );

    expect(
      screen.getByText("Matches the current category (Billing & Invoices)."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("suggested-category-apply")).not.toBeInTheDocument();
  });

  it("applies the suggestion via a PATCH to the ticket, not a new route", async () => {
    const ticket = detail({ id: 3, category: technical, ai_suggested_category: billing });
    mock.on("/tickets/3/", () => ({ ...ticket, category: billing }));
    renderWithProviders(<SuggestedCategory ticket={ticket} />);

    fireEvent.click(screen.getByTestId("suggested-category-apply"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Category applied."));
    expect(mock.requests.some((r) => r === "PATCH /tickets/3/")).toBe(true);
  });

  it("shows a distinct error message when applying fails", async () => {
    const ticket = detail({ id: 3, category: technical, ai_suggested_category: billing });
    mock.fail("/tickets/3/", 500);
    renderWithProviders(<SuggestedCategory ticket={ticket} />);

    fireEvent.click(screen.getByTestId("suggested-category-apply"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The category could not be updated."),
    );
  });

  it("requests categorize for this ticket's own id", async () => {
    mock.on("/ai/categorize/", () => ({
      ticket: 9,
      backend: "mock",
      category_id: null,
      category_slug: "",
      confidence: 0.4,
      rationale: "No strong keyword signal.",
    }));
    renderWithProviders(<SuggestedCategory ticket={detail({ id: 9 })} />);

    fireEvent.click(screen.getByTestId("suggested-category-generate"));

    await waitFor(() =>
      expect(mock.requests.some((r) => r === "POST /ai/categorize/")).toBe(true),
    );
  });
});
