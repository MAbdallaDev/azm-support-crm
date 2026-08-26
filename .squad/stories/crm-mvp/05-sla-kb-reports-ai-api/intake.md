> **Title hint (from CLI):** SLA, knowledge base, reports, AI & portal API

# Story intake

- Folder: `.squad/stories/crm-mvp/05-sla-kb-reports-ai-api/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `05-sla-kb-reports-ai-api`
- **Work item type:** Story

---

## Title

```
SLA, knowledge base, reports, AI & portal API
```

---

## Description

Complete the backend: SLA logic, the knowledge base, reporting aggregations, the
pluggable AI service, and the customer-portal endpoints. After this story the API is finished and day
two is entirely frontend.

**SLA without a scheduler.** The MVP deliberately runs no background worker. Due timestamps are
computed once, when a ticket is created or its priority changes; breach and escalation-threshold state
are then derived *on read* by comparing those stored timestamps against the current time. This is the
one design decision in the project most likely to be "improved" into a Celery beat schedule — do not.
It is correct for a 2-day build, it needs no infrastructure, and it cannot drift.

**The AI service is mocked, behind a real interface.** No Anthropic API key is available. The point is
to build the seam properly so a live client drops in through one environment variable. The mock must
return output shaped exactly like a real model's and varying with its input — a mock that returns a
constant string makes the AI panel in story 07 impossible to evaluate.

**The portal is a separate trust boundary.** Portal endpoints are not the agent endpoints with a
filter bolted on. A customer must never receive an internal note, an assignee's identity, an SLA
target, or another customer's existence, through any portal route.

---

## Acceptance criteria

```
SLA
1.  On ticket create, and on priority change, sla_service selects the matching SLAPolicy by
    (customer.tier, priority), falling back to a priority-only default policy, and writes
    sla_response_due_at and sla_resolution_due_at. Elapsed time is plain wall-clock; business
    hours are explicitly Phase 2.
2.  Breach state is computed on read, not stored as truth: a serializer field derives
    response_state and resolution_state as ok | approaching | breached, where approaching
    means elapsed >= policy.escalate_at_percent of the target. Each is returned with the
    remaining or overdue duration in seconds so the UI can render a countdown.
3.  first_response_at freezes the response clock permanently; resolved_at freezes resolution.
4.  POST tickets/{id}/assign/ with an empty body assigns round-robin across agents in the
    ticket's department where is_available is true, choosing the least-loaded on a tie, and
    writes a human-readable assignment_reason such as "auto-assigned (round-robin, Billing)".
    With no eligible agent it returns 409 and leaves the ticket unassigned.

KNOWLEDGE BASE
5.  kb/categories/ and kb/articles/ support list, retrieve, create, update. Only published
    articles are visible to non-agents; drafts are visible to their author, managers, admins.
6.  Search accepts ?q= and matches across title_en, title_ar, body_en, body_ar using icontains
    (Postgres full-text is Phase 2). Arabic queries return Arabic matches — test with real
    Arabic strings, not transliteration.
7.  Retrieving an article increments view_count without an extra round trip (F() expression).

REPORTS  (manager and admin only)
8.  reports/overview/     total, open, resolved-today, breached, avg first response,
                          avg resolution, CSAT average — respecting the caller's department scope
9.  reports/volume/       counts grouped by status, priority, channel and day, over ?days=N
10. reports/agents/       per agent: assigned, resolved, avg first response, SLA compliance %,
                          CSAT average
11. reports/csat/         distribution of scores 1-5 plus the average and response count
12. Every report is a single aggregate query per grouping. No Python-side loops over tickets.
    A test asserts the query count is bounded regardless of ticket volume.

AI  (mocked)
13. apps/ai/services/base.py defines AIBackend with summarize(ticket),
    suggest_reply(ticket, context) and categorize(subject, body). mock.py implements it
    deterministically but input-dependent: the summary must reference the real subject,
    customer and channel; suggest_reply must differ by category and language; categorize must
    return a real Category id plus a confidence float and a one-line rationale.
14. claude.py exists as a stub with the correct method signatures, a documented prompt per
    method, and a clear NotImplementedError. Selection is by the AI_BACKEND setting
    (mock | claude), default mock. Choosing claude without an API key fails loudly at startup,
    not on first request.
15. Endpoints ai/summarize/, ai/suggest-reply/, ai/categorize/ are agent-and-above only.
    summarize writes ai_summary onto the ticket; categorize writes ai_suggested_category.
    Neither ever changes the ticket's actual category, status or assignee, and neither ever
    creates a message. A test asserts an AI call cannot mutate ticket state beyond those two
    advisory fields.

PORTAL
16. portal/tickets/ list and create, portal/tickets/{id}/ retrieve, portal/tickets/{id}/messages/
    list and create, portal/csat/ create, portal/kb/articles/ list and retrieve.
17. Portal serializers are separate classes, not the agent ones. They expose: number, subject,
    status, category, created_at, resolution due date, and public messages only. They must NOT
    expose internal notes, assignee identity, department, SLA policy internals, escalation
    level, watchers, assignment_reason, or any AI field.
18. A customer creating a ticket may not set assignee, priority above normal, status, or
    department. Attempting to do so is ignored silently rather than erroring.
19. CSAT may be submitted once per ticket, only by that ticket's customer, and only when the
    ticket is resolved or closed. Second submission returns 409.
20. A regression test walks every field of every portal response and asserts none of the
    forbidden field names in criterion 17 appear anywhere in the payload.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** `04-customers-tickets-api`
- **Depends on code areas or other stories:** the ticket transition service and event logging from
  story 04 — SLA timestamp stamping hooks into it rather than duplicating it. Permission classes from
  story 03.

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

- Celery, Redis, APScheduler, or any background worker. Explicitly deferred; see the description.
- Real Claude API calls. `claude.py` is a documented stub and stays one.
- Postgres full-text search, `pgvector`, embeddings, RAG, and similar-ticket search. All Phase 2.
- Business-hours and holiday calendars in SLA arithmetic. Phase 2.
- Real email, WhatsApp, SMS or chat transports. `channel` remains a label.
- Any React work.
