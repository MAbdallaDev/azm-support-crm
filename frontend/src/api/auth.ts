import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "./client";
import { qk } from "./queryKeys";
import { loginPathForRole, tokenStore } from "./tokenStore";
import type { ChangePasswordRequest, LoginRequest, LoginResponse, Me, MeUpdateRequest } from "./types";

/**
 * Sign in.
 *
 * The login response already carries the full MeSerializer payload, so it is
 * seeded straight into the `qk.me` cache. A second GET /auth/me/ here would be
 * a round trip that can only return what we are already holding.
 */
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: LoginRequest) =>
      api.post<LoginResponse>("/auth/login/", body).then((r) => r.data),
    onSuccess: (data) => {
      tokenStore.set({ access: data.access, refresh: data.refresh, role: data.user.role });
      queryClient.setQueryData(qk.me, data.user);
    },
  });
};

/**
 * The current user. `enabled` keeps it from firing on the public login screen,
 * where there is no token and the call could only 401.
 */
export const useMe = () =>
  useQuery({
    queryKey: qk.me,
    queryFn: () => api.get<Me>("/auth/me/").then((r) => r.data),
    enabled: tokenStore.hasToken(),
    // A 401 here means the interceptor already tried to refresh and lost.
    // Retrying would just repeat that. Anything else is worth one retry.
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      return status !== 401 && failureCount < 1;
    },
  });

/**
 * Update `phone`/`language` — the only two fields of `Me` a user may change
 * about themselves.
 *
 * The response is the full `MeSerializer` shape (the backend always returns
 * it after a PATCH, never the narrower write-serializer echo), so it is safe
 * to seed `qk.me` directly from it — the same "write serializer in, detail
 * serializer out" rule story 08's cache-poisoning bugs established. Seeding
 * from a PATCH that returned only `{phone, language}` would have erased
 * every other field the rest of the app reads off `useMe()`.
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MeUpdateRequest) =>
      api.patch<Me>("/auth/me/", body).then((r) => r.data),
    onSuccess: (data) => queryClient.setQueryData(qk.me, data),
  });
};

/** No response body to seed anything from — success just means "it changed." */
export const useChangePassword = () =>
  useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.post("/auth/change-password/", body),
  });

/**
 * Sign out. Clears tokens, empties the query cache (so the next user in this
 * tab cannot see the previous one's rows flash before their own load), and
 * returns to the login page that matches the role being signed out of.
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return () => {
    const path = loginPathForRole(tokenStore.role);
    tokenStore.clear();
    queryClient.clear();
    navigate(path, { replace: true });
  };
};
