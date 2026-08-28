import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import Tickets from "@/routes/Tickets";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { detail, listRow, me } from "@/test/fixtures";
import { makeQueryClient, renderWithDataRouter } from "@/test/utils";

import "@/i18n";

/**
 * Criterion 4's mobile behaviour for the one screen genuinely at risk: below
 * `md`, the queue and the detail pane become two full-width "pages" rather
 * than two illegibly narrow columns — this is what `Tickets.tsx`'s
 * `hidden md:flex` toggling and the "back to queue" link exist to prove.
 */

let mock: ApiMock;

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/auth/me/", () => me());
  mock.on("/tickets/", () => page([listRow({ id: 1 })], 1));
  mock.on("/tickets/1/", () => detail({ id: 1 }));
  mock.on("/tickets/1/messages/", () => []);
  mock.on("/tickets/1/events/", () => []);
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("the ticket workspace's mobile layout", () => {
  it("shows a back-to-queue link once a ticket is open, absent otherwise", async () => {
    renderWithDataRouter(<Tickets />, {
      queryClient: makeQueryClient(),
      path: "/:id?",
      route: "/",
    });

    await waitFor(() => expect(screen.getByText("SMS notifications arriving hours late")).toBeInTheDocument());
    expect(screen.queryByTestId("back-to-queue")).not.toBeInTheDocument();
  });

  it("renders the back-to-queue link when a ticket is open", async () => {
    renderWithDataRouter(<Tickets />, {
      queryClient: makeQueryClient(),
      path: "/:id?",
      route: "/1",
    });

    await waitFor(() => expect(screen.getByTestId("back-to-queue")).toBeInTheDocument());
    expect(screen.getByTestId("back-to-queue")).toHaveAttribute("href", "/app/tickets");
  });

  it("offers the context-drawer toggle for the customer/SLA/assignment info below xl", async () => {
    renderWithDataRouter(<Tickets />, {
      queryClient: makeQueryClient(),
      path: "/:id?",
      route: "/1",
    });

    await waitFor(() => expect(screen.getByTestId("open-context-drawer")).toBeInTheDocument());
  });
});
