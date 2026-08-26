# AI usage journal

One entry per story, written **while the work is fresh** — not reconstructed at the end.
This file is the raw material for `docs/SUMMARY.md`, the final hand-in document.

Template for every entry:

```markdown
## Story NN — <title>          (elapsed: Xh Ym)
**What I asked for:** one or two sentences.
**What the AI built:** the files created or changed, and what each does.
**Decisions the AI made on its own:** and why.
**What I had to correct:** what went wrong and how it was fixed.
**What I learned:** the Odoo-vs-Django difference or new concept this story surfaced.
```

**Rule: no story is finished until its entry is written here.**

---

## Story 00 — Planning, scope split, and design canvas          (elapsed: —)

**What I asked for:** Read the company's requirements PDF, recommend a stack suited to an Odoo
developer, split the twelve feature areas into a core MVP and an advanced phase, break the MVP into
several squad-kit stories rather than one, and produce a design so I can see what the product looks
like.

**What the AI built:**

- `docs/00-project-brief.md` — stack rationale, the Odoo→Django concept map, the core-versus-advanced
  split across all 12 requirement areas, the 10-story map, and how the four grading criteria are met.
- `.squad/` — a squad-kit workspace for this project, with 10 story intakes under
  `stories/crm-mvp/`, each carrying its own description, acceptance criteria, dependencies,
  out-of-scope list, and attachments.
- `docs/design/` — 12 `.dc.html` artboards covering every screen, plus `canvas.json` and the
  published canvas at https://claude.ai/code/artifact/217bc985-1f5c-4817-af6c-4aaacbda09a9
- `docs/AI_USAGE.md` — this file.

**Decisions the AI made on its own:**

- *Recommended FastAPI first, then accepted Django when I chose it* — and agreed Django was the
  better call once the timeline was fixed at two days, because `contrib.auth` and Django admin
  remove two to three stories of work.
- *Django admin is the product's back-office.* No React screens for users, roles, branches,
  categories, SLA policies or the audit log. This is the single largest time saving in the plan.
- *SLA needs no scheduler.* Due timestamps are computed on create; breach and escalation state are
  derived on read. No Celery, no APScheduler, no background worker in the MVP.
- *Email, WhatsApp, SMS and live chat became channel labels rather than transports*, behind a
  common abstraction. Real transports need paid accounts and platform review, which do not fit in
  two days.
- *A minimal SLA stayed in scope* even though I did not select it, because it is core area 5 in the
  requirements and costs under an hour. Flagged for me to drop if I disagreed.
- *Typography set to IBM Plex Sans / Plex Sans Arabic / Plex Mono*, because Arabic is a hard
  requirement and needed a family with a genuine Arabic cut.
- *Arabic flips completely, chrome included.* My own first design draft left the top chrome in
  English/LTR and raised it as an open question; the AI decided a half-flipped header reads as a bug
  to an Arabic reviewer.
- *The design artboards were attached to the story intakes as files*, not linked, because
  squad-kit's planner reads only the intake and its `attachments/` folder — a linked design would
  have been invisible to it.

**What I had to correct:**

- The first plan assumed 2–3 weeks and 12 stories; I set the real timeline at 2 days and it was
  re-scoped to 10 stories.
- The first stack recommendation was FastAPI; I chose Django + DRF.
- The AI initially left `docs/00-project-brief.md` recommending FastAPI throughout while the plan had
  moved to Django. I caught it, and the whole file was rewritten rather than patched in one row.
- The AI planned to write this journal at the end of the project. I pointed out that my company
  grades on understanding what happened *during* implementation, so it became a per-story rule.

**What I learned:**

- The Odoo→Django mapping that makes the rest of this project readable: `models.Model` →
  `django.db.models.Model`; `ir.model.access` and record rules → DRF permission classes plus
  `get_queryset()` scoping — **two layers, and only having the first is the classic mistake**;
  `mail.thread` chatter → `TicketMessage` + `TicketEvent`; Odoo's backend list/form views → Django
  admin; `ir.cron` → a management command.
- Spec-driven development front-loads the arguing. Every decision that would otherwise have been
  made mid-implementation — status transitions, what the portal may never expose, where SLA is
  computed — is settled in an intake file before a line of code exists.

---

## Story 01 — Foundation & scaffold          (elapsed: 0h 22m)

**What I asked for:** Implement the generated plan at
`.squad/plans/crm-mvp/01-story-01-foundation.md` — turn the empty repository into a dockerized
Django 5 + DRF API and a React 19 + Vite frontend shell, with no domain models and no business logic.

**What the AI built:**

- `backend/` — Django project `config` with `manage.py` at the backend root; seven registered but
  model-free apps under `apps/` (`accounts`, `customers`, `tickets`, `kb`, `ai`, `reports`,
  `portal`), each with an `AppConfig` whose `name` is the dotted path; `config/settings.py` reading
  every environment-specific value from the environment with a SQLite fallback;
  `config/health.py` with a real database round-trip; `config/urls.py` wiring admin, health,
  the OpenAPI schema and Swagger UI; `pytest.ini`; `tests/test_health.py` with four tests;
  `Dockerfile` and `.dockerignore`.
- `frontend/` — Vite + React 19 + TypeScript, Tailwind 3.4, shadcn/ui with Button and Card,
  React Router with `/login` and `/app/dashboard`, a `QueryClientProvider` at the root,
  `src/api/client.ts` reading `VITE_API_URL`, i18next initialised from `en.json` and `ar.json`,
  one Vitest test, `Dockerfile` and `.dockerignore`.
- Root — `docker-compose.yml` (`db` / `api` / `web`, with the api gated on a genuine Postgres
  healthcheck), `.env.example` documenting all ten variables, `README.md` with a followable
  quickstart, and appended `.gitignore` entries.

**Decisions the AI made on its own:**

- *Caught and fixed a broken shadcn/ui theme before I ever saw it.* The `shadcn` CLI wrote
  Tailwind-v4-style `oklch(...)` values into `src/index.css` while the v3 `tailwind.config.js` it
  generated in the same run consumes them as `hsl(var(--background))` — which compiles to the
  invalid `hsl(oklch(1 0 0))`, so every themed colour would have silently rendered as nothing.
  Replaced the block with v3 HSL triplets. It also emitted `destructive` as a flat colour while
  `button.tsx` uses `text-destructive-foreground`, so that class did not exist; restored the
  `DEFAULT`/`foreground` pair. Both are the kind of bug you only find by checking computed styles,
  not by seeing the build pass — the build passed either way.
- *Pinned Vite to 6 and jsdom to 26.* This machine has Node 18. The current Vite and the jsdom that
  npm resolved both require Node 20+, and jsdom 30 failed at runtime with `ERR_REQUIRE_ESM`.
  The pinned versions run on Node 18 here and on Node 22 in the container, so the project is not
  hostage to one machine's Node version.
- *Caught `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` and
  `src/lib/utils.ts` missing.* The shadcn `init` aborted at an interactive React-19 peer-dependency
  prompt after writing its config files but before installing anything. Installed them and wrote
  `utils.ts` by hand.
- *Broadened the health check's exception from `OperationalError` to `django.db.Error`.* With
  `conn_max_age=600` Django holds a persistent connection; when Postgres stops, the dead cached
  connection can surface as `InterfaceError` rather than `OperationalError`, which would have
  escaped the handler and returned a 500 instead of the specified 503.
- *Added a test for the 503 branch.* The plan only tested the happy path, leaving the "not a
  constant" requirement verifiable by hand but not by CI.
- *Deleted the generated per-app `tests.py`* — `pytest.ini` collects `test_*.py`, so those files
  would never have run and would have read as dead scaffolding.

**What I had to correct:**

- I told it mid-run to keep narrating in plain language so I could follow along, and not to commit
  anything until I had reviewed the work. Nothing is committed; all 88 files sit in the working tree.
- Nothing else needed correcting — but one acceptance criterion could not be *executed*:
  **Docker is not installed on this machine**, so `docker compose up --build` was never run.
  The compose file and both Dockerfiles are written and the YAML parses, but they are unverified.
  Everything else was verified by running it: 4 backend tests, 1 frontend test, a clean production
  build, the live 200 and a real 503 against an unreachable Postgres, correctly scoped CORS headers,
  and the dashboard rendering live health data in a browser with computed styles checked.

**What I learned:**

- Django's `runserver` calls `check_migrations()` at startup, so it will not boot at all against a
  dead database — the health endpoint's 503 path only exists for a database that dies *while the
  process is already up*. That is exactly the reviewer's scenario (`docker compose stop db`), but it
  means "start the server with no database and curl it" is not a valid way to test it. Odoo behaves
  the opposite way: it starts fine and fails per-request.
- A Django *app* is not an Odoo *module*. It has no manifest, no dependency declaration and no
  install state — `INSTALLED_APPS` is the whole registry, and when an app lives inside a package
  its `AppConfig.name` must be the full dotted path or Django cannot find its models. There is no
  `__manifest__.py` doing that work for you.
- Odoo's `ir.config_parameter` lives in the database; Django's equivalent lives in the environment
  and is read once at import time. That is why `DATABASE_URL` can select the database engine itself,
  something an in-database setting could never do.

### Addendum — Docker verified after the fact (elapsed: +0h 18m)

The entry above closed with one criterion unexecuted: Docker was not installed, so
`docker compose up --build` had never run. Docker was installed afterwards and story 01's full
verification section was executed for real. **It found a defect that only running it could find.**

**The bug:** `docker-compose.yml` published the database on host port `5432`. This machine already
runs a local PostgreSQL 16 cluster on 5432 — the Odoo development database — so the `db` container
failed to start outright: *failed to bind host port 0.0.0.0:5432/tcp: address already in use*. Any
reviewer with PostgreSQL installed hits this on their very first command, which is precisely the
"loses on first impression" failure story 01 was written to prevent.

**The fix:** the mapping is now `127.0.0.1:${POSTGRES_PORT:-5433}:5432`, with `POSTGRES_PORT`
documented in `.env.example`. Two improvements in one line — the default moves off the port a local
PostgreSQL owns, and the bind is restricted to loopback so the database is not exposed on the LAN.
Nothing in the application is affected: the api reaches the database at `db:5432` over the compose
network, which never touched the host port. **The local Odoo PostgreSQL was left running and
untouched throughout** — the container moved, not Odoo.

**Verified after the fix**, all seven steps of the plan's verification section:

| Step | Result |
|---|---|
| Stack up | three containers; `api` waited on the db healthcheck before starting |
| Health 200 | `{"status":"ok","database":"ok"}` |
| **Health 503** | `docker compose stop db` → `{"status":"degraded","database":"unavailable"}`, HTTP 503 — **not** 500 |
| Recovery | `docker compose start db` → back to 200 |
| Swagger / schema / admin | 200 / 200 / 302 |
| CORS | `access-control-allow-origin: http://localhost:5173` |
| Backend tests | 4 passed |
| Frontend build + tests | clean production build, 1 test passed |

**What I learned:** the 503 assertion is what justified broadening the exception to
`django.db.Error`. Under Docker the api holds a pooled connection (`conn_max_age=600`); when Postgres
stops, that dead cached connection does not necessarily raise `OperationalError` — the narrower catch
the plan originally specified could have let it escape and returned a 500. The test suite passed
either way, because the test monkeypatches the cursor rather than killing a real socket. Only
stopping an actual container proved the real behaviour.

**Also learned, the practical one:** two of my own leftover dev processes (a `manage.py runserver` on
8000 and a Vite server on 5173) blocked the containers from binding. Docker and a local dev loop
compete for the same ports — pick one at a time.

---

## Story 02 — Domain models, Django admin, demo seed          (elapsed: ~45m)

**What I asked for:** implement the generated plan for story 02 — define the whole data model in one
migration pass, register every model in Django admin as a real back-office rather than a debug aid,
and write a `seed_demo` command that fills the database with credible bilingual demo data.

**What the AI built:**

- `backend/apps/accounts/models.py` — `Department`, `Branch`, `User` (an `AbstractUser` carrying
  `role`, `department`, `branch`, `tier`, `language`, `is_available` and a nullable `customer` FK for
  portal logins), and an append-only `AuditLog`.
- `backend/config/settings.py` — `AUTH_USER_MODEL = "accounts.User"`, replacing story 01's
  placeholder comment. Done **before** the first `makemigrations`, which is the one ordering
  constraint in this story that cannot be fixed afterwards.
- `backend/apps/customers/models.py` — `Customer`, `Contact`, `CustomerNote`.
- `backend/apps/tickets/models.py` — the shared `Priority` / `Status` / `Channel` vocabularies, then
  `Category`, `Tag`, `SLAPolicy`, `CannedReply`, `Ticket`, `TicketMessage`, `TicketEvent`,
  `Attachment`, `CSATRating`.
- `backend/apps/kb/models.py` — `KBCategory`, `KBArticle`.
- Five migration files (`accounts` needs two — see below), migrating clean from an empty database.
- Four `admin.py` files covering all eighteen models, with `list_display`, `list_filter`,
  `search_fields`, `ordering`, message and attachment inlines on `Ticket`, contact and note inlines
  on `Customer`, readonly system fields, and `list_select_related` / `prefetch_related` on the
  changelists that would otherwise issue a query per row.
- `backend/apps/tickets/demo_content.py` — the bilingual corpus: ten KB articles, seven canned
  replies, ten customers, contacts, notes, conversation fragments. Every Arabic string is written
  Arabic, not machine-translated placeholder text.
- `backend/apps/tickets/management/commands/seed_demo.py` — 150 tickets over 90 days, all 5 channels,
  all 8 statuses, all 4 priorities, an SLA spread computed against `timezone.now()`, conversation
  threads mixing public replies and internal notes, an event trail, and CSAT on ~60 % of the
  resolved and closed tickets. Idempotent, with `--flush`.
- Tests: `apps/tickets/tests/test_numbering.py`, `apps/tickets/tests/test_seed_demo.py`,
  `backend/tests/test_admin_smoke.py`. **59 passing on PostgreSQL**; 58 passing and 1 skipped on the
  host SQLite loop, the skip being the concurrency test SQLite cannot run.
- `README.md` — a Demo data and logins section, and the two-command test story.

**Decisions the AI made on its own:**

- *Ticket numbering does not use `select_for_update` or a database sequence*, which is what the
  intake suggested. A counter row would need a nineteenth model against an intake that says "exactly
  these models, no more"; locking the last `Ticket` row instead is gap-prone under READ COMMITTED;
  and a Postgres sequence would break the SQLite fallback story 01 built. What is used is
  `unique=True` on `number` plus a bounded retry on `IntegrityError` — the constraint is what
  actually guarantees "never reused", and the loop only handles the collision. The retry re-raises
  immediately unless a ticket with that exact number now exists, so a bad FK does not get retried
  nine times and then reported as a numbering failure. The reasoning is in a comment block in the
  model file so it does not read as having overlooked the intake.
- *`TicketEvent` is not an inline on `TicketAdmin`.* The activity log is append-only and long; it
  gets its own read-only changelist instead of bloating every ticket form. Same treatment for
  `AuditLog` — `has_add_permission` and `has_change_permission` both return `False`, because an
  audit trail that can be edited is not an audit trail.
- *Twelve SLA policies rather than the four the plan asked for as a minimum.* The model has a unique
  constraint on `(customer_tier, priority)` and there are exactly twelve such pairs; filling all of
  them means every seeded ticket resolves to a real policy instead of some falling through to a
  hard-coded default. The four names the design shows — `Enterprise-P1`, `Premium-P1`,
  `Enterprise-Normal`, `Standard-Normal` — are among them.
- *Idempotency is implemented as delete-and-rebuild for ticket children*, not as matching on message
  bodies. Messages and events have no natural key, so the command clears a ticket's thread and
  regenerates it from the seeded RNG. Counts stay identical across runs — which is what the test
  asserts — and the timestamps get recomputed against a fresh `now`.
- *A portal login is created for every customer, not just `customer@demo`.* Tickets on the `web`
  channel need an author who is not a member of staff, and "created by nobody" would have looked
  like a bug in story 07's UI.

**What I had to correct:**

- **The first seed produced 39 breached tickets out of 150 — a 26 % breach rate.** The cause was
  structural rather than a typo: ticket age was spread over 90 days independently of status, so a
  ticket created 60 days ago could still be `open` against a 24-hour resolution target and was
  therefore breached by arithmetic. The fix pulls still-open tickets forward so most sit comfortably
  inside their window, while deliberately letting roughly one in eight breach naturally — the
  Breaching tab should not consist solely of the four tickets pinned for the demo. Resolved and
  closed tickets keep the full 90-day spread, which is what story 09's report actually charts.
- **The plan's assignment split did not survive contact with the data.** It asked for roughly a
  third of tickets assigned and the rest unassigned. But two thirds of a 90-day queue is resolved
  and closed work, and a resolved ticket with no owner is not believable — it would also have made
  the agent-performance report meaningless. The rule implemented instead: `new` is never assigned,
  half of the live statuses are left unassigned, and everything resolved or closed has an owner.
  That lands at 22 unassigned tickets, enough to populate the Unassigned tab honestly.
- **`--flush` failed its own test.** pytest-django forces `DEBUG=False`, and the command refuses to
  flush in that state by design. The test now opts back in explicitly via the `settings` fixture
  rather than the guard being weakened to make the test pass.
- **The plan says four `0001_initial` migrations; `accounts` produced two files.** That is Django
  resolving the circular `User ↔ customers.Customer` reference — `0001_initial` creates the models
  and `0002_initial` adds the FKs that close the cycle. The plan explicitly says not to hand-edit
  the swappable-dependency ordering, so the extra file was left as generated.
- **The intake says "seventeen models"; there are eighteen.** Counted from its own list. The admin
  smoke test asserts all eighteen are registered and the miscount is noted in its docstring.
- **The concurrency test failed the moment it ran against real PostgreSQL — and it was a genuine
  bug, not a flaky test.** The first pass of this story was verified only on the host SQLite loop,
  because this account was not yet in the `docker` group; the 50-thread numbering test skipped
  itself with a printed reason rather than passing without racing. Once Docker access was granted
  the test ran and blew up with `duplicate key value violates unique constraint`, escaping the retry
  loop entirely.

  The cause: PostgreSQL blocks a second writer on a unique index until the first commits, so **every
  loser wakes at exactly the same instant, re-reads the same `MAX(number)` and computes the same
  next value.** Only one thread can win per round, so sixteen concurrent creates need up to fifteen
  retries — and the budget was ten. The whole attempt allowance was being spent on lockstep rather
  than on progress.

  Two changes fixed it. A **jittered backoff** staggers the wake-ups so losers pick up each other's
  committed rows instead of colliding again, and **retries after the first draw from a widening
  random window** rather than all fighting over one slot — fifty losers spread across fifty slots
  almost all succeed. The budget went from 10 to 25. The trade is an occasional gap in the sequence
  under heavy load, which is acceptable: the requirement is that a number is never *reused*, and a
  PostgreSQL sequence would leave gaps too. Attempt 0 still takes the next number exactly, so a
  quiet system numbers TK-0001, TK-0002, TK-0003 with no gaps at all.

  Verified afterwards: **59 passed, 0 skipped on PostgreSQL** (the concurrency test running for
  real), 58 passed 1 skipped on host SQLite, and a throwaway 120-create / 50-thread stress run
  produced 120 distinct numbers three times over.

**What I learned:**

- **`auto_now_add` cannot be set on create, and that shapes the whole seed.** In Odoo you assign
  `create_date` in the `create()` values and move on. Django's `auto_now_add` overwrites whatever
  you pass, so backdating means writing the row first and then
  `Ticket.objects.filter(pk=…).update(created_at=…)` — `update()` goes straight to SQL and skips the
  field's `pre_save`. Every one of the ~150 tickets, ~690 messages and ~700 events is backdated that
  way.
- **A seed with hard-coded dates rots silently.** It looks right the day it is written and, a week
  later, shows every ticket breached. Deriving every timestamp from `timezone.now()` at run time is
  what makes `seed_demo` still demo-ready whenever the reviewer runs it — and it is why idempotency
  had to be defined as stable *identities* rather than stable rows.
- **`random.Random(seed)` as an instance, not `random.seed()`.** The global module RNG is shared
  process-wide; seeding it from a management command changes behaviour anywhere else in the process
  that uses `random`. A seeded instance gives reproducible data without that side effect.
- **A skipped test is a debt, not a pass — and this one came due immediately.** Skipping the
  concurrency test on SQLite was the honest call, but it meant the single most load-bearing piece of
  logic in the story was unverified while everything around it was green. The bug it was written to
  catch was sitting there the whole time. Sixty-odd green tests said nothing about the one thing
  that actually needed proving.
- **PostgreSQL's unique-index blocking is a synchroniser, not just a guard.** I had assumed a
  collision would scatter the losers. It does the opposite: it holds them all until the winner
  commits and then releases them together, perfectly in step. Any retry loop that recomputes from
  the current maximum has to break that lockstep deliberately, which is what the jitter and the
  widening window are for. This is invisible on SQLite because it serialises writes and the race
  never happens.
- **The Odoo→Django admin mapping is closer than expected but inverted in one place.** Odoo generates
  a list and form view from the model and you subtract from them with XML. Django gives you nothing
  by default and you add columns, filters and search fields explicitly — which is why `list_display`
  and `search_fields` are a *feature* here rather than tidying. The N+1 that Odoo's ORM prefetches
  away automatically is also manual: `list_select_related` plus a `get_queryset` prefetch is the
  difference between 25 queries and several hundred on a 25-row page, and there is now a test
  pinning it.

---

## Story 03 — Auth, roles & permissions, audit log          (elapsed: ~20m)

**What I asked for:** implement the generated plan for story 03 — wire JWT authentication, build
role-based access control as two distinct layers, and add an automatic audit trail.

**What the AI built:**

- `backend/config/settings.py` — `JWTAuthentication` as the default authenticator and
  `IsAuthenticated` as the default permission, so the API denies by default. A `SIMPLE_JWT` block
  with env-driven lifetimes, and `CurrentActorMiddleware` registered after `AuthenticationMiddleware`.
- `backend/apps/accounts/serializers.py` — `LoginSerializer` (adds `role` and `name` claims to the
  token, resolves username *or* email) and `MeSerializer`.
- `backend/apps/accounts/views.py`, `urls.py` — `POST /api/v1/auth/login/`, `auth/refresh/`,
  `GET /auth/me/`.
- `backend/apps/accounts/permissions.py` — six classes: `IsAdmin`, `IsManager`, `IsAgent`,
  `IsCustomer`, `IsAgentOrAbove`, `IsOwnerOrAgentOrAbove`. This is the `ir.model.access` layer.
- `backend/apps/accounts/scoping.py` — `scope_tickets`, `scope_customers`, `scope_ticket_messages`,
  `scope_kb_articles`, plus `ScopedQuerySetMixin`. This is the record-rules layer.
- `backend/apps/accounts/middleware.py` — thread-local actor, cleared in a `finally`.
- `backend/apps/accounts/audit.py` — `pre_save`/`post_save`/`post_delete` handlers over Ticket,
  Customer, KBArticle and User; `REDACTED_FIELDS`; `audit_disabled()`; login and failed-login events.
  Connected from `AccountsConfig.ready()`.
- `seed_demo` wrapped in `audit_disabled()`.
- Tests: `test_auth.py` (11), `test_permissions.py` (23), `test_scoping.py` (14), `test_audit.py` (11).
  **118 passing on PostgreSQL**, 117 + 1 skipped on host SQLite.

**Decisions the AI made on its own:**

- *`auto_now` fields are excluded from the audit diff, alongside the redacted ones.* This was not in
  the plan and only surfaced when a test failed — see below.
- *`scope_customers` lets staff with no branch see everything, while a customer with no linked
  `Customer` sees nothing.* Branch is an organisational convenience, so an unconfigured agent should
  be inconvenienced rather than locked out; a customer's link is a security boundary, so it fails
  closed. The two cases genuinely differ and the module says why.
- *Added `scope_kb_articles`, which the plan did not ask for.* Story 05's portal needs published-only
  filtering, and putting it beside the other three keeps every record rule in one module rather than
  having one live in a viewset later.
- *`ScopedQuerySetMixin` raises `NotImplementedError` when `scope_function` is unset* rather than
  quietly returning the unfiltered queryset. A silent unscoped queryset on a view that advertises
  itself as scoped is the exact failure this story exists to prevent.
- *Login auditing lives in the view, not the serializer.* Only the view knows the final outcome — a
  401 raised during validation never reaches the serializer's return path.
- *Lengthened the development `SECRET_KEY` default by one word.* It was 31 bytes, and PyJWT warns
  below 32 for HMAC-SHA256, so every token operation emitted an `InsecureKeyLengthWarning`. Real
  deployments override it anyway, but a warning that fires constantly in dev is a warning nobody
  reads when it matters.

**What I had to correct:**

- **The audit log recorded a change on every save, including saves that changed nothing.** Two tests
  failed together: an update to `priority` reported `{"priority", "updated_at"}` rather than just
  `priority`, and a bare `ticket.save()` wrote a row. The cause is that `updated_at` is `auto_now=True`,
  so Django rewrites it on *every* save — which meant "changed fields only" never actually meant
  anything, and the log would have grown on no-op saves. Fixed by skipping `auto_now` fields in the
  diff for the same reason `last_login` was already excluded. Nothing is lost: the `AuditLog` row
  carries its own `created_at`.
- **`is_authenticated` cannot be assigned on a `User`** — it is a read-only property. The
  "authenticated but role-less" test tried to set it. An unsaved `User` instance already reports
  `True`, so the assignment was unnecessary and the test was more genuine without it.
- **The `--flush` path bypassed `audit_disabled()`.** The plan says to wrap the seeding transaction;
  I wrapped it, then noticed `_flush()` runs *before* that block and deletes every audited model,
  firing `post_delete` on each. A flush logging thousands of deletions defeats the guard exactly as
  thoroughly as seeding would. The context manager now covers both.
- **The stale container hid a fix.** After lengthening `SECRET_KEY`, the warning persisted in Docker
  because the running container still held the old environment variable. `docker compose up -d`
  recreated it. Worth remembering: editing `.env` does nothing until the container is recreated.

**Two deliberate deviations from the intake, recorded as the plan requires:**

1. **Login accepts a username *or* an email.** The intake says "login with email + password". Taken
   literally that means `admin@demo.local`, while the README tells reviewers `admin@demo`. Rather
   than break the documented credentials or force a `USERNAME_FIELD` migration on top of story 02's,
   the field resolves either — username first, so a username that looks like an address is never
   shadowed by someone else's email.
2. **The endpoint-level role matrix is deferred to story 04.** The intake's criterion 9 asks for
   "every role against every scoped endpoint", but this story ships no scoped endpoints — story 04
   builds them. The scoping functions are tested directly at queryset level here, and story 04
   re-asserts the same matrix over real routes.

**What I learned:**

- **The two-layer split is the whole story, and Odoo already taught it.** `ir.model.access` says
  whether you may touch a model; record rules say which rows. DRF splits along the identical seam —
  permission classes and `get_queryset()` filtering — and the failure mode is identical too: an agent
  correctly denied the right to delete customers can still *list* every customer if only the first
  layer exists. Writing them in two separate modules, named after the Odoo concepts, made the
  distinction impossible to blur.
- **Filtering in `get_queryset()` rather than in a list handler is what makes a detail route safe.**
  The same queryset backs list, retrieve, update and delete, so a record outside the caller's scope
  is not merely hidden from the list — it does not exist for them. That is also why an out-of-scope
  detail request returns **404 rather than 403**: a 403 confirms the record exists, which is itself
  a disclosure.
- **The `finally` in the actor middleware is not defensive coding.** Server threads are pooled and
  reused. A worker that finishes without clearing the thread-local hands the previous user's identity
  to the next request on that thread, and every audit row it writes names the wrong person — silently,
  intermittently, and only under concurrency.
- **Locking down DRF broke two endpoints that had nothing to do with auth.**
  `DEFAULT_PERMISSION_CLASSES = IsAuthenticated` applies to drf-spectacular's own views, so
  `/api/v1/schema/` and `/api/v1/docs/` would have started returning 401. The plan predicted it; the
  lesson is that "deny by default" has a blast radius that includes machinery you did not think of
  as an endpoint. There is now a parametrised regression test over all three public paths.

---

## Story 04 — Customers & tickets REST API          (elapsed: ~30m)

**What I asked for:** implement the generated plan for story 04 — the REST API for customers and
tickets, with status changes as a real state machine and a queue endpoint that does not fall over on
150 rows.

**What the AI built:**

- `backend/apps/tickets/services/ticket_service.py` — the **only** writer of `Ticket.status`. An
  explicit `ALLOWED_TRANSITIONS` map, `transition_status`, `assign`, `escalate`, `resolve`,
  `record_first_response`, and `log_event` as the single `TicketEvent` writer. `InvalidTransition` is
  a plain exception, not a DRF one, so management commands and story 05's SLA logic can call this
  module without dragging HTTP into business logic.
- `backend/apps/tickets/serializers.py` — split list / detail / write. `status` is absent from the
  write serializer, so the transition endpoints are the only way in.
- `backend/apps/tickets/filters.py`, `pagination.py`, `views.py`, `urls.py` — the queue filters
  (`q`, `escalated`, `breached`, `unassigned`), 25/100 pagination, `TicketViewSet` with
  `messages`/`events`/`attachments`/`assign`/`status`/`escalate`/`resolve` actions, and the three
  read-only lookup viewsets.
- `backend/apps/customers/serializers.py`, `filters.py`, `views.py`, `urls.py` — customers, contacts
  and the notes action.
- Tests: `test_transitions.py` (68), `test_first_response.py` (6), `test_queue_performance.py` (5),
  `test_attachments.py` (21), `test_scoping_endpoints.py` (10), `test_customers_api.py` (14).
  **241 passing on PostgreSQL**, 240 + 1 skipped on host SQLite.

**Decisions the AI made on its own:**

- *Added an `unassigned` filter the plan did not list.* Story 07's queue has an *Unassigned* tab and
  story 02 seeded 20 such tickets deliberately; without the filter the tab would have had no query
  to make.
- *`escalate` increments the level even when the ticket is already escalated*, skipping the status
  move rather than raising. A second escalation is a real event and story 07 renders the level;
  `ESCALATED → ESCALATED` is not a transition, so refusing the whole call would have been wrong.
- *`ContactViewSet` scopes through its parent customer* rather than getting its own scoping function.
  A contact has no branch or tier of its own, so reusing `scope_customers` on the parent is what
  keeps the two consistent — a contact must never be visible when its customer is not.
- *`is_breached` lives in one helper shared by the serializer and the filter.* Two copies of that
  expression would eventually disagree, and the row badge contradicting the queue tab is exactly the
  bug nobody reports because it looks like a refresh problem.
- *Added `ENUM_NAME_OVERRIDES` to the schema settings.* `User.Language` and `Customer.Language` are
  the same `en|ar` vocabulary declared twice, and `Priority` is shared by three models — without the
  override drf-spectacular emitted `LanguageEnum` and `LanguageEnum2`, and story 06's generated
  client would have had two names for one concept.

**What I had to correct:**

- **`is_breached` silently vanished from the ticket detail payload.** I had written
  `is_breached = TicketListSerializer.get_is_breached` — assigning a method as a bare class
  attribute, which DRF does not register as a field, and it was not in the `fields` tuple either.
  It serialised without error and simply was not there. Extracted into a module-level helper both
  serializers call. **The lesson: a missing serializer field is silent.** Only checking the actual
  output caught it.
- **The 68 transition tests passed alone and failed in the full suite.** `UNIQUE constraint failed:
  accounts_department.code`. The cause was mine, from story 03: the module-scoped `seed_demo`
  fixture in `test_scoping.py` **commits** its data and never removes it, so the seeded `billing`
  department outlived the module and collided with every later fixture that created one. Story 03
  only escaped this because its own files happened to run in a lucky alphabetical order. Fixed by
  wrapping both seed fixtures in `transaction.atomic()` with `set_rollback(True)` at teardown.
  **A test that passes in isolation and fails in the suite is almost always shared state, not the
  test.**
- **`django_assert_num_queries(None)` does not mean "just count".** It asserts against `None` and
  fails on the first query. The performance tests use `CaptureQueriesContext` instead, which is the
  tool that actually counts without asserting.
- **The HTTP transition tests returned 404, not the 400 I expected.** My fixture built tickets with
  no department, so they fell outside the agent's scope and `get_queryset()` correctly excluded them.
  The scoping was right and the fixture was wrong — a satisfying failure, since it is exactly the
  404-not-403 behaviour story 03 built.
- **`OpenApiParameter` is not a response type.** I used it as the 400 entry in `@extend_schema`, and
  drf-spectacular fell back to a free-form object. Replaced with `OpenApiResponse(description=...)`.
- **`deep_import_string` cannot reach `.choices` on a `TextChoices` class** — it is a metaclass
  property. The override has to name the class itself; drf-spectacular calls `.choices` for a
  `Choices` subclass on its own.

**What I learned:**

- **A state machine belongs in one function, and the value shows up immediately in the tests.**
  Driving `test_transitions.py` from `ALLOWED_TRANSITIONS` itself gives 68 tests from one map — every
  allowed pair succeeds, every forbidden pair raises — and the test cannot drift from the
  implementation when a transition is added later. This is the Odoo lesson too: state logic in the
  view is the thing that makes an audit trail develop holes.
- **`source=` beats `SerializerMethodField` for related values, for a reason that is not style.** A
  method field touching `obj.customer` still fires a query per row unless `select_related` covers it,
  and it hides that requirement from the next reader. A `source="customer.name"` path makes the
  needed `select_related` obvious at the point of use.
- **Asserting query-count *equality* between 5 rows and 50 is a better test than a magic number.** A
  hard-coded count breaks whenever middleware or auth changes and teaches nothing; equality tests the
  property that actually matters — that the cost does not grow with the data.
- **The conditional UPDATE for `first_response_at` is the same lesson as story 02's ticket
  numbering:** when two requests can race, push the decision into the database's own atomicity rather
  than into a Python `if`. Both look like stylistic choices in the diff and neither is.
- **Filename sanitising protects a column, not a path.** Django's `upload_to` already handles the
  filesystem; the `filename` column is ours and story 07 echoes it into the browser, which makes an
  unsanitised value a stored-XSS vector rather than an untidy string.
