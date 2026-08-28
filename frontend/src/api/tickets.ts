import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type {
  Attachment,
  CannedReply,
  Category,
  Paginated,
  Tag,
  TicketDetail,
  TicketEvent,
  TicketListRow,
  TicketMessage,
  TicketStatus,
} from "./types";

/**
 * Ticket data access.
 *
 * Two rules hold throughout, both inherited from story 06's `auth.ts`:
 *
 *  1. **Every mutation seeds the detail cache from its own response.** All six
 *     ticket actions return the full `TicketDetailSerializer`, so refetching
 *     the detail afterwards is a round trip whose answer we already hold.
 *  2. **Then invalidate `qk.tickets.all`** — the list, its filtered variants
 *     and the sub-resources all sit under that prefix, so one call catches
 *     every view of the row that just changed.
 */

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const useTicketList = (params: URLSearchParams) => {
  const key = params.toString();

  return useQuery({
    queryKey: qk.tickets.list(key),
    queryFn: () =>
      api.get<Paginated<TicketListRow>>(`/tickets/?${key}`).then((r) => r.data),
    // The previous page stays on screen while the next one loads, so paging
    // and tab switches do not flash an empty table.
    placeholderData: (previous) => previous,
  });
};

/**
 * A tab's badge count.
 *
 * `page_size=1` on purpose: the badge needs `count` and nothing else, and the
 * default page would fetch twenty-five rows to throw all of them away.
 */
export const useTicketCount = (params: URLSearchParams) => {
  const scoped = new URLSearchParams(params);
  scoped.set("page_size", "1");
  const key = scoped.toString();

  return useQuery({
    queryKey: qk.tickets.list(key),
    queryFn: () =>
      api.get<Paginated<TicketListRow>>(`/tickets/?${key}`).then((r) => r.data.count),
  });
};

export const useTicket = (id: number | null) =>
  useQuery({
    queryKey: qk.tickets.detail(id ?? 0),
    queryFn: () => api.get<TicketDetail>(`/tickets/${id}/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useTicketMessages = (id: number | null) =>
  useQuery({
    queryKey: qk.tickets.messages(id ?? 0),
    queryFn: () =>
      api.get<TicketMessage[]>(`/tickets/${id}/messages/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useTicketEvents = (id: number | null) =>
  useQuery({
    queryKey: qk.tickets.events(id ?? 0),
    queryFn: () => api.get<TicketEvent[]>(`/tickets/${id}/events/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useTicketAttachments = (id: number | null) =>
  useQuery({
    queryKey: qk.tickets.attachments(id ?? 0),
    queryFn: () =>
      api.get<Attachment[]>(`/tickets/${id}/attachments/`).then((r) => r.data),
    enabled: id !== null,
  });

// -- reference data. Rarely changes; edited in Django admin. ----------------

const REFERENCE_STALE_MS = 5 * 60 * 1000;

export const useCannedReplies = () =>
  useQuery({
    queryKey: qk.cannedReplies,
    queryFn: () =>
      api.get<Paginated<CannedReply> | CannedReply[]>("/canned-replies/").then((r) =>
        Array.isArray(r.data) ? r.data : r.data.results,
      ),
    staleTime: REFERENCE_STALE_MS,
  });

export const useCategories = () =>
  useQuery({
    queryKey: qk.categories,
    queryFn: () =>
      api.get<Paginated<Category> | Category[]>("/categories/").then((r) =>
        Array.isArray(r.data) ? r.data : r.data.results,
      ),
    staleTime: REFERENCE_STALE_MS,
  });

export const useTags = () =>
  useQuery({
    queryKey: qk.tags,
    queryFn: () =>
      api.get<Paginated<Tag> | Tag[]>("/tags/").then((r) =>
        Array.isArray(r.data) ? r.data : r.data.results,
      ),
    staleTime: REFERENCE_STALE_MS,
  });

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** The success path every ticket action shares. */
const settleDetail = (queryClient: QueryClient, ticket: TicketDetail) => {
  queryClient.setQueryData(qk.tickets.detail(ticket.id), ticket);
  void queryClient.invalidateQueries({ queryKey: qk.tickets.all });
  void queryClient.invalidateQueries({ queryKey: qk.mySummary });
};

/**
 * Optimistic patching for the detail cache.
 *
 * Returns the snapshot so `onError` can put it back verbatim. Patching the
 * *list* optimistically too would mean reconciling every cached filter
 * combination — including ones where the change should move the row between
 * tabs — so the list is left to its invalidation instead. The detail pane is
 * where the agent is looking, and it is the one that must feel instant.
 */
const optimisticDetail = async (
  queryClient: QueryClient,
  id: number,
  patch: Partial<TicketDetail>,
) => {
  await queryClient.cancelQueries({ queryKey: qk.tickets.detail(id) });
  const previous = queryClient.getQueryData<TicketDetail>(qk.tickets.detail(id));
  if (previous) {
    queryClient.setQueryData<TicketDetail>(qk.tickets.detail(id), {
      ...previous,
      ...patch,
    });
  }
  return { previous };
};

const rollbackDetail = (
  queryClient: QueryClient,
  id: number,
  context: { previous?: TicketDetail } | undefined,
) => {
  if (context?.previous) {
    queryClient.setQueryData(qk.tickets.detail(id), context.previous);
  }
};

export type StatusVariables = { id: number; status: TicketStatus; note?: string };

export const useChangeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, note }: StatusVariables) =>
      api
        .post<TicketDetail>(`/tickets/${id}/status/`, { status, note })
        .then((r) => r.data),
    onMutate: ({ id, status }) => optimisticDetail(queryClient, id, { status }),
    onError: (_error, { id }, context) => rollbackDetail(queryClient, id, context),
    onSuccess: (ticket) => settleDetail(queryClient, ticket),
  });
};

export const useEscalate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.post<TicketDetail>(`/tickets/${id}/escalate/`, { reason }).then((r) => r.data),
    onMutate: ({ id }) => optimisticDetail(queryClient, id, { status: "escalated" }),
    onError: (_error, { id }, context) => rollbackDetail(queryClient, id, context),
    onSuccess: (ticket) => settleDetail(queryClient, ticket),
  });
};

export const useResolve = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resolution_note }: { id: number; resolution_note?: string }) =>
      api
        .post<TicketDetail>(`/tickets/${id}/resolve/`, { resolution_note })
        .then((r) => r.data),
    onMutate: ({ id }) => optimisticDetail(queryClient, id, { status: "resolved" }),
    onError: (_error, { id }, context) => rollbackDetail(queryClient, id, context),
    onSuccess: (ticket) => settleDetail(queryClient, ticket),
  });
};

/**
 * Assign, or auto-assign when `assignee` is omitted.
 *
 * **Not optimistic.** An auto-assign has no predictable outcome to patch in —
 * the server picks the agent — and a 409 (no eligible agent) is a legitimate
 * answer rather than a failure, so showing a name and snatching it back would
 * be worse than a brief pending state.
 */
export const useAssign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      assignee,
      reason,
    }: {
      id: number;
      assignee?: number | null;
      reason?: string;
    }) => api.post<TicketDetail>(`/tickets/${id}/assign/`, { assignee, reason }).then((r) => r.data),
    onSuccess: (ticket) => settleDetail(queryClient, ticket),
  });
};

/**
 * Post a reply or an internal note.
 *
 * Optimistic against the **messages** list rather than the detail: the agent
 * needs to see their own text land immediately. The temporary row carries a
 * negative id so it cannot collide with a real one, and `onSuccess` replaces
 * the whole list from the server rather than reconciling by hand.
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
      is_internal,
    }: {
      id: number;
      body: string;
      is_internal: boolean;
    }) =>
      api
        .post<TicketMessage>(`/tickets/${id}/messages/`, { body, is_internal })
        .then((r) => r.data),
    onSuccess: (message, { id }) => {
      queryClient.setQueryData<TicketMessage[]>(qk.tickets.messages(id), (previous) =>
        previous ? [...previous, message] : [message],
      );
      // A public reply may have stamped first_response_at, which moves the
      // response SLA clock — so the detail and the queue both need refreshing.
      void queryClient.invalidateQueries({ queryKey: qk.tickets.all });
    },
  });
};

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      // The Content-Type header is deliberately unset: the browser has to add
      // its own multipart boundary, and the client default would override it.
      return api
        .post<Attachment>(`/tickets/${id}/attachments/`, form, {
          headers: { "Content-Type": undefined },
        })
        .then((r) => r.data);
    },
    onSuccess: (_attachment, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.tickets.attachments(id) });
      void queryClient.invalidateQueries({ queryKey: qk.tickets.events(id) });
    },
  });
};
