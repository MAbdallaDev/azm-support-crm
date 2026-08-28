import { describe, expect, it } from "vitest";

import { buildApiParams, tabParams } from "@/features/tickets/useTicketFilters";
import type { QueueTab } from "@/features/tickets/useTicketFilters";

/**
 * `tabParams` and `buildApiParams` are pure and exported precisely so the tab
 * badges and the list can be proven to ask for the same thing.
 */

const build = (query: string, tab: QueueTab = "all", meId: number | undefined = 3) =>
  buildApiParams(new URLSearchParams(query), tab, meId);

describe("tabParams", () => {
  it("maps each tab to a SERVER filter", () => {
    expect(tabParams("all", 3).toString()).toBe("");
    expect(tabParams("mine", 3).toString()).toBe("assignee=3");
    expect(tabParams("escalated", 3).toString()).toBe("escalated=true");
    expect(tabParams("breaching", 3).toString()).toBe("breached=true");
  });

  it("omits the assignee filter when the user is not loaded yet", () => {
    // Better a broader list for one render than `assignee=undefined`, which
    // the API would reject outright.
    expect(tabParams("mine", undefined).toString()).toBe("");
  });
});

describe("buildApiParams", () => {
  it("combines the tab filter with explicit filters", () => {
    const params = build("priority=urgent&status=open", "breaching");

    expect(params.get("breached")).toBe("true");
    expect(params.get("priority")).toBe("urgent");
    expect(params.get("status")).toBe("open");
  });

  it("preserves REPEATED values, because status is a multi-choice filter", () => {
    const params = build("status=new&status=open");

    // A naive `get`-and-`set` pass would collapse these to one and silently
    // narrow the query.
    expect(params.getAll("status")).toEqual(["new", "open"]);
  });

  it("ignores query keys this screen does not own", () => {
    const params = build("evil=1&tab=mine&priority=high");

    expect(params.has("evil")).toBe(false);
    // `tab` is interpreted, not forwarded — the API has no `tab` filter.
    expect(params.has("tab")).toBe(false);
    expect(params.get("priority")).toBe("high");
  });

  it("drops empty values rather than sending blank filters", () => {
    expect(build("priority=&status=open").has("priority")).toBe(false);
  });

  it("defaults to newest-first, and lets the URL override it", () => {
    expect(build("").get("ordering")).toBe("-created_at");
    expect(build("ordering=sla_resolution_due_at").get("ordering")).toBe(
      "sla_resolution_due_at",
    );
  });

  it("omits page=1 so the first page has a stable cache key", () => {
    // ?page=1 and no page are the same list; two keys would mean two fetches
    // and a flash of loading when returning to the first page.
    expect(build("page=1").has("page")).toBe(false);
    expect(build("page=3").get("page")).toBe("3");
  });

  it("carries the dashboard's tile filters through untouched", () => {
    const params = build("due_within_minutes=60&department_code=billing&unassigned=true");

    expect(params.get("due_within_minutes")).toBe("60");
    expect(params.get("department_code")).toBe("billing");
    expect(params.get("unassigned")).toBe("true");
  });

  it("produces the SAME filter for a tab as its badge count uses", () => {
    for (const tab of ["all", "mine", "escalated", "breaching"] as QueueTab[]) {
      const badge = tabParams(tab, 3);
      const list = build("", tab);
      // Every parameter the badge counts on is present in the list request.
      for (const [key, value] of badge) expect(list.get(key)).toBe(value);
    }
  });
});
