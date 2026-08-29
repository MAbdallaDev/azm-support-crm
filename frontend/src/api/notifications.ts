import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { qk } from "./queryKeys";
import type { Notification, Paginated } from "./types";

/**
 * The notification bell's data access.
 *
 * No polling here — the app's global QueryClient default already disables
 * `refetchOnWindowFocus`, and this deliberately does not add
 * `refetchInterval` either: the unread count refreshes when a notification is
 * marked read, and whenever the bell dropdown is opened (its `useNotifications`
 * call refetches on mount). A live-updating badge with no interaction would
 * be the app's first polling query, and one bell icon is not worth
 * introducing a second freshness convention for the whole codebase to learn.
 */

export const useUnreadCount = () =>
  useQuery({
    queryKey: qk.notifications.unreadCount,
    queryFn: () => api.get<{ count: number }>("/notifications/unread-count/").then((r) => r.data.count),
  });

export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: qk.notifications.list(""),
    queryFn: () => api.get<Paginated<Notification>>("/notifications/").then((r) => r.data.results),
    enabled,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post<Notification>(`/notifications/${id}/read/`).then((r) => r.data),
    onSuccess: () => {
      // Invalidated, not seeded: the list and the count are two separate
      // requests, and this mutation's response only carries the one
      // notification that changed.
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
    },
  });
};
