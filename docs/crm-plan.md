# AZM Squad Customer Support CRM — 2-day MVP plan

## Context

Mostafa's company set a skills-assessment task: build the Customer Support CRM described in
`~/Desktop/azm/Full_Stack_Program/azm_squad_customer_support_crm.pdf` (12 feature areas) using
AI-assisted development. He is an Odoo developer; this project deliberately avoids Odoo.

`docs/00-project-brief.md` was first drafted recommending FastAPI over a 12-story / 2–3 week
schedule. It has since been **rewritten to match this plan** — Django + DRF, the `apps/` layout, the
Odoo→Django map, and the 10-story 2-day schedule. The only FastAPI mentions it still carries are the
deliberate "why Django instead" rationale, which belongs in the README. Decisions:

| Decision | Value |
|---|---|
| Backend | **Django 5 + DRF — final.** Not FastAPI. `contrib.auth` gives users/roles/permissions free and Django admin gives the entire back-office free, which is what makes 2 days possible |
| Frontend | React 19 + TypeScript + Vite |
| Timeline | **2 days** (~16 hours) |
| AI features | **Mocked** behind a swappable interface — no Anthropic key available |
| Arabic + RTL | **In the MVP**, both languages |
| Must-haves | Customer portal, manager dashboard/reports, knowledge base |
| SLA | Included but **minimal** — due dates, breach flag, escalation flag. No background jobs |
| Design | A design canvas is produced **first** (story 00) and referenced by every frontend story |

Intended outcome: a demoable, seeded, dockerized support CRM covering every PDF area at MVP depth,
designed up front, and split into squad-kit stories so each runs as its own scoped agent session.

---

## How this project is graded

The company's real rubric — obtained from their assessment sheet — is **ten weighted criteria
totalling 100**, each scored 1–5. It is broader than the four-point paraphrase this plan was
originally written against. Full table and per-criterion mapping in `docs/00-project-brief.md` §5.

| Block | Criterion | Weight |
|---|---|---|
| AI & SDD Application | Requirement & Specification | 10 |
| | **Planning & Task Breakdown** | **20** |
| | AI Usage & Verification | 10 |
| Software Engineering & Full-Stack | Engineering Foundations (incl. Git, testing, debugging) | 10 |
| | Backend / API / Database | 10 |
| | Frontend & End-to-End Flow | 10 |
| | Productivity | 10 |
| Quality & Understanding | Correctness & Maintainability | 10 |
| | Testing, Security & Edge Cases | 5 |
| | Technical Understanding & Ownership | 5 |

**Three consequences for how this build is run:**

1. **Planning & Task Breakdown is 20 points — double any other line, and the SDD block is 40% of the
   total.** The squad-kit intakes and plans are the largest single scoring surface, not overhead.
   Generate a real plan for every story, especially when time pressure makes skipping to code tempting.
2. **Security is explicitly scored.** Three tests exist specifically for it and must not be dropped:
   the internal-note leak regression (story 03), path traversal on attachment filenames (story 04),
   and the portal trust-boundary assertion that no portal response exposes an assignee, internal note
   or SLA internal (story 05).
3. **"Avoids blind AI dependency" is a scored criterion**, and its evidence accumulates in
   `docs/AI_USAGE.md` where no reviewer will assemble it. `docs/SUMMARY.md` must carry a dedicated
   section collecting the moments the AI was corrected, overruled or verified.

### The AI journal (criterion 4)

`docs/AI_USAGE.md` is appended after **every** story, while it is fresh. Fixed template per entry,
written in plain language, no jargon:

```markdown
## Story NN — <title>          (elapsed: Xh Ym)
**What I asked for:** one or two sentences.
**What the AI built:** the files created or changed, and what each does.
**Decisions the AI made on its own:** and why.
**What I had to correct:** what went wrong and how it was fixed.
**What I learned:** the Odoo-vs-Django difference or new concept this story surfaced.
```

At the end, `docs/SUMMARY.md` is the single hand-in document: what was built, screenshots against
the artboards, the 12 PDF areas mapped to where each is implemented, the core-vs-deferred split with
reasons, total time, the SDD workflow that was followed, and an honest list of what is mocked
(AI backend) and deferred (real WhatsApp/SMS/chat/email transports).

Rule for the whole build: **no story is finished until its journal entry is written.**

---

## Design

Mostafa already designed the **agent ticket workspace** in the Claude Desktop Design app
(`Support CRM.dc.html`). That file is not on this machine, so story 00 rebuilds that artboard from
his screenshot in this project's canvas and adds the missing screens. His design is the visual
source of truth — the plan below was revised to match it, not the other way round.

**What his artboard establishes** (and the MVP must honour):

- Top chrome: `AZM Squad | Support CRM` + nav *Dashboard · Tickets · Customers · Knowledge base ·
  Reports · Admin*, global search, `EN / ع` toggle, user chip with tier and team
- Three-pane ticket workspace: queue (left) · conversation (centre) · context (right)
- Queue cards: priority badge, ticket number `TK-4796`, **channel badge**, subject, customer,
  and a live SLA countdown that turns red on breach (`Breached 14m`)
- Queue tabs: *All · Mine · Escalated · Breaching*
- Ticket header: status dropdown + **Escalate** + **Resolve**
- Centre tabs: **Conversation · Internal notes · Activity log** (three tabs, not one merged timeline)
- An **AI SUMMARY** banner above the thread with *Show detail*
- Composer: Reply / Internal note toggle, *Sending via {channel}*, quick-reply chips, Attach,
  **Suggest reply**, Send reply
- Right pane tabs *Customer · History · Notes*: customer card with tier badge, contact rows,
  branch, preferred language, open-ticket count; **SLA block** with first-response and resolution
  progress bars, target, policy name, escalation threshold; **Assignment block** with owner,
  assignment provenance, tags, watchers

**Artboards story 00 produces** — agent login · agent dashboard · ticket queue + detail (rebuild of
his) · ticket detail in **Arabic/RTL** · customer 360 · knowledge base browse + article · KB editor ·
manager reports · portal home + KB · portal submit ticket · portal ticket detail + CSAT ·
design-system tile (palette, type scale, status/priority/channel badges, SLA states).

Artboards are saved to `crm/docs/design/` and each frontend story intake links the specific
artboards it implements, so the implementing session has a visual target instead of improvising.

**Open question from his design session, to settle in story 00:** in Arabic mode the top chrome
stayed English/LTR. Decision for this plan: **flip everything** — `dir=rtl` on `<html>`, nav and
chrome translated. A bilingual half-flipped header reads as a bug to an Arabic reviewer.

---

## Scope split

### Core (2-day MVP)

1. **Customer management** — profiles, tier, branch, multiple contacts, notes, attachments, history feed
2. **Ticket management** — number, category, priority, status machine, escalation, assignment, tags,
   watchers, three-tab detail, public reply vs internal note, attachments
3. **Channels** — `channel` field (`web|email|whatsapp|sms|chat`) shown as a badge on every ticket and
   message, and driving the composer's *Sending via* label. Portal + agent are the live transports;
   the rest are labels only in the MVP
4. **Agent dashboard** — queue tabs All/Mine/Escalated/Breaching, filters, search, quick replies
5. **SLA** — response/resolution due timestamps on create, progress bars, breach flags, escalation
   threshold, round-robin assign action recording its provenance
6. **Knowledge base** — bilingual articles + categories, draft/publish, search, insert-link-into-reply
7. **AI features** — summarize ticket, suggest reply, auto-categorize (mock backend, Claude adapter stub)
8. **Customer portal** — register/login, submit, track, reply, history, KB, CSAT rating
9. **Reports** — volume by status/priority, SLA compliance %, agent performance, CSAT average
10. **Security & admin** — 4 roles, DRF permission classes, audit log, **Django admin as the back-office**
11. **Integrations** — DRF browsable API + OpenAPI schema via drf-spectacular
12. **Platform** — Arabic + English with full RTL flip, responsive, departments and branches

### Deferred to Phase 2 (`crm-advanced`)

Real transports for email (IMAP/SMTP threading), WhatsApp Cloud API, SMS, live chat + widget ·
AI chatbot with RAG over KB (pgvector) · similar-ticket semantic search · visual automation rule
builder · background SLA jobs and real escalation automation (Celery/Redis) · multi-branch
business-hours calendars · multi-tenancy / white-label · Odoo ERP connector + webhooks · custom
report builder · presence & @mentions · watcher notifications · 2FA/SSO/field-level perms ·
merge/split/link tickets · tasks & reminders · saved views · bulk actions · notification centre ·
Postgres full-text search · PWA

---

## Stack

**Backend** — Python 3.12, Django 5.x, DRF 3.15, `djangorestframework-simplejwt`, `django-filter`,
`django-cors-headers`, `drf-spectacular`, PostgreSQL 16, `pytest-django`.
Settings read `DATABASE_URL` with a SQLite fallback so the app runs without Docker.

**Frontend** — React 19 + TypeScript + Vite, Tailwind CSS + shadcn/ui, TanStack Query, React Router,
react-hook-form + zod, i18next, Recharts, axios, Vitest.

**Infra** — Docker Compose: `db`, `api`, `web`.

### Odoo → Django map (for the README)

`models.Model` → `django.db.models.Model` · `ir.model.access` → DRF permission classes ·
`mail.thread` chatter → `TicketMessage` + `TicketEvent` · Odoo backend views → Django admin ·
`ir.cron` → management command (Celery in Phase 2) · XML-RPC → DRF + OpenAPI.

---

## Repository layout

```
crm/
├─ docker-compose.yml   .env.example
├─ docs/design/         *.dc.html artboards + exported PNGs
├─ backend/
│  ├─ manage.py  requirements.txt  pytest.ini  Dockerfile
│  ├─ config/            settings.py urls.py
│  └─ apps/
│     ├─ accounts/       User, Department, Branch, AuditLog, JWT views
│     ├─ customers/      Customer, Contact, CustomerNote
│     ├─ tickets/        Category, Tag, Ticket, TicketMessage, TicketEvent,
│     │                  Attachment, CannedReply, SLAPolicy, CSATRating
│     ├─ kb/             KBCategory, KBArticle
│     ├─ ai/             services/{base,mock,claude}.py + views
│     ├─ reports/        aggregation views
│     └─ portal/         portal-scoped viewsets
└─ frontend/src/{api,components/ui,features,i18n,routes,lib}
```

`features/` = `tickets/ customers/ kb/ dashboard/ reports/ portal/ auth/`.

---

## Data model

**accounts.User** (`AbstractUser`) — `role` (`admin|manager|agent|customer`), `phone`, `department`,
`branch`, `tier` (agent tier, e.g. *Tier 2*), `language` (`ar|en`), `is_available`,
`customer` FK (nullable — links portal users to a Customer).
**accounts.Department**, **accounts.Branch** — `name_en`, `name_ar`, `code`.
**accounts.AuditLog** — `actor`, `action`, `model_name`, `object_id`, `changes` JSON, `created_at`.

**customers.Customer** — `name`, `company`, `email`, `phone`, `whatsapp`, `tier`
(`standard|premium|enterprise`), `branch`, `preferred_language`, `created_by`, timestamps.
**customers.Contact** — `customer`, `name`, `email`, `phone`, `position`, `is_primary`.
**customers.CustomerNote** — `customer`, `author`, `body`, `created_at`.

**tickets.Category** — `name_en`, `name_ar`, `slug`, `default_priority`.
**tickets.Tag** — `name_en`, `name_ar`, `color`.
**tickets.Ticket** — `number` (`TK-4796`), `subject`, `description`, `customer`, `contact`,
`category`, `tags` M2M, `priority` (`low|normal|high|urgent`), `status`
(`new|open|pending|on_hold|escalated|resolved|closed|reopened`), `channel`
(`web|email|whatsapp|sms|chat`), `assignee`, `watchers` M2M, `department`, `branch`,
`assignment_reason` (e.g. *auto-assigned by rule R-12*), `escalation_level`, `escalated_at`,
`created_by`, `first_response_at`, `resolved_at`, `closed_at`,
`sla_policy`, `sla_response_due_at`, `sla_resolution_due_at`,
`sla_response_breached`, `sla_resolution_breached`,
`ai_summary`, `ai_suggested_category`, timestamps.
**tickets.TicketMessage** — `ticket`, `author`, `body`, `is_internal`, `channel`, `created_at`.
**tickets.TicketEvent** — `ticket`, `actor`, `event_type`, `field`, `old_value`, `new_value`, `created_at`
(powers the *Activity log* tab).
**tickets.Attachment** — `ticket`, `message` (nullable), `file`, `filename`, `size`, `uploaded_by`.
**tickets.CannedReply** — `title_en/ar`, `body_en/ar`, `shortcut`, `category` (the composer's chips).
**tickets.SLAPolicy** — `name` (e.g. *Enterprise-P1*), `customer_tier`, `priority`,
`first_response_minutes`, `resolution_minutes`, `escalate_at_percent`, `is_active`.
**tickets.CSATRating** — `ticket` O2O, `score` 1–5, `comment`, `created_at`.

**kb.KBCategory** — `name_en/ar`, `slug`, `order`.
**kb.KBArticle** — `title_en/ar`, `body_en/ar`, `slug`, `category`, `status` (`draft|published`),
`author`, `view_count`, `helpful_count`, timestamps.

Bilingual content uses paired `_en` / `_ar` columns — no extra translation dependency.
SLA breach and escalation are computed **lazily on read** from the stored due timestamps, so no
scheduler is needed in the MVP.

---

## API surface (`/api/v1/`)

`auth/login` `auth/refresh` `auth/me` · `customers/` `contacts/` `customers/{id}/notes/` ·
`tickets/` (filters `status priority assignee category customer channel breached escalated q`,
ordering, pagination), `tickets/{id}/messages/` `tickets/{id}/events/` `tickets/{id}/attachments/`,
actions `assign` `status` `escalate` `resolve` · `categories/` `tags/` `canned-replies/` ·
`kb/categories/` `kb/articles/` (search) ·
`ai/summarize` `ai/suggest-reply` `ai/categorize` ·
`reports/overview` `reports/volume` `reports/agents` `reports/csat` ·
`portal/tickets/` `portal/tickets/{id}/messages/` `portal/csat/` `portal/kb/articles/` ·
`schema/` + `docs/`.

---

## Frontend routes

`/login` · `/app/dashboard` · `/app/tickets` · `/app/tickets/:id` · `/app/customers` ·
`/app/customers/:id` · `/app/kb` · `/app/kb/:slug` · `/app/kb/new` · `/app/reports` ·
`/portal/login` · `/portal` · `/portal/new` · `/portal/tickets/:id` · `/portal/kb`

Language switcher sets `<html lang dir>`; all spacing uses Tailwind logical properties
(`ms-*`/`me-*`/`ps-*`/`pe-*`) so RTL flips without per-component overrides.

---

## Story map — feature slug `crm-mvp`

Each story = one `intake.md` → `/squad-plan` → one scoped implementation session.

| NN | Story | Delivers | Depends |
|----|-------|----------|---------|
| 00 | **Design canvas** | Rebuild his ticket-workspace artboard + the 11 other artboards listed above, saved to `docs/design/`, published as an editable canvas. Settles the Arabic-chrome question and fixes the palette, badge, and SLA-state vocabulary the frontend stories consume | — |

### Day 1 — backend

| NN | Story | Delivers | Depends |
|----|-------|----------|---------|
| 01 | **Foundation & scaffold** | docker-compose (db/api/web), Django project + DRF + CORS + spectacular, `DATABASE_URL` settings, `/api/v1/health`, pytest-django, Vite+TS+Tailwind+shadcn+router+query+i18next scaffold, `.env.example`; confirm `docs/00-project-brief.md` still matches what was built | — |
| 02 | **Domain models, admin, seed** | All models above + migrations, `AUTH_USER_MODEL`, Django admin for every model (this *is* the back-office), `seed_demo` command with bilingual demo data, 4 demo logins, and tickets across all five channels and every SLA state | 01 |
| 03 | **Auth, RBAC, audit** | SimpleJWT login/refresh/me, role-based permission classes, queryset scoping (agents see their team, customers only their own), `AuditLog` signals, tests | 02 |
| 04 | **Customers & tickets API** | ViewSets + serializers for customers/contacts/notes/tickets/messages/events/attachments/categories/tags/canned-replies, filters + search + ordering + pagination, `assign`/`status`/`escalate`/`resolve` actions, event logging, tests | 03 |
| 05 | **SLA, KB, reports, AI, portal API** | SLA due-date computation on save, lazy breach + escalation-threshold evaluation, round-robin `assign` writing `assignment_reason`; bilingual KB search; 4 report endpoints; `ai/services/` with `MockAIBackend` (default) and `ClaudeAIBackend` stub behind an `AI_BACKEND` setting; portal viewsets + CSAT; tests | 04 |

### Day 2 — frontend

| NN | Story | Delivers | Depends |
|----|-------|----------|---------|
| 06 | **App shell, auth, i18n/RTL** | axios client with JWT refresh interceptor, TanStack Query, login page, protected routes, top chrome per the design (nav, global search, EN/ع toggle, user chip), i18next `en.json`/`ar.json` + full `dir` flip, shared UI: `DataTable`, `StatusBadge`, `PriorityBadge`, `ChannelBadge`, `SlaBar`, `EmptyState`, `Skeleton`, toasts | 00, 03 |
| 07 | **Agent workspace** | The three-pane screen from his design: queue with All/Mine/Escalated/Breaching tabs + filters + search + live SLA countdowns; centre with Conversation / Internal notes / Activity log tabs, AI summary banner, composer with *Sending via*, quick-reply chips, Attach, Suggest reply; right pane with customer card, SLA bars, assignment block. Plus the agent dashboard | 04, 06 |
| 08 | **Customers & knowledge base UI** | Customer list + search, customer 360 (profile, contacts, notes, attachments, ticket history), KB browse + article reader + bilingual editor with draft/publish, insert-KB-link-into-reply from the composer | 07 |
| 09 | **Manager reports & customer portal** | Reports: KPI tiles, volume-by-status bar, SLA compliance donut, agent performance table, CSAT average; portal shell, submit-ticket form (zod), my-tickets list, ticket detail + reply + attachments, CSAT widget, portal KB search | 05, 08 |
| 10 | **Delivery** | Full AR/RTL sweep against the RTL artboard, responsive pass, empty/loading/error states, richer `seed_demo`, `README.md` (setup, run, architecture, Odoo↔Django map, why Django over FastAPI), `docs/DEMO.md` walkthrough, screenshots of every screen next to its artboard, and **`docs/SUMMARY.md`** — the hand-in document assembled from the ten journal entries. Tests green | all |

Phase 2 stories land under feature slug `crm-advanced` starting at NN 11.

---

## Execution steps

**Done already** — design canvas built and published; `squad init` run; ten intakes scaffolded and
filled with descriptions, acceptance criteria, dependencies and out-of-scope lists; artboards copied
into the frontend stories' `attachments/` (squad-kit's planner reads only the intake and its
attachments, so a linked-but-not-attached design would be invisible to it); `docs/AI_USAGE.md`
opened with its story 00 entry.

### ✅ Done — repository setup and story 01 (kept as the record of how it was done)

This is the immediate next step and it is **not optional housekeeping** — criterion 1 is judged
partly on a commit history showing plan-then-implement order, and there is currently no history at
all. Every artifact so far is uncommitted. If story 01's code lands before the planning artifacts are
committed, the ordering evidence is gone permanently.

1. **`git init`** in `~/Desktop/azm/crm`, default branch `main`, remote `origin` set to
   `https://github.com/MAbdallaDev/azm-support-crm.git` (public, created by Mostafa).

   **The push is his, not mine.** `gh` is not installed, there are no SSH keys and no git credential
   helper, so this session cannot authenticate to GitHub. It initialises, commits and wires the
   remote; `git push -u origin main` is run by him.

   **Commit identity — set repo-locally before the first commit**, so commits link to the
   `MAbdallaDev` GitHub profile:

   ```bash
   git config user.name "Mostafa Abdallah"
   git config user.email "143842834+MAbdallaDev@users.noreply.github.com"
   ```

2. **Fix the ignore rule.** squad-kit's managed `.gitignore` block excludes
   `.squad/stories/**/attachments/`. That drops the design artboards attached to stories 06–09 plus
   the requirements PDF and brief attached to story 01 — leaving the shipped intakes referencing
   `attachments/Main.dc.html` files that are not in the repo. Broken references inside the exact SDD
   artifact the reviewer inspects. Add **after** the managed block (never inside it — it is marked
   "do not edit"):

   ```gitignore
   # Story attachments are part of the SDD artifact the reviewer reads — keep them tracked.
   !.squad/stories/**/attachments/
   ```

   Roughly 250 KB of text and one small PDF. Verify with `git check-ignore -v` on one artboard before
   committing, and confirm `git status` lists the attachment files.

3. **Baseline commit** of the planning artifacts, before any application code:
   `docs/`, `.squad/`, `.gitignore`, the requirements PDF. One commit, message naming it as the
   planning baseline.

4. **Restore the design canvas launch view.** The canvas currently opens focused on the Reports
   artboard alone — a recorded side effect of expanding it and saving while expanded. Set
   `docs/design/canvas.json` `launch` back to `{"view": "canvas", "page": "agent-app"}` and return
   Reports to `x: 0, y: 2240` so it re-aligns with the grid. Re-seed and republish to the existing
   artifact URL. Anyone opening the shared link should land on the whole product, not one screen.

5. **Re-sync `docs/crm-plan.md`** from this plan file — it is Mostafa's in-repo copy and the two must
   stay identical, since the repo copy is what the reviewer reads.

6. **Generate story 01's plan**: `/squad-plan .squad/stories/crm-mvp/01-foundation/intake.md`.
   Review the generated `.squad/plans/crm-mvp/NN-story-*.md`, then commit it — the plan commit must
   land before the implementation commit.

### Story 01 review — accepted, with one unexecuted criterion

Reviewed at commit `20a6f1c`. All 11 acceptance criteria are satisfied in code, and three changes
improved on the plan rather than merely following it:

- `config/health.py` catches `django.db.Error`, not the narrower `OperationalError` the plan
  specified. Correct: with `conn_max_age=600` a dead cached connection surfaces as `InterfaceError`,
  which would have escaped the handler and returned 500 instead of the required 503.
- A test was added for the **503 branch**. The plan only specified the happy path, leaving the
  "`database` is not a constant" requirement hand-verifiable but not CI-verifiable.
- Three bugs in shadcn's generated output were caught and fixed — v4 `oklch()` values written into a
  v3 config that consumes them as `hsl(var(--x))`, a missing `destructive-foreground` pair, and an
  `init` that aborted after writing config but before installing `clsx`/`cva`/`tailwind-merge`.

Independently verified: no build artifacts tracked (`.venv`, `dist/`, `db.sqlite3`, `.pytest_cache`
all ignored); seven apps registered with dotted `AppConfig.name`; **every `models.py` empty with no
migrations** — the exact precondition story 02 needs; `AUTH_USER_MODEL` deliberately unset with an
explanatory comment; full `en`/`ar` key parity with real Arabic; and **zero directional Tailwind
utilities**, so story 06's RTL rule starts clean. The Alpine/musl Rollup trap (`npm ci` on
`node:22-alpine` against a glibc lockfile) was checked specifically and does not apply — the lockfile
records `@rollup/rollup-linux-x64-musl`.

**The one gap: Docker is not installed on the machine**, so `docker compose up --build` was never
executed. Acceptance criterion 1 and verification steps 1, 2, 3 and 6 are unrun. The compose file and
both Dockerfiles are statically sound, but sound is not verified — and the definition of done for the
two days is that `docker compose up` is the only setup step.

---

### Next: install Docker, verify story 01 for real, then plan story 02

1. **Install Docker Engine + the Compose plugin** (needs `sudo`; Mostafa runs this, not the session):

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"
   ```

   Log out and back in (or `newgrp docker`) so the group applies without `sudo` on every command.

2. **Run story 01's verification section for real** — all seven steps in
   `.squad/plans/crm-mvp/01-story-01-foundation.md`. Step 2 is the one that matters: `docker compose
   stop db`, then confirm health returns **503** with `"database":"unavailable"`, then
   `docker compose start db`. Fix anything that surfaces on a story-01 branch, merged the same way as
   the rest.

3. **Then generate story 02's plan**: `/squad-plan .squad/stories/crm-mvp/02-models-admin-seed/intake.md`.

Story 02 does not strictly depend on Docker — it is models, admin and seed, all exercisable on the
verified SQLite path. Docker is being resolved first because a compose bug discovered on day 2 has
nowhere to go.

### Story 02 — planned approach (to be written into `.squad/plans/crm-mvp/`)

**Context.** Story 01 delivered seven registered but empty Django apps and left an explicit comment
reserving `AUTH_USER_MODEL`. Story 02 fills every `models.py` in a single migration pass, registers
all seventeen models in Django admin — **which is this product's entire back-office**, so admin
config is a feature, not a debug aid — and writes `seed_demo`, the command that makes every later
story demonstrable.

**Ordering constraint that cannot be got wrong.** `accounts.User` must exist and `AUTH_USER_MODEL`
must be set *before* the first `makemigrations`. There are currently no migrations anywhere, so the
window is clean — but only once. Define `User` first, set the setting, then generate migrations for
all seven apps in one pass.

**Circular foreign keys.** `accounts.User.customer` → `customers.Customer` while
`customers.Customer.created_by` → `AUTH_USER_MODEL`. Both use string references and `null=True`;
Django emits `swappable_dependency` and resolves the order itself. Do not try to break the cycle by
moving a model between apps.

**Ticket numbering — a deliberate deviation from the intake.** The intake suggests
"`select_for_update` or a DB sequence". Both are problematic here:

- A counter row to lock would need an **eighteenth model**, and the intake says *"exactly these
  models, no more"*.
- Locking the last `Ticket` row instead is gap-prone: under READ COMMITTED two transactions can
  resolve "the last row" differently around an in-flight insert.
- A Postgres sequence breaks the SQLite fallback story 01 built and verified.

Use instead: **`unique=True` on `number`, plus a bounded retry-on-`IntegrityError` loop.** The unique
constraint is what actually guarantees "never reused" — the database enforces it regardless of
isolation level or engine; the loop merely handles the collision. Engine-agnostic, no extra model,
and it survives the 50-thread test. Record the reasoning in a code comment so it does not read as
having missed the intake's suggestion.

**Test target — decided.** `docker compose exec api pytest` becomes the canonical command
(Postgres). The concurrency test uses `transaction=True` and **skips with an explicit reason when the
engine is not PostgreSQL**, so the fast host-side SQLite loop stays green and honest rather than
silently weaker. Update the README's test section accordingly.

**Seed design — 150 tickets across 90 days.** Chosen so story 09's 7/30/90-day report ranges and the
agent-performance table have real curves, rather than rebuilding the seed under time pressure in
story 10.

The non-obvious requirement: **every SLA timestamp must be computed relative to `timezone.now()` at
run time, never hard-coded.** A seed with fixed dates shows every ticket breached the day after it
was run, and the demo degrades silently. The breach spread — comfortable, within 10% of target,
already breached, escalated — has to be re-derived on each run. Idempotency therefore means *stable
identities* (natural keys via `get_or_create`), not stable timestamps.

**Admin quality bar.** `list_display`, `list_filter`, `search_fields` chosen per model;
`TicketMessage` and `Attachment` inlines on `Ticket`; system fields (`number`, timestamps, SLA due
dates) readonly; `list_select_related` and `prefetch_related` on every changelist that shows a
related field — with 150 seeded tickets an N+1 is immediately visible rather than theoretical.

**Verification.** `makemigrations --check --dry-run` clean after the pass; `migrate` clean against an
empty Postgres; `seed_demo` then `seed_demo` again produces identical object counts; every changelist
loads; `pytest` green in the container.

---

### Branching and release cadence

Chosen flow, now in use:

- One branch per story: `story/NN-<slug>` → push → PR → **merge into `dev`**.
- **`dev` → `main` at milestones**: after story 05 (backend complete, end of day 1) and after
  story 10 (delivery).
- `main` therefore lags `dev` during a day. That is deliberate — but it means anyone opening the
  repo between milestones sees a `main` without that day's code. Acceptable given the two merges
  are scheduled; **`main` must be current before the work is handed in.**

---

### Then, per story, in order

`/squad-plan .squad/stories/crm-mvp/<id>/intake.md` → commit the plan → open a **fresh scoped
session attached only to the generated plan file** → implement → verify → **append the journal entry
to `docs/AI_USAGE.md`** → commit → next.

Attach the **plan**, never the intake. The intake is the planner's input; the generated
`.squad/plans/crm-mvp/NN-story-*.md` is the implementer's input. Handing a fresh session the intake
makes it re-derive the plan itself, which throws away the work and the audit trail.

The fresh-session-per-story rule is deliberate: it keeps each session's context small, and the
resulting commit pattern (plan, then implementation, then journal) is the evidence for criterion 1.
The journal entry is part of the story, not homework for later.

**Where plan changes happen.** This planning session is the place to revise scope — but the durable
record is on disk (`docs/crm-plan.md` and the ten intakes), not the conversation, which is summarised
as it grows. A scope change means editing those files, and re-running `/squad-plan` for any story
whose intake changed after its plan was already generated.

### The project brief is already current

`docs/00-project-brief.md` was rewritten to Django + DRF before any implementation started: stack
table, `apps/` layout, Odoo→Django concept map, the 10-story 2-day schedule, and the revised
core-versus-deferred split. Story 01 only confirms it still matches what was actually built — it does
not rewrite it. The FastAPI references that remain are the deliberate "why Django instead of FastAPI"
comparison, which is worth keeping: it shows the alternative was evaluated rather than ignored.

---

## Verification

**Bring it up**
```bash
cd ~/Desktop/azm/crm && docker compose up --build
```
`api` on `http://localhost:8000`, `web` on `http://localhost:5173`, Postgres on `5432`.

**Seed and check the API**
```bash
docker compose exec api python manage.py migrate && docker compose exec api python manage.py seed_demo
curl -s http://localhost:8000/api/v1/health/
```

**Tests**
```bash
docker compose exec api pytest -q
cd frontend && npm run test -- --run && npm run build
```

**End-to-end demo path (this becomes `docs/DEMO.md`)**
1. Portal: log in as the demo customer, submit a ticket, see it acknowledged with an SLA due time.
2. Agent app: it appears under *All* and unassigned; **Assign to me** sets `assignment_reason` and
   starts the SLA bars.
3. AI panel: summary, suggested category, and suggested reply populate from the mock backend.
4. Insert a KB link, send a public reply; add an internal note and confirm the portal cannot see it.
5. **Escalate** the ticket — it moves to the *Escalated* queue tab with the escalation badge.
6. Resolve; portal shows resolved and offers CSAT; submit 5 stars.
7. Manager account: reports reflect the ticket in volume, SLA compliance, and CSAT.
8. Switch to Arabic — every screen, including the top chrome, flips to RTL with translated labels.
9. Django admin at `/admin/` — users, roles, branches, categories, SLA policies, audit log.
10. Compare the running agent workspace side by side with the `docs/design/` artboard.

**Definition of done for the 2 days:** every one of the PDF's 12 areas is demonstrable in that path,
`docker compose up` is the only setup step, the UI matches the artboards, and the README states
plainly what is mocked (AI) and what is deferred (real WhatsApp, SMS, live chat, email transports).
