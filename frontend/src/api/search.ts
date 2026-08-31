import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { CustomerListRow, Paginated, TicketListRow } from "./types";

/**
 * The header search field's results dropdown.
 *
 * Reuses the same `q` filters the ticket queue and customer list already
 * expose — `TicketFilterSet.filter_q` / `CustomerFilterSet.filter_q` — with
 * `page_size` trimmed to a handful, the same `page_size=1`-for-a-count trick
 * `useTicketCount` already relies on, just for a small page instead of none.
 */

const RESULT_LIMIT = { tickets: 5, customers: 3 };

export const useGlobalSearchResults = (query: string) => {
  const trimmed = query.trim();
  const enabled = trimmed.length > 0;

  const tickets = useQuery({
    queryKey: qk.globalSearch(`tickets:${trimmed}`),
    queryFn: () =>
      api
        .get<Paginated<TicketListRow>>(
          `/tickets/?q=${encodeURIComponent(trimmed)}&page_size=${RESULT_LIMIT.tickets}`,
        )
        .then((r) => r.data.results),
    enabled,
  });

  const customers = useQuery({
    queryKey: qk.globalSearch(`customers:${trimmed}`),
    queryFn: () =>
      api
        .get<Paginated<CustomerListRow>>(
          `/customers/?q=${encodeURIComponent(trimmed)}&page_size=${RESULT_LIMIT.customers}`,
        )
        .then((r) => r.data.results),
    enabled,
  });

  return {
    tickets: tickets.data ?? [],
    customers: customers.data ?? [],
    isLoading: enabled && (tickets.isPending || customers.isPending),
    hasQuery: enabled,
  };
};
