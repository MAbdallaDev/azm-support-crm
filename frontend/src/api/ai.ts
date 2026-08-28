import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { AiSuggestedReply, AiSummary, TicketDetail } from "./types";

/**
 * The AI assist endpoints.
 *
 * The two differ in a way that matters: `summarize` **persists** `ai_summary`
 * on the ticket, so its result is folded into the detail cache. `suggest-reply`
 * persists nothing — the agent edits the draft and sends it through the normal
 * messages endpoint, which is what keeps "an agent always approves" true rather
 * than aspirational. Nothing here writes a suggested reply anywhere.
 */

export const useSummarize = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticket: number) =>
      api.post<AiSummary>("/ai/summarize/", { ticket }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData<TicketDetail>(qk.tickets.detail(data.ticket), (previous) =>
        previous ? { ...previous, ai_summary: data.summary } : previous,
      );
    },
  });
};

export const useSuggestReply = () =>
  useMutation({
    mutationFn: ({ ticket, context }: { ticket: number; context?: string }) =>
      api
        .post<AiSuggestedReply>("/ai/suggest-reply/", { ticket, context })
        .then((r) => r.data),
  });
