import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appRouteChildren } from "@/main";
import { tokenStore } from "@/api/tokenStore";
import i18n from "@/i18n";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient } from "@/test/utils";

/**
 * `/app/tickets/new` must resolve to the create form, not to `Tickets` with
 * `:id === "new"`. `main.tsx` exports its `/app/*` children array
 * specifically so this can be asserted by actually resolving a route through
 * React Router — importing `main.tsx`'s default render would execute
 * `ReactDOM.createRoot(...).render(...)` as a side effect, which has no
 * `#root` element to mount into under a test.
 */
describe("tickets/new is registered above tickets/:id", () => {
  it("resolves /app/tickets/new to the create form", () => {
    const router = createMemoryRouter(appRouteChildren, {
      initialEntries: ["/tickets/new"],
    });
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <I18nextProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    // NewTicket's own "missing customer" message only renders when it truly
    // is NewTicket — Tickets.tsx has no such text anywhere.
    expect(
      screen.getByText("Start this from a customer's page so the ticket has someone to belong to."),
    ).toBeInTheDocument();
  });

  it("still resolves /app/tickets/152 to the ticket detail route", () => {
    const router = createMemoryRouter(appRouteChildren, {
      initialEntries: ["/tickets/152"],
    });
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <I18nextProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    // Tickets.tsx's own empty-queue-selection copy would not appear if "new"
    // had swallowed this path too; a numeric id must still reach Tickets.
    expect(screen.queryByText(/Start this from a customer's page/)).not.toBeInTheDocument();
  });
});

describe("story 09's reports route", () => {
  let mock: ApiMock;

  beforeEach(() => {
    mock = installApiMock();
    tokenStore.set({ access: "a", refresh: "r", role: "manager" });
  });

  afterEach(() => {
    mock.restore();
    tokenStore.clear();
  });

  it("resolves /app/reports to the reports page", () => {
    const router = createMemoryRouter(appRouteChildren, { initialEntries: ["/reports"] });
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <I18nextProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("report-tile-total")).toBeInTheDocument();
  });
});
