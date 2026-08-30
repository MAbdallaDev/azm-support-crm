import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import { TicketQueue } from "@/features/tickets/TicketQueue";
import { installApiMock, page } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { listRow, me } from "@/test/fixtures";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const setup = (route = "/app/tickets", selectedId: number | null = null) => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(qk.me, me());
  return renderWithProviders(<TicketQueue selectedId={selectedId} />, {
    queryClient,
    route,
  });
};

/** The list request — the one without the count-only `page_size=1`. */
const listRequests = () =>
  mock.urls().filter((url) => url.startsWith("/tickets/?") && !url.includes("page_size=1"));

const countRequests = () =>
  mock.urls().filter((url) => url.includes("page_size=1"));

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "agent" });
  mock.on("/categories/", () => page([]));
  mock.on("/tickets/", () => page([listRow({ id: 1 }), listRow({ id: 2, number: "TK-0002" })], 2));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("tab counts", () => {
  it("come from SERVER queries, one per tab, not from filtering a fetched page", async () => {
    setup();
    await screen.findByTestId("queue-row-1");

    // Distinct queries, not raw request count: a refetch (here, after
    // /auth/me/ resolves and re-renders) legitimately repeats one of them.
    const counts = [...new Set(countRequests())];

    // Four badges, four count-only queries — and each carries the filter its
    // own tab applies. A client-side count would show none of these.
    expect(counts).toHaveLength(4);
    expect(counts.some((url) => url.includes("assignee=3"))).toBe(true);
    expect(counts.some((url) => url.includes("escalated=true"))).toBe(true);
    expect(counts.some((url) => url.includes("breached=true"))).toBe(true);
  });

  it("asks for page_size=1, so a badge does not fetch 25 rows to discard them", async () => {
    setup();
    await screen.findByTestId("queue-row-1");

    for (const url of countRequests()) expect(url).toContain("page_size=1");
  });

  it("uses the same filter for the badge and the list it labels", async () => {
    setup("/app/tickets?tab=escalated");
    await screen.findByTestId("queue-row-1");

    // Whatever the Escalated badge counted, the list asked for the same thing.
    expect(listRequests()[0]).toContain("escalated=true");
    expect(countRequests().some((url) => url.includes("escalated=true"))).toBe(true);
  });
});

describe("filters panel", () => {
  it("stays collapsed by default, reclaiming space for the list", async () => {
    setup();
    await screen.findByTestId("queue-row-1");

    expect(screen.getByTestId("queue-filters-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("queue-filters-panel")).not.toBeInTheDocument();
  });

  it("opens automatically when a filter is already active from the URL", async () => {
    setup("/app/tickets?priority=urgent");
    await screen.findByTestId("queue-row-1");

    expect(screen.getByTestId("queue-filters-toggle")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("queue-filters-panel")).toBeInTheDocument();
  });
});

describe("URL as the source of truth", () => {
  it("restores tab and filters from the URL on load", async () => {
    setup("/app/tickets?tab=breaching&priority=urgent&status=open");
    await screen.findByTestId("queue-row-1");

    expect(screen.getByTestId("queue-tab-breaching")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("queue-filter-priority")).toHaveValue("urgent");
    expect(screen.getByTestId("queue-filter-status")).toHaveValue("open");

    const request = listRequests()[0];
    expect(request).toContain("breached=true");
    expect(request).toContain("priority=urgent");
    expect(request).toContain("status=open");
  });

  it("writes a filter change back into the URL and re-queries the server", async () => {
    setup();
    await screen.findByTestId("queue-row-1");
    const before = listRequests().length;

    // Filters are collapsed by default now (queue-filters-toggle) — reclaims
    // vertical space for the list, per the queue-panel scroll-squeeze fix.
    fireEvent.click(screen.getByTestId("queue-filters-toggle"));

    fireEvent.change(screen.getByTestId("queue-filter-priority"), {
      target: { value: "urgent" },
    });

    await waitFor(() => expect(listRequests().length).toBeGreaterThan(before));
    const requests = listRequests();
    expect(requests[requests.length - 1]).toContain("priority=urgent");
  });

  it("clears every filter at once", async () => {
    setup("/app/tickets?priority=urgent&status=open");
    await screen.findByTestId("queue-row-1");

    fireEvent.click(screen.getByTestId("queue-clear-filters"));

    await waitFor(() => {
      const requests = listRequests();
      const latest = requests[requests.length - 1] ?? "";
      expect(latest).not.toContain("priority=urgent");
      expect(latest).not.toContain("status=open");
    });
  });
});

describe("selection", () => {
  it("is derived from the route, so a refetch cannot clear it", async () => {
    const view = setup("/app/tickets/2", 2);
    await screen.findByTestId("queue-row-2");

    expect(screen.getByTestId("queue-row-2")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("queue-row-1")).not.toHaveAttribute("aria-current");

    // Re-render with fresh rows, as a refetch would: still selected.
    view.rerender(<TicketQueue selectedId={2} />);
    expect(screen.getByTestId("queue-row-2")).toHaveAttribute("aria-current", "true");
  });

  it("carries the current filters into each row's link, so the queue survives", async () => {
    setup("/app/tickets?tab=mine&priority=urgent");
    const row = await screen.findByTestId("queue-row-1");

    const href = row.getAttribute("href") ?? "";
    expect(href).toContain("/app/tickets/1?");
    expect(href).toContain("tab=mine");
    expect(href).toContain("priority=urgent");
  });
});

describe("states", () => {
  it("shows a skeleton before the first page arrives", () => {
    setup();
    expect(screen.getByTestId("queue-skeleton")).toBeInTheDocument();
  });

  it("shows a real empty state, with a way out when filters caused it", async () => {
    mock.on("/tickets/", () => page([], 0));
    setup("/app/tickets?priority=urgent");

    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getAllByText(/clear filters/i).length).toBeGreaterThan(0);
  });
});
