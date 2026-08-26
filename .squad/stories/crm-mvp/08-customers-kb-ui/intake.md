> **Title hint (from CLI):** Customers & knowledge base UI

# Story intake

- Folder: `.squad/stories/crm-mvp/08-customers-kb-ui/intake.md`
- Project: **AZM Squad Customer Support CRM** — a 2-day MVP skills-assessment build.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** CRM MVP
- **Feature slug (folder under `plans/`):** `crm-mvp`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `08-customers-kb-ui`
- **Work item type:** Story

---

## Title

```
Customers & knowledge base UI
```

---

## Description

Two screens that complete the agent-side application: the customer 360 view and the
knowledge base.

**Customer 360** is what an agent opens mid-conversation to answer "who am I talking to and what has
happened before?". It must answer that in one screen without further clicks: identity and tier,
contacts, notes, attachments, and the complete ticket history with outcomes.

**Knowledge base** carries a requirement the rest of the app does not: articles are **genuinely
bilingual**, with separate Arabic and English titles and bodies on the same record. The editor must
make it obvious which language is being edited and which translation is missing — an article with an
English body and an empty Arabic one should be visibly incomplete, not silently half-published.

The small feature that ties this story back to story 07 is **insert-KB-link-into-reply**: from the
ticket composer an agent searches the knowledge base and inserts a link to an article without losing
the draft they were writing. That is the whole point of having a knowledge base inside a support tool,
and it is the piece most likely to be forgotten because it lives in another story's screen.

---

## Acceptance criteria

```
CUSTOMERS
1.  /app/customers: searchable, filterable (tier, branch) list showing name, company, tier
    badge, branch, open-ticket count and last-activity. Server-side pagination and search.
2.  /app/customers/:id — customer 360, single screen:
      header: name, company, tier badge, branch, preferred language, quick actions
              (new ticket for this customer, edit)
      contacts: all contacts, primary marked, add and edit inline
      notes: chronological, newest first, with add
      tickets: full history with status, priority, channel, created date, resolution time,
              each row linking to the ticket
      attachments: every file across that customer's tickets, with source ticket and date
3.  Creating a ticket from this screen pre-fills the customer and returns to the new ticket.

KNOWLEDGE BASE
4.  /app/kb: browse by category with an article count per category, plus search matching both
    languages. Draft articles are visible only to their author, managers and admins, and are
    clearly marked.
5.  /app/kb/:slug: article reader showing title and body in the active interface language,
    falling back to the other language with an explicit "Arabic version not available" style
    notice rather than an empty page. Shows category, author, updated date and view count, and
    offers a helpful / not-helpful control that increments helpful_count.
6.  /app/kb/new and /app/kb/:slug/edit: editor with side-by-side or tabbed English and Arabic
    fields, a visible completeness indicator per language, draft and publish states, and
    category assignment. The Arabic field renders RTL regardless of the interface language.
7.  Publishing an article with one language entirely empty warns before proceeding, and does
    not block — a single-language article is a legitimate choice, just not an accidental one.
8.  Unsaved-changes guard on both editor routes.

CROSS-STORY
9.  Insert-KB-link-into-reply: a control in the story 07 ticket composer opens a searchable
    article picker and inserts a link at the cursor. The existing draft text is preserved
    exactly. This is the acceptance criterion most at risk of being skipped — it must work.

THROUGHOUT
10. Both languages, verified against the artboards. RTL clean.
11. Loading skeletons and empty states everywhere; no spinner-on-white.
12. Vitest coverage for the language-fallback notice, the completeness indicator, the unsaved-
    changes guard, and draft visibility by role.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/Customer360.dc.html` | Customer detail: header stats, contacts, notes, ticket history, attachments |
| `attachments/KnowledgeBase.dc.html` | KB browse — categories, article list, article reader |
| `attachments/KBEditor.dc.html` | Bilingual article editor with per-language completeness indicators |
| `attachments/DesignSystem.dc.html` | Shared vocabulary |

These are **Design Component** files (`.dc.html`) — plain, self-contained HTML. Open them in a
browser or read them as source; the inline styles and exact values (colours, sizes, spacing, radii)
are the specification. Copy the numbers rather than approximating them.

Where an artboard and the acceptance criteria disagree, the **artboard wins on layout and visual
detail**, and the **criteria win on behaviour**.

The full canvas of all twelve artboards lives at `docs/design/` in the repository.
---

## Dependencies

- **Blocked by / related ids:** `07-agent-workspace`
- **Depends on code areas or other stories:** shared components from story 06; the ticket composer
  from story 07, which this story extends with the article picker.

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

- Rich-text or WYSIWYG editing. Plain textarea with Markdown is sufficient; a rich editor is
  Phase 2 and would consume most of this story's budget on its own.
- Article versioning, revision history, approval workflows. Phase 2.
- Postgres full-text search and Arabic stemming. Phase 2 — `icontains` is the MVP.
- Reports and the portal — story 09.
