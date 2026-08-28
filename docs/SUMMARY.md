# AZM Squad Customer Support CRM — hand-in summary

This is the single document a reviewer needs to assess the project. It links out to everything else
rather than repeating it — [`README.md`](../README.md) for quickstart and architecture,
[`docs/00-project-brief.md`](00-project-brief.md) for the full stack rationale and scope split,
[`docs/AI_USAGE.md`](AI_USAGE.md) for the per-story journal, [`docs/DEMO.md`](DEMO.md) for the
rehearsed walkthrough.

---

## 1. What was built

A multi-channel customer-support CRM in ten stories: ticket management with a state machine, SLA
tracking and escalation; a customer 360 view; a bilingual (Arabic/English) knowledge base; mocked
AI assistance (summarize, suggest-reply, categorize) behind a real pluggable interface; a
self-service customer portal (registration, submission, reply, CSAT); and manager reports with
KPI tiles that link through to the filtered queue behind each figure.

**Screenshots.** `docs/design/` holds each of the twelve artboards (`.dc.html`) alongside a
screenshot of the corresponding built screen (`.png`), captured against the running stack at each
artboard's own design width. See the table in §2 for the pairing; the mapping from artboard to live
route is:

| Artboard | Live route | Role |
|---|---|---|
| `Login.dc.html` | `/login` | unauthenticated |
| `Dashboard.dc.html` | `/app/dashboard` | `agent@demo` |
| `Main.dc.html` | `/app/tickets/:id` | `agent@demo` |
| `TicketWorkspaceRTL.dc.html` | `/app/tickets/:id` (Arabic) | `agent@demo` |
| `Customer360.dc.html` | `/app/customers/:id` | `agent@demo` |
| `KnowledgeBase.dc.html` | `/app/kb` | `agent@demo` |
| `KBEditor.dc.html` | `/app/kb/:slug/edit` | `manager@demo` |
| `Reports.dc.html` | `/app/reports` | `manager@demo` |
| `PortalHome.dc.html` | `/portal` | `customer@demo` |
| `PortalSubmit.dc.html` | `/portal/new` | `customer@demo` |
| `PortalTicket.dc.html` | `/portal/tickets/:id` | `customer@demo` |
| `DesignSystem.dc.html` | `/app/_kitchen-sink` (dev-only) | `agent@demo` |

---

## 2. The twelve requirement areas, mapped to implementation

Reused from the README rather than duplicated — see
[`README.md` § Requirement coverage](../README.md#requirement-coverage) for the full table of all
twelve PDF feature areas against the story and file that implements each.

---

## 3. Core versus deferred

Full table with reasons in
[`docs/00-project-brief.md` §3](00-project-brief.md#3-scope-split). In short: this MVP ships every
one of the twelve requirement areas at a working, demoable depth. What is deferred to Phase 2 is
listed there with the specific reason each is expensive (real email/WhatsApp/SMS/live-chat
transports, a RAG chatbot over the KB, Celery-backed background automation, a visual rule builder,
multi-tenancy, an Odoo/ERP connector, 2FA/SSO, and more) — none of it is a silent gap; each has a
one-line "why it is expensive" note in that table.

---

## 4. The SDD workflow, and what it changed

Ten stories, ten written intakes (`.squad/stories/crm-mvp/`), ten generated plans
(`.squad/plans/crm-mvp/`), one scoped implementation session each — never all ten planned up front.
Each plan's own "Context — Read These Files First" section pointed back at the *previous* story's
"as built" section in `00-overview.md`, and reading that before planning the next story caught
things a fresh read of the intake alone would have missed:

- **Story 04 lifted `breached_q` into a shared `sla_service` helper** after story 03's plan flagged
  that the breach condition would otherwise be written twice — once for filtering, once for display
  — and the two copies would drift the moment one changed.
- **Story 07's plan named six backend additions before writing a line of frontend code**, because
  story 06's as-built section had already surfaced that the shell needed reference endpoints
  (branches, departments) the backend API didn't yet expose — planned as backend work up front
  rather than discovered mid-implementation.
- **Story 08 named a whole bug *class*** — three separate mutations (`TicketViewSet.create`,
  `CustomerViewSet.update`, `KBArticleViewSet.create`/`update`) all poisoned their own TanStack Query
  cache the same way, by seeding it from a **write** serializer's narrower response instead of
  invalidating. Story 09's own plan explicitly told the next session to check this before writing
  any new mutation — and it still needed applying three more times.
- **Story 09's plan pre-emptively named two limitations** (no portal category picker, two
  non-linkable KPI tiles) as gaps to record rather than fix, reading them off story 08's own
  "what I learned" section about not silently expanding scope near the end of a project.
- **Story 10's own plan told this session to read `apiMock`'s substring-matching registration-order
  gotcha and the `ResponsiveContainer`-renders-nothing-at-0×0 jsdom quirk before starting** — both
  discovered the hard way in story 09, both would otherwise have cost another debugging cycle here.

The pattern held for ten stories straight: a plan that opens by reading what the previous session
actually found is measurably cheaper than one that only reads the original intake.

---

## 5. Elapsed time

Summed from `docs/AI_USAGE.md`'s ten per-story entries:

| Story | Elapsed |
|---|---|
| 00 — Planning, scope split, design canvas | — (planning session, not separately timed) |
| 01 — Foundation & scaffold | 0h 22m (+0h 18m Docker-verification addendum) |
| 02 — Domain models, admin, seed | ~0h 45m |
| 03 — Auth, RBAC, audit | ~0h 20m |
| 04 — Customers & tickets API | ~0h 30m |
| 05 — SLA, KB, reports, AI, portal API | ~0h 28m |
| 06 — App shell, auth flow, i18n/RTL | ~2h 15m |
| 07 — Agent workspace | ~1h 50m |
| 08 — Customers & knowledge base UI | ~2h 40m |
| 09 — Manager reports & customer portal | ~2h 20m |
| 10 — Delivery (this story) | ~3h 30m |
| **Total** | **~15h 18m** |

Against the project's own 2-day (~16 hour) budget. **Criterion 3 (Productivity) is scored partly on
this figure being visible rather than asserted** — it is visible here, summed from entries written
during each story rather than reconstructed for this document.

---

## 6. Honest limitations

- **AI is mocked.** `MockAIBackend` is deterministic per ticket and drafts replies in the customer's
  preferred language; `ClaudeAIBackend` has the real interface and prompts, selected by one
  environment variable, but no Anthropic key is configured for this project. An agent always
  approves before anything the AI drafts reaches a customer.
- **Email, WhatsApp, SMS and live chat are channel labels only.** The portal and the agent app are
  the two live transports; the other three tag a ticket's origin (badge, composer's "Sending via"
  label) without a real integration behind them.
- **SLA math is wall-clock, not business-hours-aware.** A due timestamp computed at 11pm Thursday
  counts the whole weekend against the clock. Business-hours calendars are Phase 2.
- **Knowledge-base search is `icontains`, not full-text.** No Arabic stemming, no ranking — a
  substring match across bilingual title/body fields. Postgres full-text search is Phase 2.
- **The customer portal has no category picker on the submit form.**
  `PortalTicketCreateSerializer.category` does accept a category id, but no portal-reachable
  endpoint lists what those ids are, and `src/api/portal.ts` may not import the agent-facing
  `useCategories()` — the same trust-boundary constraint criterion 14's own test enforces. The form
  submits `category: null` rather than fake a working control or quietly reach into the agent API.
  Recorded during story 09, not silently patched over in story 10.
- **Two of the six manager-report KPI tiles do not link through to a filtered queue.** SLA
  compliance % and CSAT average are not a filterable population — there is no `?sla_compliant=true`
  query a queue link could point at. The other four tiles (total, open, resolved-today, breached) do
  link through, verified live and by test.
- **Portal reply bodies render as plain text, not Markdown.** An agent's reply inserted via "Insert
  KB link" produces a Markdown link (`[Title](/app/kb/slug)`); the agent-side conversation renders
  it, but `PortalMessageSerializer`'s plain-text field means the customer sees the raw
  `[Title](url)` syntax in their own thread. Found during story 10's demo rehearsal (step 5→6);
  recorded here rather than fixed, since it is a cosmetic gap in an already-shipped feature (the
  link is followable by URL even unrendered) and this late in the project a UI change to the
  portal's message renderer is exactly the kind of scope story 10's own intake says not to add.

---

## 7. What Phase 2 would tackle first, and why

From `docs/00-project-brief.md`'s Part B, in priority order:

1. **A real email channel (IMAP/SMTP, threading, quote-stripping).** This alone unlocks the whole
   "Communication Channels" requirement area rather than one transport among several — most real
   support traffic starts as email, and the portal/agent app already prove the ticket model and SLA
   machinery work; email only needs a transport, not a data-model change.
2. **Business-hours-aware SLA calendars.** The SLA engine already exists and is exercised
   end-to-end; teaching it to skip nights and weekends is a bounded change to one service
   (`sla_service.compute_due_dates`) that immediately makes every SLA figure in the reports more
   credible, without touching any other subsystem.
3. **The Odoo/ERP connector.** The strongest differentiator available given the author's Odoo
   background — but it needs real field-mapping and conflict rules against a live Odoo instance to
   design honestly, which is why it comes after the two changes above rather than first: those two
   are self-contained and immediately useful; this one needs a design pass of its own before code.

The visual automation rule builder and the RAG chatbot are explicitly **not** in this top three —
each only improves an area (SLA automation, KB search) that already works at a basic level, whereas
email and business hours each fix something visibly incomplete in the MVP as it stands.

---

## 8. Ownership and corrections

Every moment across all ten stories where the AI was corrected, overruled, or where running the
actual system — not reading the plan — surfaced something a static review had missed. Each entry:
the decision, who made the call, and why.

1. **The stack was changed from the AI's initial FastAPI recommendation to Django + DRF** once the
   2-day timeline was fixed. *Made by the author*, recorded in `00-project-brief.md`'s revision
   note — FastAPI's advantages (streaming, WebSockets) do not apply to a mocked-AI, no-live-chat
   MVP, and Django's free auth/admin/migrations were the deciding factor under a hard deadline.
2. **The AI was instructed to narrate in plain language and commit nothing until reviewed.** *Made
   by the author*, a working-agreement decision that shaped every subsequent story's commit
   discipline (plan committed before implementation, on every one of the ten stories).
3. **A first draft of the project brief was left recommending FastAPI while the plan had already
   moved to Django** — a contradiction caught in review, not by the AI generating the draft. The
   file was rewritten with an explicit revision note rather than silently patched, so the
   correction itself stays visible in the document.
4. **The AI usage journal was planned to be written at the end of the project; the author made it a
   per-story rule instead**, specifically because *Technical Understanding & Ownership* is scored on
   understanding the work *during* implementation, not on a retrospective account written once
   everything is already finished and easy to describe as having gone smoothly.
5. **Story 01's health endpoint was widened from catching `OperationalError` to `django.db.Error`**
   during implementation, and running the container later proved the wider catch was necessary — a
   pooled dead connection raises a different exception than the narrower one the plan specified.
   Found by running the stack, not by reading the code.
6. **Story 01's Docker verification found a real port-collision bug** that static review of the
   compose file had missed entirely — the file parsed and read correctly; it simply did not run
   clean on the first attempt. This is exactly the class of finding a plan-only process cannot
   produce.
7. **Story 02's plan deviates from its own intake on ticket numbering** — a suggested counter-row
   design would have needed an eighteenth model the intake explicitly capped at seventeen. The
   deviation and its reasoning are recorded in the plan itself, not silently substituted.
8. **Story 02's ticket-numbering retry loop's jittered backoff was found load-bearing, not
   decorative**, by running the real concurrency test against PostgreSQL — the same test passes on
   SQLite without ever exercising the race SQLite's write-serialization hides. Simplifying the
   backoff away would have shipped a race condition invisible to the test suite's SQLite fallback.
9. **Story 03 rewrote two existing tests in the same commit as a scoping-rule tightening**
   (`scope_kb_articles`, story 08) rather than leaving them to silently pass on stale assumptions —
   a discipline maintained from story 03 onward whenever a later story narrowed an earlier rule.
10. **Story 07 discovered and named six backend additions the frontend needed** that its own plan's
    original backend-task list had not anticipated, because building the actual screen surfaced gaps
    a paper review of the API had not.
11. **Story 08 found and fixed a real bug class**: three separate mutations
    (`TicketViewSet.create`, `CustomerViewSet.update`, `KBArticleViewSet.create/update`) all poisoned
    their own TanStack Query cache by seeding it from a write serializer's narrower response instead
    of invalidating — found live in the browser (a crash on `formatRelative(undefined)`, a
    `.contacts.map is not a function` error), not by static review, and the fix rule was written
    into the plan for story 09 to check again rather than assuming it could not recur.
12. **Story 08 also found that a new ticket with no department was invisible to its own creator** —
    `scope_tickets` requires a department, assignee or watcher match, and a freshly created ticket
    with none of the three 404's on its own detail page immediately after a successful 201. Found by
    creating a real ticket and clicking through to it, not by reading the serializer.
13. **Story 09's `useBlocker` stale-closure race was found by publishing a real article** and
    watching the page get stuck on its own "discard unsaved changes?" prompt after a successful
    save — `useBlocker(dirty)`'s boolean form reads the previous render's value, not the current
    one. Fixed with a ref and the function form, and the fix pattern was written into the next
    story's plan as the reference implementation.
14. **Story 10's Arabic sweep found five real bugs by walking the live app in Arabic**, not by
    reading the code: `PortalTicketSerializer.status`/`.channel` used `get_..._display()` text
    (English-only regardless of session language) instead of the raw enum keys every other
    serializer exposes; the customer list's branch filter, the KB editor's category picker, and the
    new-ticket form's category/department pickers all rendered `name_en` unconditionally instead of
    switching on the active language; and the registration screen had no language toggle at all,
    unlike every other unauthenticated screen.
15. **Story 10's states audit found three screens with no error state at all** — the reports page,
    the customer list, and the portal home all failed a query silently, leaving stale or empty data
    on screen with no indication anything had gone wrong. Found by reading the actual `isPending`/
    `isError` destructuring in each file against the criterion, not by assuming "it probably has
    one" because other screens did.
16. **Story 10's `docs/DEMO.md` rehearsal found the single most serious bug of the project**: a
    ticket submitted through the customer portal was invisible to *every* agent and manager, because
    `PortalTicketViewSet.perform_create` never set a `department`, and `scope_tickets` matches an
    agent's queue on department, assignee, or watcher — none of which a portal ticket had. This was
    only found by actually registering as a customer, submitting a ticket, and then searching for it
    in an agent's queue — exactly what a plan-only or code-review-only pass would not have caught,
    because the code reads correctly in isolation; the bug is in what it does *not* set. Fixed by
    defaulting new portal tickets to the "general" department, with a dedicated regression test.
17. **A missing i18n key was caught by the tooling itself, not by reading the code**: configuring
    `missingKeyHandler` to throw in development (added specifically to catch exactly this class of
    bug) immediately crashed the composer with `i18next: missing key "composer.insertKbLink"` — a
    typo from story 07 that had shipped silently as a raw key string on screen for three stories
    because i18next's default behaviour is to render the key rather than fail.

---

## Appendix: repository layout for the SDD process

`.squad/plans/crm-mvp/00-overview.md` holds all ten stories' "as built" sections in full — the
primary source for every claim in this document. `.squad/stories/crm-mvp/` holds the ten intakes;
`.squad/plans/crm-mvp/` holds the ten generated plans. The commit history shows a `plan(NN): ...`
commit before every `feat(NN): ...` commit, story by story.
