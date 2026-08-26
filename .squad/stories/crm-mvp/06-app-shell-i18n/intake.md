> **Title hint (from CLI):** App shell, auth flow, Arabic/English RTL

# Story intake

- Folder: `.squad/stories/crm-mvp/06-app-shell-i18n/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `06-app-shell-i18n`
- **Work item type:** Story

---

## Title

```
App shell, auth flow, Arabic/English RTL
```

---

## Description

First frontend story. Build the application shell every later screen sits inside: the
API client, the authentication flow, the top chrome, the shared component vocabulary, and full
Arabic/English support with a genuine right-to-left flip.

**Do the RTL work now, not at the end.** Retrofitting direction-awareness onto finished screens means
auditing every margin, every icon, every chevron. Doing it here costs one rule: **no directional
spacing utilities anywhere in the codebase.** `ms-*` and `me-*`, never `ml-*` or `mr-*`. `ps-*` and
`pe-*`, never `pl-*` or `pr-*`. `text-start` and `text-end`, never `text-left` or `text-right`. If
that rule holds from this story onward, the Arabic mode in story 10 is a translation pass rather than
a rescue operation. Add a lint rule or a CI grep that fails the build on a directional utility.

The Arabic flip is **total**: `<html dir="rtl" lang="ar">`, navigation translated, the sidebar moving
to the right, chevrons mirrored. A half-flipped interface with an English header reads as a bug to an
Arabic-speaking reviewer, not as a design choice.

The shared components defined here are the vocabulary the rest of the build speaks. Get their APIs
right and stories 07 to 09 become assembly.

---

## Acceptance criteria

```
API CLIENT
1.  src/api/client.ts wraps axios: attaches the access token, and on a 401 refreshes once and
    replays the original request. Concurrent 401s share a single refresh, not one each.
    A failed refresh clears the session and redirects to the correct login route — /login for
    agents, /portal/login for customers.
2.  Typed hooks per resource in src/api/, built on TanStack Query, with query keys
    centralised in one place so invalidation cannot drift.

AUTH
3.  /login: email and password, react-hook-form + zod, inline field errors, a readable message
    for bad credentials, a loading state on the button, and no double submit.
4.  Protected routes redirect unauthenticated users to login preserving the intended
    destination, and send the user onward to it after a successful login.
5.  Role-aware routing: a customer landing on /app/* is redirected to /portal, and an agent
    landing on /portal/* is redirected to /app/dashboard.

SHELL
6.  Top chrome matching the design artboard: the AZM Squad / Support CRM lockup, navigation
    for Dashboard, Tickets, Customers, Knowledge base, Reports and Admin, a global search
    field, an EN / ar language toggle, and a user chip showing name, tier and team with a
    menu offering profile and sign out. The Admin item links to Django admin at /admin/.
7.  Navigation items the current role cannot access are not rendered at all, rather than
    rendered and then rejected on click.

I18N AND RTL
8.  i18next with src/i18n/en.json and src/i18n/ar.json. Every visible string in this story
    comes from a translation key. No literal user-facing text in a component.
9.  The language toggle sets dir and lang on <html>, persists the choice to localStorage, and
    applies the logged-in user's `language` field on first load.
10. Arabic mode flips completely: layout direction, sidebar and chrome position, and
    directional icons. Numerals stay Western (0-9); dates render through a shared formatter
    so the choice is made once.
11. The codebase contains no directional Tailwind utility. A CI-runnable check greps for
    ml-, mr-, pl-, pr-, text-left, text-right, left-, right- in src/ and fails on a hit.

SHARED COMPONENTS  (src/components/ui/, each with a Vitest test)
12. DataTable       sortable columns, pagination, loading skeleton, empty state, RTL-aware
    StatusBadge     all 8 ticket statuses, colour-coded, bilingual labels
    PriorityBadge   low / normal / high / urgent
    ChannelBadge    web / email / whatsapp / sms / chat, each with its icon
    SlaBar          a progress bar plus remaining or overdue time, in ok / approaching /
                    breached states, counting down live without re-rendering the whole page
    EmptyState, Skeleton, ConfirmDialog, and a toast helper
13. A Storybook-style demo route at /app/_kitchen-sink renders every component in every state
    in both languages. It is the fastest way to review this story and to catch RTL breakage
    in later ones. Exclude it from the production build.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/DesignSystem.dc.html` | Palette, type scale, badge vocabulary, SLA states, buttons, inputs — **build these as the shared components this story delivers** |
| `attachments/Main.dc.html` | Top chrome: lockup, navigation, global search, EN/ع toggle, user chip |
| `attachments/Login.dc.html` | Agent sign-in screen |
| `attachments/TicketWorkspaceRTL.dc.html` | The Arabic/RTL reference — what a complete flip looks like, including the chrome |

These are **Design Component** files (`.dc.html`) — plain, self-contained HTML. Open them in a
browser or read them as source; the inline styles and exact values (colours, sizes, spacing, radii)
are the specification. Copy the numbers rather than approximating them.

Where an artboard and the acceptance criteria disagree, the **artboard wins on layout and visual
detail**, and the **criteria win on behaviour**.

The full canvas of all twelve artboards lives at `docs/design/` in the repository.
---

## Dependencies

- **Blocked by / related ids:** `03-auth-rbac-audit` (needs working JWT endpoints);
  design artboards from story 00.
- **Depends on code areas or other stories:** the Vite scaffold, Tailwind config, shadcn setup,
  axios instance and i18next initialisation from story 01. Extend them; do not re-scaffold.

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

- The ticket queue and ticket detail screens — story 07.
- Customers and knowledge base screens — story 08.
- Reports and the customer portal — story 09.
- Filling `ar.json` for screens that do not exist yet. Translate what this story renders; later
  stories add their own keys as they go.
- Any backend change. If an endpoint is missing or wrong, note it in the journal rather than
  patching the API from a frontend story.
