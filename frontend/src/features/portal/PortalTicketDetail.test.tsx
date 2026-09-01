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
  status: "resolved",
  category: "Billing",
  channel: "web",
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
  mock.on("/portal/tickets/5/attachments/", () => []);
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
    setup({ ...baseTicket, status: "open", resolved_at: null });
    await screen.findByText("Cannot access invoice portal");

    expect(screen.queryByTestId("csat-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("csat-readonly")).not.toBeInTheDocument();
  });
});

describe("the ticket cannot be found or fails to load", () => {
  it("shows a not-found state instead of an endless skeleton on a 404", async () => {
    mock.fail("/portal/tickets/5/", 404);
    renderWithDataRouter(<PortalTicketDetail />, {
      queryClient: makeQueryClient(),
      path: "/tickets/:id",
      route: "/tickets/5",
    });

    expect(await screen.findByText("That request is not available.")).toBeInTheDocument();
    expect(screen.queryByTestId("portal-ticket-skeleton")).not.toBeInTheDocument();
  });

  it("shows a load-error state, not a 404 message, on a server error", async () => {
    mock.fail("/portal/tickets/5/", 500);
    renderWithDataRouter(<PortalTicketDetail />, {
      queryClient: makeQueryClient(),
      path: "/tickets/:id",
      route: "/tickets/5",
    });

    expect(await screen.findByText("The request could not be loaded.")).toBeInTheDocument();
  });
});

describe("attachments", () => {
  it("shows nothing when the ticket has none", async () => {
    setup();
    await screen.findByText("Cannot access invoice portal");

    expect(screen.queryByText("Attachments")).not.toBeInTheDocument();
  });

  it("lists a real, resolvable download link for a ticket-creation attachment", async () => {
    setup();
    // Registered AFTER setup(): `setup()` itself registers the broader
    // "/portal/tickets/5/" match, and apiMock's substring `includes` check
    // means that broader match also catches "/portal/tickets/5/attachments/"
    // — the LAST registration for a matching URL wins, so this override must
    // be pushed after setup() to actually take effect.
    mock.on("/portal/tickets/5/attachments/", () => [
      {
        id: 3,
        message: null,
        file: "/media/attachments/2026/09/tes.png",
        filename: "tes.png",
        size: 62453,
        uploaded_by_kind: "you",
        created_at: "2026-08-20T09:05:00Z",
      },
    ]);
    await screen.findByText("Cannot access invoice portal");

    const link = await screen.findByTestId("portal-attachment-3");
    expect(link).toHaveAttribute("href", "http://localhost:8000/media/attachments/2026/09/tes.png");
    expect(link).toHaveTextContent("tes.png");
    expect(link).toHaveTextContent("61.0 KB");
    expect(link).toHaveTextContent("from you");
  });

  it("labels a support-uploaded file as from support, not by name", async () => {
    setup();
    mock.on("/portal/tickets/5/attachments/", () => [
      {
        id: 4,
        message: 1,
        file: "/media/attachments/2026/09/policy.pdf",
        filename: "policy.pdf",
        size: 1024,
        uploaded_by_kind: "support",
        created_at: "2026-08-20T09:05:00Z",
      },
    ]);
    await screen.findByText("Cannot access invoice portal");

    const link = await screen.findByTestId("portal-attachment-4");
    expect(link).toHaveTextContent("from support");
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
