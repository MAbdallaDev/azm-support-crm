import type { Role } from "@/api/types";

/**
 * The agent/manager navigation, as data.
 *
 * An array filtered by role before render — **not** rendered-then-disabled.
 * A greyed-out "Reports" tells an agent the feature exists and that they are
 * not trusted with it; absent is the honest and quieter answer, and it is what
 * the story's criterion 7 asks for.
 *
 * `external: true` leaves the SPA (Django admin), so it renders as an `<a>`
 * rather than a router `<Link>` — a `<Link>` there would push a client route
 * that has no match and blank the page.
 */
export type NavItem = {
  key: string;
  labelKey: string;
  to: string;
  roles: readonly Role[];
  external?: boolean;
};

const STAFF: readonly Role[] = ["admin", "manager", "agent"];
const MANAGERS: readonly Role[] = ["admin", "manager"];

/** Strips the `/api/v1` suffix off VITE_API_URL to reach Django's own root. */
export const adminUrl = (): string => {
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
  return `${base.replace(/\/api\/v1\/?$/, "")}/admin/`;
};

export const appNavItems = (): readonly NavItem[] => [
  { key: "dashboard", labelKey: "nav.dashboard", to: "/app/dashboard", roles: STAFF },
  { key: "tickets", labelKey: "nav.tickets", to: "/app/tickets", roles: STAFF },
  { key: "live-chat", labelKey: "nav.liveChat", to: "/app/live-chat", roles: STAFF },
  { key: "customers", labelKey: "nav.customers", to: "/app/customers", roles: STAFF },
  { key: "kb", labelKey: "nav.kb", to: "/app/kb", roles: STAFF },
  // Reports are manager-or-admin on the API too (story 05); this mirrors that
  // rather than inventing a second rule.
  { key: "reports", labelKey: "nav.reports", to: "/app/reports", roles: MANAGERS },
  { key: "admin", labelKey: "nav.admin", to: adminUrl(), roles: ["admin"], external: true },
];

export const portalNavItems = (): readonly NavItem[] => [
  { key: "requests", labelKey: "nav.portalRequests", to: "/portal", roles: ["customer"] },
  { key: "articles", labelKey: "nav.portalArticles", to: "/portal/kb", roles: ["customer"] },
];

export const visibleNavItems = (items: readonly NavItem[], role: Role | undefined) =>
  role === undefined ? [] : items.filter((item) => item.roles.includes(role));
