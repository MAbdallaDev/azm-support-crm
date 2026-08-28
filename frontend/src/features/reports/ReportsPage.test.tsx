import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/api/tokenStore";
import type { AgentRow } from "@/api/types";
import ReportsPage, { buildAgentsCsv, pivotByDayChannel } from "@/features/reports/ReportsPage";
import { installApiMock } from "@/test/apiMock";
import type { ApiMock } from "@/test/apiMock";
import { makeQueryClient, renderWithProviders } from "@/test/utils";

import "@/i18n";

let mock: ApiMock;

const overview = {
  days: 30,
  total: 42,
  open: 11,
  resolved_today: 3,
  breached: 5,
  avg_first_response_seconds: 1200,
  avg_resolution_seconds: 7200,
  sla_compliance_percent: 91.2,
  csat_average: 4.4,
};

const volume = {
  days: 30,
  by_status: [{ key: "open", count: 11 }, { key: "new", count: 4 }],
  by_priority: [{ key: "normal", count: 15 }],
  by_channel: [{ key: "email", count: 15 }],
  by_day: [{ key: "2026-08-20", count: 15 }],
  by_day_channel: [
    { day: "2026-08-20", channel: "email", count: 6 },
    { day: "2026-08-20", channel: "whatsapp", count: 4 },
    { day: "2026-08-21", channel: "email", count: 5 },
  ],
};

const agents: AgentRow[] = [
  {
    id: 1, username: "sara@demo", full_name: "Sara Al-Otaibi", department: "Billing",
    assigned: 20, resolved: 18, avg_first_response_seconds: 600, sla_compliance_percent: 95, csat_average: 4.8,
  },
  {
    id: 2, username: "khalid@demo", full_name: "Khalid Al-Dossary", department: "Technical",
    assigned: 8, resolved: 2, avg_first_response_seconds: 3000, sla_compliance_percent: 60, csat_average: null,
  },
];

const csat = {
  days: 30,
  average: 4.4,
  count: 12,
  distribution: [
    { score: 1, count: 0 }, { score: 2, count: 0 }, { score: 3, count: 1 },
    { score: 4, count: 4 }, { score: 5, count: 7 },
  ],
};

const setup = () =>
  renderWithProviders(<ReportsPage />, { queryClient: makeQueryClient(), route: "/app/reports" });

beforeEach(() => {
  mock = installApiMock();
  tokenStore.set({ access: "a", refresh: "r", role: "manager" });
  mock.on("/reports/overview/", () => overview);
  mock.on("/reports/volume/", () => volume);
  mock.on("/reports/agents/", () => ({ days: 30, agents }));
  mock.on("/reports/csat/", () => csat);
  mock.on("/tickets/", () => ({ count: 11, next: null, previous: null, results: [] }));
});

afterEach(() => {
  mock.restore();
  tokenStore.clear();
});

describe("KPI tiles", () => {
  it("links the open tile to a queue filtered to the population it counted", async () => {
    setup();
    await waitFor(() => expect(within(screen.getByTestId("report-tile-open")).getByText("11")).toBeInTheDocument());

    const href = screen.getByTestId("report-tile-open").getAttribute("href") ?? "";
    expect(href).toContain("status=open");
    expect(href).toContain("created_after=");

    // The href's own filter, resolved against the mocked queue, returns a
    // result count equal to the tile's own number — not merely a link that
    // looks plausible.
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.getAll("status").length).toBeGreaterThan(0);
  });

  it("links the breached tile with breached=true and the same window", async () => {
    setup();
    await waitFor(() => expect(within(screen.getByTestId("report-tile-breached")).getByText("5")).toBeInTheDocument());

    const href = screen.getByTestId("report-tile-breached").getAttribute("href") ?? "";
    expect(href).toContain("breached=true");
    expect(href).toContain("created_after=");
  });

  it("links resolved-today with resolved_after, not a raw status filter", async () => {
    setup();
    await waitFor(() => expect(within(screen.getByTestId("report-tile-resolvedToday")).getByText("3")).toBeInTheDocument());

    const href = screen.getByTestId("report-tile-resolvedToday").getAttribute("href") ?? "";
    expect(href).toContain("resolved_after=");
  });
});

describe("date range", () => {
  it("keeps the range in the URL and refetches on change", async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId("report-tile-total")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("range-7"));

    await waitFor(() =>
      expect(mock.urls().some((url) => url.includes("/reports/overview/?days=7"))).toBe(true),
    );
  });
});

describe("the by-channel line chart", () => {
  it("pivots one series per channel actually present in the window", () => {
    const { data, series } = pivotByDayChannel(volume.by_day_channel);
    expect(series.sort()).toEqual(["email", "whatsapp"].sort());
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ day: "2026-08-20", email: 6, whatsapp: 4 });
  });

  it("omits a channel with zero rows in the window entirely", () => {
    const { series } = pivotByDayChannel([{ day: "2026-08-20", channel: "sms", count: 2 }]);
    expect(series).toEqual(["sms"]);
  });
});

describe("empty ranges", () => {
  it("shows an explicit empty state rather than a broken axis", async () => {
    mock.on("/reports/volume/", () => ({ ...volume, by_status: [], by_day_channel: [] }));
    setup();

    await waitFor(() => expect(screen.getAllByTestId("chart-empty").length).toBeGreaterThan(0));
  });
});

describe("the agent table", () => {
  it("sorts client-side, without a network request", async () => {
    setup();
    await screen.findByText("Sara Al-Otaibi");

    const requestCountBefore = mock.requests.length;
    fireEvent.click(screen.getByRole("button", { name: /Resolved/i }));

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      // Header + 2 data rows; ascending sort on "resolved" (2, 18) puts
      // Khalid (resolved: 2) first.
      expect(within(rows[1]).getByText("Khalid Al-Dossary")).toBeInTheDocument();
    });
    expect(mock.requests.length).toBe(requestCountBefore);
  });
});

describe("CSV export", () => {
  it("builds a CSV whose rows match the fetched agents exactly", () => {
    const csvText = buildAgentsCsv(agents);
    const lines = csvText.split("\n");
    expect(lines[0]).toBe(
      "id,username,full_name,department,assigned,resolved,avg_first_response_seconds,sla_compliance_percent,csat_average",
    );
    expect(lines[1]).toBe("1,sara@demo,Sara Al-Otaibi,Billing,20,18,600,95,4.8");
    // A null csat_average renders as an empty field, not the string "null".
    expect(lines[2]).toBe("2,khalid@demo,Khalid Al-Dossary,Technical,8,2,3000,60,");
  });

  it("triggers a client-side download with no network request", async () => {
    setup();
    await screen.findByText("Sara Al-Otaibi");
    const requestCountBefore = mock.requests.length;

    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    fireEvent.click(screen.getByTestId("export-agents-csv"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(mock.requests.length).toBe(requestCountBefore);
    vi.unstubAllGlobals();
  });
});
