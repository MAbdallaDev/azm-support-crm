import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import type { MySummary } from "@/api/types";
import Dashboard from "@/routes/Dashboard";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { listRow, me } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const summary = (over: Partial<MySummary> = {}): MySummary => ({
  my_open: 7,
  breaching_within_hour: 3,
  unassigned_in_department: 9,
  resolved_by_me_today: 4,
  awaiting_first_reply: 2,
  already_breached: 1,
  csat_average: 4.6,
  csat_count: 41,
  csat_distribution: [
    { score: 1, count: 0 },
    { score: 2, count: 1 },
    { score: 3, count: 3 },
    { score: 4, count: 8 },
    { score: 5, count: 29 },
  ],
  ...over,
});

const setup = () => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(qk.me, me());
  return renderWithProviders(<Dashboard />, { queryClient, route: "/app/dashboard" });
};

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/reports/my-summary/", () => summary());
  mock.on("/auth/me/", () => me());
  mock.on("/health/", () => ({ status: "ok", database: "ok" }));
  mock.on("/tickets/", () => page([listRow({ id: 1 })], 1));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

/** The href of the tile whose label matches. */
const tileLink = (id: string) =>
  screen.getByTestId(`tile-${id}`).getAttribute("href") ?? "";

describe("the four tiles", () => {
  it("render every figure from the one summary request", async () => {
    setup();

    // Scoped per tile: bare digits also appear in the CSAT distribution, so a
    // document-wide getByText("3") is ambiguous and would pass for the wrong
    // reason as easily as it fails.
    await waitFor(() =>
      expect(within(screen.getByTestId("tile-myOpen")).getByText("7")).toBeInTheDocument(),
    );
    expect(within(screen.getByTestId("tile-breaching")).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByTestId("tile-unassigned")).getByText("9")).toBeInTheDocument();
    expect(within(screen.getByTestId("tile-resolvedToday")).getByText("4")).toBeInTheDocument();

    // One request, not five — that is the reason the endpoint exists.
    expect(mock.urls().filter((url) => url.includes("my-summary")).length).toBe(1);
  });

  it("links each tile to a queue filtered to the SAME set it counts", async () => {
    setup();
    await waitFor(() =>
      expect(within(screen.getByTestId("tile-myOpen")).getByText("7")).toBeInTheDocument(),
    );

    // My open: mine, restricted to open statuses.
    const myOpen = tileLink("myOpen");
    expect(myOpen).toContain("tab=mine");
    expect(myOpen).toContain("status=open");
    expect(myOpen).not.toContain("status=resolved");
    expect(myOpen).not.toContain("status=closed");

    // Breaching: the about-to-breach filter, NOT breached=true. The two are
    // deliberately disjoint sets on the API side, and the tile counts the
    // former — linking to the latter would open a different list entirely.
    const breaching = tileLink("breaching");
    expect(breaching).toContain("due_within_minutes=60");
    expect(breaching).toContain("tab=mine");
    expect(breaching).not.toContain("breached=true");

    // Unassigned: by department **code**, because MeSerializer.department is a
    // code string and the client holds no primary key to filter with.
    const unassigned = tileLink("unassigned");
    expect(unassigned).toContain("unassigned=true");
    expect(unassigned).toContain("department_code=technical");

    // Resolved today: mine, resolved since local midnight.
    const resolved = tileLink("resolvedToday");
    expect(resolved).toContain("assignee=3");
    expect(resolved).toContain("resolved_after=");
  });

  it("dates the resolved-today link from local midnight, not from now", async () => {
    setup();
    await waitFor(() =>
      expect(within(screen.getByTestId("tile-myOpen")).getByText("7")).toBeInTheDocument(),
    );

    const href = tileLink("resolvedToday");
    const iso = decodeURIComponent(href.split("resolved_after=")[1] ?? "");
    const midnight = new Date(iso);

    // "Today" starts at 00:00 local. Using `now` would silently exclude
    // everything resolved earlier in the same day.
    expect(midnight.getHours()).toBe(0);
    expect(midnight.getMinutes()).toBe(0);
    expect(midnight.toDateString()).toBe(new Date().toDateString());
  });

  it("gives the breaching tile its alarm styling", async () => {
    setup();
    await waitFor(() =>
      expect(within(screen.getByTestId("tile-breaching")).getByText("3")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("tile-breaching").className).toContain("#f0c9c9");
    expect(screen.getByTestId("tile-myOpen").className).toContain("border-line");
  });
});

describe("supporting cards", () => {
  it("orders the most-urgent list by SLA deadline, ascending", async () => {
    setup();
    await waitFor(() =>
      expect(within(screen.getByTestId("tile-myOpen")).getByText("7")).toBeInTheDocument(),
    );

    const request = mock.urls().find((url) => url.includes("ordering=sla_resolution_due_at"));
    expect(request).toBeDefined();
    expect(request).toContain("assignee=3");
  });

  it("shows the CSAT average and its distribution", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("4.6")).toBeInTheDocument());
    expect(screen.getByText(/41 ratings/)).toBeInTheDocument();
  });

  it("says so plainly rather than showing 0 when there are no ratings", async () => {
    mock.on("/reports/my-summary/", () => summary({ csat_average: null, csat_count: 0 }));
    setup();

    // Zero is a real CSAT score and would read as a catastrophic rating.
    await waitFor(() => expect(screen.getByText(/No ratings yet/)).toBeInTheDocument());
  });

  it("keeps story 01's health indicator as the API-client smoke test", async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId("health-status")).toHaveTextContent("ok"));
  });
});

describe("failure", () => {
  it("says the figures could not load instead of showing zeros", async () => {
    mock.fail("/reports/my-summary/", 500);
    setup();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
