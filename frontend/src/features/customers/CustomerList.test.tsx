import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import CustomerList from "@/features/customers/CustomerList";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: "Khalid Omari",
  company: "Omari Contracting",
  email: "k@omari.test",
  phone: "",
  tier: "enterprise",
  branch: 1,
  branch_name: "Riyadh",
  preferred_language: "en",
  open_ticket_count: 4,
  last_activity: "2026-08-24T09:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const setup = () =>
  renderWithProviders(<CustomerList />, { queryClient: makeQueryClient(), route: "/app/customers" });

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/branches/", () => [{ id: 1, code: "riyadh", name_en: "Riyadh", name_ar: "الرياض" }]);
  mock.on("/customers/", () => page([row()]));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("last_activity", () => {
  it("renders the annotated date rather than computing it client-side", async () => {
    setup();
    await screen.findByText("Khalid Omari");

    expect(screen.getByText("Aug 24, 2026")).toBeInTheDocument();
  });

  it("shows a dash for a customer with no ticket activity, rather than a fabricated date", async () => {
    mock.on("/customers/", () => page([row({ last_activity: null })]));
    setup();
    await screen.findByText("Khalid Omari");

    const dashCells = screen.getAllByText("—");
    expect(dashCells.length).toBeGreaterThan(0);
  });
});

describe("filters", () => {
  it("sends the tier filter to the server as a repeated parameter", async () => {
    setup();
    await screen.findByText("Khalid Omari");

    fireEvent.click(screen.getByTestId("tier-filter-enterprise"));

    await waitFor(() =>
      expect(mock.urls().some((url) => url.includes("tier=enterprise"))).toBe(true),
    );
  });

  it("supports selecting more than one tier at once", async () => {
    setup();
    await screen.findByText("Khalid Omari");

    fireEvent.click(screen.getByTestId("tier-filter-enterprise"));
    fireEvent.click(screen.getByTestId("tier-filter-premium"));

    await waitFor(() => {
      const requests = mock.urls().filter((url) => url.startsWith("/customers/?"));
      const latest = requests[requests.length - 1] ?? "";
      expect(latest).toContain("tier=enterprise");
      expect(latest).toContain("tier=premium");
    });
  });

  it("populates the branch dropdown from the branches/ reference endpoint", async () => {
    setup();
    await screen.findByText("Khalid Omari");

    expect(screen.getByRole("option", { name: "Riyadh" })).toBeInTheDocument();
  });
});
