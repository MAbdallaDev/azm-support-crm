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

**Backend** — pytest-django:

```bash
docker compose exec api pytest -q
```

Or locally: `cd backend && .venv/bin/python -m pytest -q`

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

**This is story 01 of 10 — foundation and scaffold only.**

What exists: the dockerized stack, environment-driven settings, the health endpoint, OpenAPI schema
and Swagger UI, seven registered but empty Django apps, and a frontend shell with Tailwind,
shadcn/ui, routing, TanStack Query, an axios client and i18next.

**No domain features exist yet.** There are no models, no authentication, no tickets and no real
screens — `/login` and `/app/dashboard` are placeholders. `/app/dashboard` renders the live health
response, which exists to prove the whole chain end to end: browser → Vite → axios → CORS → DRF →
Postgres.

Domain models and demo data arrive in story 02, authentication in story 03. Progress per story is
recorded in [`docs/AI_USAGE.md`](docs/AI_USAGE.md).
