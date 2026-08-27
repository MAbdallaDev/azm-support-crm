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
| 04 | [04-story-04-customers-tickets-api.md](04-story-04-customers-tickets-api.md) | Customers & tickets REST API | — | Story 03 | ✅ implemented | ✅ implemented |
| 05 | [05-story-05-sla-kb-reports-ai-api.md](05-story-05-sla-kb-reports-ai-api.md) | SLA, knowledge base, reports, AI & portal API | — | Story 04 | — |
| 06 | _not yet planned_ | App shell, auth flow, Arabic/English RTL | — | Stories 03, design canvas | — |
| 07 | _not yet planned_ | Agent workspace: ticket queue & detail | — | Stories 04, 06 | — |
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

Story 06 establishes the shared component vocabulary (`DataTable`, `StatusBadge`, `PriorityBadge`,
`ChannelBadge`, `SlaBar`) and the no-directional-utility rule that makes the Arabic RTL flip a
translation pass in story 10 rather than a rescue. Stories 07–09 assemble from that vocabulary.

Frontend stories 06–09 each carry the relevant design artboards in their `attachments/` folder.
Squad-kit's planner reads only the intake and its attachments, so those files must stay attached —
a linked-but-not-attached design is invisible to it.

## Phase 2

Deferred work (real email/WhatsApp/SMS/chat transports, RAG chatbot, automation rule builder,
Odoo ERP connector, multi-tenancy, custom report builder) lands under a separate `crm-advanced`
feature slug starting at NN 11. See `docs/00-project-brief.md` part B.
