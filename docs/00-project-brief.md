# AZM Squad — Customer Support CRM
## Project brief: stack, scope split, and story map

Source of truth: `azm_squad_customer_support_crm.pdf` (12 feature areas).
Author: Mostafa Abdallah · Purpose: company skills-assessment project (AI-assisted development).
Timeline: **2 days (~16 hours)** for the MVP.

> **Revision note.** An earlier draft of this file recommended FastAPI + SQLAlchemy over a
> 2–3 week, 12-story schedule. That is superseded. The timeline is 2 days and the backend is
> **Django + DRF**. Everything below reflects the current plan.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Language (backend) | **Python 3.12** | Mostafa's Odoo language. Zero ramp-up. |
| Framework | **Django 5 + Django REST Framework** | The deciding factor for a 2-day build: `django.contrib.auth` supplies users, groups and permissions for free, and **Django admin supplies the entire back-office for free** — user management, categories, SLA policies, audit browsing. That is two to three stories that never have to be written. |
| ORM | **Django ORM** | Built in. Closest thing to Odoo's ORM outside Odoo: models as classes, related fields, querysets. |
| Migrations | **Django migrations** | `makemigrations` / `migrate`. Replaces Odoo's automatic schema update. |
| Database | **PostgreSQL 16** | The same database Odoo runs on. Settings read `DATABASE_URL` with a SQLite fallback, so the app also runs without Docker. |
| Auth | **`djangorestframework-simplejwt`** | JWT access + refresh. Roles map onto Odoo groups. |
| Filtering | **`django-filter`** | Query-string filters on the ticket queue without hand-written code. |
| API docs | **`drf-spectacular`** | OpenAPI schema + Swagger UI. Covers the PDF's "APIs" integration requirement. |
| Background work | **Management commands** (MVP) → **Celery + Redis** (Phase 2) | This is Odoo's `ir.cron`. The MVP needs no scheduler at all — SLA breach is computed lazily on read. |
| AI | **Pluggable backend**: `MockAIBackend` (default) + `ClaudeAIBackend` stub, selected by an `AI_BACKEND` setting | No Anthropic API key is available, so the AI features are mocked behind a real interface. Swapping in the live client later is a one-line env change. |
| Frontend | **React 19 + TypeScript + Vite** | Fast dev server, typed against the OpenAPI schema. |
| Server state | **TanStack Query** | Caching, refetch, optimistic updates. Removes most hand-written state code. |
| UI kit | **Tailwind CSS + shadcn/ui** | Components we own outright. Professional immediately, and RTL-capable through logical properties. |
| Forms | **react-hook-form + zod** | Client validation mirroring the DRF serializers. |
| i18n | **i18next** + `dir` flip on `<html>` | Arabic + English is a hard requirement from the PDF. |
| Charts | **Recharts** | Manager dashboard. |
| Tests | **pytest-django** (API), **Vitest** (UI) | The program's rubric asks for tests or documented manual evidence. |
| Dev infra | **Docker Compose**: `db`, `api`, `web` | One `docker compose up` for the reviewer. |

### Why Django and not FastAPI

FastAPI is the better long-term fit for streaming AI responses and WebSockets, and it was the
initial recommendation. It lost on one axis that dominates a 2-day build: **everything Django hands
you for free**. With FastAPI, auth, permissions, migrations and an admin UI are all work you do
yourself. With Django they are configuration. Since the AI features are mocked in this MVP,
FastAPI's main advantage does not apply. Revisit if Phase 2's live chat and streaming AI arrive.

### Odoo → Django mental map

| Odoo concept | Here |
|---|---|
| `models.Model`, `_name` | `django.db.models.Model`, `Meta.db_table` |
| `fields.Char` / `Many2one` / `One2many` | `CharField` / `ForeignKey` / reverse FK accessor |
| `@api.constrains`, `_sql_constraints` | `clean()`, `Meta.constraints`, DRF serializer validators |
| `ir.cron` | Management command (Celery task in Phase 2) |
| `ir.model.access`, record rules | DRF permission classes + `get_queryset()` scoping |
| `mail.thread` / chatter | `TicketMessage` + `TicketEvent` + the timeline component |
| Odoo backend views (list/form) | **Django admin** |
| QWeb / Owl | React components |
| `ir.actions.server`, automated actions | SLA computation + assignment logic in services |
| XML-RPC external API | DRF + OpenAPI (an Odoo connector is Phase 2) |

---

## 2. Architecture

```
crm/
├─ docker-compose.yml   .env.example
├─ docs/
│  ├─ 00-project-brief.md     this file
│  ├─ design/                 *.dc.html artboards
│  ├─ AI_USAGE.md             journal, appended after every story
│  ├─ DEMO.md                 walkthrough script
│  └─ SUMMARY.md              final hand-in document
├─ backend/
│  ├─ manage.py  requirements.txt  pytest.ini  Dockerfile
│  ├─ config/            settings.py, urls.py
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

Two apps, one frontend codebase: the **agent/manager app** under `/app/*` and the **customer
portal** under `/portal/*`, separated by route and auth scope, sharing one component library.

---

## 3. Scope split

### PART A — CORE (2-day MVP)

| # | PDF area | In the MVP |
|---|---|---|
| 1 | Customer Management | Profiles with tier and branch, multiple contacts, notes, attachments, interaction history |
| 2 | Ticket Management | Number, category, priority, status machine, escalation, assignment, tags, watchers, Conversation / Internal notes / Activity log tabs, attachments |
| 3 | Communication Channels | `channel` field (`web · email · whatsapp · sms · chat`) badged on every ticket and message, driving the composer's *Sending via* label. Portal and agent app are the live transports; the rest are labels only |
| 4 | Agent Dashboard | Queue tabs All / Mine / Escalated / Breaching, filters, search, quick replies |
| 5 | SLA & Automation | Response and resolution due timestamps, progress bars, breach flags, escalation threshold, round-robin assignment that records its own provenance |
| 6 | Knowledge Base | Bilingual articles and categories, draft/publish, search, insert-link-into-reply |
| 7 | AI Features | Ticket summary, suggested reply, automatic categorization — **mock backend**, agent always approves |
| 8 | Customer Portal | Register/login, submit, track, reply, history, browse KB, CSAT rating |
| 9 | Reports & Management | Volume by status and priority, SLA compliance %, agent performance, CSAT average |
| 10 | Security & Administration | Four roles, DRF permission classes, audit log, **Django admin as the back-office** |
| 11 | Integrations | REST API + OpenAPI schema and Swagger UI |
| 12 | Platform | Arabic + English with a full RTL flip, responsive, departments and branches |

### PART B — ADVANCED (Phase 2, after the MVP demo)

| Area | Deferred item | Why it is expensive |
|---|---|---|
| Channels | Real **email** transport (IMAP/SMTP, threading, quote stripping) | Mail parsing, message-id threading, deliverability |
| Channels | **WhatsApp Business Cloud API** | Meta app review, verified number, webhook signatures, 24-hour session rules, template approval |
| Channels | **SMS** (Twilio / Unifonic) | Paid account, sender-ID registration, delivery receipts |
| Channels | **Live chat** + embeddable widget | WebSocket infrastructure, presence, cross-origin widget, offline fallback |
| AI | **Chatbot with RAG over the KB** | Embeddings, `pgvector`, chunking, retrieval tuning, hallucination guards, human handoff |
| AI | **Suggested solutions from similar past tickets** | Semantic search, dedup, relevance evaluation |
| SLA | **Background jobs and real escalation automation** (Celery + Redis) | Worker fleet, retries, idempotency |
| SLA | **Visual automation rule builder + macros** | Condition/action DSL, safe evaluation, dry-run, builder UI |
| Platform | **Multi-branch business-hours and holiday calendars** | SLA arithmetic against working calendars and timezones |
| Platform | **Multi-tenancy / white-label branding** | Data isolation, per-tenant config, custom domains |
| Integrations | **Odoo / ERP connector** (XML-RPC or JSON-RPC) + outbound webhooks | The strongest differentiator available here — partners ↔ customers, invoices ↔ tickets — but needs field mapping and conflict rules |
| Reports | **Custom report builder, scheduled exports, forecasting** | Dynamic safe query building, PDF rendering |
| Collaboration | **Presence, typing indicators, collision warnings, @mentions, watcher notifications** | Realtime fan-out per record |
| Security | **2FA, SSO/SAML, field-level permissions, retention and GDPR export** | Identity-provider integration, per-field ACL evaluation |
| Ticketing | **Merge / split / link tickets, duplicate detection** | Message re-parenting, history rewriting, undo |
| Ticketing | Tasks and reminders, saved views, bulk actions, notification centre | Individually small, collectively a day's work |
| Search | **Postgres full-text search** across tickets and KB | Arabic stemming configuration |
| Platform | **PWA / offline mobile**, push notifications | Service worker, sync conflicts |

---

## 4. Story map — squad-kit feature `crm-mvp`

Each row is one story intake → one generated plan → one scoped implementation session.

| NN | Story | Depends on |
|----|-------|-----------|
| 00 | **Design canvas** — artboards for every screen, in `docs/design/` | — |
| 01 | **Foundation & scaffold** — Docker Compose, Django + DRF + CORS + spectacular, health endpoint, pytest-django, Vite/Tailwind/shadcn/router/query/i18next scaffold | — |
| 02 | **Domain models, admin, seed** — all models and migrations, Django admin for everything, `seed_demo` with bilingual data | 01 |
| 03 | **Auth, RBAC, audit** — SimpleJWT, role permission classes, queryset scoping, audit-log signals | 02 |
| 04 | **Customers & tickets API** — viewsets, serializers, filters, search, pagination, `assign`/`status`/`escalate`/`resolve` actions, event logging | 03 |
| 05 | **SLA, KB, reports, AI, portal API** — SLA computation, bilingual KB search, four report endpoints, pluggable AI service, portal viewsets, CSAT | 04 |
| 06 | **App shell, auth, i18n/RTL** — API client, login, protected routes, top chrome, AR/EN switch with full `dir` flip, shared UI components | 00, 03 |
| 07 | **Agent workspace** — three-pane ticket screen, queue tabs, SLA countdowns, AI panel, composer, agent dashboard | 04, 06 |
| 08 | **Customers & knowledge base UI** — customer list, customer 360, KB browse/read/edit, insert-KB-link-into-reply | 07 |
| 09 | **Manager reports & customer portal** — KPI tiles and charts, portal shell, submit/track/reply, CSAT widget, portal KB | 05, 08 |
| 10 | **Delivery** — RTL sweep, responsive pass, seed data, README, `DEMO.md`, screenshots, `SUMMARY.md` | all |

**Day 1** is stories 01–05 (backend). **Day 2** is stories 06–10 (frontend).
Phase 2 stories land under the feature slug `crm-advanced`, starting at NN 11.

---

## 5. How this project is graded

The company scores four things, and each is a deliverable rather than a by-product.

1. **SDD via squad-kit.** `.squad/` ships inside the repo: ten story intakes, ten generated plans,
   an overview and an index. The commit history shows plan-then-implement order.
2. **Full-stack implementation.** Django + DRF, React + TypeScript, PostgreSQL, Docker Compose,
   tests on both sides, OpenAPI docs, and an end-to-end demo path through portal → agent → manager.
3. **Productivity.** The levers are deliberate: Django admin replaces every admin CRUD screen,
   `seed_demo` replaces manual data entry, and one scoped session per story keeps context small.
   `docs/AI_USAGE.md` records elapsed time per story so the figure is visible rather than asserted.
4. **Visible AI usage.** `docs/AI_USAGE.md` is appended **after every story, while it is fresh** —
   not reconstructed at the end — using a fixed plain-language template: what was asked for, what
   the AI built, what it decided on its own, what had to be corrected, what was learned.
   `docs/SUMMARY.md` is the final single hand-in document.

**No story is finished until its journal entry is written.**

---

## 6. Assumptions

1. **AI features are mocked**, behind a swappable interface. No Anthropic key is available.
2. **Arabic and English are both in the MVP**, with a complete RTL flip including the top chrome.
3. **Email, WhatsApp, SMS and live chat are channel labels only** in the MVP. Real transports are Phase 2.
4. **Single tenant, multi-department, multi-branch.** Multi-tenancy is Phase 2.
5. **SLA needs no scheduler** — breach and escalation thresholds are computed on read from stored due timestamps.
6. **AI never sends a message on its own.** An agent always approves.
