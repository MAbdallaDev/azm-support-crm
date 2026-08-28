import * as React from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Generic URL-backed list-filter state — the pattern story 07's
 * `useTicketFilters` established, factored out so the customer list and the
 * knowledge base list can share it.
 *
 * **Not a refactor of `useTicketFilters` itself.** That hook also owns the
 * queue's tab machinery (`tabParams`, the All/Mine/Escalated/Breaching
 * split), which has no equivalent here — customers and KB articles filter,
 * they do not have tabs backed by distinct server predicates. Reusing the
 * *filter* half without dragging the tab half along is what this file is for.
 *
 * The reason this lives in the URL at all is unchanged from story 07: a
 * filtered list is a link a colleague can be sent, it survives a reload, and
 * the back button undoes a filter change. Component state gives none of that.
 */

export type UseUrlFiltersOptions = {
  /** Query keys this screen owns. Anything else in the URL is left alone. */
  keys: readonly string[];
};

export const useUrlFilters = ({ keys }: UseUrlFiltersOptions) => {
  const [search, setSearch] = useSearchParams();

  const page = Number(search.get("page") ?? "1") || 1;
  const activeFilterCount = keys.filter((key) => search.get(key)).length;

  const update = React.useCallback(
    (mutate: (next: URLSearchParams) => void, { keepPage = false } = {}) => {
      const next = new URLSearchParams(search);
      mutate(next);
      if (!keepPage) next.delete("page");
      setSearch(next, { replace: false });
    },
    [search, setSearch],
  );

  const setFilter = React.useCallback(
    (key: string, value: string | null) =>
      update((next) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }),
    [update],
  );

  /** Sets a multi-valued filter to exactly this list, replacing any prior values. */
  const setMultiFilter = React.useCallback(
    (key: string, values: readonly string[]) =>
      update((next) => {
        next.delete(key);
        for (const value of values) next.append(key, value);
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
        for (const key of keys) next.delete(key);
      }),
    [update, keys],
  );

  return {
    search,
    page,
    activeFilterCount,
    setFilter,
    setMultiFilter,
    setPage,
    clearFilters,
    value: (key: string) => search.get(key) ?? "",
    values: (key: string) => search.getAll(key),
  };
};

export type BuildListParamsOptions = {
  keys: readonly string[];
  defaultOrdering?: string;
};

/**
 * The query string sent to the API for a list screen: this screen's own
 * filter keys, carried over untouched (including repeated values, since a
 * multi-choice filter like `tier` needs `?tier=a&tier=b` to survive rather
 * than collapsing to one), plus paging and a default ordering.
 */
export const buildListParams = (
  search: URLSearchParams,
  { keys, defaultOrdering }: BuildListParamsOptions,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const key of keys) {
    for (const value of search.getAll(key)) {
      if (value !== "") params.append(key, value);
    }
  }

  const page = search.get("page");
  if (page && page !== "1") params.set("page", page);

  if (defaultOrdering && !params.has("ordering")) {
    params.set("ordering", defaultOrdering);
  }

  return params;
};
