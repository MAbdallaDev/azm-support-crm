import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import type { PortalTicket } from "@/api/types";
import PortalTicketDetail from "@/features/portal/PortalTicketDetail";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const baseTicket: PortalTicket = {
  id: 5,
  number: "TK-0005",
  subject: "Cannot access invoice portal",
  status: "Resolved",
  category: "Billing",
  channel: "Portal",
  created_at: "2026-08-20T09:00:00Z",
  target_date: "2026-08-27T09:00:00Z",
  resolved_at: "2026-08-25T09:00:00Z",
  message_count: 1,
  csat: null,
};

const setup = (ticket = baseTicket) => {
  mock.on("/portal/tickets/5/", () => ticket);
  mock.on("/portal/tickets/5/messages/", () => []);
  return renderWithDataRouter(<PortalTicketDetail />, {
    queryClient: makeQueryClient(),
    path: "/tickets/:id",
    route: "/tickets/5",
  });
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "customer" });
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("CSAT — survives a reload rather than only the current session", () => {
  it("shows the star input when the ticket has not been rated yet", async () => {
    setup();
    await screen.findByText("Cannot access invoice portal");

    expect(screen.getByTestId("csat-input")).toBeInTheDocument();
    expect(screen.queryByTestId("csat-readonly")).not.toBeInTheDocument();
  });

  it("shows the read-only rating on a FRESH mount when ticket.csat is already set", async () => {
    // A fresh mount, not a mutation followed by a re-render — this is what
    // proves the reload path, not merely the current session's optimistic state.
    setup({ ...baseTicket, csat: { score: 4, comment: "Quick fix, thanks" } });
    await screen.findByText("Cannot access invoice portal");

    expect(screen.getByTestId("csat-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("csat-input")).not.toBeInTheDocument();
    expect(screen.getByText("Quick fix, thanks")).toBeInTheDocument();
  });

  it("treats a 409 (already rated, e.g. a race between two tabs) as already-rated, not as a failure", async () => {
    setup();
    await screen.findByText("Cannot access invoice portal");

    mock.fail("/portal/csat/", 409);
    fireEvent.click(screen.getByTestId("csat-star-4"));

    await waitFor(() => expect(screen.getByTestId("csat-readonly")).toBeInTheDocument());
    // No error toast text anywhere — a 409 here is not a failure state.
    expect(screen.queryByText(/could not be submitted/i)).not.toBeInTheDocument();
  });

  it("does not show the widget before the ticket is resolved or closed", async () => {
    setup({ ...baseTicket, status: "Open", resolved_at: null });
    await screen.findByText("Cannot access invoice portal");

    expect(screen.queryByTestId("csat-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("csat-readonly")).not.toBeInTheDocument();
  });
});

describe("the forbidden set never appears", () => {
  it("renders none of assignee/department/sla/escalation anywhere on the page", async () => {
    setup();
    const found = await screen.findByText("Cannot access invoice portal");
    const text = found.closest("body")?.textContent ?? "";
    for (const forbidden of ["assignee", "department", "SLA policy", "escalation"]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
