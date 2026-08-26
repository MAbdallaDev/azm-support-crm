> **Title hint (from CLI):** Domain models, Django admin, demo seed

# Story intake

- Folder: `.squad/stories/crm-mvp/02-models-admin-seed/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `02-models-admin-seed`
- **Work item type:** Story

---

## Title

```
Domain models, Django admin, demo seed
```

---

## Description

Define the entire data model for the CRM in one migration pass, register every model
in Django admin, and write a `seed_demo` management command that fills the database with realistic
bilingual demo data.

This story carries unusual weight for two reasons. First, **Django admin is the product's entire
back-office** — the "Admin" item in the top navigation is Django admin, not a React screen. Anything
an administrator needs to manage (users, roles, branches, departments, categories, tags, SLA policies,
canned replies, audit log) is managed there and will never be built in React. So admin registration
is a feature, not a debug tool: it needs `list_display`, `list_filter`, `search_fields`, sensible
`inlines`, and `readonly_fields` on computed columns.

Second, **`seed_demo` is what makes every later story demonstrable.** A ticket queue with four rows
proves nothing. The seed must produce enough variety that every UI state in the design has real data
behind it: tickets on all five channels, every status including escalated, SLA timers that are
comfortable, nearly-breached, and already breached, customers at all three tiers, and knowledge-base
articles that genuinely read as Arabic and English rather than as placeholder text.

---

## Acceptance criteria

```
MODELS — exactly these, no more:

accounts.User (AbstractUser)  role(admin|manager|agent|customer), phone, department FK,
    branch FK, tier, language(ar|en), is_available, customer FK (nullable, links a portal
    login to a Customer)
accounts.Department / accounts.Branch   name_en, name_ar, code
accounts.AuditLog   actor FK, action, model_name, object_id, changes JSON, created_at

customers.Customer  name, company, email, phone, whatsapp,
    tier(standard|premium|enterprise), branch FK, preferred_language, created_by, timestamps
customers.Contact   customer FK, name, email, phone, position, is_primary
customers.CustomerNote  customer FK, author FK, body, created_at

tickets.Category    name_en, name_ar, slug, default_priority
tickets.Tag         name_en, name_ar, color
tickets.Ticket      number (TK-####, unique, auto-assigned), subject, description,
    customer FK, contact FK, category FK, tags M2M, priority(low|normal|high|urgent),
    status(new|open|pending|on_hold|escalated|resolved|closed|reopened),
    channel(web|email|whatsapp|sms|chat), assignee FK, watchers M2M, department FK,
    branch FK, assignment_reason, escalation_level, escalated_at, created_by,
    first_response_at, resolved_at, closed_at, sla_policy FK, sla_response_due_at,
    sla_resolution_due_at, sla_response_breached, sla_resolution_breached,
    ai_summary, ai_suggested_category, timestamps
tickets.TicketMessage  ticket FK, author FK, body, is_internal, channel, created_at
tickets.TicketEvent    ticket FK, actor FK, event_type, field, old_value, new_value, created_at
tickets.Attachment     ticket FK, message FK (nullable), file, filename, size, uploaded_by
tickets.CannedReply    title_en, title_ar, body_en, body_ar, shortcut, category FK
tickets.SLAPolicy      name, customer_tier, priority, first_response_minutes,
    resolution_minutes, escalate_at_percent, is_active
tickets.CSATRating     ticket O2O, score 1-5, comment, created_at

kb.KBCategory   name_en, name_ar, slug, order
kb.KBArticle    title_en, title_ar, body_en, body_ar, slug, category FK,
    status(draft|published), author FK, view_count, helpful_count, timestamps

REQUIREMENTS:

1.  AUTH_USER_MODEL points at accounts.User and is set before the first migration.
2.  `makemigrations` then `migrate` runs clean against an empty PostgreSQL database.
3.  Ticket.number is generated on first save as TK-0001, TK-0002 ... and is never reused.
    Generation is safe under concurrent creates (select_for_update or a DB sequence).
4.  Every model above is registered in Django admin with list_display, list_filter and
    search_fields chosen for that model. Ticket admin has TicketMessage and Attachment
    inlines. Computed and system fields (number, timestamps, SLA due dates) are readonly.
5.  Admin list pages avoid N+1 queries via list_select_related / prefetch.
6.  `python manage.py seed_demo` creates, idempotently (safe to run twice):
      - 4 logins, one per role, credentials printed at the end and documented in README
      - >= 6 customers spanning all three tiers, with contacts and notes
      - >= 40 tickets covering all 5 channels, all 8 statuses, all 4 priorities
      - SLA spread: some with hours remaining, at least 3 within 10% of breach,
        at least 3 already breached, at least 2 escalated
      - conversation threads with a realistic mix of public replies and internal notes
      - >= 8 KB articles, each with genuine Arabic and English text (not lorem ipsum,
        not machine-mangled) across >= 3 categories
      - >= 6 canned replies and >= 4 SLA policies keyed to tier and priority
7.  `python manage.py seed_demo --flush` clears seeded data first.
8.  Tests: ticket numbering is sequential and unique under 50 concurrent creates; seed_demo
    is idempotent; every model round-trips through the admin changelist without error.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** `01-foundation`
- **Depends on code areas or other stories:** the seven empty apps and the settings module created
  in story 01. This story adds `models.py` and `admin.py` to each and nothing else.

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

- Any REST endpoint, serializer or viewset — stories 03 to 05.
- SLA *computation*. The SLA fields are defined and populated by the seed, but the logic that
  derives due dates from a policy belongs to story 05.
- Permissions. Admin access is superuser-only for now; role-based rules are story 03.
- Any React work.
