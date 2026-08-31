> **Title hint (from CLI):** Suggested solutions AI feature

# Story intake

- Folder: `.squad/stories/crm-advanced/11-suggested-solutions/intake.md`
- Project: **AZM Squad Customer Support CRM** — closing the fourth of five PDF "AI Features"
  sub-bullets, done post-hand-in as a small, scoped Phase-2 slice rather than the whole Phase-2
  backlog at once.
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** Suggested solutions
- **Feature slug (folder under `plans/`):** `crm-advanced`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `11-suggested-solutions`
- **Work item type:** Story

---

## Title

```
Suggested solutions — surface already-resolved tickets like this one
```

---

## Description

The requirements PDF's "AI Features" area lists five sub-items: ticket summaries, suggested
replies, automatic categorization, suggested solutions, and an AI chatbot. The MVP (story 05)
built the first three, mocked behind `apps/ai/services/base.py`'s `AIBackend` interface, and
`docs/00-project-brief.md` deferred the remaining two to Phase 2.

This story closes **suggested solutions** only. The AI chatbot stays deferred — it needs a live
LLM to be credible in a demo (a scripted chatbot response is obviously fake in a way a one-line
ticket summary is not), and no Anthropic API key is available for this project, same reasoning as
the rest of the AI panel.

**What it does.** When an agent opens a ticket, the system finds other tickets that already have
a resolution and look like this one — same category, or overlapping words in the subject — and
shows them as a short list: subject, how it was resolved (the resolution message or note, per
`ticket_service.resolve`'s existing `resolution_note` → public `TicketMessage` write), and how
long ago. The agent reads the list and reuses a fix instead of researching from scratch.

**No embeddings, no vector store, no live model.** The existing `MockAIBackend` pattern already
proves the point that a mocked-but-genuinely-input-dependent AI feature is convincing in a demo:
`categorize`'s substring-hint matching and `summarize`'s per-ticket seeded templates are both
"a smart-looking database query", not machine learning. `suggest_solutions` should be the same
kind of thing — a real, explainable ranking over `Ticket.objects` (same category first, then
subject-keyword overlap, most-recently-resolved as the tiebreak), not a call to any external
service. This keeps it consistent with the existing backend's `name = "mock"` / `name = "claude"`
seam: `ClaudeAIBackend` gets the fourth method as a documented `NotImplementedError` stub, exactly
like the other three, so swapping to a live backend later is still one environment variable.

**Where it's shown.** The ticket detail's AI panel (`frontend/src/features/tickets/
AiSummaryBanner.tsx`) currently has one card: the summary. `suggest_reply` isn't shown as a card
at all — it likely lives behind a composer button (check `Composer.tsx` before assuming) — and
`categorize`'s result (`ai_suggested_category`) has **no frontend surface at all** today, confirmed
by grep. Suggested solutions needs its own small, clearly-labelled card in that same AI-panel
area, not a new route or screen — this is meant to feel like the fourth item in an existing
family, matching the existing violet-tinted AI-card visual language.

---

## Acceptance criteria

```
BACKEND
1.  apps/ai/services/base.py's AIBackend gains an abstract `suggest_solutions(ticket) -> list[dict]`,
    each dict shaped `{"ticket_id": int, "number": str, "subject": str, "resolution": str,
    "resolved_at": str}`. `resolution` is the ticket's most recent public (non-internal)
    TicketMessage body if one exists after resolved_at, else "" — never fabricated text.
2.  apps/ai/services/mock.py implements it: candidates are other tickets with
    status in (resolved, closed), excluding the ticket itself, ranked by (a) same category as
    the ticket, (b) shared significant words in the subject (case-insensitive, stopwords
    excluded), (c) most recently resolved_at as the final tiebreak. Returns at most 3.
    Zero matches returns an empty list — a "no similar tickets found" state is legitimate and
    the frontend must handle it, not something to force a fake result for.
3.  apps/ai/services/claude.py gains the same method as a documented stub raising
    NotImplementedError, with the intended prompt in a module-level constant, matching the
    existing SUMMARIZE_PROMPT / SUGGEST_REPLY_PROMPT / CATEGORIZE_PROMPT pattern exactly.
4.  A new read-only endpoint `GET ai/suggested-solutions/?ticket=<id>` (or the existing AIView's
    POST pattern — planner's call, but stay consistent with whichever the other three endpoints
    use for symmetry) returns the list, agent-or-above only, ticket resolved through
    scope_tickets like every other AI endpoint — a ticket outside the caller's scope is 404,
    not a leak of that ticket's resolution history.
5.  This endpoint writes nothing. Unlike summarize/categorize, "suggested solutions" is
    read-only advice about *other* tickets, not the current one — there is no advisory column
    on Ticket to write to. A test asserts calling it never changes the current ticket row nor
    any of the referenced past tickets.
6.  The ticket being viewed is never returned as its own "similar" suggestion (self-exclusion),
    and a ticket with no other resolved tickets in its category or with matching keywords
    returns an empty list rather than an error.

FRONTEND
7.  A new "Suggested solutions" card in the same visual family as AiSummaryBanner.tsx's existing
    summary card, in the ticket detail's AI panel area, showing the returned list: each item's
    subject (as a link to that past ticket's detail page), the resolution text, and a relative
    time ("resolved 3 days ago", reusing `formatRelative`). Same generate-on-demand pattern as
    the summary card (a button that fires the request; no auto-fetch on every ticket open) is
    the planner's call to confirm, weighed against a plain auto-loaded card given this endpoint
    is read-only and free of side effects unlike summarize's ai_summary write.
8.  Empty state ("no similar tickets found") is a real, dismissible-feeling state, not a blank
    gap — matching the project's own established EmptyState conventions elsewhere.
9.  Bilingual: the card's own labels are in both en.json/ar.json, following the existing `ai.*`
    key namespace pattern (ai.summary, ai.generate, etc.).

TESTS
10. Backend: the ranking test (same category ranks above keyword-only match; most-recent-resolved
    breaks ties; self-exclusion; empty-list-on-no-match; the read-only/no-mutation test from
    criterion 5; the out-of-scope-ticket-is-404 test matching the other three AI endpoints'
    existing tests in apps/ai/tests/test_ai_advisory.py).
11. Frontend: the card's three states (has results / empty / loading), and that clicking a
    suggested ticket's subject navigates to that ticket's detail page.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** none — builds on the completed `crm-mvp` feature (story 05's AI
  service, story 07's AI panel), no new story blocks it.
- **Depends on code areas or other stories:** `apps/ai/services/{base,mock,claude}.py`,
  `apps/ai/views.py`, `apps/ai/urls.py`, `apps/ai/serializers.py`, `apps/ai/tests/
  test_ai_advisory.py` (story 05); `frontend/src/features/tickets/AiSummaryBanner.tsx`,
  `frontend/src/api/ai.ts` (story 07); `apps/accounts/scoping.py::scope_tickets` (story 03).

## Extra notes

- This is the second post-hand-in addition (after the notification centre closed the SLA &
  Automation area's "alerts and notifications" item) — same pattern: pick one Phase-2 line item
  that's genuinely cheap and consistent with the existing architecture, build it for real, and
  leave the rest honestly documented as deferred rather than half-building several things.
- `docs/00-project-brief.md`'s Part B table currently lists "Suggested solutions from similar
  past tickets | Semantic search, dedup, relevance evaluation" as the reason it was deferred —
  that reasoning was written assuming a real semantic-search implementation. This story
  deliberately does NOT do semantic search; it does the same "convincing mock" the other three
  AI features already do. The project brief's deferred-items table should be updated once this
  ships, the same way "notification centre" was removed from it after that story shipped.

## Technical hints

APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `python`.

**Stack — fixed, do not re-litigate.** Backend: Python 3.12, Django 5, DRF 3.15, PostgreSQL 16 via
Docker Compose. Frontend: React 19, TypeScript, TanStack Query, Tailwind, i18next. No new
dependency should be needed for this story — it is one method on an existing interface, one
endpoint, and one card in an existing panel.

**Existing patterns to reuse, not reinvent:**
- `apps/ai/services/mock.py`'s `_rng(seed_text)` pattern only matters where output needs to vary
  stably per input for test purposes (e.g. picking which of several equally-ranked resolution
  messages to show, if that ever comes up) — the ranking itself should be a real, deterministic
  database ordering, not seeded randomness, since "which ticket is most similar" is a real
  computable answer here, unlike the flavour text in `summarize`.
- `AIView.get_ticket()` in `apps/ai/views.py` is the existing scope-and-fetch-or-404 helper every
  other AI endpoint uses — reuse it rather than writing a second version.
- `frontend/src/api/ai.ts`'s `useSummarize`/`useSuggestReply` hooks are the pattern for the new
  `useSuggestedSolutions` hook — check whether this one should be a `useQuery` (read-only, GET)
  rather than a `useMutation` like the other two (which are POST and have a "generate" action
  with a side effect on the first two, or no persisted state on suggest-reply) — the planner
  should pick based on what's actually true here: no ticket-state mutation happens, so a `useQuery`
  with a manual `refetch()` triggered by a button (matching AiSummaryBanner's "click to generate"
  UX without needing a mutation) is likely the better fit, but confirm against TanStack Query
  conventions already used elsewhere in this codebase before deciding.

## Out of scope

- Real semantic search, embeddings, or `pgvector` — that is what `docs/00-project-brief.md`
  actually deferred, and stays deferred. This story is a keyword/category database query only.
- Any change to `summarize`, `suggest_reply`, or `categorize` — they are done and untouched.
- The AI chatbot (the fifth AI Features sub-item) — explicitly staying deferred; see Description.
- Applying a suggested solution automatically (e.g. auto-filling the reply composer from a past
  resolution) — the agent reads the suggestion and acts on it themselves, consistent with "an
  agent always approves" holding for every AI feature in this project.
- Ranking quality beyond the simple category-then-keyword-then-recency rule above — no TF-IDF,
  no fuzzy matching, no configurable weighting.
