# crm-advanced — plan overview

Entry point for the **crm-advanced** feature — Phase 2 items from `docs/00-project-brief.md` Part B,
picked off one at a time post-hand-in rather than planned all at once. Stories execute in order by
their `NN` prefix, continuing the global sequence `crm-mvp` ended at (01–10).

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 11 | [11-story-suggested-solutions.md](11-story-suggested-solutions.md) | Suggested solutions | — | `crm-mvp` stories 03, 05, 07 |
| 12 | [12-story-live-chat.md](12-story-live-chat.md) | Live chat | — | `crm-mvp` stories 04, 05, 07, 08/09 |

## Dependency notes

Each `crm-advanced` story is deliberately independent of the others — there is no fixed backlog
order, only the priority read off `docs/00-project-brief.md`'s Part B table at the time a story is
picked. Story 11 depends only on completed `crm-mvp` work (the AI service seam, the AI panel, and
ticket scoping), not on any other `crm-advanced` story. Story 12 depends only on completed
`crm-mvp` ticket/portal API and UI work — not on story 11.

### As built

**Story 11 — Suggested solutions.** *(filled in after implementation)*

**Story 12 — Live chat.** Implemented on branch `feature/live-chat`, **not merged into `dev`** per
explicit instruction. Confirmed the backend already accepted `channel: "chat"` on both ticket
creation and message-sending with zero code changes; the story is almost entirely a scoped
frontend change — a `live` parameter on `useTicketMessages`/`usePortalMessages` setting
`refetchInterval: 4000` only for `channel === "chat"` tickets (the codebase's first polling query),
and a "Start a live chat" portal entry point. 3 new backend tests, 5 new frontend tests, all green.
Live-verified end to end in the running app: agent → portal and portal → agent messages each
appeared within the 4-second interval with no reload. Full detail in `docs/AI_USAGE.md`.
