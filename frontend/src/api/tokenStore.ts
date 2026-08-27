import type { Role } from "./types";

/**
 * The one place tokens are read from and written to.
 *
 * Module state in front of localStorage, not scattered `localStorage.getItem`
 * calls: the request interceptor runs on every call and localStorage is
 * synchronous main-thread I/O, but more importantly a single pair of accessors
 * is what makes "clear the session" a one-liner that cannot miss a key.
 *
 * The **role** is cached alongside the tokens on purpose. When a refresh fails
 * the session is already invalid, so asking `/auth/me/` which login page to
 * send the user to would be a request guaranteed to 401. The cached role is
 * stale-tolerant here precisely because it only picks a redirect target.
 */

const ACCESS_KEY = "crm.access";
const REFRESH_KEY = "crm.refresh";
const ROLE_KEY = "crm.role";

export type Tokens = { access: string; refresh: string; role: Role };

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private-mode Safari and hardened browsers throw rather than return null.
    return null;
  }
};

let access: string | null = read(ACCESS_KEY);
let refresh: string | null = read(REFRESH_KEY);
let role: Role | null = read(ROLE_KEY) as Role | null;

const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* memory-only session; the app still works for this tab. */
  }
};

export const tokenStore = {
  get access() {
    return access;
  },
  get refresh() {
    return refresh;
  },
  get role() {
    return role;
  },

  hasToken: () => access !== null,

  set(next: Tokens) {
    access = next.access;
    refresh = next.refresh;
    role = next.role;
    write(ACCESS_KEY, access);
    write(REFRESH_KEY, refresh);
    write(ROLE_KEY, role);
  },

  /** After a refresh. ROTATE_REFRESH_TOKENS is False, so only access moves. */
  setAccess(next: string) {
    access = next;
    write(ACCESS_KEY, access);
  },

  clear() {
    access = null;
    refresh = null;
    role = null;
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
    write(ROLE_KEY, null);
  },
};

/** Which sign-in page a given role belongs to. Two shells, two front doors. */
export const loginPathForRole = (forRole: Role | null): string =>
  forRole === "customer" ? "/portal/login" : "/login";

/** Where a role lands when it has nowhere more specific to go. */
export const homePathForRole = (forRole: Role | null): string =>
  forRole === "customer" ? "/portal" : "/app/dashboard";
