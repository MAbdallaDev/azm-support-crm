> **Title hint (from CLI):** Live chat (real-time channel)

# Story intake

- Folder: `.squad/stories/crm-advanced/12-live-chat/intake.md`
- Project: **AZM Squad Customer Support CRM** — closing the last unimplemented item in the PDF's
  "Communication Channels" area (Email, WhatsApp, SMS and Web forms are already real label+message
  flows through the existing `Ticket`/`TicketMessage` channel field; "Live chat" has so far been a
  name only — a `Channel.CHAT` choice nothing ever sets from a live conversation).
- The planner reads **this file and the files in `attachments/`**, nothing else.

---

## Feature

- **Feature name (display):** Live chat
- **Feature slug (folder under `plans/`):** `crm-advanced`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `12-live-chat`
- **Work item type:** Story

---

## Title

```
Live chat — a real, near-real-time channel between the customer and the agent
```

---

## Description

The requirements PDF's "Communication Channels" area lists five channels: Email, WhatsApp, Live
chat, SMS, Web forms. `docs/SUMMARY.md` already flags this area as the weakest-covered (36%) —
every channel is a label on `Ticket.channel`/`TicketMessage.channel`, but only the portal's own
"Web" submissions and the agent's manual replies are things a human actually did *through* this
app; Email/WhatsApp/SMS stay labels with no real transport, honestly documented as deferred.

This story closes **Live chat specifically**, because — unlike Email/WhatsApp/SMS, which need a
real external transport (IMAP, a WhatsApp Business API key, an SMS gateway) this project has none
of — a live chat's "transport" is just this app's own existing REST API, used more frequently while
a conversation is actively open. No new infrastructure is required to make it real, only a UX
entry point and a short polling loop.

**What it does.** A customer in the portal gets a **"Start a live chat"** entry point, distinct
from "Submit a request" (`SubmitTicket.tsx`) — no subject/description form, since a live-chat
start shouldn't require filling out a ticket form. It creates a ticket with `channel: "chat"` (or
reuses an existing open one, so repeat clicks don't spawn duplicate chat tickets) and drops the
customer straight into that ticket's conversation view. From that point it is the **same**
conversation UI and the **same** `TicketMessage` model and endpoints every other channel already
uses on both sides (`PortalTicketDetail.tsx` for the customer, `TicketDetail.tsx`'s Conversation
tab for the agent) — no new message model, no new endpoints for sending or reading messages.

The one genuinely new behavior: **while a chat-channel ticket's conversation view is open, both
sides poll for new messages every few seconds**, instead of only refreshing on their own
send-a-message mutation like today. That's what turns "you can reply on this ticket" (already true
for every channel) into "this feels like a live conversation" (true for none today).

**This is the app's first polling query — say so, don't pretend otherwise.** Confirmed by
research: `frontend/src/api/notifications.ts` explicitly chose *not* to poll ("a live-updating
badge with no interaction would be the app's first polling query"), and the global `QueryClient`
default (`frontend/src/main.tsx`) has `refetchOnWindowFocus: false` with no `refetchInterval`
anywhere in the codebase today. This story is where that line gets crossed, deliberately and
narrowly: the interval applies **only** to a mounted conversation view **whose ticket's channel is
`chat`** — every other channel's conversation tab (email, whatsapp, sms, web) keeps today's
fetch-once behavior, since a polling loop makes no product sense for a channel that is inherently
asynchronous by nature. TanStack Query's own default (`refetchIntervalInBackground: false`) already
stops the loop while the tab is backgrounded — no extra code needed for that part, just don't
override the default.

---

## Acceptance criteria

```
BACKEND
1.  No new models, no new endpoints. Confirmed already true and to stay true:
    `TicketMessageSerializer` (agent side, apps/tickets/serializers.py) already accepts an
    arbitrary `channel` on write, falling back to the ticket's own channel only when omitted
    (apps/tickets/views.py's messages action) — chat messages need zero backend change here.
    `PortalTicketCreateSerializer` (apps/portal/serializers.py) already lists `channel` as a
    writable field — the portal's ticket-creation endpoint needs zero backend change either.
    The portal's message-send endpoint already forces `channel=ticket.channel` server-side
    (apps/portal/views.py) — a chat-channel ticket's portal replies are chat-channel automatically,
    with no client-supplied channel needed or accepted there.
2.  A backend test confirming a portal-created ticket with `channel: "chat"` actually persists
    that channel (this capability already exists in the serializer but has no test pinning it,
    since the frontend never exercised it before this story) — a regression here would silently
    turn every "started" live chat back into a `web` ticket.

FRONTEND
3.  A "Start a live chat" entry point on the portal home (`PortalHome.tsx`, alongside the existing
    "New request" CTA) that: looks for an existing ticket of the current customer with
    `channel === "chat"` and an open status (reusing the same open-status set `SubmitTicket`/
    `PortalHome` already treat as "open" elsewhere in the portal) and navigates straight there if
    found; otherwise calls the existing `useSubmitPortalTicket` mutation with `channel: "chat"`
    and a fixed subject/description (no form shown to the customer — e.g. a translated
    "Live chat started" placeholder subject), then navigates to `/portal/tickets/:id` on success.
4.  `useTicketMessages` (agent, `frontend/src/api/tickets.ts`) and `usePortalMessages` (portal,
    `frontend/src/api/portal.ts`) each gain a `refetchInterval` (in the 3–5 second range — planner
    picks the exact value) applied **conditionally**: only when the ticket being viewed has
    `channel === "chat"`. Every other channel keeps today's fetch-once-plus-refetch-on-mutation
    behavior exactly as it is now — this is a targeted addition, not a global polling default.
5.  No visual change to `ChannelBadge.tsx` needed — `chat`'s violet badge + `MessageSquare` icon
    and the `channel.chat` i18n key already exist and render correctly; confirm via a quick look,
    do not touch this file unless something is actually found broken.
6.  New portal i18n keys for the "Start a live chat" CTA and its placeholder subject, in both
    `en.json` and `ar.json`, following the existing `portal.*` key namespace.

TESTS
7.  Frontend: the polling hooks apply `refetchInterval` for a `channel: "chat"` ticket and do
    **not** apply it for a `channel: "email"` (or any other non-chat) ticket — this is the
    regression guard against the interval silently spreading to every conversation view.
8.  Frontend: "Start a live chat" creates a new chat ticket and navigates to it when the customer
    has none open; reuses (navigates to, does not re-create) an existing open chat ticket when one
    already exists.
9.  Backend: the test from acceptance criterion 2 above.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** none — builds entirely on completed `crm-mvp` work (story 04's
  ticket/message API, story 05's portal API, story 08/09's portal UI, story 07's agent workspace).
- **Depends on code areas or other stories:** `apps/tickets/{models,views,serializers}.py`,
  `apps/portal/{views,serializers}.py` (all existing, no changes expected beyond the one test in
  criterion 2); `frontend/src/features/tickets/TicketDetail.tsx`, `frontend/src/api/tickets.ts`
  (`useTicketMessages`); `frontend/src/features/portal/{PortalHome,PortalTicketDetail,
  SubmitTicket}.tsx`, `frontend/src/api/portal.ts` (`usePortalMessages`,
  `useSubmitPortalTicket`); `frontend/src/components/ui/ChannelBadge.tsx` (read-only check, no
  expected change); `frontend/src/i18n/{en,ar}.json`.

## Extra notes

- This is the fourth post-hand-in addition (after MVP polish, the notification centre's SLA-breach
  extension, and the search dropdown's message-body-search + snippet-highlight work) — same
  pattern each time: pick one genuinely-cheap, architecture-consistent slice of a documented gap
  and build it for real, rather than half-building several things or reaching for infrastructure
  (Django Channels, Redis, WebSockets) this project's stack was never meant to carry.
- `docs/00-project-brief.md` and `docs/SUMMARY.md`'s Communication Channels coverage note should be
  updated once this ships, the same way the notification centre's entry was updated after that
  story shipped — Live chat moves from "label only" to "real", Email/WhatsApp/SMS stay honestly
  labelled as deferred (they need external transports this project doesn't have credentials for).
- Per explicit instruction: implement this story but **do not merge it into `dev`** — it stays on
  its own branch until told otherwise, same as the SLA-breach notification work before it.

## Technical hints

APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `python`.

**Stack — fixed, do not re-litigate.** Backend: Python 3.12, Django 5, DRF 3.15, PostgreSQL 16 via
Docker Compose. Frontend: React 19, TypeScript, TanStack Query, Tailwind, i18next. No new
dependency needed — this story is entirely REST + a scoped `refetchInterval`, no WebSocket
library, no Channels, no Redis.

**Existing patterns to reuse, not reinvent:**
- `apps/tickets/views.py`'s `messages` action's `channel=serializer.validated_data.get("channel")
  or ticket.channel` fallback is exactly the mechanism that already lets an agent's reply on a
  chat ticket land as `channel="chat"` with zero extra code — do not add a separate "send chat
  message" endpoint.
- `useSendMessage` (`frontend/src/api/tickets.ts`) and `useSendPortalMessage`
  (`frontend/src/api/portal.ts`)'s existing `onSuccess` cache-append pattern should stay exactly
  as-is; the new polling only affects the read side (`useTicketMessages`/`usePortalMessages`), not
  the send side, since an optimistic append plus periodic re-sync from the server is the same
  pattern most chat UIs use, not a contradiction.
- Whichever "is this ticket open" status set `SubmitTicket.tsx`/`PortalHome.tsx` already use
  elsewhere for filtering — reuse that exact set for "does the customer already have an open chat
  ticket," rather than inventing a second definition of "open."
- `useTicketMessages`/`usePortalMessages`'s new `refetchInterval` should be a plain conditional
  number-or-false based on the already-loaded ticket's `channel` field (both hooks already have
  the ticket object or its id in scope at the call site) — no new query param, no backend
  involvement in deciding whether to poll.

## Out of scope

- Django Channels, WebSockets, Server-Sent Events, Redis, or any push-based transport — explicitly
  staying inside the existing REST + polling architecture, per the description above.
- Typing indicators, read receipts, presence ("customer is online"), or delivery ticks — none of
  these exist in the current `TicketMessage` model and none are required for "live chat" to be a
  real, working channel. A small typing-indicator UI polish may be added *only if time allows*
  after the required criteria are met — it is not part of "done" for this story.
- Chat between two staff members (agent-to-agent) — this is customer-to-agent, on a ticket, like
  every other channel.
- A dedicated full-screen chat route/layout distinct from the existing ticket conversation view —
  the same `TicketDetail.tsx` Conversation tab and `PortalTicketDetail.tsx` reply UI serve chat
  exactly as they serve every other channel today.
- Real transports for Email, WhatsApp, or SMS — those stay exactly as deferred as they were before
  this story; only Live chat is being closed here.
