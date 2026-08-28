import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { CustomerDetail, CustomerNote } from "./types";

/** The context pane's Customer and Notes tabs. Story 08 extends this file. */

export const useCustomer = (id: number | null) =>
  useQuery({
    queryKey: qk.customers.detail(id ?? 0),
    queryFn: () => api.get<CustomerDetail>(`/customers/${id}/`).then((r) => r.data),
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
