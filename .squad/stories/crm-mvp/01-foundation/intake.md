> **Title hint (from CLI):** Foundation & scaffold

# Story intake

- Folder: `.squad/stories/crm-mvp/01-foundation/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `01-foundation`
- **Work item type:** Story

---

## Title

```
Foundation & scaffold
```

---

## Description

Turn the empty repository into a running, dockerized Django + DRF API and a React +
Vite frontend shell. **No domain models and no business logic in this story** — this is purely the
skeleton every later story builds on.

The reviewer's very first action will be `docker compose up --build`. If that single command does not
produce a reachable API and a reachable web app, the project loses on its first impression. That is
the bar for this story.

Backend: a Django project named `config`, seven empty-but-registered Django apps under `backend/apps/`,
settings driven entirely by environment variables, a health endpoint, OpenAPI docs, and a working
pytest run. Frontend: Vite + TypeScript, Tailwind, shadcn/ui initialised, React Router with two
placeholder routes, a TanStack Query provider, an axios client, and i18next wired to `en`/`ar`
resource files that are still nearly empty.

---

## Acceptance criteria

```
1.  `docker compose up --build` starts three services: `db` (postgres:16), `api` (:8000), `web` (:5173).
    The api container waits for the database to accept connections before starting.
2.  `GET /api/v1/health/` returns 200 with `{"status": "ok", "database": "ok"}` — the database key
    reflects a real connection check, not a constant.
3.  `backend/config/settings.py` reads SECRET_KEY, DEBUG, ALLOWED_HOSTS, DATABASE_URL and
    CORS_ALLOWED_ORIGINS from the environment. DATABASE_URL absent falls back to SQLite so the
    project runs without Docker.
4.  Seven Django apps exist under `backend/apps/` and are listed in INSTALLED_APPS: accounts,
    customers, tickets, kb, ai, reports, portal. Each has an AppConfig with an explicit `name`.
    They contain no models yet.
5.  drf-spectacular serves the schema at `/api/v1/schema/` and Swagger UI at `/api/v1/docs/`.
6.  `pytest` runs from `backend/` and passes, with at least one test asserting the health endpoint's
    status code and body.
7.  `frontend/` builds: `npm run build` exits 0. `npm run dev` serves on 5173 and reaches the API.
8.  Frontend has: Tailwind configured, shadcn/ui initialised with at least Button and Card, React
    Router with `/login` and `/app/dashboard` placeholders, a QueryClientProvider at the root, an
    axios instance in `src/api/client.ts` reading `VITE_API_URL`, and i18next initialised with
    `src/i18n/en.json` and `src/i18n/ar.json`.
9.  `.env.example` lists every environment variable both services read, with safe example values.
    No real secret is committed.
10. `README.md` gives a quickstart that a reviewer can follow start to finish without asking questions.
11. `docs/00-project-brief.md` already describes this Django stack — read it, and correct it only if
    the implementation diverges from it. Do not rewrite it wholesale.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/requirements.pdf` | The original company requirements — 12 feature areas |
| `attachments/project-brief.md` | Full stack rationale, scope split, and the 10-story map |

Read both. `project-brief.md` is the authority on stack and scope; `requirements.pdf` is the
authority on what the finished product must eventually do.

---

## Dependencies

- **Blocked by / related ids:** none — this is the first story.
- **Depends on code areas or other stories:** none. The repository contains only `docs/` and `.squad/`.

## Technical hints

**Stack — fixed, do not re-litigate.** Backend: Python 3.12, Django 5, Django REST Framework 3.15,
`djangorestframework-simplejwt`, `django-filter`, `django-cors-headers`, `drf-spectacular`,
PostgreSQL 16, `pytest-django`. Frontend: React 19 + TypeScript + Vite, Tailwind CSS, shadcn/ui,
TanStack Query, React Router, react-hook-form + zod, i18next, Recharts, axios, Vitest.
Infra: Docker Compose services `db`, `api`, `web`.

**Repository layout.**
```
backend/{manage.py,requirements.txt,pytest.ini,Dockerfile,config/,apps/{accounts,customers,tickets,kb,ai,reports,portal}}
frontend/src/{api,components/ui,features,i18n,routes,lib}
docs/{00-project-brief.md,design/,AI_USAGE.md,DEMO.md,SUMMARY.md}
```

**Author background.** The developer is an Odoo developer learning Django. Where a Django concept has
a direct Odoo equivalent, name it in a short code comment: `ir.model.access` / record rules → DRF
permission classes and `get_queryset()` scoping; `mail.thread` chatter → `TicketMessage` +
`TicketEvent`; Odoo backend list/form views → Django admin; `ir.cron` → management command.

**Bilingual convention.** User-facing content models carry paired `_en` / `_ar` columns
(`name_en`/`name_ar`, `title_en`/`title_ar`, `body_en`/`body_ar`). No translation library.

**Journal rule — applies to every story.** This story is not complete until an entry is appended to
`docs/AI_USAGE.md` using the plain-language template in `docs/00-project-brief.md` section 5:
what was asked for, what the AI built, what it decided on its own, what had to be corrected, what
was learned. Record elapsed time.

## Out of scope

- Any domain model (Ticket, Customer, KBArticle) — that is story 02.
- Authentication and JWT — that is story 03.
- Any real screen. `/login` and `/app/dashboard` are placeholders that render a heading.
- Arabic translation content. The `ar.json` file exists but may hold only the handful of keys
  the placeholder routes use; the full translation pass is story 06.
