# crm-mvp — plan overview

Entry point for the **crm-mvp** feature: a 2-day MVP of the AZM Squad Customer Support CRM
(Django 5 + DRF, React 19 + Vite, PostgreSQL, Docker Compose). Stories execute in order by their
`NN` prefix. Scope, stack rationale and the core-vs-deferred split live in `docs/00-project-brief.md`.

## Stories

| NN | File | Title | Tracker id | Depends on | Status |
|----|------|-------|------------|------------|--------|
| 01 | [01-story-01-foundation.md](01-story-01-foundation.md) | Foundation & scaffold | — | None | ✅ implemented |
| 02 | [02-story-02-models-admin-seed.md](02-story-02-models-admin-seed.md) | Domain models, Django admin, demo seed | — | Story 01 | ✅ implemented |
| 03 | [03-story-03-auth-rbac-audit.md](03-story-03-auth-rbac-audit.md) | Auth, roles & permissions, audit log | — | Story 02 | ✅ implemented |
| 04 | [04-story-04-customers-tickets-api.md](04-story-04-customers-tickets-api.md) | Customers & tickets REST API | — | Story 03 | ✅ implemented |
| 05 | [05-story-05-sla-kb-reports-ai-api.md](05-story-05-sla-kb-reports-ai-api.md) | SLA, knowledge base, reports, AI & portal API | — | Story 04 | ✅ implemented |
| 06 | [06-story-06-app-shell-i18n.md](06-story-06-app-shell-i18n.md) | App shell, auth flow, Arabic/English RTL | — | Stories 03, design canvas | ✅ implemented |
| 07 | [07-story-07-agent-workspace.md](07-story-07-agent-workspace.md) | Agent workspace: ticket queue & detail | — | Stories 04, 06 | ✅ implemented |
| 08 | _not yet planned_ | Customers & knowledge base UI | — | Story 07 | — |
| 09 | _not yet planned_ | Manager reports & customer portal | — | Stories 05, 08 | — |
| 10 | _not yet planned_ | Delivery: RTL sweep, docs, summary | — | All | — |

Each story's intake is at `.squad/stories/crm-mvp/<id>/intake.md`. Plans are generated one at a time
with `/squad-plan`, immediately before that story is implemented — not all ten up front, so each plan
reflects what the previous story actually produced.

## Story 01 — as built

Implemented. Delivered `backend/` (Django project `config`, seven model-free apps, environment-driven
settings with a SQLite fallback, `config/health.py`, OpenAPI schema and Swagger UI, pytest with 4
passing tests), `frontend/` (Vite 6 + React 19, Tailwind 3.4, shadcn/ui Button and Card, router,
TanStack Query, axios client, i18next `en`/`ar`, 1 passing Vitest test), and root
`docker-compose.yml`, `.env.example` and `README.md`.

Two deviations later stories should know about:

- **Vite is pinned to 6 and jsdom to 26** because the dev machine runs Node 18. Do not run
  `npm install <pkg>@latest` blindly in stories 06–10; check the Node requirement first.
- **`src/index.css` holds shadcn v3 HSL triplet tokens, not v4 `oklch` values.** The `shadcn` CLI
  emits v4 values that are invalid under the v3 `hsl(var(--x))` config it generates alongside them.
  If a later story adds components with the CLI and colours vanish, this is why. Story 06 replaces
  this block with the palette from `docs/design/DesignSystem.dc.html`.

**`docker compose up --build` is unverified** — Docker is not installed on the dev machine. The
compose file and both Dockerfiles are written and the YAML parses, but the one-command path is
untested. Story 10 must run it on a machine with Docker before hand-in.

## Story 02 — as built

Implemented. Eighteen models across `accounts` (4), `customers` (3), `tickets` (9) and `kb` (2);
`AUTH_USER_MODEL = "accounts.User"` set before the first migration; five migration files that apply
clean to an empty database, with `makemigrations --check --dry-run` reporting no pending changes.
All eighteen models registered in Django admin with real list columns, filters, search and inlines.
`manage.py seed_demo` creates 150 tickets over 90 days plus 10 customers, 18 users, a 10-article
bilingual knowledge base, 7 canned replies and 12 SLA policies — idempotent, with `--flush`.
**Verified on PostgreSQL:** 59 tests pass with nothing skipped, migrate runs clean into an empty
database, `makemigrations --check` reports no changes, and two consecutive `seed_demo` runs leave
identical counts. On the host SQLite loop, 58 pass and the concurrency test skips with its reason.

Five things later stories should know about:

- **Ticket numbering is `unique=True` plus a bounded `IntegrityError` retry**, not
  `select_for_update` and not a database sequence — the intake suggested those and the reasoning for
  rejecting all three alternatives is in a comment block above `next_ticket_number` in
  `apps/tickets/models.py`. Story 04 should not "fix" it. Supplying `number` explicitly preserves it,
  which is what `seed_demo` keys on.
- **The retry loop's backoff is load-bearing — do not simplify it away.** PostgreSQL blocks a second
  writer on the unique index until the first commits, which releases every loser at the same instant
  to recompute the same next number. Without the jittered sleep and the widening random offset on
  retries, sixteen concurrent creates exhaust the attempt budget and raise. This was a real failure
  under `docker compose exec api pytest`, invisible on SQLite; the comments in `Ticket.save()`
  explain it.
- **`accounts` has two migration files, not one.** `0001_initial` creates the models and
  `0002_initial` adds the FKs that close the circular `User ↔ customers.Customer` reference. Django
  generated the ordering itself; do not hand-edit it.
- **The intake's prose says "seventeen models"; its own list has eighteen.** `tests/test_admin_smoke.py`
  asserts all eighteen are registered.
- **The dev database volume from story 01 must be dropped once.** Story 01's container migrated
  `django.contrib.auth` before `accounts.User` existed, so an existing `pgdata` volume raises
  `InconsistentMigrationHistory: Migration admin.0001_initial is applied before its dependency
  accounts.0001_initial`. That is the expected consequence of introducing a custom user model, not a
  defect in the migrations — they apply cleanly to an empty database. The one-time fix is
  `docker compose down -v && docker compose up -d`, after which `seed_demo` populates it. Anyone
  cloning the repo fresh never sees this.

Story 03 consumes `User.role` for its permission classes and `AuditLog` for its signals; both are in
place and empty of business logic by design.

## Story 03 — as built

Implemented. JWT via SimpleJWT with `role` and `name` claims; `POST /api/v1/auth/login/` (accepting
username **or** email), `auth/refresh/`, `GET /auth/me/`. DRF denies by default; `health`, `schema`
and `docs` stay public explicitly. Access control is two modules, deliberately: six permission
classes in `apps/accounts/permissions.py` (the `ir.model.access` layer) and scoping functions plus
`ScopedQuerySetMixin` in `apps/accounts/scoping.py` (the record-rules layer). An automatic audit
trail covers Ticket, Customer, KBArticle and User, with the actor carried by thread-local middleware.
**118 tests pass on PostgreSQL** (117 + 1 skipped on host SQLite).

What stories 04 and 05 consume from this:

- **Use `ScopedQuerySetMixin`, do not filter in a list handler.** Set `scope_function` on the
  viewset. The same queryset backs retrieve, update and delete, so scoping in `get_queryset()` is
  what stops a detail route bypassing it — and why an out-of-scope detail request returns **404, not
  403**. The mixin raises `NotImplementedError` if `scope_function` is unset rather than silently
  returning unfiltered rows.
- **`scope_ticket_messages` is the internal-note boundary.** Its `.filter(is_internal=False)` for
  customers is the only check on the read path; there is no second one further down. It has a
  dedicated regression test, plus a guard test proving the fixture actually contains internal notes
  on the customer's own tickets, so the assertion cannot pass vacuously.
- **`scope_kb_articles` exists although story 03 did not require it** — story 05's portal needs
  published-only filtering, and every record rule belongs in the one module.
- **Audit is automatic; do not write `AuditLog` rows by hand in a viewset.** Signals cover create,
  update and delete. Anything bulk should run inside `audit_disabled()` — `seed_demo` already does,
  covering both its seeding and its `--flush`.
- **`REDACTED_FIELDS` and `auto_now` fields never enter `changes`.** Passwords are absent rather than
  masked, and `updated_at` is excluded because Django rewrites it on every save — without that,
  every no-op save wrote a row and "changed fields only" meant nothing.

Two deliberate deviations from the intake, both recorded in the journal: login accepts username or
email (the intake says email, the README documents the username), and the endpoint-level role matrix
is deferred to story 04, which is the first story that has endpoints to matrix.

## Story 04 — as built

Implemented. The REST API for customers and tickets: `TicketViewSet` with `messages`, `events`,
`attachments`, `assign`, `status`, `escalate` and `resolve` actions; `CustomerViewSet` with a `notes`
action; `ContactViewSet`; and read-only `categories`, `tags` and `canned-replies`. Queue filters
(`q`, `status`, `priority`, `channel`, `escalated`, `breached`, `unassigned`, date range), ordering,
and 25/100 pagination. **241 tests pass on PostgreSQL**, 240 + 1 skipped on host SQLite, and the
OpenAPI schema generates with **zero warnings**.

What story 05 and the frontend stories consume:

- **`services/ticket_service.py` is the only writer of `Ticket.status`.** Story 05's SLA and
  round-robin logic must call `transition_status` / `assign` rather than setting fields, or the
  Activity log develops holes. `InvalidTransition` is deliberately a plain exception, not a DRF one,
  so the service stays callable from management commands; the viewset translates it to a 400 at the
  boundary.
- **`breached` is derived from the stored due timestamps, not the `sla_*_breached` columns.** Nothing
  writes those yet. `filters.breached_q()` and `serializers.is_breached()` share one expression, and
  **story 05 should lift that expression into `sla_service` rather than add a third copy** — a row
  badge that disagrees with the queue tab is a bug nobody reports because it looks like a refresh
  problem.
- **`record_first_response` is a conditional UPDATE, not a read-then-write.** Do not "simplify" it to
  an `if`; two agents replying simultaneously would both see None and the later write would move the
  timestamp, flattering the SLA number story 09 reports.
- **Sub-resources are `@action(detail=True)`, not a nested router** — `drf-nested-routers` would be a
  new dependency and the stack is fixed. Follow the same pattern in story 05's portal endpoints.
- **`@extend_schema` with an explicit `request` serializer is mandatory on every `@action`.** DRF
  infers `{}` otherwise, and story 06 types its client from this schema. There are four small inline
  request serializers for exactly this reason.

One trap fixed here that later stories inherit: **the module-scoped `seed_demo` test fixtures now
roll back at teardown** (`transaction.atomic()` + `set_rollback(True)`). Previously they committed,
so seeded departments outlived the module and collided with any later fixture creating its own —
a failure that depended on file ordering. Any new module-scoped seed fixture must do the same.

## Story 05 — as built

Implemented. **The backend is complete.** SLA computed on create and derived on read; the knowledge
base API with bilingual search; four reporting aggregations; the pluggable AI service; and the
customer-portal endpoints. **347 tests pass on PostgreSQL** (346 + 1 skipped on host SQLite), and the
OpenAPI schema covers **42 endpoints with zero warnings**.

What the frontend stories consume:

- **`sla_service` owns the breach expression outright.** `filters.breached_q` and
  `serializers.is_breached` are now imports, not copies — a test asserts identity. A third definition
  anywhere is a regression.
- **`response_sla` / `resolution_sla` on the ticket detail** give story 07 everything the design's
  right-pane SLA block needs: `state` (ok / approaching / breached), a **signed**
  `seconds_remaining` so one number renders both "2h left" and "Breached 14m", `target_minutes` and
  `policy_name`.
- **`sla_state` and `breached_q` disagree about resolved tickets on purpose.** The first reports what
  happened (a late resolution reads `breached` forever, which the compliance report needs); the
  second reports what needs attention now and excludes resolved work, so the Breaching tab does not
  fill with closed tickets.
- **The portal has its own serializers and imports nothing from the agent app.** Do not "DRY" them
  together — `apps/portal/tests/test_portal_boundary.py` recurses every response by key name and will
  fail, which is the point. It also carries a not-vacuous guard so it cannot pass by the forbidden
  names having disappeared from the agent API.
- **`MockAIBackend` is deterministic per ticket and varies between tickets**, and drafts replies in
  the customer's preferred language. Story 07's AI panel can be evaluated by eye because two tickets
  visibly differ.
- **AI endpoints write only `ai_summary` and `ai_suggested_category`.** `suggest_reply` persists
  nothing — the agent edits it and sends it through story 04's messages endpoint. A snapshot test
  enforces this.
- **Reports are manager-or-admin, scope-respecting, and aggregate-only.** `?days=` is allow-listed to
  7/30/90. Durations come back as integer seconds; formatting is the client's job because it depends
  on the display language.

Two things later work must not undo:

- **The SLA hook lives in `perform_create` / `perform_update`, never a signal or `save()` override.**
  Either would fire during seeding and overwrite the deliberate breach spread.
  `test_seed_still_intact.py` exists solely to catch that, and was verified by temporarily removing
  the guard.
- **`User.last_assigned_at` was added** (migration `accounts/0003`) because rotation genuinely needs
  to remember who went last. The plan called the ordering "stateless" while naming that field — the
  field is the honest reading. Both manual and automatic assignment stamp it.

## Story 06 — as built

Implemented. The frontend shell: the axios client with a real refresh flow, the two-shell route tree
with role-aware guards, `Main.dc.html`'s top chrome, nine shared components, and a complete
Arabic/English flip. **74 Vitest tests pass**, `npm run build` and `npm run lint` are clean (2
pre-existing react-refresh warnings, 0 errors), and `npm run check:rtl` reports no directional
utilities in `src/`. The backend is untouched and still **347 passed**.

Verified against the running stack: `agent@demo` signs in and lands on `/app/dashboard` with the
health card still green; a `customer@demo` token on `/app/dashboard` is bounced to `/portal` wearing
`PortalChrome`; a corrupted access token produces **exactly one** `POST /auth/refresh/` in the
network tab followed by a successful replay; and the chrome measures 56px tall with an 18px gutter,
a 28px `#14171f` mark, a 300px search field, a 32px toggle and a 30px avatar — the artboard's own
numbers. Every badge's computed colours match `DesignSystem.dc.html` hex-for-hex.

What stories 07–09 consume:

- **`<SlaBar sla={ticket.response_sla} />` — the prop is the API object, verbatim and snake_case.**
  The plan's prose named camelCase props while its own done-criterion said the shape must match
  `response_sla` **verbatim**; verbatim won, so there is no adapter and no rename that can drift
  between the serializer and the component. `seconds_remaining` stays signed — the sign chooses the
  sentence ("2h left" vs "Breached 14m"), the magnitude fills it in. The bar ticks on its own
  `setInterval`, scoped to the component, so fifty rows do not re-render a page each second.
- **`src/api/queryKeys.ts` is the only place query keys are written.** Extend `qk`; do not invent
  `["ticket", id]` in a screen. This is what lets one mutation invalidate a list, a detail and every
  filtered variant without guessing.
- **`tokenStore` is the only reader/writer of tokens.** No `localStorage.getItem("crm.access")`
  anywhere else. It caches the **role** beside the tokens because a failed refresh has to pick a
  login page and cannot ask an API that is already rejecting it.
- **The refresh `catch` covers the refresh only, never the replay.** A retried request that comes
  back 500 is a failed request, not a dead session. The first version wrapped both and logged users
  out on any backend hiccup; `client.test.ts` has the test that caught it, and that test must keep
  passing.
- **`ProtectedRoute` is a role check, not a permission check** — it decides which shell you see, not
  what you may do inside it. Story 03's permission classes and scoping are the real boundary, and
  the frontend deliberately does not restate them. It picks its login page from the **subtree**,
  not the cached role, so a first-time visitor pasting a `/portal/*` link is not shown the agent
  sign-in page.
- **Nav items are filtered by role before render, never rendered-then-disabled** (`navItems.ts`).
  `Reports` is manager-or-admin, mirroring story 05's API rule rather than inventing a second one;
  `Admin` is a plain `<a>` to Django's `/admin/`, because a router `<Link>` there blanks the page.
- **`toast` is sonner.** One toast library; do not add a second. The shadcn primitive was skipped
  because its CLI needs Node 20 and this machine runs 18 — for the same reason `dropdown-menu`,
  `alert-dialog`, `input` and `label` are hand-written against Radix rather than CLI-generated.
- **`src/lib/format.ts` is the only caller of `Intl.*`.** Numerals stay Western in both languages by
  pinning the numbering system (`ar-u-nu-latn`), not the locale — Arabic month names, Latin digits.
  Nothing else should format a date, a duration or a number inline.
- **`.mono-ltr` is the class for ticket numbers, phone numbers and emails.** Mono, `direction: ltr`,
  `unicode-bidi: isolate` — the artboard's `<span dir="ltr">TK-4796</span>`, written once.

Three things later work must not undo:

- **`npm run check:rtl` must stay green.** No `ml-*`/`mr-*`/`pl-*`/`pr-*`/`text-left`/`text-right`/
  `left-*`/`right-*` anywhere in `src/`. It strips comments before matching, because English prose
  says "left-to-right" constantly and a guard that cries wolf is a guard people bypass; the per-line
  `rtl-ok` escape hatch exists but is used exactly once, in the test that asserts `text-right` is
  absent. Every later story's verification should run it.
- **The kitchen sink is gated at router-construction time on `import.meta.env.DEV`, not at runtime.**
  A role check would still ship the code. `npm run build` was grepped: no kitchen-sink-only string
  survives. (Its `kitchen.*` translation keys do ship, with the rest of `en.json`/`ar.json` — a few
  hundred bytes, and separating them would cost more than it saves.)
- **The language toggle applies the profile's `language` only when nothing is persisted, and never
  persists it.** Persisting a profile default makes it indistinguishable from a user's own choice,
  after which the profile can never change anything again.

Two open items story 07 inherits, both deliberate:

- **The chrome's search field is inert** — rendered so the chrome matches `Main.dc.html`, disabled so
  it cannot look broken, with a test asserting it. Wire it in story 07, where the list it filters
  exists.
- **`/app/tickets`, `/app/customers`, `/app/kb` and `/app/reports` are nav targets with no routes
  yet.** A catch-all `{ path: "*" }` **inside** each layout renders `NotFound` ("not built yet")
  with the chrome still standing — stories 07–09 add their real routes *above* that entry, which is
  all they need to do. Without the catch-all, clicking an unbuilt nav item threw React Router's own
  error page over the whole shell, which reads as a crash rather than as unfinished work.
  (`/app/profile` does have a route — a deliberate no-op placeholder, since editing a profile is
  Django admin's job in this MVP.)

One environment note: **the `web` container's `node_modules` is an anonymous volume baked from the
image**, so new dependencies need `docker compose up -d --build --renew-anon-volumes web`, not a
restart. A fresh clone never sees this — the image build reads the committed lockfile.

## Story 07 — as built

Implemented. The three-pane agent workspace (`Main.dc.html`: queue 300px / conversation flex /
context 336px), the agent dashboard, and **six backend additions**. Frontend: **145 Vitest tests**
(up from 74), `check:rtl` green, `npm run build` clean, lint 0 errors. Backend: **370 tests** (up
from 347), OpenAPI schema still **zero warnings**.

Verified against the running stack as `agent@demo`: all four queue tabs carry non-zero server-side
counts (99 / 25 / 5 / 16 under agent scoping); a `new` ticket's dropdown offers exactly *Open* and
*Escalated*, and after escalating offers *Open* and *Resolved*; every dashboard tile's number equals
the row count of the queue its link opens; and in Arabic the panes mirror (queue at x=1125, context
at x=0), `border-inline-start` resolves to the right edge, and `TK-0150` stays `dir: ltr`.

**A frontend story grew the API, and that is worth a reviewer's attention.** Each addition exists
because a criterion could not be met from the API as story 05 froze it:

- **`allowed_transitions`** on the ticket detail — the status dropdown reads the state machine
  instead of transcribing it. A client-side copy drifts silently and offers moves the API refuses.
- **`resolution_sla`** on the list serializer — one `sla_state` call feeds both a queue row and the
  detail pane, so their colours cannot diverge. Story 04's `test_queue_performance.py` still passes,
  which is the proof it is not an N+1.
- **`due_within_minutes`** — "breaching within the hour", a set deliberately **disjoint** from
  `breached=true` so two dashboard tiles never double-count one ticket.
- **`resolved_after` / `resolved_before`** — "resolved by me today".
- **`department_code`** — added *alongside* the pk-based `department`, because
  `MeSerializer.department` is a code string and the client holds no id to filter with.
- **`reports/my-summary/`** — agent-reachable, unlike the four `IsManager` reports. Four of its five
  numbers were obtainable from count queries; **`csat_average` was not**, since `csat_score` appears
  only on the detail serializer.

What stories 08–09 consume:

- **`useSecondsTick` in `src/lib/ticker.ts` is the app's only countdown timer.** One module-level
  interval, subscribed to via `useSyncExternalStore`; it starts on the first subscriber and stops on
  the last. Story 06's per-component interval and story 07's "single shared timer" were never in
  conflict — the expensive thing is a *page-level* state update, not the timer, and an external
  store gives one timer with each subscriber re-rendering only itself. **Do not add a second
  interval**; a test asserts one `setInterval` for three mounted `SlaBar`s.
- **Queue filter state lives in the URL** (`useTicketFilters`), never in component state. A filtered
  queue is a shareable link that survives reload and the back button. `tabParams` and
  `buildApiParams` are exported and pure so a tab's **badge count** and its **list** provably use the
  same filter; the badges request `page_size=1` rather than fetching 25 rows to discard them.
- **Every tab is a server filter.** Never a client-side pass over a fetched page — the page is 25 of
  150 rows, so filtering locally produces a convincing list that is simply wrong.
- **Ticket mutations seed the detail cache from their own response**, then invalidate
  `qk.tickets.all`. All six actions return the full `TicketDetailSerializer`, so refetching the
  detail afterwards is a round trip whose answer you already hold. Status/escalate/resolve are
  optimistic with a snapshot rollback and an error toast; **assign deliberately is not**, because an
  auto-assign has no predictable outcome to patch in and a 409 is a legitimate answer, not a failure.
- **The composer's mode is carried by the field itself**, not just a selected tab — the internal-note
  mode tints the textarea. This is the one control where a mistake is published to a customer. Its
  test asserts the *class actually changes*, not that a state variable flipped.
- **Drafts live in `sessionStorage`, keyed by ticket id *and* mode**, so a half-written internal note
  can never surface in the reply box. They survive navigation and are kept on a failed send — losing
  what someone just wrote is worse than any error message.
- **`src/api/attachments.ts` mirrors the backend's limits.** 10 MB and **sixteen** content types (the
  story-07 plan says eighteen; the set in `views.py` has sixteen — the code is the authority, and
  `attachments.test.ts` pins the count so an edit to either side fails there rather than at upload).
- **The Activity log renders translated sentences in the API's own newest-first order.**
  `TicketEvent.Meta.ordering` is `["-created_at"]`; do not re-sort client-side. Enum values go back
  through `status.*` / `priority.*`, and an unknown event type falls back to a generic sentence
  rather than rendering blank.
- **`src/test/apiMock.ts` stubs the axios *adapter*, not the hooks.** Everything above it runs for
  real, which is what lets a test assert *about the requests themselves* ("this count came from a
  server query"). Later registrations override earlier ones, so a test can replace a `beforeEach`
  default. `makeQueryClient` uses `gcTime: Infinity` — with `0`, a cache entry seeded by
  `setQueryData` and having no observer is collected between the write and the assertion.

Three things later work must not undo:

- **`reports/my-summary/` counts from LOCAL midnight** (`timezone.localtime`), not UTC.
  `TIME_ZONE` is `Asia/Riyadh`, so a UTC boundary starts "today" three hours late and makes the tile
  disagree with the queue its link opens. `test_resolved_by_me_today_starts_at_LOCAL_midnight`
  anchors one minute either side of the boundary and was verified to fail against the UTC version.
- **`check:rtl` now strips comments with a stateful block-comment scan**, because a JSX block
  comment's continuation lines begin with ordinary prose — and English prose says "left-to-right"
  constantly. Still verified to catch a planted `ml-2 text-right`.
- **`formatDuration` translates its unit letters** (`h`/`m`/`d` → `س`/`د`/`ي`) while digits stay
  Western. It is the number an agent looks at most and was the last visibly English thing on an
  otherwise flipped screen.

Story 06's two open items are both closed: the chrome's search field is wired (it writes `q` into the
queue's URL parameter, debounced 300 ms), and `/app/tickets` and `/app/tickets/:id` are real routes
above the in-layout catch-all. `/app/customers/:id` is linked from the context pane and still renders
"not built yet" until story 08.

## Dependency notes

**Day 1 is stories 01–05 (backend); day 2 is 06–10 (frontend).**

Story 01 creates the seven Django apps (`accounts`, `customers`, `tickets`, `kb`, `ai`, `reports`,
`portal`) with **empty** `models.py` files. Story 02 fills them in a single migration pass and sets
`AUTH_USER_MODEL` — which is why story 01 must **not** set it, and why the app names are fixed in
story 01's plan rather than chosen later.

Story 03 delivers permission classes and `get_queryset()` scoping helpers; stories 04, 05 and the
portal endpoints consume them rather than writing their own access logic. This is the DRF equivalent
of Odoo's two-layer `ir.model.access` plus record rules, and having only the first layer is the
failure mode the story 03 plan calls out explicitly.

Story 05 is the last backend story: after it the API is complete and day 2 is purely frontend.

Story 06 established the shared component vocabulary (`DataTable`, `StatusBadge`, `PriorityBadge`,
`ChannelBadge`, `SlaBar`) and the no-directional-utility rule — now enforced by
`frontend/scripts/check-rtl.mjs` — that makes the Arabic RTL flip a translation pass in story 10
rather than a rescue. Stories 07–09 assemble from that vocabulary; read story 06's "as built"
section above before starting 07, the way this plan read story 05's.

Frontend stories 06–09 each carry the relevant design artboards in their `attachments/` folder.
Squad-kit's planner reads only the intake and its attachments, so those files must stay attached —
a linked-but-not-attached design is invisible to it.

## Phase 2

Deferred work (real email/WhatsApp/SMS/chat transports, RAG chatbot, automation rule builder,
Odoo ERP connector, multi-tenancy, custom report builder) lands under a separate `crm-advanced`
feature slug starting at NN 11. See `docs/00-project-brief.md` part B.
