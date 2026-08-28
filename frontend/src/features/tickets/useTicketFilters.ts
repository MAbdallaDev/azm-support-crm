import * as React from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Queue filter state, held **in the URL** rather than in component state.
 *
 * That is not a stylistic preference. A filtered queue has to be a link an
 * agent can paste into a chat ("these three are breaching, can you take one?"),
 * it has to survive a reload, and the browser's back button has to undo a
 * filter change. Component state gives none of those, and retrofitting it
 * later means rewriting every control that writes a filter.
 *
 * The tabs are **server** filters, never a client-side pass over a fetched
 * page: the page is twenty-five of a hundred and fifty rows, so filtering it
 * locally would produce a convincing-looking list that is simply wrong.
 */

export const TABS = ["all", "mine", "escalated", "breaching"] as const;
export type QueueTab = (typeof TABS)[number];

/** The statuses "open work" means — matching `ticket_service.OPEN_STATUSES`. */
export const OPEN_STATUSES = [
  "new",
  "open",
  "pending",
  "on_hold",
  "escalated",
  "reopened",
] as const;

/** Filter params this screen owns. Anything else in the URL is left alone. */
const FILTER_KEYS = [
  "status",
  "priority",
  "channel",
  "category",
  "assignee",
  "unassigned",
  "due_within_minutes",
  "resolved_after",
  "department_code",
  "q",
  "ordering",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

const isTab = (value: string | null): value is QueueTab =>
  value !== null && (TABS as readonly string[]).includes(value);

/**
 * The query string sent to `GET /tickets/` for one tab.
 *
 * Exported and pure so the tab **badge counts** reuse it verbatim — a count
 * derived from different parameters than the list it labels is the bug this
 * shape exists to make impossible.
 */
export const tabParams = (tab: QueueTab, meId: number | undefined): URLSearchParams => {
  const params = new URLSearchParams();

  if (tab === "mine" && meId !== undefined) params.set("assignee", String(meId));
  if (tab === "escalated") params.set("escalated", "true");
  if (tab === "breaching") params.set("breached", "true");

  return params;
};

/** Tab filters + explicit filters + paging, as the API expects them. */
export const buildApiParams = (
  search: URLSearchParams,
  tab: QueueTab,
  meId: number | undefined,
): URLSearchParams => {
  const params = tabParams(tab, meId);

  for (const key of FILTER_KEYS) {
    // getAll: `status` is a MultipleChoiceFilter, so ?status=new&status=open
    // has to survive as two values rather than collapsing to one.
    for (const value of search.getAll(key)) {
      if (value !== "") params.append(key, value);
    }
  }

  const page = search.get("page");
  if (page && page !== "1") params.set("page", page);

  if (!params.has("ordering")) params.set("ordering", "-created_at");

  return params;
};

export const useTicketFilters = (meId: number | undefined) => {
  const [search, setSearch] = useSearchParams();

  const tab: QueueTab = isTab(search.get("tab")) ? (search.get("tab") as QueueTab) : "all";
  const page = Number(search.get("page") ?? "1") || 1;

  /**
   * Every write goes through here, and every write except paging resets to
   * page 1 — landing on page 4 of a two-page result is an empty screen that
   * looks like "no tickets match" rather than "you are past the end".
   */
  const update = React.useCallback(
    (mutate: (next: URLSearchParams) => void, { keepPage = false } = {}) => {
      const next = new URLSearchParams(search);
      mutate(next);
      if (!keepPage) next.delete("page");
      setSearch(next, { replace: false });
    },
    [search, setSearch],
  );

  const setTab = React.useCallback(
    (nextTab: QueueTab) =>
      update((next) => {
        if (nextTab === "all") next.delete("tab");
        else next.set("tab", nextTab);
      }),
    [update],
  );

  const setFilter = React.useCallback(
    (key: FilterKey, value: string | null) =>
      update((next) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }),
    [update],
  );

  const setPage = React.useCallback(
    (nextPage: number) =>
      update((next) => next.set("page", String(nextPage)), { keepPage: true }),
    [update],
  );

  const clearFilters = React.useCallback(
    () =>
      update((next) => {
        for (const key of FILTER_KEYS) next.delete(key);
      }),
    [update],
  );

  const activeFilterCount = FILTER_KEYS.filter((key) => search.get(key)).length;

  const apiParams = React.useMemo(
    () => buildApiParams(search, tab, meId),
    [search, tab, meId],
  );

  return {
    search,
    tab,
    page,
    apiParams,
    setTab,
    setFilter,
    setPage,
    clearFilters,
    activeFilterCount,
    /** Current value of one filter, for a controlled `<select>`. */
    value: (key: FilterKey) => search.get(key) ?? "",
  };
};
