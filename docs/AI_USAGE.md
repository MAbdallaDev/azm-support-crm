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
