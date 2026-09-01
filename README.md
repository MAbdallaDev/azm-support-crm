# AZM Squad — Customer Support CRM

A multi-channel customer support CRM: tickets with SLA tracking, a customer 360 view, a bilingual
knowledge base, mocked AI assistance, a self-service customer portal, and manager reports.

It implements the twelve requirement areas in [`azm_squad_customer_support_crm.pdf`](azm_squad_customer_support_crm.pdf) —
see [Requirement coverage](#requirement-coverage) below for exactly where each one lives.

**Stack:** Django 5 + Django REST Framework · PostgreSQL 16 · React 19 + TypeScript + Vite ·
Tailwind CSS + shadcn/ui · TanStack Query · i18next (Arabic + English) · Docker Compose.

**What's mocked, what's deferred — upfront, not as a footnote:** the AI backend (summarize/
suggest-reply/categorize) is a deterministic mock behind a real interface — no Anthropic key is
available for this project, and an agent always approves before anything it drafts reaches a
customer. Email, WhatsApp, SMS and live chat are **channel labels only** — the portal and the agent
app are the two live transports; the rest tag a ticket's origin without a real integration behind
them. SLA math is wall-clock, not business-hours-aware. Knowledge-base search is `icontains`, not
full-text. The customer portal has no category picker on the submit form (it silently has nowhere
to source the options from without importing the agent-facing API, which the portal's own trust
boundary forbids). Two of the six manager-report KPI tiles (SLA compliance %, CSAT average) do not
link through to a filtered queue, because a percentage and an average are not a filterable
population. Full reasoning for each is in [`docs/00-project-brief.md`](docs/00-project-brief.md) §3
and in [`docs/SUMMARY.md`](docs/SUMMARY.md)'s honest-limitations section.

---

## Quickstart (Docker)

Requires Docker with the Compose plugin. Nothing else — no local Python, no local Node.

```bash
cp .env.example .env
docker compose up --build
```

Three containers start: `db`, then `api` once Postgres is accepting connections, then `web`.
First build takes a few minutes; afterwards it is seconds.

Then run migrations and seed the demo data (see [Demo data and logins](#demo-data-and-logins)):

```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py seed_demo
```

Then open:

| What | URL |
|---|---|
| Web app | http://localhost:5173 |
| API health | http://localhost:8000/api/v1/health/ |
| API docs (Swagger UI) | http://localhost:8000/api/v1/docs/ |
| OpenAPI schema | http://localhost:8000/api/v1/schema/ |
| Django admin | http://localhost:8000/admin/ |

The API denies by default from story 03 onward. `health`, `schema` and `docs` are public; everything
else needs a bearer token — sign in through the web app, or directly:

```bash
curl -s -X POST localhost:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@demo","password":"Demo!2345"}'
```

That returns `access`, `refresh` and the caller's profile. Send the access token as
`Authorization: Bearer <access>`; `POST /api/v1/auth/refresh/` exchanges the refresh token for a new
access token, and `GET /api/v1/auth/me/` returns your own profile. The `username` field accepts
either the username (`admin@demo`) or the email (`admin@demo.local`).

To stop: `Ctrl+C`, then `docker compose down`. Add `-v` to also drop the database volume.

### Check it is really working

```bash
curl -s localhost:8000/api/v1/health/
```

Expect `{"status":"ok","database":"ok"}` with HTTP 200. The `database` key is a live round-trip,
not a constant — stop the database and it changes:

```bash
docker compose stop db && curl -s -i localhost:8000/api/v1/health/ | head -1
```

Expect `HTTP/1.1 503 Service Unavailable` and `"database":"unavailable"`. Bring it back with
`docker compose start db`.

---

## Demo data and logins

> **Upgrading from a story-01 checkout?** Drop the database volume once —
> `docker compose down -v && docker compose up -d`. Story 01's container migrated Django's built-in
> auth tables before `accounts.User` existed, so an existing volume reports
> `InconsistentMigrationHistory`. A fresh clone never sees this.

The database starts empty. One command fills it with a full working dataset — ~150 tickets spread
over the last 90 days (a mix already breached, already escalated, or close to breaching, so every
SLA state is visible without waiting), ten customers across all three tiers, a bilingual knowledge
base (one article deliberately English-only, to exercise the language-fallback notice), SLA
policies, canned replies, and a spread of CSAT ratings (not all 5s):

```bash
docker compose exec api python manage.py seed_demo
```

It is **safe to run twice**: every object is keyed on a natural key, so a second run refreshes the
data rather than duplicating it. All timestamps are recomputed relative to the moment you run it, so
the SLA countdowns are live however long after the build you demo it. `seed_demo --flush` clears the
seeded data first and re-creates it from scratch (refused when `DEBUG=False`).

### Demo logins

Password for **every** account below: `Demo!2345`

| Login | Role | What they see |
|---|---|---|
| `admin@demo` | Administrator | Everything, plus the Django admin back-office at `/admin/` — users, roles, departments, branches, categories, tags, SLA policies, canned replies and the audit log |
| `manager@demo` | Manager | Every ticket across all departments and branches, the manager reports at `/app/reports`, and team assignment |
| `agent@demo` | Agent | The ticket queue, their own assigned work, customers and the knowledge base |
| `customer@demo` | Customer | The customer portal only, at `/portal` — their own tickets, replies, CSAT rating, and the published knowledge base |

The seed also creates five more agents (`sara@demo`, `khalid@demo`, `noura@demo`, `faisal@demo`,
`omar@demo`) so the agent-performance report has more than one row, and a portal login per seeded
customer so tickets opened over the web channel have a believable author. `docs/DEMO.md` walks
through a full end-to-end scenario using these logins.

---

## Running without Docker

The backend falls back to SQLite when `DATABASE_URL` is unset, so it runs standalone.

**Backend** (Python 3.12):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver
```

**Frontend** (Node 18 or newer):

```bash
cd frontend
npm install
npm run dev
```

The web app is then on http://localhost:5173 and the API on http://localhost:8000.

---

## Tests

**Backend** — pytest-django, **411 tests**, against PostgreSQL:

```bash
docker compose exec api pytest -q
```

The host-side loop also works and runs against SQLite:

```bash
cd backend && .venv/bin/python -m pytest -q
```

One test differs between the two. `test_fifty_concurrent_creates_get_fifty_distinct_numbers` races
50 threads at the ticket-number generator; SQLite serialises writes and raises "database is locked"
under threads, so on the host run it is **skipped with its reason printed** (`pytest -rs` shows it)
rather than passing without ever having raced.

**Frontend** — Vitest, **225 tests**:

```bash
cd frontend && npm run test -- --run
```

Plus two guard scripts, both run in CI and both required to pass before a story is considered done:

```bash
cd frontend && npm run check:rtl    # no directional Tailwind utility (ml-/mr-/left-/right-/...) anywhere
cd frontend && npm run check:i18n   # every key in en.json exists in ar.json and vice versa
```

**Production build check:** `cd frontend && npm run build` · **Lint:** `cd frontend && npm run lint`

---

## Configuration

Every environment-specific value is read from the environment; nothing is hardcoded.
[`.env.example`](.env.example) documents all of them with safe defaults and a comment each:
`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `TIME_ZONE`, `POSTGRES_DB`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `VITE_API_URL`.

`.env` is git-ignored, so no real secret can be committed.

---

## Architecture

```
crm/
├─ docker-compose.yml   .env.example
├─ docs/                brief, design artboards, AI usage journal, DEMO.md, SUMMARY.md
├─ .squad/               ten story intakes and ten generated plans (see SDD workflow, below)
├─ backend/
│  ├─ config/           settings.py, urls.py, health.py
│  └─ apps/             accounts customers tickets kb ai reports portal
└─ frontend/src/        api components/ui features i18n routes lib
```

One Django app per domain — the rough equivalent of an Odoo module. One frontend codebase carries
two route trees: the agent/manager app under `/app/*` and the customer portal under `/portal/*`,
separated by auth scope and sharing one component library.

### Odoo → Django mental map

Mostafa's production background is Odoo. This is the map used throughout development to carry that
experience over rather than starting from zero on an unfamiliar framework:

| Odoo concept | Here |
|---|---|
| `models.Model`, `_name` | `django.db.models.Model`, `Meta.db_table` |
| `fields.Char` / `Many2one` / `One2many` | `CharField` / `ForeignKey` / reverse FK accessor |
| `@api.constrains`, `_sql_constraints` | `clean()`, `Meta.constraints`, DRF serializer validators |
| `ir.cron` | Management command (Celery task in Phase 2) |
| `ir.model.access`, record rules | DRF permission classes (`apps/accounts/permissions.py`) + `get_queryset()` scoping (`apps/accounts/scoping.py`) — the same two-layer split Odoo makes, just implemented as two Python modules instead of two XML mechanisms |
| `mail.thread` / chatter | `TicketMessage` + `TicketEvent` + the Conversation/Internal notes/Activity log tabs |
| Odoo backend views (list/form) | **Django admin** |
| QWeb / Owl | React components |
| `ir.actions.server`, automated actions | SLA computation + round-robin assignment in `apps/tickets/services/` |
| XML-RPC external API | DRF + OpenAPI schema + Swagger UI (an Odoo connector is Phase 2) |

### Why Django and not FastAPI

FastAPI was the initial recommendation, and it is the better long-term fit for streaming AI
responses and WebSockets. It lost on the one axis that dominates a 2-day build: **everything Django
hands you for free**. With FastAPI, auth, permissions, migrations and an admin UI are all work done
by hand. With Django they are configuration — `django.contrib.auth` supplies users, groups and
permissions, and **Django admin supplies the entire back-office** (user management, categories, SLA
policies, audit browsing) without a line of custom CRUD UI. That is two to three stories that never
had to be written. Since this MVP's AI features are mocked, FastAPI's main advantage does not apply
here; it is the right choice to revisit if Phase 2's live chat and streaming AI arrive.

---

## Requirement coverage

The twelve feature areas from the assessment PDF, each mapped to the story and the file where it is
implemented:

| # | Requirement area | Implemented in | Where |
|---|---|---|---|
| 1 | Customer Management | Story 04 (API), Story 08 (UI) | `apps/customers/`, `frontend/src/features/customers/` |
| 2 | Ticket Management | Story 04 (API), Story 07 (UI) | `apps/tickets/`, `frontend/src/features/tickets/` |
| 3 | Communication Channels | Story 02 (model), Story 07 (UI) | `Ticket.channel`, `ChannelBadge`, the composer's *Sending via* label |
| 4 | Agent Dashboard | Story 07 | `frontend/src/routes/Dashboard.tsx`, `apps/reports/views.py::MySummaryView` |
| 5 | SLA & Automation | Story 05 (API), Story 07 (UI); alerts added post-hand-in | `apps/tickets/services/sla_service.py`, `apps/tickets/services/ticket_service.py`, `SlaBar`; `apps/accounts/notifications.py`, `NotificationBell` |
| 6 | Knowledge Base | Story 05 (API), Story 08 (UI) | `apps/kb/`, `frontend/src/features/kb/` |
| 7 | AI Features | Story 05; suggested solutions added post-hand-in | `apps/ai/services/{base,mock,claude}.py`, `SuggestedSolutions.tsx` |
| 8 | Customer Portal | Story 05 (API), Story 09 (UI) | `apps/portal/`, `frontend/src/features/portal/` |
| 9 | Reports & Management | Story 05 (API), Story 09 (UI) | `apps/reports/views.py`, `frontend/src/features/reports/ReportsPage.tsx` |
| 10 | Security & Administration | Story 03 | `apps/accounts/{permissions,scoping,audit}.py`, Django admin |
| 11 | Integrations | Story 01 | `drf-spectacular` OpenAPI schema, Swagger UI at `/api/v1/docs/` |
| 12 | Platform (bilingual, responsive) | Story 06 (shell), Story 10 (sweep) | `frontend/src/i18n/`, `scripts/check-rtl.mjs`, `scripts/check-i18n.mjs` |

### The SDD workflow

This project shipped as **ten stories**, each following the same cycle: a written intake with
numbered acceptance criteria and an explicit out-of-scope list, a generated implementation plan
against concrete file paths, then one scoped implementation session — never all ten planned up
front. `.squad/stories/crm-mvp/` holds the ten intakes; `.squad/plans/crm-mvp/` holds the ten
generated plans, each with its own "as built" section written after the fact. The commit history
shows plan-then-implement order per story (a `plan(NN): ...` commit before every `feat(NN): ...`
commit), and `docs/AI_USAGE.md` has one dated journal entry per story recording what was asked for,
what was built, what the AI decided on its own, what had to be corrected, and elapsed time.

Full rationale for every stack choice, the scope split between this MVP and the deferred Phase 2
work, and the per-criterion grading map are in
[`docs/00-project-brief.md`](docs/00-project-brief.md). The hand-in summary — screenshots against
every artboard, the ownership-and-corrections section, and total elapsed time — is
[`docs/SUMMARY.md`](docs/SUMMARY.md) (frozen at the ten-story hand-in; see below for what shipped
after it).

### Post-hand-in additions

Done after the ten-story hand-in, branch → PR → `dev` → `main` each time unless noted otherwise:

- A queue-panel layout fix and the scroll-escape bug it led to being found and fixed, a
  self-service profile page (view/edit phone and language, change password), and personalized demo
  account display names.
- A **notification centre** (bell with an unread badge, notifying on ticket assignment,
  escalation, and SLA breach — closing the SLA & Automation area's "alerts and notifications" item
  fully; the breach verb is written by a `check_sla_breaches` management command, a real periodic
  sweep — the project's own Odoo `ir.cron` mapping — rather than the lossy check bolted onto an
  unrelated write that was rejected the first time this was built, since the SLA engine's breach
  *state* stays lazily derived either way). Merged.
- **Suggested solutions** (`.squad/stories/crm-advanced/11-suggested-solutions/` — an agent viewing
  a ticket sees up to three already-resolved tickets that look similar, each with how it was
  resolved; a real deterministic database ranking, not semantic search or an external model —
  closing the fourth of the AI Features area's five sub-items. The fifth, an AI chatbot, stays
  deferred: it needs a live LLM to be credible and no key is available for this project). Merged.
- A **global search results dropdown** in the header (grouped Tickets/Customers, keyboard nav,
  a mobile full-screen takeover), extended to also match message-body text (not just
  subject/customer), and to show a highlighted excerpt of the matching message when that's the
  only reason a ticket matched. Merged.
- **Live chat** (`.squad/stories/crm-advanced/12-live-chat/` — turns the "Live chat" channel from a
  label into a real, near-real-time channel: a "Start a live chat" entry point in the portal, and
  both sides of the conversation polling every 4 seconds while a chat-channel ticket is open — the
  codebase's first `refetchInterval`, deliberately scoped to that one channel, no Django
  Channels/WebSockets/Redis. Closes the last unimplemented item in the Communication Channels area).
  **On branch `feature/live-chat`, not merged into `dev`** per explicit instruction.

Full detail, decisions and corrections for each are in `docs/AI_USAGE.md`'s post-hand-in entries.

---

## Status

**All ten stories are complete, plus the merged post-hand-in work above; `dev` has been merged into
`main`.** Live chat (above) is implemented but intentionally sitting on its own unmerged branch.

**428 backend tests** pass against PostgreSQL (on `feature/live-chat`; 421 on `main`). **251
frontend tests** pass (`feature/live-chat`; 244 on `main`). Both RTL and i18n-parity guards are
clean, the production build is clean, and lint has zero errors (the same pre-existing, accepted
`react-refresh` warnings only).

Four things worth knowing about how the backend works:

- **SLA runs without a scheduler.** Due timestamps are written once, on create or on a priority
  change; breach and escalation state are derived on read. No Celery, no broker, no window where the
  database disagrees with reality.
- **The AI is mocked behind a real interface.** `MockAIBackend` is the default — deterministic per
  ticket, different between tickets, and it drafts replies in the customer's preferred language.
  `ClaudeAIBackend` has the real signatures and the intended prompts; switching is one environment
  variable. Nothing the AI returns is applied automatically: an agent always approves.
- **The customer portal is a separate trust boundary**, not the agent endpoints with fields hidden.
  It has its own serializers and imports nothing from the agent app on either side of the stack —
  `apps/portal/serializers.py` on the backend, `frontend/src/api/portal.ts` on the frontend — and a
  test recurses every portal response by key name to prove no internal field ever appears.
- **Status changes go through one service function** that validates against an explicit transition
  map, stamps the timestamps and writes the Activity log.

And on the frontend:

- **Two route trees, one component library.** `/app/*` (agent/manager) and `/portal/*` (customer)
  are separated by `ProtectedRoute`'s audience check and by which API module a screen is allowed to
  import from — `src/api/portal.ts` is checked by its own test to never import an agent-facing
  module, even for a type.
- **A real error boundary on both shells.** `RouteErrorBoundary` catches a render error anywhere
  under `/app/*` or `/portal/*` and shows a reporting screen with a reload action instead of a blank
  page; verified live with a deliberate throw during story 10, then removed.
- **Bilingual by construction, not by patch.** `ms-*`/`me-*`/`text-start`/`text-end` throughout
  instead of `ml-*`/`mr-*`/`text-left`/`text-right` — the RTL flip is structural, and
  `scripts/check-rtl.mjs` fails the build if a directional utility ever creeps back in.
