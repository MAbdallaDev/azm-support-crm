import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { AgentsReport, CSATReport, OverviewReport, VolumeReport } from "./types";

/**
 * The four manager-only reports (`reports/overview|volume|agents|csat/`).
 *
 * Distinct from `reports.ts`, which is `useMySummary` — the agent dashboard's
 * one, agent-reachable endpoint. Keeping the two audiences in separate files
 * matches the API's own split (`IsManager` vs `IsAgentOrAbove`) rather than
 * growing `useMySummary`'s file into a second, unrelated audience.
 *
 * `days` is folded into the query string so each range caches independently —
 * switching 7/30/90 back and forth is instant instead of refetching over the
 * previous range's numbers.
 */

const paramsFor = (days: number) => new URLSearchParams({ days: String(days) }).toString();

export const useOverviewReport = (days: number) => {
  const params = paramsFor(days);
  return useQuery({
    queryKey: qk.reports.overview(params),
    queryFn: () => api.get<OverviewReport>(`/reports/overview/?${params}`).then((r) => r.data),
  });
};

export const useVolumeReport = (days: number) => {
  const params = paramsFor(days);
  return useQuery({
    queryKey: qk.reports.volume(params),
    queryFn: () => api.get<VolumeReport>(`/reports/volume/?${params}`).then((r) => r.data),
  });
};

export const useAgentsReport = (days: number) => {
  const params = paramsFor(days);
  return useQuery({
    queryKey: qk.reports.agents(params),
    queryFn: () => api.get<AgentsReport>(`/reports/agents/?${params}`).then((r) => r.data),
  });
};

export const useCSATReport = (days: number) => {
  const params = paramsFor(days);
  return useQuery({
    queryKey: qk.reports.csat(params),
    queryFn: () => api.get<CSATReport>(`/reports/csat/?${params}`).then((r) => r.data),
  });
};
