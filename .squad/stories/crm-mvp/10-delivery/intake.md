> **Title hint (from CLI):** Delivery: RTL sweep, docs, summary

# Story intake

- Folder: `.squad/stories/crm-mvp/10-delivery/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `10-delivery`
- **Work item type:** Story

---

## Title

```
Delivery: RTL sweep, docs, summary
```

---

## Description

The story that turns a working application into a submitted project. Nothing here is
optional, and none of it is decoration — three of the company's four grading criteria are settled in
this story rather than in any code written before it.

Four blocks of work.

**The Arabic sweep.** Every screen, in Arabic, compared against the RTL artboard. Stories 06 to 09
each verified their own screens in isolation; this is the first pass that walks the entire application
in one language and finds the seams between them — an untranslated key here, a mirrored icon there, a
date formatted in the wrong calendar.

**The demo path.** `docs/DEMO.md` is the script the reviewer follows, and it must work start to finish
against a freshly seeded database. Rehearse it. A demo script that has never been run end to end will
fail in front of the person grading it.

**The summary.** `docs/SUMMARY.md` is the single hand-in document. It is assembled from the ten
`AI_USAGE.md` journal entries written along the way — which is why they had to be written along the
way. It must be honest about what is mocked and what is deferred; a reviewer who discovers an
undisclosed limitation trusts nothing else in the document.

**The final check.** Fresh clone, `docker compose up`, seed, demo path. Exactly what the reviewer will
do, done once by us first.

---

## Acceptance criteria

```
ARABIC AND RESPONSIVE SWEEP
1.  Every route walked in Arabic and compared to its artboard: login, dashboard, ticket queue,
    ticket detail, customer list, customer 360, KB browse, KB article, KB editor, reports, and
    all four portal screens. Findings fixed, not filed.
2.  Zero untranslated keys. A script asserts every key present in en.json exists in ar.json
    and that no component renders a raw key string.
3.  The directional-utility check from story 06 passes across the whole of src/.
4.  Every screen usable at 1280px, 1024px and 375px. The three-pane workspace collapses
    sensibly on narrow viewports rather than overflowing horizontally.
5.  Dates, times and durations render through one shared formatter, correct in both locales.

STATES
6.  Every list has a real empty state, every async view a skeleton, every failed request a
    readable error with a retry. No raw exception text and no spinner-on-white anywhere.
7.  A 404 route and an error boundary that reports rather than blanking the page.

SEED AND DATA
8.  seed_demo extended so every screen looks populated and credible in a screenshot: reports
    have enough history for the 90-day range to be non-trivial, CSAT has a real distribution,
    the KB has genuine Arabic content, and the queue shows all SLA states at once.
9.  The four demo logins are documented in the README with their passwords and what each role
    is able to see.

DOCUMENTATION
10. README.md: what the project is, the 12 requirement areas and where each is implemented,
    quickstart, the four demo logins, architecture overview, the Odoo-to-Django concept map,
    why Django was chosen over FastAPI, how to run the tests, and a plain statement of what is
    mocked and what is deferred.
11. docs/DEMO.md: the numbered walkthrough — portal submit, agent assign, AI panel, KB link,
    internal note invisible to the customer, escalate, resolve, CSAT, manager reports, Arabic
    switch, Django admin. Each step names what the reviewer should see. Rehearsed end to end
    against a fresh seed before this story is closed.
12. docs/design/ holds every artboard alongside a screenshot of the built screen, so design
    and implementation can be compared side by side.
13. docs/AI_USAGE.md holds ten entries, one per story, each in the template from
    00-project-brief.md section 5, each with elapsed time. Backfilling here is a failure of
    the process — the entries exist already and are only checked for completeness.
14. docs/SUMMARY.md, the hand-in document, covering:
      - what was built, with screenshots
      - all 12 requirement areas mapped to where each is implemented
      - the core-versus-deferred split, with the reason for each deferral
      - the SDD workflow followed: 10 intakes, 10 plans, one scoped session each, and what
        that changed about how the work went
      - total elapsed time and time per story
      - honest limitations: AI is mocked; email, WhatsApp, SMS and live chat are labels;
        SLA uses wall-clock rather than business hours; search is icontains
      - what Phase 2 would tackle first and why
      - **an "Ownership and corrections" section** — the company scores "Technical Understanding
        & Ownership: explains decisions, debugs, adapts the solution and avoids blind AI
        dependency" (weight 5). The evidence is scattered through AI_USAGE.md and no reviewer
        will assemble it. Collect every moment the AI was corrected, overruled or verified, each
        naming the decision, who made it and why. Already on record: the stack changed from the
        AI's FastAPI recommendation to Django once the timeline was fixed; a stale brief was
        caught contradicting the plan; the journal was made per-story rather than written at the
        end; story 01's health-check exception was widened from OperationalError to
        django.db.Error and running the container later proved it necessary; story 02's plan
        deviates from its own intake on ticket numbering with the reasoning recorded; and story
        01's Docker verification found a port-collision bug that static review had missed.

FINAL VERIFICATION
15. Fresh clone into an empty directory, docker compose up --build, migrate, seed_demo, then
    the whole of DEMO.md. Every step passes with no manual intervention beyond the documented
    commands.
16. Backend pytest green. Frontend vitest green. npm run build green.
17. The .squad/ directory ships in the repository: 10 intakes, 10 generated plans,
    00-overview.md and 00-index.md, so the SDD process is visible to the reviewer.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/TicketWorkspaceRTL.dc.html` | The RTL reference for the Arabic sweep |
| `attachments/DesignSystem.dc.html` | The vocabulary every screen must still match at the end |

These are **Design Component** files (`.dc.html`) — plain, self-contained HTML. Open them in a
browser or read them as source; the inline styles and exact values (colours, sizes, spacing, radii)
are the specification. Copy the numbers rather than approximating them.

Where an artboard and the acceptance criteria disagree, the **artboard wins on layout and visual
detail**, and the **criteria win on behaviour**.

The full canvas of all twelve artboards lives at `docs/design/` in the repository.
---

## Dependencies

- **Blocked by / related ids:** every story, 01 through 09.
- **Depends on code areas or other stories:** the nine `docs/AI_USAGE.md` entries written during
  stories 01–09. If any is missing, write it from the git history for that story before assembling
  `SUMMARY.md`, and record in the journal that it was reconstructed rather than written live.

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

- Any new feature. If something is missing, it is documented as deferred, not built here.
- Deployment, hosting, CI/CD pipelines, and production hardening.
- A recorded video walkthrough. `DEMO.md` is the script; recording it is the developer's own step.
- Phase 2 stories. They are listed in `SUMMARY.md` and scaffolded later under `crm-advanced`.
