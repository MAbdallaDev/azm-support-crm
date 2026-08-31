import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { renderWithDataRouter, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const ticket = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 31,
  number: "TK-0031",
  subject: "Payment link expired before we could use it",
  priority: "high",
  status: "open",
  channel: "web",
  customer_name: "Abdulaziz Al-Rashid",
  assignee_name: "",
  category_name: "Billing",
  created_at: "2026-08-26T09:00:00Z",
  sla_resolution_due_at: null,
  is_breached: false,
  resolution_sla: null,
  ...over,
});

const customer = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 7,
  name: "Abdulaziz Al-Rashid",
  company: "Arabian Gulf Trading Co.",
  email: "a@example.com",
  phone: "0500000000",
  tier: "enterprise",
  branch: null,
  branch_name: "",
  preferred_language: "en",
  open_ticket_count: 1,
  last_activity: null,
  created_at: "2026-08-26T09:00:00Z",
  ...over,
});

const typeQuery = (text: string) => {
  fireEvent.change(screen.getByTestId("global-search"), { target: { value: text } });
};

beforeEach(() => {
  mock = installApiMock();
  mock.on("/tickets/", () => page([]));
  mock.on("/customers/", () => page([]));
});

afterEach(() => {
  mock.restore();
});

describe("GlobalSearch", () => {
  it("does not query until there is a value", () => {
    renderWithProviders(<GlobalSearch />);

    expect(mock.urls().some((u) => u.includes("/tickets/?q="))).toBe(false);
    expect(mock.urls().some((u) => u.includes("/customers/?q="))).toBe(false);
  });

  it("shows grouped ticket and customer results once typed", async () => {
    mock.on("/tickets/", () => page([ticket()]));
    mock.on("/customers/", () => page([customer()]));
    renderWithProviders(<GlobalSearch />);

    fireEvent.focus(screen.getByTestId("global-search"));
    typeQuery("invoice");

    expect(await screen.findByTestId("global-search-result-ticket-31")).toBeInTheDocument();
    expect(screen.getByTestId("global-search-result-customer-7")).toBeInTheDocument();
    expect(screen.getByText("Tickets")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();

    await waitFor(() => expect(mock.urls().some((u) => u.includes("q=invoice"))).toBe(true));
  });

  it("shows an empty state when nothing matches", async () => {
    renderWithProviders(<GlobalSearch />);

    fireEvent.focus(screen.getByTestId("global-search"));
    typeQuery("xqzzt");

    expect(await screen.findByText('No results for "xqzzt"')).toBeInTheDocument();
  });

  it("navigates to the ticket on selecting a result", async () => {
    mock.on("/tickets/", () => page([ticket()]));
    const { router } = renderWithDataRouter(<GlobalSearch />);

    fireEvent.focus(screen.getByTestId("global-search"));
    typeQuery("invoice");

    fireEvent.click(await screen.findByTestId("global-search-result-ticket-31"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/tickets/31"));
  });

  it("navigates to the customer on selecting a result", async () => {
    mock.on("/customers/", () => page([customer()]));
    const { router } = renderWithDataRouter(<GlobalSearch />);

    fireEvent.focus(screen.getByTestId("global-search"));
    typeQuery("rashid");

    fireEvent.click(await screen.findByTestId("global-search-result-customer-7"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/customers/7"));
  });

  it("navigates to the full queue via 'see all results'", async () => {
    mock.on("/tickets/", () => page([ticket()]));
    const { router } = renderWithDataRouter(<GlobalSearch />);

    fireEvent.focus(screen.getByTestId("global-search"));
    typeQuery("invoice");

    fireEvent.click(await screen.findByTestId("global-search-see-all"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/tickets"));
    expect(router.state.location.search).toBe("?q=invoice");
  });

  it("opens a full-screen takeover from the mobile trigger", async () => {
    mock.on("/tickets/", () => page([ticket()]));
    renderWithProviders(<GlobalSearch />);

    fireEvent.click(screen.getByTestId("global-search-mobile-trigger"));
    expect(screen.getByTestId("global-search-mobile")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("global-search-mobile-input"), {
      target: { value: "invoice" },
    });

    expect(await screen.findByTestId("global-search-result-ticket-31")).toBeInTheDocument();
  });
});
