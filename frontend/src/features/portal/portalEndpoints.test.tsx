import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import PortalHome from "@/routes/PortalHome";
import PortalKB from "@/features/portal/PortalKB";
import PortalTicketDetail from "@/features/portal/PortalTicketDetail";
import Register from "@/features/portal/Register";
import SubmitTicket from "@/features/portal/SubmitTicket";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

/**
 * Criterion 14: `src/api/portal.ts` imports nothing from the agent-facing API
 * modules, and every screen built on it must therefore only ever call a
 * `/portal/*` or `/auth/*` route. This is exactly `mock.urls()` from
 * `apiMock.ts` — the real adapter layer, not a mocked hook — checked against
 * every screen story 09 adds.
 */

let mock: ApiMock;

const ticket = {
  id: 5,
  number: "TK-0005",
  subject: "Cannot access invoice portal",
  status: "Open",
  category: "Billing",
  channel: "Portal",
  created_at: "2026-08-20T09:00:00Z",
  target_date: "2026-08-27T09:00:00Z",
  resolved_at: null,
  message_count: 1,
  csat: null,
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "customer" });
  // Registered broad-to-narrow: apiMock's matcher is a substring `includes`
  // check, and the LAST matching registration wins — so the more specific
  // "/portal/tickets/5/" and ".../messages/" routes must be registered AFTER
  // the general "/portal/tickets/" list route, or the list handler's broader
  // match wins for every ticket-detail and messages request too.
  mock.on("/portal/tickets/", () => page([ticket]));
  mock.on("/portal/kb/articles/", () => page([{ id: 1, slug: "billing-faq", title_en: "Billing FAQ", title_ar: "", category: "Billing", updated_at: "2026-08-01T00:00:00Z", body_en: "", body_ar: "" }]));
  mock.on("/portal/tickets/5/", () => ticket);
  mock.on("/portal/tickets/5/messages/", () => []);
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

const assertPortalOnly = () => {
  const bad = mock.urls().filter((url) => !/^\/(portal|auth)\//.test(url));
  expect(bad).toEqual([]);
};

describe("every portal screen calls only /portal/* or /auth/* routes", () => {
  it("PortalHome", async () => {
    renderWithDataRouter(<PortalHome />, { queryClient: makeQueryClient() });
    await screen.findByText("TK-0005");
    assertPortalOnly();
  });

  it("SubmitTicket", async () => {
    renderWithDataRouter(<SubmitTicket />, { queryClient: makeQueryClient() });
    await waitFor(() => expect(screen.getByTestId("submit-ticket-button")).toBeInTheDocument());
    assertPortalOnly();
  });

  it("PortalTicketDetail", async () => {
    renderWithDataRouter(<PortalTicketDetail />, {
      queryClient: makeQueryClient(),
      path: "/tickets/:id",
      route: "/tickets/5",
    });
    await screen.findByText("Cannot access invoice portal");
    assertPortalOnly();
  });

  it("PortalKB", async () => {
    renderWithDataRouter(<PortalKB />, { queryClient: makeQueryClient() });
    await screen.findByText("Billing FAQ");
    assertPortalOnly();
  });

  it("Register", async () => {
    renderWithDataRouter(<Register />, { queryClient: makeQueryClient() });
    await waitFor(() => expect(screen.getByText("Create your account")).toBeInTheDocument());
    assertPortalOnly();
  });
});
