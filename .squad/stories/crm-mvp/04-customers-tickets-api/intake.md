> **Title hint (from CLI):** Customers & tickets REST API

# Story intake

- Folder: `.squad/stories/crm-mvp/04-customers-tickets-api/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `04-customers-tickets-api`
- **Work item type:** Story

---

## Title

```
Customers & tickets REST API
```

---

## Description

Build the REST API for customers and tickets — the endpoints that carry most of the
product's behaviour.

Two things in this story are easy to get wrong and expensive to fix later.

**Status transitions are a state machine, not a free-text field.** Every status change must go through
one service function that validates the transition, stamps the right timestamp (`first_response_at`,
`resolved_at`, `closed_at`), and writes a `TicketEvent`. If viewsets are allowed to assign
`ticket.status` directly, the activity log develops holes and the SLA numbers in story 05 quietly
become wrong.

**The queue endpoint is the most performance-sensitive route in the product.** It renders a list where
each row shows customer name, assignee, category, channel and SLA state. Written naively that is five
extra queries per row. It must be `select_related` and `prefetch_related` from the start, and there
must be a test that asserts the query count stays constant as the row count grows — the Django
equivalent of an Odoo `read_group` you would never write inside a loop.

---

## Acceptance criteria

```
ENDPOINTS (all under /api/v1/, all authenticated, all role-scoped per story 03):

  customers/                     list, retrieve, create, update    filters: tier, branch, q
  customers/{id}/notes/          list, create
  contacts/                      full CRUD, filter by customer
  categories/  tags/  canned-replies/    list and retrieve
  tickets/                       list, retrieve, create, update
      filters: status, priority, assignee, category, customer, channel, department,
               breached (bool), escalated (bool), q (subject, number, customer name)
      ordering: created_at, updated_at, priority, sla_resolution_due_at
      pagination: page-number, default 25, max 100
  tickets/{id}/messages/         list, create        (is_internal respected per role)
  tickets/{id}/events/           list, read-only     (powers the Activity log tab)
  tickets/{id}/attachments/      list, create        multipart
  tickets/{id}/assign/           POST {assignee_id} or {} for round-robin
  tickets/{id}/status/           POST {status}
  tickets/{id}/escalate/         POST {reason}
  tickets/{id}/resolve/          POST {resolution_note}

REQUIREMENTS:

1.  All status changes route through a single transition function in
    apps/tickets/services/ticket_service.py. It validates the transition against an explicit
    allowed-transition map, stamps timestamps, and writes a TicketEvent. Viewsets never
    assign ticket.status directly. An invalid transition returns 400 naming both states.
2.  Allowed transitions: new->open|escalated; open->pending|on_hold|escalated|resolved;
    pending->open|escalated|resolved; on_hold->open|escalated; escalated->open|resolved;
    resolved->closed|reopened; closed->reopened; reopened->open|escalated|resolved.
3.  Creating the first non-internal message from an agent stamps first_response_at exactly
    once and never overwrites it.
4.  Every mutation writes a TicketEvent: created, assigned, status_changed, priority_changed,
    escalated, message_added, note_added, attachment_added, resolved, reopened.
5.  tickets/ list executes a constant number of queries regardless of page size. A test seeds
    5 tickets and 50 tickets and asserts the query count is identical.
6.  Attachment upload validates content type against an allowlist and caps size at 10 MB,
    returning 400 with a readable message otherwise. Filenames are sanitised; a traversal
    attempt (../../etc/passwd) has its own test.
7.  Serializers are split: a lean list serializer for the queue and a full detail serializer.
    The list serializer must not trigger per-row queries.
8.  Every endpoint appears in the OpenAPI schema with correct request and response types.
9.  Tests: transition map exhaustively (valid and invalid), first_response_at stamped once,
    event written for every mutation, query counts, upload validation, and role scoping
    inherited from story 03 still holding on these concrete routes.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** `03-auth-rbac-audit`
- **Depends on code areas or other stories:** models from story 02; permission classes and
  `get_queryset()` scoping helpers from story 03. Reuse them — do not write new permission logic.

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

- SLA due-date computation and breach evaluation — story 05. This story stores and returns the
  SLA fields but does not calculate them. Round-robin selection inside `assign/` is also story 05;
  here, `assign/` with an empty body may pick the least-loaded agent naively.
- Knowledge base, reports, AI and portal endpoints — story 05.
- Any React work.
