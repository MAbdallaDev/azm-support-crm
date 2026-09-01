/**
 * The four KB categories the portal home's shortcut chips link into —
 * `backend/apps/tickets/demo_content.py`'s `KB_CATEGORIES` slugs, verbatim.
 *
 * A shared constant rather than one hardcoded list in `PortalHome.tsx` (the
 * chips) and a second in `PortalKB.tsx` (the active-filter label): the two
 * screens must agree on which slug means what, and a second copy is exactly
 * how they'd start disagreeing.
 *
 * There is no portal-facing categories endpoint to fetch this from — the
 * agent-side `/kb/categories/` list exists but sits outside the portal's own
 * trust boundary and returns an article count that includes drafts, which
 * this screen has no business exposing to a customer for four static labels.
 */
export const PORTAL_KB_CATEGORIES = [
  { slug: "billing", labelKey: "portal.shortcutBilling" },
  { slug: "technical", labelKey: "portal.shortcutTechnical" },
  { slug: "account", labelKey: "portal.shortcutAccount" },
  { slug: "getting-started", labelKey: "portal.shortcutGettingStarted" },
] as const;
