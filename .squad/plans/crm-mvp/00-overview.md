# crm-mvp — plan overview

Entry point for the **crm-mvp** feature: a 2-day MVP of the AZM Squad Customer Support CRM
(Django 5 + DRF, React 19 + Vite, PostgreSQL, Docker Compose). Stories execute in order by their
`NN` prefix. Scope, stack rationale and the core-vs-deferred split live in `docs/00-project-brief.md`.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-01-foundation.md](01-story-01-foundation.md) | Foundation & scaffold | — | None |
| 02 | _not yet planned_ | Domain models, Django admin, demo seed | — | Story 01 |
| 03 | _not yet planned_ | Auth, roles & permissions, audit log | — | Story 02 |
| 04 | _not yet planned_ | Customers & tickets REST API | — | Story 03 |
| 05 | _not yet planned_ | SLA, knowledge base, reports, AI & portal API | — | Story 04 |
| 06 | _not yet planned_ | App shell, auth flow, Arabic/English RTL | — | Stories 03, design canvas |
| 07 | _not yet planned_ | Agent workspace: ticket queue & detail | — | Stories 04, 06 |
| 08 | _not yet planned_ | Customers & knowledge base UI | — | Story 07 |
| 09 | _not yet planned_ | Manager reports & customer portal | — | Stories 05, 08 |
| 10 | _not yet planned_ | Delivery: RTL sweep, docs, summary | — | All |

Each story's intake is at `.squad/stories/crm-mvp/<id>/intake.md`. Plans are generated one at a time
with `/squad-plan`, immediately before that story is implemented — not all ten up front, so each plan
reflects what the previous story actually produced.

## Dependency notes

**Day 1 is stories 01–05 (backend); day 2 is 06–10 (frontend).**

Story 01 creates the seven Django apps (`accounts`, `customers`, `tickets`, `kb`, `ai`, `reports`,
`portal`) with **empty** `models.py` files. Story 02 fills them in a single migration pass and sets
`AUTH_USER_MODEL` — which is why story 01 must **not** set it, and why the app names are fixed in
story 01's plan rather than chosen later.

Story 03 delivers permission classes and `get_queryset()` scoping helpers; stories 04, 05 and the
portal endpoints consume them rather than writing their own access logic. This is the DRF equivalent
of Odoo's two-layer `ir.model.access` plus record rules, and having only the first layer is the
failure mode the story 03 plan calls out explicitly.

Story 05 is the last backend story: after it the API is complete and day 2 is purely frontend.

Story 06 establishes the shared component vocabulary (`DataTable`, `StatusBadge`, `PriorityBadge`,
`ChannelBadge`, `SlaBar`) and the no-directional-utility rule that makes the Arabic RTL flip a
translation pass in story 10 rather than a rescue. Stories 07–09 assemble from that vocabulary.

Frontend stories 06–09 each carry the relevant design artboards in their `attachments/` folder.
Squad-kit's planner reads only the intake and its attachments, so those files must stay attached —
a linked-but-not-attached design is invisible to it.

## Phase 2

Deferred work (real email/WhatsApp/SMS/chat transports, RAG chatbot, automation rule builder,
Odoo ERP connector, multi-tenancy, custom report builder) lands under a separate `crm-advanced`
feature slug starting at NN 11. See `docs/00-project-brief.md` part B.
