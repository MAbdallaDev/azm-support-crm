import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { MySummary } from "./types";

/**
 * The agent dashboard's figures, in one request.
 *
 * `reports/my-summary/` rather than `reports/overview/`: the latter is
 * manager-or-admin only, so an agent — this dashboard's actual audience — gets
 * a 403 from it. Story 07 added the endpoint for exactly that reason.
 */
export const useMySummary = () =>
  useQuery({
    queryKey: qk.mySummary,
    queryFn: () => api.get<MySummary>("/reports/my-summary/").then((r) => r.data),
  });
