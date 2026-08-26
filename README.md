# AZM Squad — Customer Support CRM

A multi-channel customer support CRM: tickets with SLA tracking, a customer 360 view, a bilingual
knowledge base, mocked AI assistance, a self-service customer portal, and manager reports.

It implements the twelve requirement areas in [`azm_squad_customer_support_crm.pdf`](azm_squad_customer_support_crm.pdf).
The scope split between the MVP and a deferred phase 2 is in [`docs/00-project-brief.md`](docs/00-project-brief.md).

**Stack:** Django 5 + Django REST Framework · PostgreSQL 16 · React 19 + TypeScript + Vite ·
Tailwind CSS + shadcn/ui · TanStack Query · i18next (Arabic + English) · Docker Compose.

---

## Quickstart (Docker)

Requires Docker with the Compose plugin. Nothing else — no local Python, no local Node.

```bash
cp .env.example .env
docker compose up --build
```

Three containers start: `db`, then `api` once Postgres is accepting connections, then `web`.
First build takes a few minutes; afterwards it is seconds.

Then open:

| What | URL |
|---|---|
| Web app | http://localhost:5173 |
| API health | http://localhost:8000/api/v1/health/ |
| API docs (Swagger UI) | http://localhost:8000/api/v1/docs/ |
| OpenAPI schema | http://localhost:8000/api/v1/schema/ |
| Django admin | http://localhost:8000/admin/ |

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
over the last 90 days, ten customers across all three tiers, a bilingual knowledge base, SLA
policies and canned replies:

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
| `manager@demo` | Manager | Every ticket across all departments and branches, the manager reports, and team assignment |
| `agent@demo` | Agent | The ticket queue, their own assigned work, customers and the knowledge base |
| `customer@demo` | Customer | The customer portal only — their own tickets, replies, and the published knowledge base |

Roles are stored on the user record from this story onwards; the permission classes that enforce
them arrive in story 03. Until then admin access is superuser-only. The seed also creates five more
agents (`sara@demo`, `khalid@demo`, `noura@demo`, `faisal@demo`, `omar@demo`) so the agent-performance
report has more than one row, and a portal login per customer so tickets opened over the web channel
have a believable author.

---

## Running without Docker

The backend falls back to SQLite when `DATABASE_URL` is unset, so it runs standalone.

**Backend** (Python 3.12):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
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

**Backend** — pytest-django. This is the canonical command; it runs against PostgreSQL:

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

**Frontend** — Vitest:

```bash
cd frontend && npm run test -- --run
```

**Production build check:** `cd frontend && npm run build`

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
├─ docs/                brief, design artboards, AI usage journal
├─ backend/
│  ├─ config/           settings.py, urls.py, health.py
│  └─ apps/             accounts customers tickets kb ai reports portal
└─ frontend/src/        api components/ui features i18n routes lib
```

One Django app per domain — the rough equivalent of an Odoo module. One frontend codebase carries
two route trees: the agent/manager app under `/app/*` and the customer portal under `/portal/*`,
separated by auth scope and sharing one component library.

Full stack rationale, the Odoo→Django concept map, and the ten-story plan are in
[`docs/00-project-brief.md`](docs/00-project-brief.md). Development follows spec-driven
development: every story has an intake under `.squad/stories/` and a generated plan under
`.squad/plans/` written *before* implementation.

---

## Status

**This is story 02 of 10 — the data model, the back-office, and demo data.**

What exists now: everything from story 01 (the dockerized stack, environment-driven settings, the
health endpoint, OpenAPI schema and Swagger UI, the frontend shell), plus the complete domain model —
eighteen models across `accounts`, `customers`, `tickets` and `kb` — every one of them registered in
Django admin with real list columns, filters, search and inlines, and a `seed_demo` command that
fills the database with credible bilingual data.

**Django admin at `/admin/` is the product's back-office, not a debug aid.** The "Admin" item in the
app's top navigation links there. Users, roles, departments, branches, categories, tags, SLA
policies, canned replies and the audit log are all managed in it and will never be rebuilt as React
screens — a deliberate trade that buys two to three stories of time.

**There is still no API and no real UI.** There are no serializers, viewsets or endpoints beyond
`/api/v1/health/`, no authentication, and `/login` and `/app/dashboard` are still placeholders.
Authentication and role-based permissions arrive in story 03, the REST API in stories 04 and 05, and
the first real screens in story 06. Progress per story is recorded in
[`docs/AI_USAGE.md`](docs/AI_USAGE.md).
