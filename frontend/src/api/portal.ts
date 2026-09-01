import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import { tokenStore } from "./tokenStore";
import type {
  LoginResponse,
  Me,
  Paginated,
  PortalAttachment,
  PortalKBArticle,
  PortalMessage,
  PortalTicket,
  RegisterRequest,
} from "./types";

/**
 * Portal data access. **Every function below calls a `/portal/*` or `/auth/*`
 * path and nothing else** — no import from `tickets.ts`, `customers.ts` or
 * `kb.ts`, not even a type. `src/features/portal/*.test.tsx`'s
 * portal-endpoint-only assertion is what checks this holds; the constraint
 * itself mirrors story 05's backend serializers, which made the identical
 * call for the identical reason — a customer-visible surface should be
 * impossible to widen by accident through a shared import.
 */

const toFormData = (body: Record<string, unknown>, files: File[], fileField: string): FormData => {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value !== null && value !== undefined) form.append(key, String(value));
  }
  for (const file of files) form.append(fileField, file);
  return form;
};

// -- registration -------------------------------------------------------

/**
 * `RegisterView` returns the same `LoginResponse` shape login does — safe to
 * seed `qk.me` from directly, mirroring `useLogin` exactly. Registering and
 * being signed in are one action, not two requests.
 */
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterRequest) =>
      api.post<LoginResponse>("/portal/register/", body).then((r) => r.data),
    onSuccess: (data) => {
      tokenStore.set({ access: data.access, refresh: data.refresh, role: data.user.role });
      queryClient.setQueryData<Me>(qk.me, data.user);
    },
  });
};

// -- tickets --------------------------------------------------------------

export const usePortalTickets = (params: URLSearchParams = new URLSearchParams()) => {
  const key = params.toString();
  return useQuery({
    queryKey: qk.portal.tickets.list(key),
    queryFn: () =>
      api.get<Paginated<PortalTicket>>(`/portal/tickets/?${key}`).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
};

export const usePortalTicket = (id: number | null) =>
  useQuery({
    queryKey: qk.portal.tickets.detail(id ?? 0),
    queryFn: () => api.get<PortalTicket>(`/portal/tickets/${id}/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useSubmitPortalTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // `PortalTicketViewSet.create()` is DRF's default `CreateModelMixin`,
    // serialised with `PortalTicketCreateSerializer` — a narrower shape than
    // the detail view (no `status`, no `target_date`, no `csat`). Only
    // `number`/`id` are trustworthy here; the confirmation screen needs
    // exactly those plus the target date, so the mutation re-fetches the
    // detail rather than seeding the cache from this response.
    mutationFn: (args: {
      subject: string;
      description: string;
      category: number | null;
      channel?: string;
      attachments: File[];
    }) =>
      api
        .post<{ id: number; number: string }>(
          "/portal/tickets/",
          toFormData(
            {
              subject: args.subject,
              description: args.description,
              category: args.category,
              ...(args.channel ? { channel: args.channel } : {}),
            },
            args.attachments,
            "attachments",
          ),
          { headers: { "Content-Type": "multipart/form-data" } },
        )
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.portal.tickets.all });
    },
  });
};

/** `live` — see `useTicketMessages`'s doc comment in `tickets.ts`; same scoped
 *  polling, mirrored on the portal side. */
export const usePortalMessages = (id: number | null, live: boolean = false) =>
  useQuery({
    queryKey: qk.portal.tickets.messages(id ?? 0),
    queryFn: () => api.get<PortalMessage[]>(`/portal/tickets/${id}/messages/`).then((r) => r.data),
    enabled: id !== null,
    refetchInterval: live ? 4000 : false,
  });

export const usePortalTicketAttachments = (id: number | null) =>
  useQuery({
    queryKey: qk.portal.tickets.attachments(id ?? 0),
    queryFn: () =>
      api.get<PortalAttachment[]>(`/portal/tickets/${id}/attachments/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useSendPortalMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // The messages action returns one `PortalMessageSerializer` row — safe to
    // append to the messages list, unsafe to use for anything about the
    // ticket itself (it carries none of the ticket's own fields).
    mutationFn: ({ id, body, attachments }: { id: number; body: string; attachments: File[] }) =>
      api
        .post<PortalMessage>(
          `/portal/tickets/${id}/messages/`,
          toFormData({ body }, attachments, "attachments"),
          { headers: { "Content-Type": "multipart/form-data" } },
        )
        .then((r) => r.data),
    onSuccess: (message, { id }) => {
      queryClient.setQueryData<PortalMessage[]>(qk.portal.tickets.messages(id), (previous) =>
        previous ? [...previous, message] : [message],
      );
      void queryClient.invalidateQueries({ queryKey: qk.portal.tickets.detail(id) });
      // A reply may have carried its own attachments — the list just went stale.
      void queryClient.invalidateQueries({ queryKey: qk.portal.tickets.attachments(id) });
    },
  });
};

export const useSubmitCSAT = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticket, score, comment }: { ticket: number; score: number; comment?: string }) =>
      api.post("/portal/csat/", { ticket, score, comment: comment ?? "" }).then((r) => r.data),
    onSuccess: (_data, { ticket }) => {
      // A fresh detail carries the real `csat` object — invalidating rather
      // than guessing the server's shape keeps the read-only display correct
      // even on the 409 "someone else already rated it in another tab" race.
      void queryClient.invalidateQueries({ queryKey: qk.portal.tickets.detail(ticket) });
    },
  });
};

// -- knowledge base ---------------------------------------------------------

export const usePortalArticles = (params: URLSearchParams = new URLSearchParams()) => {
  const key = params.toString();
  return useQuery({
    queryKey: qk.portal.kb.list(key),
    queryFn: () =>
      api.get<Paginated<PortalKBArticle>>(`/portal/kb/articles/?${key}`).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
};

export const usePortalArticle = (slug: string | null) =>
  useQuery({
    queryKey: qk.portal.kb.detail(slug ?? ""),
    queryFn: () => api.get<PortalKBArticle>(`/portal/kb/articles/${slug}/`).then((r) => r.data),
    enabled: slug !== null,
  });
