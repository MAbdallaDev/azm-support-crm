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

---

## Story 05 — SLA, knowledge base, reports, AI & portal API          (elapsed: ~28m)

**What I asked for:** implement the generated plan for story 05 — SLA logic without a scheduler, the
knowledge base API, four reporting aggregations, the pluggable AI service, and the customer-portal
endpoints. The last backend story.

**What the AI built:**

- `backend/apps/tickets/services/sla_service.py` — now the single owner of the breach expression.
  `breached_q()` moved out of `filters.py` and `is_breached()` out of `serializers.py`; both call
  sites import from here and hold no copies. Plus `select_policy`, `compute_due_dates` with its
  guard, `sla_state` returning ok/approaching/breached with signed `seconds_remaining`, and
  `resolution_met` for the compliance figure.
- `ticket_service.pick_next_agent` replacing `pick_least_loaded_agent`, with `NoEligibleAgent` →
  409, plus `User.last_assigned_at` and migration `accounts/0003`.
- `apps/kb/{serializers,views,urls}.py` — bilingual `icontains` search, drafts staff-only,
  `view_count` incremented with `F()`.
- `apps/reports/{serializers,views,urls}.py` — four aggregation-only endpoints, manager-or-admin,
  scope-respecting, durations as integer seconds.
- `apps/ai/services/{base,mock,claude}.py` plus `{serializers,views,urls}.py` and an `AppConfig.ready()`
  that fails at startup if `claude` is selected without a key.
- `apps/portal/{serializers,views,urls}.py` — its own serializer classes, importing nothing from the
  agent app.
- Tests: `test_sla.py` (17), `test_assignment.py` (15), `test_seed_still_intact.py` (4),
  `test_kb_api.py` (15), `test_report_queries.py` (21), `test_ai_advisory.py` (17),
  `test_portal_boundary.py` (17). **347 passing on PostgreSQL**, 346 + 1 skipped on host SQLite.
  OpenAPI: 42 endpoints, **zero warnings**.

**Decisions the AI made on its own:**

- *Added `User.last_assigned_at` and a migration.* The plan's ordering names the field while calling
  the approach "stateless" — those cannot both be true, and the field does not exist. See the
  correction below.
- *`select_policy`'s fallback picks the most **generous** policy for the priority*, ordering by
  `resolution_minutes` descending. A premium customer with no premium policy must not silently
  inherit the tightest deadline on the board; inventing a shorter target than anyone configured
  would manufacture breaches nobody agreed to.
- *`sla_state` and `breached_q` deliberately disagree about resolved tickets.* `sla_state` reports
  what *happened* — a ticket resolved late reads `breached` forever, which is the honest history the
  compliance report needs. `breached_q` reports what needs attention *now* and excludes resolved work
  entirely, so the Breaching queue tab does not fill with closed tickets. Both behaviours are
  correct; the asymmetry is documented at both sites.
- *`resolution_met` was added although the plan did not name it*, so the compliance percentage has
  one definition rather than being re-expressed inside each report query.
- *Manual assignment also stamps `last_assigned_at`, not just auto-assignment.* Otherwise the
  rotation would count only half the work and drift away from reality.
- *The portal CSAT route resolves its ticket through `scope_tickets`*, so rating someone else's
  ticket is a 404 rather than a 403 — consistent with every other detail route in the codebase.
- *Added `TicketStatusEnum` / `KBArticleStatusEnum` overrides.* `Ticket` and `KBArticle` both have a
  `status`, and drf-spectacular resolved the collision as `Status68aEnum` — stable, but meaningless
  in story 06's generated client.

**What I had to correct:**

- **The plan asks for something self-contradictory, and I had to pick a side.** It specifies ordering
  by `(open_ticket_count, last_assigned_at, id)` and, three lines later, calls that ordering
  "stateless". `last_assigned_at` does not exist on `User`, and remembering who went last *is* state
  by definition. I added the column — the smallest possible amount of state, one nullable timestamp —
  because the alternative derivations were worse: `Max(assigned_tickets__updated_at)` moves on any
  edit, not just assignment, and joining `TicketEvent` on a username string is fragile. The plan's
  Done Criteria names the field explicitly, so this follows the letter of it; the "stateless"
  description is the part that is wrong.
- **`timezone.timedelta` is not public API.** It works because `django.utils.timezone` happens to
  import `timedelta`, which is an implementation detail. Changed to a direct `datetime` import.
- **`is_breached` and `breached_q` had to be *moved*, not wrapped.** My first instinct was to leave
  thin re-export wrappers at the old sites for compatibility. That would have been two more places
  for the expression to be edited — exactly the failure the consolidation exists to prevent. Both
  original definitions were deleted outright and the modules now import the real thing; a test
  asserts identity (`filters.breached_q is sla_service.breached_q`).
- **The Docker stack had exited overnight** (exit 137/143 — a host shutdown, not a crash), which
  surfaced mid-verification as `service "api" is not running`. Restarting it re-ran migrations
  cleanly. Worth noting the breach count then read 36 before re-seeding and 17 after: the database
  had been sitting for eleven hours while `now` moved on, so tickets had drifted into breach. That
  is the seed's relative-timestamp design working, not a regression — and it is precisely the rot
  that a hard-coded seed would have produced permanently.

**Two tests I deliberately tried to break, to check they had teeth:**

- Removing the `compute_due_dates` guard: `test_seed_still_intact.py` failed with
  *"compute_due_dates overwrote seeded SLA data on ['TK-0150', …]"*. Worth doing, because this is the
  one failure mode with **no other symptom** — no exception, no failing assertion elsewhere, just a
  demo that quietly shows "everything comfortable".
- Adding `assignee` and `escalation_level` to the portal serializer: the boundary test failed with
  *"portal/tickets/ list leaked internal field(s): ['assignee', 'escalation_level']"*. It also carries
  a `test_the_forbidden_set_is_not_vacuous` guard, so it cannot pass by the names having quietly
  disappeared from the agent API.

**What I learned:**

- **"Computed on read" is a design position that has to be defended in code, not just chosen once.**
  The whole SLA feature is four functions and no infrastructure — no Celery, no broker, no beat
  schedule, no window where the database disagrees with reality. But the cheapest way to break it is
  a well-meaning `post_save` signal, so the hook points are two explicit calls in
  `perform_create`/`perform_update` and there is a test whose only job is to fail if a signal ever
  appears.
- **The portal's separateness is enforced by having no shared code, not by discipline.** Reusing an
  agent serializer with a shorter `fields` tuple works until someone adds a field to the agent
  version — then it appears in the portal too, silently, because nothing in the code says it must
  not. Separate classes make every portal-visible field a decision someone made on purpose.
- **A mock has two requirements that pull against each other.** Tests need determinism; a demo needs
  variety. Seeding a `random.Random` from a hash of the ticket subject satisfies both — same ticket,
  same text; different ticket, different text. A constant string would have passed every test and
  made story 07's AI panel impossible to evaluate, because broken wiring and working wiring would
  look identical.
- **The reports' query-count test is the same shape as story 04's queue test, and for the same
  reason.** With 150 seeded tickets a Python loop returns exactly the right numbers. That is what
  makes it dangerous: it would pass review, pass every correctness test, and only fail in production.
  Asserting the count is *identical* for 20 and 150 rows tests the property rather than the output.

---

## Story 06 — App shell, auth flow, Arabic/English RTL          (elapsed: ~2h 15m)

**What I asked for:** implement the generated plan for story 06 — the API client with a real refresh
flow, the authenticated route tree, the top chrome from the design, the shared component vocabulary
stories 07–09 will speak, and a complete Arabic/English flip. The first frontend story; the backend
was frozen after story 05.

**What the AI built:**

- `src/api/tokenStore.ts` — module state in front of `localStorage`, one get/set pair, plus
  `loginPathForRole` / `homePathForRole`. Caches the **role** beside the tokens so a failed refresh
  knows which of the two login pages to land on without a request that could only 401.
- `src/api/client.ts` — the request interceptor (Bearer header, skipped on the auth routes) and the
  response interceptor: a module-level `refreshing: Promise<string> | null` so concurrent 401s share
  one `POST /auth/refresh/`, a single `_retried` replay, and `navigation.redirect` as a testable seam
  over `window.location.assign`. `getHealth` preserved.
- `src/api/queryKeys.ts`, `src/api/auth.ts`, `src/api/types.ts` — `qk`, then `useLogin` (seeds the
  `qk.me` cache from the login response rather than making a second `/auth/me/` call), `useMe`,
  `useLogout`, and the API types read off the serializers.
- `src/index.css` + `tailwind.config.js` — the `DesignSystem.dc.html` palette converted to HSL
  triplets, plus semantic `priority-*`, `channel-*`, `status-*`, `sla-*` and `tier` colour families.
- `src/components/shell/` — `AppChrome` (56px bar, lockup, role-filtered nav, inert 300px search,
  language toggle, user chip), `PortalChrome`, `ProtectedRoute`, `LanguageToggle`, `Lockup`,
  `UserChip`, `navItems.ts`.
- `src/components/ui/` — `StatusBadge`, `PriorityBadge`, `ChannelBadge`, `SlaBar`, `EmptyState`,
  `Skeleton`, `ConfirmDialog`, `DataTable`, the `Pill` base, a sonner-backed `toast`, and
  hand-written `dropdown-menu` / `alert-dialog` / `input` / `label` primitives.
- `src/routes/` — the real `Login` (two-panel, react-hook-form + zod), `PortalLogin`, `PortalHome`,
  the `KitchenSink`, and `Dashboard` keeping its health card as the API-client smoke test.
- `src/lib/format.ts`, `src/i18n/*`, `scripts/check-rtl.mjs`, and 14 test files / **74 tests**.

**Decisions the AI made on its own:**

- *`SlaBar` takes the API object as a single `sla` prop, in snake_case.* The plan named camelCase
  props (`secondsRemaining`) while the done-criterion said the shape must match `response_sla`
  **verbatim** — those two cannot both hold. Verbatim won, so story 07 writes
  `<SlaBar sla={ticket.response_sla} />` with genuinely no adapter and no rename to drift.
- *`ProtectedRoute` picks its login page from the subtree, not the cached role.* A first-time visitor
  pasting a `/portal/*` link has no cached role at all, and the cached-role answer would put the
  agent sign-in page in front of a customer. The interceptor still uses the cached role — it runs
  outside the router and has no subtree to ask.
- *sonner over shadcn's own toast primitive* — recorded here so stories 07–09 do not introduce a
  second. The shadcn toast comes from a CLI that needs Node 20 (this machine is on 18), and its
  Radix provider is the fiddly piece under React 19. sonner is one self-contained component that
  reads direction from the document.
- *The shadcn CLI was not used at all.* `dropdown-menu`, `alert-dialog`, `input` and `label` are
  hand-written against the Radix primitives, for the same Node 18 reason.
- *`check-rtl.mjs` strips comments before matching.* English prose says "left-to-right" and
  "right-hand column" constantly; a guard that fails the build on those is a guard people start
  bypassing. There is also a per-line `rtl-ok` escape hatch, used exactly once — in the DataTable
  test that asserts `text-right` is *absent*.
- *The kitchen sink renders both languages side by side via two cloned i18next instances*, so a
  reviewer sees the flip without toggling, and the chrome's own toggle is unaffected.
- *The search field is inert this story.* There is no global search endpoint, and the tickets list it
  filters does not exist until story 07. It is rendered so the chrome matches the artboard, disabled
  so it cannot look broken, and there is a test asserting it is disabled.

**What I had to correct:**

- **The refresh interceptor logged the user out on any failed retry.** The first version wrapped both
  the refresh *and* the replayed request in one `try/catch`, so a replay that came back 500 — or 401
  again — cleared the session and redirected. A test that returned the *same* dead token from a
  "successful" refresh caught it; the fix scopes the `catch` to the refresh alone. This is the bug
  the story would most likely have shipped: it only shows up when the backend is unhealthy, which is
  exactly when being thrown to a login page is most confusing.
- **`vi.useFakeTimers()` in a file-level `beforeEach` deadlocked the whole `SlaBar` suite.** Testing
  Library's auto-cleanup awaits React 19's `act` queue, which cannot drain while the clock is frozen,
  so every test after the first timed out *in its hook* — a failure that looks nothing like its
  cause, and which first presented as "found multiple elements" from leaked DOM. Fake timers now
  install inside the two tests that advance the clock and unmount explicitly.
- **A test that faked an axios error with a plain object passed for the wrong reason.** `Login`
  narrows on `instanceof AxiosError` before reading the status, so the look-alike silently took the
  "server unavailable" branch and the 401 banner assertion failed. The helper now throws a real
  `AxiosError` — which is also what proved the 401-vs-outage split works at all.
- **I nearly shipped a comment asserting something I had not checked.** After seeing English text in
  what I thought was the Arabic column, I added `changeLanguage()` calls to the cloned i18next
  instances and wrote a comment explaining why they were necessary. They were not — my *selector* was
  wrong (`document.documentElement` already carries `dir="rtl"`, so `[dir=rtl] …` matched the LTR
  column's badge first). Removing the calls and re-checking confirmed `cloneInstance({lng})` resolves
  on its own. The calls and the comment are gone.
- **`npm run build` failed on a root-owned `dist/`** left behind by an earlier Docker build writing
  into the bind mount. Not a code problem, and not fixable without root on the host — but the web
  container runs as root on the same mount, so `docker compose exec web rm -rf /app/dist` cleared it.
- **The web container needed a rebuild, not just a restart.** Its `node_modules` is an anonymous
  volume baked from the image, so `lucide-react`/Radix/sonner installed on the host were invisible
  to it. `docker compose up -d --build --renew-anon-volumes web` is the fix; a fresh clone never
  sees it because the image build reads the committed `package-lock.json`.
- **A killed `pytest` run left an orphaned `test_crm` database** holding an idle transaction, so the
  next run failed at `CREATE DATABASE` with *"is being accessed by other users"*. The catch:
  `docker compose exec` only kills the **local client** — the `pytest` process keeps running inside
  the container and keeps its connection, so terminating the Postgres backend and dropping the
  database was not enough on its own. The processes had to be killed inside the container first
  (the image has no `ps` or `pkill`, so via `/proc/*/cmdline`). Worth knowing because the symptom is
  a wall of `E`s that looks exactly like a broken test suite: the real backend run afterwards was
  **347 passed** with nothing skipped, untouched by this story as expected.

**What I learned:**

- **A refresh flag has to be a promise, not a boolean.** A boolean tells you a refresh is happening;
  it does not give the other nine callers anything to wait *on*. The promise is simultaneously the
  lock, the queue and the result — and clearing it in a `finally` rather than on success is what
  stops a resolved promise from being reused an hour later against a token that has since died.
- **"No directional utility anywhere" is cheap to hold and expensive to retrofit** — which is exactly
  why it needs a script rather than a code-review habit. The whole guard is 70 lines and no
  dependencies, and it has already caught two real slips plus one piece of prose. The prose false
  positive was the useful part: a guard nobody trusts is a guard nobody runs.
- **The Odoo parallel for `ProtectedRoute` is the menu, not `ir.model.access`.** Filtering nav items
  by role is the same job as `groups=` on a menuitem: it decides what you *see*, and it is never the
  thing that protects the data. Story 03's permission classes and record-rule scoping are the real
  boundary, and the front end deliberately does not restate them — two copies of an access rule
  eventually disagree, and the one people trust is the one that is wrong.
- **Rendering both languages side by side finds things toggling does not.** Half the layout problems
  I would have shipped were only visible with the two columns adjacent — a badge that looked fine
  alone read as misaligned next to its mirror.

---

## Story 07 — Agent workspace: ticket queue & detail          (elapsed: ~1h 50m)

**Model:** Claude Opus 5 via Claude Code. **Plan:** `.squad/plans/crm-mvp/07-story-07-agent-workspace.md`.

The three-pane workspace, the agent dashboard, and — unusually for a frontend story — **six backend
additions**. Frontend: **145 Vitest tests** (up from 74), `check:rtl` green, `npm run build` clean,
lint 0 errors. Backend: **370 tests** (up from 347), OpenAPI schema still **zero warnings**.

### The six backend additions, and why a frontend story grew the API

Every one exists because a criterion could not be met from the API as story 05 froze it. Listing
them here rather than leaving a reviewer to find them in the diff:

1. **`allowed_transitions` on `TicketDetailSerializer`.** The status dropdown must offer only moves
   the backend permits. `ALLOWED_TRANSITIONS` lived in `ticket_service` and was never serialised, so
   the only alternatives were to transcribe the map client-side or to guess. A transcribed map
   drifts silently and offers moves the API then refuses with a 400 the agent cannot act on.
2. **`resolution_sla` on `TicketListSerializer`.** Queue rows show a live countdown that turns red on
   breach, but the list carried only `sla_resolution_due_at` and a boolean. Without this the queue
   would need a *second* SLA component with its own colour logic — and the queue's colour and the
   detail pane's would drift the first time either rule changed. Story 04's
   `test_queue_performance.py` still passes, which is the proof it is not an N+1.
3. **`due_within_minutes`.** "Breaching within the hour" is not `breached=true` (already breached).
   The window is `[now, now+N]` and deliberately **excludes** the already-breached, so the two
   dashboard tiles report disjoint sets rather than double-counting one ticket.
4. **`resolved_after` / `resolved_before`.** "Resolved by me today" — only `created_at` had a range.
5. **`department_code`.** `MeSerializer.department` is a `SlugRelatedField` returning a code string,
   so the client holds no primary key for the existing pk-based `department` filter. Added
   *alongside* it, so story 04's tests keep passing; codes also make a shared link readable
   (`?department_code=billing`).
6. **`reports/my-summary/`.** The four manager reports are `IsManager`-gated, so an agent — the
   dashboard's audience — gets a 403 from all of them. Four of the five numbers were obtainable from
   `tickets/` count queries; **`csat_average` was not**, because `csat_score` appears on the detail
   serializer only. One request instead of five, and the honest home for a figure no filter can
   express.

### Where the plan and the code disagreed, and which won

- **"the eighteen-entry `ALLOWED_CONTENT_TYPES`"** — the set in `views.py` has **sixteen**. The code
  won; `attachments.test.ts` pins the count on the client so an edit to either side fails there
  rather than as a confusing 400 at upload time.
- **The shared ticker vs story 06's per-component interval.** The plan asked for one timer; story
  06's as-built note defended one interval per `SlaBar` ("fifty rows must not re-render a page each
  second"). **Both are right and they were never in conflict** — the expensive thing is a
  *page-level state update*, not the timer. `useSyncExternalStore` gives the third option: one
  interval, and each subscriber re-rendering only itself. A test asserts one `setInterval` for three
  mounted bars, and that no timer runs at all when nothing is counting down.

### Four bugs the work surfaced

- **The activity log was rendering oldest-first.** `TicketEvent.Meta.ordering` is `["-created_at"]`,
  so the API already returns newest-first; my `[...events].reverse()` was written assuming ascending
  and silently flipped it. Found by escalating a real ticket and looking at the result, not by a
  test — the log looked perfectly plausible either way, which is exactly why it survived to that
  point.
- **`check:rtl` flagged its own prose.** The stripper tested whether a line *started* with a comment
  marker, which misses the continuation lines of a JSX block comment — where the English word
  "left-to-right" sits. Replaced with a stateful scan that tracks `/* … */` across lines. Verified it
  still catches a planted `ml-2 text-right` in all three comment styles.
- **"Resolved by me today" started at UTC midnight, not local midnight.** `TIME_ZONE` is
  `Asia/Riyadh` (UTC+3), so `timezone.now().replace(hour=0)` began "today" three hours late and
  silently dropped everything an agent resolved between 00:00 and 03:00 their time. The dashboard
  link already used the browser's local midnight, so the tile and the queue it opens would have
  disagreed — the one thing these figures must never do. Caught by accident: my own test used
  `now - 10 minutes`, which lands in *yesterday* when the suite runs within ten minutes of UTC
  midnight, and the suite happened to run at 00:07. The test is now anchored one minute either side
  of local midnight, and I verified it fails against the UTC implementation before keeping the fix.
- **Arabic durations still read `1h 39m`.** `formatDuration` hard-coded `d`/`h`/`m`/`s`. It is the
  number an agent looks at most, and it was the last visibly English thing on an otherwise flipped
  screen. Unit letters now translate; **digits stay Western**, per the design.

### Test-harness mistakes worth recording

Three of my own tests failed for reasons that had nothing to do with the code under test, and each
would have been a bad test even had it passed:

- **`gcTime: 0`** in the shared query client collected cache entries that had no observer, so a test
  seeding data with `setQueryData` and then asserting on it read as "the mutation did not update the
  cache". Freshness per test comes from a new client, not from collection.
- **A fixture body of `"Internal note"`** matched the composer's own mode-tab label, so the assertion
  passed against the wrong element entirely.
- **Tile testids built from translated labels** broke the moment `me` was undefined — and would have
  broken again the first time anyone ran them in Arabic. Now stable keys.

### What I learned

- **"Read it from the API" is a design position that needs a serialiser to exist.** The rule that a
  state machine must not be transcribed client-side is easy to agree with and impossible to honour
  if the map is never sent. Four of the six backend additions are that same shape: the frontend
  constraint was already agreed, and the API simply had no way to express it yet.
- **Two numbers that must agree should be provable, not asserted in prose.** The dashboard tiles and
  the queues they open are the clearest case — a tile showing 7 that opens a list of 5 teaches an
  agent not to trust any of the numbers. `test_my_summary.py` runs both halves and compares them,
  which is a very different thing from a comment saying they match.
- **Verifying in the browser found what the tests could not.** Every test passed while the activity
  log was in the wrong order and Arabic durations said "39m", because both were plausible. The
  measurements that caught the layout being right — pane widths 300/flex/336, `border-inline-start`
  resolving to the right edge under RTL — were also only available by looking.

---

## Story 08 — Customers & knowledge base UI          (elapsed: ~2h 40m)

**Model:** Claude Opus 5 via Claude Code. **Plan:** `.squad/plans/crm-mvp/08-story-08-customers-kb-ui.md`.

Customer 360, the three-pane knowledge base (browse / reader / editor), the new-ticket form, and
**four backend additions**. Frontend: **179 Vitest tests** (up from 145). Backend: **383 tests**
(up from 370), OpenAPI schema still **zero warnings**.

### The four backend additions

1. **Draft visibility narrowed to author/manager/admin** (`scope_kb_articles`). Previously any staff
   member saw every draft. Rewrote story 05's `test_kb_scope_hides_drafts_from_customers` (it asserted
   the old, wider rule) and a story-03 scoping assertion that happened to pin the same behaviour via
   the seeded data — both updates are in the same commit as the code change, not silent.
2. **`customers/<id>/attachments/`**, scoped through `scope_tickets` on the ticket relation, not just
   `scope_customers` on the customer row — an agent who can open a customer must still not reach
   another department's ticket's attachments through it. Has its own test for exactly that.
3. **`last_activity`** on the customer list, annotated (`Max("tickets__updated_at")`), with a
   constant-query-count test in story 04's shape.
4. **`branches/` and `departments/`** — unpaginated reference lists the customer filter and the new
   ticket form both needed, and story 09's reports will reuse the department one.

### A backend field the story didn't ask for, added anyway

**The new-ticket form needed `department`, which the plan's field list did not name.** Building it, I
found that a ticket created with no department is invisible to its own creator — `scope_tickets`
shows an agent only work in their own department, assigned to them, or watched by them, and none of
those is true for a freshly created ticket with `department: null`. Verified this live: the first
ticket I created returned 201, then 404'd on its own detail page. The form now defaults the field to
the creating agent's own department (via the new `departments/` list, matched against `useMe()`'s
department **code** — the same code-to-pk mismatch story 07 solved for `department_code`), editable
in case they want a different one.

### Three cache-poisoning bugs, all the same shape, all found by using the feature

`TicketViewSet.create()`, `CustomerViewSet.update()`/`partial_update()`, and
`KBArticleViewSet.create()`/`update()` all use DRF's default `get_serializer_class()` dispatch, which
returns the **write** serializer for those actions — a narrower shape than the **detail** serializer a
reader immediately renders. I had typed all three mutation responses as the full detail type and
written them straight into the query cache:

- **New ticket → 404 on its own detail page**, then, after that fix, a crash:
  `formatRelative(undefined)` on `created_at`, which `TicketWriteSerializer` does not carry.
- **Editing a customer's tier crashed the page** the instant the cache write landed —
  `CustomerWriteSerializer` has no `contacts`, and `customer.contacts.map(...)` had nothing to map.
- **Publishing a KB article** would have shown an `updated_at`-shaped crash in the reader the moment
  someone published from the editor, for the same reason.

All three mutations now **invalidate** the relevant detail query instead of seeding it, so the next
read is a real request against the real serializer. Each fix is commented with which serializer the
create/update path actually returns and why seeding was wrong — the same shape of comment story 07's
own as-built note left for the six ticket actions, which is the reason those six were safe and these
three were not: they explicitly build `TicketDetailSerializer(ticket).data`, and the plain
`ModelViewSet.create()`/`update()` do not.

### A found-by-testing bug from story 07

**`common.english` / `common.arabic` never existed as translation keys.** `TicketContext.tsx`'s
"Preferred language" field has been silently printing the raw key since story 07 shipped; it was
never caught because no test or manual check happened to read that exact line. Found while writing
the KB reader's "Available in [English] [العربية]" pills, which use the same two keys. Both are now
present in `en.json`/`ar.json`, self-referential in both files (a language name is not translated —
matching the login screen's own switcher, "English" / "العربية" regardless of interface language).

### `useBlocker`'s stale-closure race

The unsaved-changes guard blocked its own successful save. `save()`'s `onSuccess` called
`setDirty(false)` then `navigate(...)` synchronously in the same handler; `useBlocker(dirty)`'s
boolean form re-renders from the render that created it, so the blocker still read the *previous*
render's `dirty=true` when the synchronous `navigate()` ran, and blocked its own navigation. Fixed
with a ref (`dirtyRef.current`, mutated synchronously) passed to `useBlocker`'s function form instead
of the raw boolean — found by actually publishing an article in the browser and watching it fail to
leave the page, not by a test (my first version of the test happened to assert the wrong thing and
would have passed either way; rewritten once the live bug was understood).

### Two harness gaps `useBlocker` and `useParams` exposed

- **`useBlocker` throws outside a data router.** Story 07's `renderWithProviders` wraps tests in a
  plain declarative `<MemoryRouter>`. Added `renderWithDataRouter` (a `createMemoryRouter` +
  `RouterProvider` pair with a catch-all route) for any component that calls `useBlocker` or reads
  `useParams()` directly — `KBBrowse` needed the latter for its selection test, since (unlike
  `TicketQueue`, which receives `selectedId` as a prop from its parent) it reads `:slug` itself.
- **`main.tsx` could not be imported for its route config** without executing
  `ReactDOM.createRoot(document.getElementById("root")!).render(...)` as an import-time side effect.
  Guarded the render behind `if (document.getElementById("root"))` and exported `appRouteChildren`
  separately, so `routes.test.tsx` can resolve `/app/tickets/new` through the real router and prove
  it reaches `NewTicket`, not `Tickets` with `id === "new"` — a stronger test than reading array order.

### The customer stats-strip decision (Frontend Task 6)

Customer 360's stats strip is **three cells, not five**. `Open` and `Lifetime` come straight off
`CustomerDetailSerializer` and are exact. `Avg resolution` and `CSAT` do not exist as a
single-customer aggregate anywhere, and getting either from the loaded ticket history would need a
detail request per ticket — the same N+1 story 04's queue test forbids. Dropped both, per the plan's
own instruction ("a stat that silently describes 25 of 37 tickets is worse than an absent one").
`SLA met` **does** stay: `resolution_sla.state` (frozen at resolution) is already on every list row
from story 07's addition, so it costs nothing extra to compute from the loaded history — and the
cell names the count it is based on ("based on 5 resolved") rather than implying it covers the
customer's whole lifetime.

### What I learned

- **"Returns the full detail" is a per-action fact, not a per-viewset one.** Story 07's as-built note
  said ticket mutations seed their cache because they return `TicketDetailSerializer`; I generalised
  that to "mutations can seed their cache" without checking that the specific action I was calling
  actually made that promise. Three separate call sites made the same wrong assumption before I
  traced the first crash back to `get_serializer_class()`.
- **A missing translation key fails silently and looks like a passing screen.** i18next's fallback —
  print the key — reads as "some placeholder text", not as an error, so it survives a whole story's
  manual verification unless someone happens to read that specific string. Cheap general defence:
  when adding a *new* key elsewhere that happens to be the same as an old, unused one (`common.english`
  here), the mismatch surfaces immediately in a rendered test — which is exactly how this one was
  found, one story late.
- **`useBlocker`'s boolean argument is a snapshot, not a live read.** Anything that flips a flag and
  immediately navigates in the same handler needs the function form (or an equivalent ref) if the flag
  is meant to already reflect the new state by the time the navigation is evaluated.

## Story 09 — Manager reports & customer portal          (elapsed: ~2h 20m)

**Model:** Claude Sonnet 5 via Claude Code. **Plan:** `.squad/plans/crm-mvp/09-story-09-reports-portal-ui.md`.

Two audiences neither previous frontend story served: `/app/reports` for managers, and the whole
`/portal/*` tree for customers — registration, home, submit, ticket detail with CSAT, and a
knowledge-base browser. **Five backend additions.** Frontend: **202 Vitest tests** (up from 179).
Backend: **391 tests** (up from 383), OpenAPI schema still **zero warnings**.

### The five backend additions

1. **Portal registration** (`RegisterView` at `portal/register/`, `AllowAny`) — the one
   unauthenticated write this app has. Links to an existing `Customer` by email
   (`email__iexact`) where one matches, otherwise creates one; the uniqueness check is against
   `accounts.User`, not `Customer`, and a duplicate email gets the *same* generic 400 a malformed
   one would — never "this email is taken", which is exactly the account-enumeration oracle the
   plan calls out. The response reuses `LoginSerializer.get_token` rather than re-deriving the
   token's `role`/`name` claims a second time — one place that stamps those claims, not two that
   can drift apart.
2. **`by_day_channel` on the volume report** — a fifth grouped query (`TruncDate` × `channel`),
   returned as a flat `{day, channel, count}` list rather than nesting by day, because that is
   exactly the shape a Recharts multi-line series wants and pivoting server-side would just be
   unpivoted again on the client for the other three groupings' sake.
3. **Attachments on a portal ticket submission**, validated through the *same*
   `sanitise_filename` / size / content-type checks `TicketViewSet.attachments` already applies —
   imported from `apps.tickets.views`, not copied, so the two checks cannot go stale independently.
4. **Attachments on a portal reply** — the identical treatment, on the `messages` POST branch.
5. **`csat` exposed on `PortalTicketSerializer`** (`{score, comment}` or `null`), with
   `select_related("csat")` on the viewset queryset. Without this the POST response was the only
   place a rating's score ever appeared — reload the page and there was nothing to read it from.

**CSV export (Backend Task 6) is a deliberate frontend-only decision, not a gap.**
`AgentsReportView` already returns the complete, unpaginated dataset in one response — every row a
CSV would need is already in the browser's memory by the time an export click happens. A server
endpoint would re-run the same aggregation for no benefit the client cannot already provide, so the
CSV is built client-side from the fetched `agents` array and downloaded via a `Blob` + a temporary
`<a download>`. No network request fires when the button is clicked — asserted directly in
`ReportsPage.test.tsx`.

### A gap surfaced, not silently worked around: no portal category picker

`PortalTicketCreateSerializer.category` does accept a category id, but **no portal-reachable
endpoint lists what those ids are.** `src/api/portal.ts` is not allowed to import the agent-facing
`useCategories()` — that is precisely criterion 14's own constraint, checked by
`portalEndpoints.test.tsx` sweeping every portal screen's real request URLs — and adding a
`portal/categories/` endpoint was not among this story's five backend tasks. Building a dropdown
from nothing would mean either an empty control or a secret import of the agent list, both worse
than the honest choice: `SubmitTicket.tsx` renders no category picker and submits `category: null`.
Recorded here rather than left for a reviewer to wonder about.

### The KPI-tile-to-queue links, and where the mapping stops being exact

Four of the six report tiles have an exact `TicketFilterSet` equivalent for the population they
count (`total` → `created_after`, `open` → `created_after` + `status=`, `resolved today` →
`created_after` + `resolved_after`, `breached` → `created_after` + `breached=true`) — verified live
against the running stack: the Reports page showed "9 open" for the seeded 30-day window, and
clicking through to the queue showed the identical "9 open" header. **SLA compliance % and CSAT
average do not** — a percentage and an average are not a filterable *population*, so both tiles
link to the reporting window as a whole rather than pretending a precise filter exists. Named here
rather than left implicit.

### The by-channel line chart and the SLA donut are designed, not copied from an artboard

`Reports.dc.html` shows two charts (volume-by-status, the SLA donut); criterion 2 asks for four.
The by-channel line (pivoted from `by_day_channel` via a pure `pivotByDayChannel` function, tested
directly rather than through Recharts' own SVG output — jsdom's zero-sized `ResponsiveContainer`
never actually renders a chart, so the series-count assertion has to hit the transform, not the
DOM) and the CSAT-distribution bar are built to the same token set (`DesignSystem.dc.html`) instead
of free-styled. RTL verified live: under `ع`, `document.documentElement.dir` is `"rtl"` and the
volume-by-status chart's Y-axis renders on the chart's right edge (`orientation="right"`), not the
left — confirmed by reading the actual bounding rect, not assumed from the prop being set.

### `portalEndpoints.test.tsx` caught a substring-matching test bug, not a product bug

Registering `apiMock` handlers broad-to-narrow (`/portal/tickets/` before `/portal/tickets/5/`)
meant the *narrower* handler, matched via `.includes()`, would still lose to whichever handler was
registered last — the general list handler's substring matched the specific ticket-detail and
messages URLs too, so the detail fetch returned a paginated list envelope and `ticket.created_at`
was `undefined`, crashing `formatDate` inside `PortalTicketDetail` with `RangeError: Invalid time
value`. Fixed by registering broad-to-narrow in the test's own `beforeEach` — `apiMock`'s own
contract is "last registration wins," which means specific routes must be registered *after*
general ones, the opposite order that reads naturally on the page.

### What I learned

- **A registration endpoint's response shape should be the login response's shape, reusing the
  exact same token-building code.** `RegisterResponseSerializer.build` calls
  `LoginSerializer.get_token` rather than re-stamping `role`/`name` onto a fresh `RefreshToken` —
  the two claims only need to be right in one place.
- **`apiMock`'s `.includes()` matcher makes registration order load-bearing**, and the natural
  writing order (general routes first, as the fixtures are usually listed) is backwards. Any test
  mocking a resource **and** its own sub-resources needs the sub-resource routes registered last.
- **A pure transform is more testable than the chart it feeds**, once a charting library's
  container sizing depends on layout jsdom never performs. Exporting `pivotByDayChannel` and
  `buildAgentsCsv` from `ReportsPage.tsx` for direct unit tests was cheaper and more honest than
  trying to coax Recharts into rendering real SVG under `ResponsiveContainer` at 0×0.

## Story 10 — Delivery: RTL sweep, docs, summary          (elapsed: ~3h 30m)

**Model:** Claude Sonnet 5 via Claude Code. **Plan:** `.squad/plans/crm-mvp/10-story-10-delivery.md`.

Turning a working application into a submitted project: the Arabic sweep, a responsive pass, an
i18n key-parity guard, a real error boundary, a states audit, `seed_demo` audited against
criterion 8, and the four hand-in documents (README rewrite, `DEMO.md`, `SUMMARY.md`,
`00-overview.md`'s tenth "as built" section). **No new endpoint, model or migration was planned** —
one landed anyway, because the demo rehearsal found a bug serious enough that fixing it in place
was the only honest option. Frontend: **208 Vitest tests** (up from 202). Backend: **392 tests** (up
from 391), OpenAPI schema still zero warnings, `makemigrations --check` clean.

### The seed audit — nothing needed changing

Walked all five sub-points of criterion 8 against a fresh `docker compose down -v && up --build`,
`migrate`, `seed_demo`: 150 tickets across an 86-day span (already satisfies "90-day, non-trivial"),
9 already breached / 4 within 10% of breach / 5 escalated (all SLA states visible at once), 54 CSAT
ratings with a genuine 1–5 spread (not all 5s — `{5:21, 4:19, 3:9, 2:4, 1:1}`), and one deliberately
English-only KB article among ten real bilingual ones. **Every sub-point was already met; nothing in
`seed_demo` was touched.** Padding it for the appearance of more work would have been exactly the
kind of effort the intake warns against spending on a requirement already satisfied.

### `check:i18n`, and what `missingKeyHandler` immediately caught

Added `scripts/check-i18n.mjs` (flattens both JSON files to dotted keys, diffs both directions) and
configured i18next's `missingKeyHandler` to throw in development. The very first test run under the
new handler crashed the composer: `i18next: missing key "composer.insertKbLink"` — a story-07 typo
(the correct key, `kb.insertKbLink`, existed all along) that had been rendering as a raw key string
on screen for three stories because i18next's default behaviour on a miss is to print the key, not
fail. Two **deliberate** missing-key patterns in `ActivityLog.tsx` (an unknown enum value or event
type falling back to a generic label) had to be rewritten from "call `t()` and compare to the key"
to `i18n.exists()` checks, since the new throw-on-miss handler would otherwise fire on every
legitimately-absent key those patterns exist specifically to tolerate.

### The Arabic sweep found five real bugs, fixed in the same commits as found

- `PortalTicketSerializer.status`/`.channel` used `get_..._display()` text — English-only
  regardless of session language, unlike every other serializer in the app. Every portal ticket
  showed "Open"/"Email" under Arabic. Changed to raw enum keys (matching the agent-facing
  `TicketListSerializer`), translated client-side.
- Four reference-list dropdowns (customer list's branch filter, KB editor's category picker,
  new-ticket form's category and department pickers) rendered `name_en` unconditionally instead of
  switching on the active language — fixable without touching the backend, since those endpoints
  already return both `name_en`/`name_ar`.
- `Register.tsx` had no language toggle at all, unlike every other unauthenticated screen — a
  customer with no session yet had no way to reach Arabic on that specific route.

### The responsive pass found the context pane was not "hidden," it was gone

`TicketContext`'s `hidden ... xl:flex` classing meant the customer/SLA/assignment information was
**unreachable, not merely tucked away**, below 1280px — there was no toggle, just `display:none`.
Split the panel's content into `TicketContextPanel` and added a dialog-based drawer reached via a
toggle button below `xl`. Separately, the whole three-pane workspace overflowed badly below 768px (a
fixed 300px queue next to a detail pane with its own minimum width does not fit at 375px) — fixed by
stacking the queue and the detail pane into two full-width "pages" with a back-to-queue link, and by
collapsing `AppChrome`'s six-item nav into a menu button below `lg` (it overflowed the header at
375px on its own, independent of the ticket workspace).

### The states audit found three screens with no error state at all

`ReportsPage`, `CustomerList`, and `PortalHome` all destructured `isPending` from their queries but
never `isError` — a failed request left stale or empty data on screen with no indication anything
had gone wrong, which is worse than a raw exception message: at least a raw error says something
broke. Added a `role="alert"` banner with a retry button wired to `refetch()` to each. `ActivityLog`
also returned `null` while its events query was pending (a genuine blank flash), replaced with three
skeleton rows.

### The demo rehearsal found the most serious bug of the project

Registering as a customer, submitting a ticket, then searching for it in `agent@demo`'s queue: **it
was not there.** `PortalTicketViewSet.perform_create` never set a `department`, and `scope_tickets`
shows an agent only work in their own department, assigned to them, or watched by them — a ticket
with none of the three is invisible to every agent and manager, visible only to an admin. This is
the story-08 department bug's twin, on the other side of the trust boundary, and it went unnoticed
through the whole of story 09 because nothing in that story's own testing ever completed the loop
of "submit as a customer, then look for it as an agent." Fixed by defaulting new portal tickets to
the "general" department, with a dedicated regression test asserting a fresh portal ticket is
visible to at least one non-admin queue. **This is exactly why `DEMO.md` has to be rehearsed for
real and not written from memory of how the app is supposed to behave** — a plan-only or
code-review-only pass reads `perform_create` and sees nothing wrong, because the bug is in what the
function does *not* set, not in anything it does incorrectly.

### What I learned

- **A missing i18n key is a silent bug until something is configured to treat it as a loud one.**
  `missingKeyHandler` existed as an i18next option the whole project; it just was never turned on
  until the story whose job was specifically to look for exactly this class of bug.
- **"Hidden below a breakpoint" and "unreachable below a breakpoint" are different claims**, and the
  Tailwind class list alone does not distinguish them — `hidden xl:flex` reads, at a glance, like a
  responsive design decision. It takes actually resizing the viewport and checking what happens to
  the information that pane carried to tell the two apart.
- **An end-to-end rehearsal finds bugs that neither a passing test suite nor a code review can**,
  because both of those operate story-by-story on code that is individually correct — the portal
  department bug was invisible to story 09's own tests because nothing in that story's scope ever
  played both roles (customer, then agent) against the same ticket in sequence. The bug lived
  entirely in the gap between two stories that were each, on their own terms, done correctly.
