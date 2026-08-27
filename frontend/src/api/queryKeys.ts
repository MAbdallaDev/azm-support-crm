/**
 * Every TanStack Query key in the app, in one object.
 *
 * The point is invalidation. `qk.tickets.detail(id)` written here once means a
 * mutation can invalidate `qk.tickets.all` and be certain it catches the list,
 * the detail and every filtered variant. Ten screens each inventing
 * `["ticket", id]` vs `["tickets", "detail", id]` is how a stale queue tab
 * happens, and it is invisible until someone notices the count is wrong.
 *
 * Stories 07–09 extend this file rather than adding keys inline.
 */
export const qk = {
  health: ["health"] as const,
  me: ["auth", "me"] as const,
} as const;
