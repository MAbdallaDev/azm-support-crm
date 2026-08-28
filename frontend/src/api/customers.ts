import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type {
  Branch,
  Contact,
  CustomerAttachment,
  CustomerDetail,
  CustomerListRow,
  CustomerNote,
  Department,
  Paginated,
} from "./types";

/** The customer list, customer 360, and the two dropdowns that filter them. */

export const useCustomerList = (params: URLSearchParams) => {
  const key = params.toString();

  return useQuery({
    queryKey: qk.customers.list(key),
    queryFn: () =>
      api.get<Paginated<CustomerListRow>>(`/customers/?${key}`).then((r) => r.data),
    // The previous page stays on screen while the next loads — story 07's
    // ticket list does the same, for the same reason: no flash of empty
    // between a filter change and its result.
    placeholderData: (previous) => previous,
  });
};

export const useCustomer = (id: number | null) =>
  useQuery({
    queryKey: qk.customers.detail(id ?? 0),
    queryFn: () => api.get<CustomerDetail>(`/customers/${id}/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useCustomerAttachments = (id: number | null) =>
  useQuery({
    queryKey: qk.customers.attachments(id ?? 0),
    queryFn: () =>
      api.get<CustomerAttachment[]>(`/customers/${id}/attachments/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useCustomerNotes = (id: number | null) =>
  useQuery({
    queryKey: qk.customers.notes(id ?? 0),
    queryFn: () => api.get<CustomerNote[]>(`/customers/${id}/notes/`).then((r) => r.data),
    enabled: id !== null,
  });

export const useAddCustomerNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.post<CustomerNote>(`/customers/${id}/notes/`, { body }).then((r) => r.data),
    onSuccess: (note, { id }) => {
      queryClient.setQueryData<CustomerNote[]>(qk.customers.notes(id), (previous) =>
        previous ? [note, ...previous] : [note],
      );
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // `CustomerViewSet.get_serializer_class()` returns `CustomerWriteSerializer`
    // for both "update" and "partial_update" — a narrower shape than
    // `CustomerDetailSerializer`, missing `contacts`, `open_ticket_count`,
    // `total_ticket_count` and `branch_name`. Typing the response as the full
    // detail and writing it straight into the cache would poison it with
    // those fields `undefined`, and Customer 360 reads several of them on its
    // very first render after a save.
    mutationFn: ({ id, ...body }: { id: number } & Partial<CustomerDetail>) =>
      api.patch<{ id: number }>(`/customers/${id}/`, body).then((r) => r.data),
    onSuccess: (customer) => {
      // Invalidate rather than seed: the next read refetches the real
      // CustomerDetailSerializer payload instead of a partial one.
      void queryClient.invalidateQueries({ queryKey: qk.customers.detail(customer.id) });
      void queryClient.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
};

export const useAddContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Omit<Contact, "id">) =>
      api.post<Contact>("/contacts/", body).then((r) => r.data),
    onSuccess: (_contact, variables) => {
      // The contact is nested read-only inside CustomerDetailSerializer, so
      // there is no cache to patch directly — a refetch of the detail is the
      // only path back to a consistent `contacts` array.
      void queryClient.invalidateQueries({ queryKey: qk.customers.detail(variables.customer) });
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // `customer` stays in the PATCH body (unchanged, harmless) rather than
    // being excluded — the alternative is destructuring it out purely to
    // discard it, which has no use inside `mutationFn` and only exists for
    // `onSuccess` below to key cache invalidation on.
    mutationFn: ({ id, ...body }: { id: number; customer: number } & Partial<Contact>) =>
      api.patch<Contact>(`/contacts/${id}/`, body).then((r) => r.data),
    onSuccess: (_contact, variables) => {
      void queryClient.invalidateQueries({ queryKey: qk.customers.detail(variables.customer) });
    },
  });
};

// -- reference data. Six branches, a handful of departments; rarely changes. --

const REFERENCE_STALE_MS = 5 * 60 * 1000;

export const useBranches = () =>
  useQuery({
    queryKey: qk.branches,
    queryFn: () => api.get<Branch[]>("/branches/").then((r) => r.data),
    staleTime: REFERENCE_STALE_MS,
  });

export const useDepartments = () =>
  useQuery({
    queryKey: qk.departments,
    queryFn: () => api.get<Department[]>("/departments/").then((r) => r.data),
    staleTime: REFERENCE_STALE_MS,
  });
