> **Title hint (from CLI):** Agent workspace: ticket queue & detail

# Story intake

- Folder: `.squad/stories/crm-mvp/07-agent-workspace/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `07-agent-workspace`
- **Work item type:** Story

---

## Title

```
Agent workspace: ticket queue & detail
```

---

## Description

The centrepiece screen, and the one the reviewer will spend the most time in. Build
the three-pane agent workspace from the design artboard, plus the agent dashboard.

Layout: **queue on the left, conversation in the centre, context on the right.** The attached artboard
is the specification for spacing, hierarchy and colour — follow it closely.

Details from the design that matter and are easy to drop:

- Queue rows carry a priority badge, ticket number, **channel badge**, subject, customer name, and a
  **live SLA countdown** that turns red on breach and reads `Breached 14m`, not `-14m`.
- Queue tabs are **All / Mine / Escalated / Breaching** and each shows a count.
- The ticket header has a status dropdown alongside distinct **Escalate** and **Resolve** buttons.
- The centre pane has **three tabs — Conversation, Internal notes, Activity log** — each with a count.
  Public replies and internal notes are separate tabs, not one interleaved thread.
- An **AI SUMMARY** banner sits above the thread with a *Show detail* affordance.
- The composer toggles Reply / Internal note, states *Sending via {channel}*, offers quick-reply chips,
  an attach control, and a **Suggest reply** button.
- The right pane has tabs *Customer / History / Notes*, and below the customer card an **SLA block**
  with both progress bars, targets and policy name, then an **Assignment block** showing the owner,
  the assignment provenance text, tags and watchers.

Two behavioural requirements the artboard cannot express. **The SLA countdown must tick** — a value
computed once at render is wrong within a minute, and the reviewer will notice. **Every mutation must
be optimistic and reversible**: assigning, changing status or sending a reply updates the interface
immediately and rolls back visibly if the request fails.

---

## Acceptance criteria

```
QUEUE (left pane)
1.  Tabs All / Mine / Escalated / Breaching, each with a live count, each mapping to backend
    filters from story 04 — never filtering client-side over a fetched page.
2.  Filters for status, priority, category, channel and assignee, plus a search box matching
    subject, ticket number and customer name. Filter state lives in the URL query string, so a
    filtered queue is a shareable link and survives reload.
3.  Rows render exactly the fields listed in the description. Server-side pagination or
    infinite scroll; the selected ticket stays highlighted.
4.  The countdown re-renders on a one-second interval driven by a single shared timer, not one
    interval per row. It crosses into the breached style without a refresh.

DETAIL (centre pane)
5.  Header: number, priority badge, channel badge, opened-relative-time, subject, status
    dropdown, Escalate, Resolve. Escalate opens a reason prompt; Resolve opens a resolution
    note prompt. The status dropdown offers only transitions the backend permits from the
    current status — read them from the API, do not hardcode the map a second time.
6.  Three tabs, each with a count: Conversation (public messages), Internal notes, Activity
    log (TicketEvent rows rendered as readable sentences: "Omar changed priority from Normal
    to High", not raw field diffs).
7.  AI SUMMARY banner above the thread, populated from ai_summary, with Show detail expanding
    to the full text and a control to regenerate. While generating it shows a loading state,
    and on failure a dismissible error — never a silent empty banner.
8.  Composer: Reply / Internal note toggle that visibly restyles the field so the two modes
    can never be confused; a "Sending via {channel}" label; quick-reply chips from
    canned-replies that insert at the cursor; attach with client-side type and size validation
    matching the backend's; Suggest reply calling ai/suggest-reply/ and inserting the result
    as editable draft text that is never auto-sent.
9.  An unsent draft survives navigating away and back within the session.

CONTEXT (right pane)
10. Tabs Customer / History / Notes. Customer: tier badge, email, phone, WhatsApp, branch,
    preferred language, open-ticket count, and a link to the customer 360 page (story 08).
    History: that customer's other tickets, each linked. Notes: customer notes, with add.
11. SLA block: first-response and resolution progress bars in ok / approaching / breached
    styling, each with target, policy name and remaining-or-overdue time.
12. Assignment block: current owner with avatar, the assignment_reason text, an Assign-to-me
    action and an assignee picker, tags, and the watcher count.

DASHBOARD
13. /app/dashboard: tiles for my open tickets, tickets breaching within the hour, unassigned in
    my department, and resolved by me today; a list of my most urgent tickets by SLA; and my
    CSAT average. Every tile links into a correspondingly pre-filtered queue.

THROUGHOUT
14. All mutations are optimistic with rollback and an error toast on failure.
15. Every screen has a real loading skeleton and a real empty state. No spinner-on-white.
16. Both languages render correctly with no layout breakage; verify against the RTL artboard.
17. Vitest coverage for the countdown crossing a breach boundary, the transition dropdown
    offering only permitted statuses, the internal-note toggle restyling, and optimistic
    rollback on a failed mutation.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/Main.dc.html` | **The primary specification for this story.** Three-pane workspace: queue, conversation, context |
| `attachments/Dashboard.dc.html` | Agent dashboard — tiles, urgent list, CSAT distribution, saved filters |
| `attachments/TicketWorkspaceRTL.dc.html` | The same workspace in Arabic/RTL |
| `attachments/DesignSystem.dc.html` | Badge, button and SLA-state vocabulary this screen consumes |

These are **Design Component** files (`.dc.html`) — plain, self-contained HTML. Open them in a
browser or read them as source; the inline styles and exact values (colours, sizes, spacing, radii)
are the specification. Copy the numbers rather than approximating them.

Where an artboard and the acceptance criteria disagree, the **artboard wins on layout and visual
detail**, and the **criteria win on behaviour**.

The full canvas of all twelve artboards lives at `docs/design/` in the repository.
---

## Dependencies

- **Blocked by / related ids:** `04-customers-tickets-api`, `05-sla-kb-reports-ai-api`, `06-app-shell-i18n`
- **Depends on code areas or other stories:** the shared components from story 06 — `DataTable`,
  `StatusBadge`, `PriorityBadge`, `ChannelBadge`, `SlaBar`, `EmptyState`, `Skeleton`, `ConfirmDialog`,
  toasts. Use them. If one needs a new prop, extend it in place and update its kitchen-sink entry.

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

- The customer 360 page — story 08. Link to the route; it may 404 until then.
- Knowledge base browsing and the insert-KB-link-into-reply control — story 08.
- Reports and the portal — story 09.
- Ticket merge, split, link, bulk actions, saved views, and @mentions. All Phase 2.
