# AI usage journal

One entry per story, written **while the work is fresh** — not reconstructed at the end.
This file is the raw material for `docs/SUMMARY.md`, the final hand-in document.

Template for every entry:

```markdown
## Story NN — <title>          (elapsed: Xh Ym)
**What I asked for:** one or two sentences.
**What the AI built:** the files created or changed, and what each does.
**Decisions the AI made on its own:** and why.
**What I had to correct:** what went wrong and how it was fixed.
**What I learned:** the Odoo-vs-Django difference or new concept this story surfaced.
```

**Rule: no story is finished until its entry is written here.**

---

## Story 00 — Planning, scope split, and design canvas          (elapsed: —)

**What I asked for:** Read the company's requirements PDF, recommend a stack suited to an Odoo
developer, split the twelve feature areas into a core MVP and an advanced phase, break the MVP into
several squad-kit stories rather than one, and produce a design so I can see what the product looks
like.

**What the AI built:**

- `docs/00-project-brief.md` — stack rationale, the Odoo→Django concept map, the core-versus-advanced
  split across all 12 requirement areas, the 10-story map, and how the four grading criteria are met.
- `.squad/` — a squad-kit workspace for this project, with 10 story intakes under
  `stories/crm-mvp/`, each carrying its own description, acceptance criteria, dependencies,
  out-of-scope list, and attachments.
- `docs/design/` — 12 `.dc.html` artboards covering every screen, plus `canvas.json` and the
  published canvas at https://claude.ai/code/artifact/217bc985-1f5c-4817-af6c-4aaacbda09a9
- `docs/AI_USAGE.md` — this file.

**Decisions the AI made on its own:**

- *Recommended FastAPI first, then accepted Django when I chose it* — and agreed Django was the
  better call once the timeline was fixed at two days, because `contrib.auth` and Django admin
  remove two to three stories of work.
- *Django admin is the product's back-office.* No React screens for users, roles, branches,
  categories, SLA policies or the audit log. This is the single largest time saving in the plan.
- *SLA needs no scheduler.* Due timestamps are computed on create; breach and escalation state are
  derived on read. No Celery, no APScheduler, no background worker in the MVP.
- *Email, WhatsApp, SMS and live chat became channel labels rather than transports*, behind a
  common abstraction. Real transports need paid accounts and platform review, which do not fit in
  two days.
- *A minimal SLA stayed in scope* even though I did not select it, because it is core area 5 in the
  requirements and costs under an hour. Flagged for me to drop if I disagreed.
- *Typography set to IBM Plex Sans / Plex Sans Arabic / Plex Mono*, because Arabic is a hard
  requirement and needed a family with a genuine Arabic cut.
- *Arabic flips completely, chrome included.* My own first design draft left the top chrome in
  English/LTR and raised it as an open question; the AI decided a half-flipped header reads as a bug
  to an Arabic reviewer.
- *The design artboards were attached to the story intakes as files*, not linked, because
  squad-kit's planner reads only the intake and its `attachments/` folder — a linked design would
  have been invisible to it.

**What I had to correct:**

- The first plan assumed 2–3 weeks and 12 stories; I set the real timeline at 2 days and it was
  re-scoped to 10 stories.
- The first stack recommendation was FastAPI; I chose Django + DRF.
- The AI initially left `docs/00-project-brief.md` recommending FastAPI throughout while the plan had
  moved to Django. I caught it, and the whole file was rewritten rather than patched in one row.
- The AI planned to write this journal at the end of the project. I pointed out that my company
  grades on understanding what happened *during* implementation, so it became a per-story rule.

**What I learned:**

- The Odoo→Django mapping that makes the rest of this project readable: `models.Model` →
  `django.db.models.Model`; `ir.model.access` and record rules → DRF permission classes plus
  `get_queryset()` scoping — **two layers, and only having the first is the classic mistake**;
  `mail.thread` chatter → `TicketMessage` + `TicketEvent`; Odoo's backend list/form views → Django
  admin; `ir.cron` → a management command.
- Spec-driven development front-loads the arguing. Every decision that would otherwise have been
  made mid-implementation — status transitions, what the portal may never expose, where SLA is
  computed — is settled in an intake file before a line of code exists.
