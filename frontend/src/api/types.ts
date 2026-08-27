/**
 * The API shapes this story consumes, typed from the backend serializers
 * rather than guessed. Later stories add their own to this file.
 */

/** `backend/apps/accounts/models.py` — `User.Role`. Gates which shell you see. */
export type Role = "admin" | "manager" | "agent" | "customer";

/**
 * `MeSerializer` verbatim. Note `department` and `branch` are **code strings**
 * (`SlugRelatedField(slug_field="code")`), not nested objects — reading
 * `user.department.name` is the mistake this type exists to prevent.
 */
export type Me = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  department: string | null;
  branch: string | null;
  tier: number;
  language: "en" | "ar";
  is_available: boolean;
};

/** `LoginSerializer` response. `username` accepts a username *or* an email. */
export type LoginResponse = { access: string; refresh: string; user: Me };
export type LoginRequest = { username: string; password: string };

/** `apps/tickets/models.py` choice sets, shared by the badge components. */
export const STATUSES = [
  "new",
  "open",
  "pending",
  "on_hold",
  "escalated",
  "resolved",
  "closed",
  "reopened",
] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof PRIORITIES)[number];

export const CHANNELS = ["web", "email", "whatsapp", "sms", "chat"] as const;
export type TicketChannel = (typeof CHANNELS)[number];

/**
 * `response_sla` / `resolution_sla` on the ticket detail, verbatim — story 07
 * passes the API response straight into <SlaBar /> with no adapter.
 *
 * `seconds_remaining` is **signed**: negative means breached. It is null when
 * no policy applies, which is why both numeric fields are nullable.
 */
export type SlaState = "ok" | "approaching" | "breached";
export type Sla = {
  state: SlaState;
  seconds_remaining: number | null;
  target_minutes: number | null;
  policy_name: string;
};
