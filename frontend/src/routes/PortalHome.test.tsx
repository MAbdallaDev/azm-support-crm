import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import type { PortalTicket } from "@/api/types";
import PortalHome from "@/routes/PortalHome";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const ticket = (over: Partial<PortalTicket> = {}): PortalTicket => ({
  id: 1,
  number: "TK-0001",
  subject: "Cannot access invoice portal",
  status: "open",
  category: "Billing",
  channel: "web",
  created_at: "2026-08-20T09:00:00Z",
  target_date: null,
  resolved_at: null,
  message_count: 0,
  csat: null,
  ...over,
});

const setup = () =>
  renderWithDataRouter(<PortalHome />, { queryClient: makeQueryClient(), path: "/", route: "/" });

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "customer" });
  mock.on("/auth/me/", () => ({ id: 48, full_name: "Hind Al-Subaie", role: "customer" }));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

/** The mock matches by URL substring only, not method — GET (list) and POST
 *  (create) both hit "/portal/tickets/", so one handler branches on
 *  `config.method` rather than two handlers racing to win the same match. */
const mockPortalTickets = (existing: PortalTicket[]) => {
  mock.on("/portal/tickets/", (config) =>
    (config.method ?? "get").toLowerCase() === "post"
      ? { id: 42, number: "TK-0042" }
      : page(existing),
  );
};

describe("Start a live chat", () => {
  it("creates a new chat ticket and navigates to it when none is open", async () => {
    mockPortalTickets([]);
    const { router } = setup();

    await screen.findByText("No open requests");
    fireEvent.click(screen.getByTestId("start-live-chat"));

    await waitFor(() =>
      expect(mock.requests.some((r) => r === "POST /portal/tickets/")).toBe(true),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/portal/tickets/42"));
  });

  it("reuses an existing open chat ticket instead of creating a new one", async () => {
    mockPortalTickets([ticket({ id: 7, channel: "chat", status: "open" })]);
    const { router } = setup();

    // Wait for the ticket list itself to load — the button renders
    // immediately regardless, but clicking before `open` is populated would
    // read it as empty and create a new ticket instead of reusing this one.
    await screen.findByText("Cannot access invoice portal");
    fireEvent.click(screen.getByTestId("start-live-chat"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/portal/tickets/7"));
    expect(mock.requests.some((r) => r === "POST /portal/tickets/")).toBe(false);
  });

  it("ignores a CLOSED chat ticket and starts a new one instead", async () => {
    mockPortalTickets([ticket({ id: 9, channel: "chat", status: "closed" })]);
    const { router } = setup();

    // This ticket lands in the CLOSED section — the open list is empty.
    await screen.findByText("No open requests");
    fireEvent.click(screen.getByTestId("start-live-chat"));

    await waitFor(() =>
      expect(mock.requests.some((r) => r === "POST /portal/tickets/")).toBe(true),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/portal/tickets/42"));
  });
});

describe("matching the design canvas", () => {
  it("greets the customer by first name in the hero", async () => {
    mockPortalTickets([]);
    setup();

    expect(await screen.findByText("How can we help, Hind?")).toBeInTheDocument();
  });

  it("shows a colour-coded status badge and channel badge per row, not plain text", async () => {
    mockPortalTickets([ticket({ id: 3, status: "on_hold", channel: "whatsapp" })]);
    setup();

    expect(await screen.findByTestId("status-on_hold")).toBeInTheDocument();
    expect(screen.getByTestId("channel-whatsapp")).toBeInTheDocument();
  });

  it("shows a live rating for a rated closed ticket, and a 'rate this' prompt for an unrated one", async () => {
    mockPortalTickets([
      ticket({ id: 10, status: "resolved", csat: { score: 5, comment: "" } }),
      ticket({ id: 11, status: "resolved", csat: null }),
    ]);
    setup();

    expect(await screen.findByText("you rated 5")).toBeInTheDocument();
    expect(screen.getByText("rate this")).toBeInTheDocument();
  });

  it("caps the closed list and reveals the rest via 'View all N'", async () => {
    const closedTickets = Array.from({ length: 7 }, (_, i) =>
      ticket({ id: 100 + i, status: "closed", subject: `Closed ticket ${i}` }),
    );
    mockPortalTickets(closedTickets);
    setup();

    await screen.findByText("Closed ticket 0");
    expect(screen.queryByText("Closed ticket 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("view-all-closed"));

    expect(screen.getByText("Closed ticket 6")).toBeInTheDocument();
  });

  it("a KB shortcut chip searches the KB with that category's name", async () => {
    mockPortalTickets([]);
    const { router } = setup();

    fireEvent.click(await screen.findByText("Billing & Invoices"));

    await waitFor(() =>
      expect(router.state.location.pathname + router.state.location.search).toBe(
        "/portal/kb?q=Billing%20%26%20Invoices",
      ),
    );
  });
});
