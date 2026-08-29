/**
 * Every TanStack Query key in the app, in one object.
 *
 * The point is invalidation. `qk.tickets.detail(id)` written here once means a
 * mutation can invalidate `qk.tickets.all` and be certain it catches the list,
 * the detail and every filtered variant. Ten screens each inventing
 * `["ticket", id]` vs `["tickets", "detail", id]` is how a stale queue tab
 * happens, and it is invisible until someone notices the count is wrong.
 *
 * Stories 08–09 extend this file rather than adding keys inline.
 */
export const qk = {
  health: ["health"] as const,
  me: ["auth", "me"] as const,

  tickets: {
    /**
     * The prefix every ticket key starts with. `invalidateQueries` matches on
     * prefix, so invalidating this one catches the list, every filtered
     * variant, every detail and their sub-resources in a single call.
     */
    all: ["tickets"] as const,
    /**
     * Keyed on the **serialised query string**, so each filter combination
     * caches separately — switching tabs back and forth is instant instead of
     * refetching — while still sitting under `all` for invalidation.
     */
    list: (params: string) => ["tickets", "list", params] as const,
    detail: (id: number) => ["tickets", "detail", id] as const,
    messages: (id: number) => ["tickets", id, "messages"] as const,
    events: (id: number) => ["tickets", id, "events"] as const,
    attachments: (id: number) => ["tickets", id, "attachments"] as const,
  },

  cannedReplies: ["canned-replies"] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  agents: ["agents"] as const,

  customers: {
    all: ["customers"] as const,
    list: (params: string) => ["customers", "list", params] as const,
    detail: (id: number) => ["customers", "detail", id] as const,
    notes: (id: number) => ["customers", id, "notes"] as const,
    attachments: (id: number) => ["customers", id, "attachments"] as const,
  },

  /** A customer's contacts, for `NewTicket`'s contact picker. */
  contacts: {
    byCustomer: (customerId: number) => ["contacts", "by-customer", customerId] as const,
  },

  kb: {
    all: ["kb"] as const,
    categories: ["kb", "categories"] as const,
    list: (params: string) => ["kb", "list", params] as const,
    detail: (slug: string) => ["kb", "detail", slug] as const,
  },

  branches: ["branches"] as const,
  departments: ["departments"] as const,

  mySummary: ["reports", "my-summary"] as const,

  /** The four manager-only reports. `days` is folded into each key so a range
   *  change caches independently rather than refetching over the old data's flash. */
  reports: {
    overview: (params: string) => ["reports", "overview", params] as const,
    volume: (params: string) => ["reports", "volume", params] as const,
    agents: (params: string) => ["reports", "agents", params] as const,
    csat: (params: string) => ["reports", "csat", params] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (params: string) => ["notifications", "list", params] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },

  /** Every portal query key. Distinct namespace from `tickets`/`kb` above —
   *  `src/api/portal.ts` never imports those files, and this mirrors it. */
  portal: {
    tickets: {
      all: ["portal", "tickets"] as const,
      list: (params: string) => ["portal", "tickets", "list", params] as const,
      detail: (id: number) => ["portal", "tickets", "detail", id] as const,
      messages: (id: number) => ["portal", "tickets", id, "messages"] as const,
    },
    kb: {
      list: (params: string) => ["portal", "kb", "list", params] as const,
      detail: (slug: string) => ["portal", "kb", "detail", slug] as const,
    },
  },
} as const;
