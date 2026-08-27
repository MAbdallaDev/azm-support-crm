import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { loginPathForRole, tokenStore } from "./tokenStore";

/** The single axios instance every feature imports. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

/**
 * Routes that must never trigger a refresh, matched on the request URL.
 *
 * Without this guard a wrong password 401s, the interceptor refreshes, the
 * refresh 401s, which refreshes... The login and refresh endpoints are the two
 * places a 401 means "these credentials are wrong", not "this token expired".
 */
const NO_REFRESH = ["auth/login/", "auth/refresh/"];
const isAuthRoute = (url?: string) => NO_REFRESH.some((path) => (url ?? "").includes(path));

/**
 * A module-level promise, not a boolean flag: every 401 arriving while a
 * refresh is already in flight awaits the SAME promise rather than firing its
 * own POST /auth/refresh/. Ten expired-token requests in parallel — the queue
 * tab's own concurrent fetches after an idle tab — produce one refresh call,
 * not ten, and one of the ten racing to invalidate the token first would
 * otherwise fail the other nine.
 */
let refreshing: Promise<string> | null = null;

/** Exported for tests only: no test should inherit another's in-flight state. */
export const __resetRefreshState = () => {
  refreshing = null;
};

const refreshAccessToken = (): Promise<string> => {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refresh = tokenStore.refresh;
    if (!refresh) throw new Error("no refresh token");

    // A bare axios call, not `api`: routing it through the instance would put
    // the refresh request itself under the interceptor that called it.
    const { data } = await axios.post<{ access: string }>(
      `${api.defaults.baseURL}/auth/refresh/`,
      { refresh },
      { headers: { "Content-Type": "application/json" } },
    );
    tokenStore.setAccess(data.access);
    return data.access;
  })().finally(() => {
    // Cleared win or lose. A resolved promise left here would be reused
    // forever, so the *next* expiry an hour later would retry a dead token.
    refreshing = null;
  });

  return refreshing;
};

/**
 * A hard navigation, behind a seam.
 *
 * `window.location.assign` is deliberate rather than a router `navigate`: a
 * dead session should tear the SPA down and rebuild it, so no component keeps
 * the previous user's state on screen. The indirection exists so tests can
 * observe the redirect — jsdom cannot actually navigate.
 */
export const navigation = {
  redirect(path: string) {
    if (typeof window === "undefined") return;
    if (window.location.pathname === path) return;
    window.location.assign(path);
  },
};

api.interceptors.request.use((config) => {
  const access = tokenStore.access;
  if (access && !isAuthRoute(config.url)) {
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

/** `_retried` marks a request that has already had its one replay. */
type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    const refreshable =
      error.response?.status === 401 &&
      config !== undefined &&
      !config._retried &&
      !isAuthRoute(config.url);

    if (!refreshable) return Promise.reject(error);

    let access: string;
    try {
      access = await refreshAccessToken();
    } catch {
      // Only the **refresh** failing means the session is over rather than
      // merely stale. The replay below is deliberately outside this catch: a
      // retried request that comes back 500 — or 401 again, because the new
      // token is somehow no better — is a failed request, not a dead session,
      // and signing the user out over it would be a logout on a bad gateway.
      // Read the role before clearing; it is what picks the front door.
      const path = loginPathForRole(tokenStore.role);
      tokenStore.clear();
      navigation.redirect(path);
      return Promise.reject(error);
    }

    config._retried = true;
    config.headers = { ...config.headers, Authorization: `Bearer ${access}` };
    return api.request(config);
  },
);

export type Health = { status: string; database: string };

export const getHealth = () => api.get<Health>("/health/").then((r) => r.data);
