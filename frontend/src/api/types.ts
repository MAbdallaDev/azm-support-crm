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

// ---------------------------------------------------------------------------
// Story 07 — tickets, customers, AI and the agent dashboard.
//
// Every type below is transcribed from a named serializer, not invented. The
// comment naming the serializer is load-bearing: it is what lets the next
// reader check a field against its source instead of guessing.
// ---------------------------------------------------------------------------

/** DRF's `StandardPagination` envelope (page size 25, max 100). */
export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/**
 * `TicketListSerializer` — exactly what one queue row renders.
 *
 * `resolution_sla` is story 07's own addition to it, so a row and the detail
 * pane derive their countdown from the same `sla_state` call.
 */
export type TicketListRow = {
  id: number;
  number: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  customer_name: string;
  assignee_name: string;
  category_name: string;
  created_at: string;
  sla_resolution_due_at: string | null;
  is_breached: boolean;
  resolution_sla: Sla;
};

/** `TicketPersonSerializer` — a person as the detail page shows them. */
export type TicketPerson = {
  id: number;
  username: string;
  full_name: string;
  role: Role;
};

/** `CategorySerializer`. Bilingual pairs; the client picks by language. */
export type Category = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  default_priority: TicketPriority;
};

/** `TagSerializer`. */
export type Tag = {
  id: number;
  name_en: string;
  name_ar: string;
  color: string;
};

/** `TicketDetailSerializer`. `allowed_transitions` is story 07's addition. */
export type TicketDetail = {
  id: number;
  number: string;
  subject: string;
  description: string;
  customer: number;
  customer_name: string;
  customer_company: string;
  customer_tier: string;
  contact: number | null;
  contact_name: string;
  category: Category | null;
  tags: Tag[];
  priority: TicketPriority;
  status: TicketStatus;
  channel: TicketChannel;
  assignee: TicketPerson | null;
  created_by: TicketPerson | null;
  department: string | null;
  branch: string | null;
  assignment_reason: string;
  escalation_level: number;
  escalated_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_policy: number | null;
  sla_policy_name: string;
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  sla_response_breached: boolean;
  sla_resolution_breached: boolean;
  ai_summary: string;
  ai_suggested_category: Category | null;
  watcher_count: number;
  csat_score: number | null;
  is_breached: boolean;
  response_sla: Sla;
  resolution_sla: Sla;
  /**
   * The status values this ticket may move to **right now**, from
   * `ticket_service.ALLOWED_TRANSITIONS`. The dropdown is built from this —
   * never from a map transcribed client-side, which would drift silently and
   * offer moves the API then refuses.
   */
  allowed_transitions: TicketStatus[];
  created_at: string;
  updated_at: string;
};

/** `TicketMessageSerializer`. `is_internal` is a trust boundary, not a flag. */
export type TicketMessage = {
  id: number;
  ticket: number;
  author: number | null;
  author_name: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  channel: TicketChannel;
  created_at: string;
};

/**
 * `TicketEventSerializer` — the Activity log, append-only.
 *
 * `old_value` / `new_value` are **enum keys** (`on_hold`), not display text.
 * The client translates them through the existing `status.*` / `priority.*`
 * keys rather than printing them raw.
 */
export type TicketEventType =
  | "created"
  | "assigned"
  | "status_changed"
  | "priority_changed"
  | "escalated"
  | "message_added"
  | "note_added"
  | "attachment_added"
  | "resolved"
  | "reopened";

export type TicketEvent = {
  id: number;
  ticket: number;
  actor: number | null;
  actor_name: string;
  event_type: TicketEventType | string;
  field: string;
  old_value: string;
  new_value: string;
  created_at: string;
};

/** `AttachmentSerializer`. `filename` and `size` are derived server-side. */
export type Attachment = {
  id: number;
  ticket: number;
  message: number | null;
  file: string;
  filename: string;
  size: number;
  uploaded_by: number | null;
  uploaded_by_name: string;
  created_at: string;
};

/** `CannedReplySerializer`. Bilingual pairs, as-is. */
export type CannedReply = {
  id: number;
  shortcut: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category: string | null;
};

/** `ContactSerializer`, as nested in the customer detail. */
export type Contact = {
  id: number;
  customer: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  is_primary: boolean;
};

/** `CustomerDetailSerializer`. Feeds the context pane's Customer tab. */
export type CustomerDetail = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  tier: string;
  branch: number | null;
  branch_name: string;
  preferred_language: "en" | "ar";
  contacts: Contact[];
  open_ticket_count: number;
  total_ticket_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

/** `CustomerNoteSerializer`. */
export type CustomerNote = {
  id: number;
  customer: number;
  author: number | null;
  author_name: string;
  body: string;
  created_at: string;
};

/** `MySummarySerializer` — story 07's agent dashboard, in one request. */
export type MySummary = {
  my_open: number;
  breaching_within_hour: number;
  unassigned_in_department: number;
  resolved_by_me_today: number;
  awaiting_first_reply: number;
  already_breached: number;
  csat_average: number | null;
  csat_count: number;
  csat_distribution: { score: number; count: number }[];
};

/** `SummarizeResponseSerializer`. Persists `ai_summary` on the ticket. */
export type AiSummary = { ticket: number; backend: string; summary: string };

/**
 * `SuggestReplyResponseSerializer`. **Persisted nowhere** — the agent edits
 * this and sends it through the messages endpoint, which is what keeps
 * "an agent always approves" true rather than aspirational.
 */
export type AiSuggestedReply = {
  ticket: number;
  backend: string;
  suggested_reply: string;
  language: "en" | "ar";
};

// ---------------------------------------------------------------------------
// Story 08 — customer 360, knowledge base, and the two reference lists a
// dropdown needed (branches, departments).
// ---------------------------------------------------------------------------

/**
 * `CustomerListSerializer` — the `/app/customers` table.
 *
 * `last_activity` is annotated (`Max("tickets__updated_at")`), not computed
 * per row — **nullable**, because a customer with no tickets has none, and
 * the client renders a dash rather than fabricating a date.
 */
export type CustomerListRow = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  tier: string;
  branch: number | null;
  branch_name: string;
  preferred_language: "en" | "ar";
  open_ticket_count: number;
  last_activity: string | null;
  created_at: string;
};

/**
 * `CustomerAttachmentSerializer` — every file across a customer's tickets,
 * story 08's attachment chip row. Distinct from the ticket-scoped
 * `Attachment` type: this one carries `ticket_number` so a chip can name its
 * source ticket without a second lookup.
 */
export type CustomerAttachment = {
  id: number;
  ticket: number;
  ticket_number: string;
  filename: string;
  size: number;
  uploaded_by_name: string;
  created_at: string;
};

/** `BranchSerializer` / `DepartmentSerializer` — unpaginated reference lists. */
export type Branch = { id: number; code: string; name_en: string; name_ar: string };
export type Department = { id: number; code: string; name_en: string; name_ar: string };

export const KB_STATUSES = ["draft", "published"] as const;
export type KBStatus = (typeof KB_STATUSES)[number];

/** `KBCategorySerializer`. `article_count` is annotated, not computed per row. */
export type KBCategory = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  order: number;
  article_count: number;
};

/**
 * `KBArticleListSerializer` — the browse list. Bodies are deliberately
 * absent; `has_arabic` is `bool(title_ar and body_ar)`, computed on the
 * server so the client never re-derives the same rule and drifts from it.
 */
export type KBArticleListRow = {
  id: number;
  slug: string;
  title_en: string;
  title_ar: string;
  category: string | null;
  category_name: string;
  status: KBStatus;
  has_arabic: boolean;
  view_count: number;
  helpful_count: number;
  updated_at: string;
};

/** `KBArticleDetailSerializer`. */
export type KBArticleDetail = {
  id: number;
  slug: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category: string | null;
  category_name: string;
  status: KBStatus;
  author: number | null;
  author_name: string;
  has_arabic: boolean;
  view_count: number;
  helpful_count: number;
  created_at: string;
  updated_at: string;
};

/**
 * `KBArticleWriteSerializer`. **`slug` is writable and required** — the
 * editor auto-generates it from `title_en` on create and freezes it on edit,
 * since changing a slug breaks every link already inserted into a reply.
 */
export type KBArticleWrite = {
  slug: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category: number | null;
  status: KBStatus;
};
