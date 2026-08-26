> **Title hint (from CLI):** Manager reports & customer portal

# Story intake

- Folder: `.squad/stories/crm-mvp/09-reports-portal-ui/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `09-reports-portal-ui`
- **Work item type:** Story

---

## Title

```
Manager reports & customer portal
```

---

## Description

Two audiences neither previous frontend story served: the manager who never opens a
ticket, and the customer outside the company.

**Manager reports** must answer four questions on one screen without scrolling to find them: are we
keeping our promises (SLA compliance), how much is coming in and through which channels (volume), who
is carrying the load (agent performance), and are customers satisfied (CSAT). Every number must be
clickable through to the underlying filtered ticket list — a dashboard whose figures cannot be
interrogated is decoration.

**The customer portal is a different product wearing the same design system.** It is not the agent app
with fields hidden. Different layout, different navigation, dramatically less information. A customer
sees their own tickets and the published knowledge base, and nothing else — no assignee names, no
internal notes, no SLA targets, no department structure. The backend already enforces this in story
05; the frontend must not undermine it by requesting agent endpoints and filtering client-side.

The portal is also where the reviewer's demo begins. It is the first screen in `docs/DEMO.md`, so its
first impression matters more than its feature count.

---

## Acceptance criteria

```
MANAGER REPORTS  (/app/reports, manager and admin only)
1.  KPI tiles: total open, resolved today, SLA compliance percentage, average first response,
    average resolution, CSAT average. Each tile states the period it covers.
2.  Charts via Recharts: ticket volume by status (bar), volume over time by channel (line),
    SLA compliance (donut), and CSAT score distribution (bar). All read RTL correctly with
    axes and legends mirrored.
3.  Agent performance table: assigned, resolved, average first response, SLA compliance %,
    CSAT average per agent. Sortable on every column.
4.  A date-range selector — last 7 / 30 / 90 days — applying to every tile and chart at once,
    held in the URL.
5.  Every KPI tile and every chart segment links through to the ticket queue pre-filtered to
    exactly the population it counted. A test asserts one such link produces a queue whose
    result count matches the tile.
6.  CSV export of the agent performance table.
7.  Charts have explicit empty states. A range with no data shows a message, not broken axes.

CUSTOMER PORTAL
8.  /portal/login and registration. Registration links the new user to a Customer record by
    email where one matches, and otherwise creates one.
9.  /portal: the customer's own tickets with status, subject, last update and channel, split
    into open and closed, plus a prominent "Submit a request" action and knowledge-base search.
10. /portal/new: submit form with subject, description, category and attachments, validated
    with zod, showing inline errors. On submit it confirms with the ticket number and the
    resolution target date. It does not expose priority, assignee, department or status.
11. /portal/tickets/:id: subject, number, status, category, created date, resolution target,
    the public conversation only, and a reply box with attachments. No internal notes, no
    assignee identity, no SLA policy internals, no escalation state.
12. CSAT: when a ticket is resolved or closed, a 1-5 star widget with an optional comment
    appears. It submits once; afterwards it shows the submitted rating read-only.
13. /portal/kb: browse and search published articles, in the customer's language with the
    same fallback notice as story 08.
14. The portal uses only /api/v1/portal/* endpoints. A test asserts no portal screen calls an
    agent endpoint — this is the frontend half of story 05's trust boundary.
15. The portal shell is visibly distinct from the agent app: its own header, no agent
    navigation, no global search over customers, no Admin link.

THROUGHOUT
16. Both languages, RTL clean, verified against the artboards.
17. Loading skeletons and empty states throughout.
18. Vitest coverage for the KPI-to-queue link, the CSAT single-submission rule, and the
    portal-endpoint-only assertion.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/Reports.dc.html` | Manager reports — KPI tiles, volume bars, SLA donut, agent table |
| `attachments/PortalHome.dc.html` | Portal home — search hero, open requests, closed requests |
| `attachments/PortalSubmit.dc.html` | Submit-a-request form with SLA expectation notice |
| `attachments/PortalTicket.dc.html` | Portal request detail with the CSAT widget |

These are **Design Component** files (`.dc.html`) — plain, self-contained HTML. Open them in a
browser or read them as source; the inline styles and exact values (colours, sizes, spacing, radii)
are the specification. Copy the numbers rather than approximating them.

Where an artboard and the acceptance criteria disagree, the **artboard wins on layout and visual
detail**, and the **criteria win on behaviour**.

The full canvas of all twelve artboards lives at `docs/design/` in the repository.
---

## Dependencies

- **Blocked by / related ids:** `05-sla-kb-reports-ai-api`, `08-customers-kb-ui`
- **Depends on code areas or other stories:** shared components from story 06; the KB reader
  behaviour and language-fallback notice from story 08, reused rather than reimplemented for the
  portal's article view.

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

- A custom report builder, scheduled email exports, forecasting. All Phase 2.
- Live chat, a chat widget, and any real-time updating. Phase 2 — the portal polls or refetches
  on focus.
- Email notifications to customers on ticket updates. Phase 2, since it needs a real mail transport.
- CSAT surveys delivered over email or WhatsApp. Phase 2.
