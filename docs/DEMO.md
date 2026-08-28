# Demo script

Rehearsed end to end against a freshly seeded database during story 10 (2026-08-29), not written
from memory. One real bug surfaced during this rehearsal and is fixed in the same commit — see the
note after step 3.

**Before you start:** `docker compose down -v && docker compose up -d --build`, then
`docker compose exec api python manage.py migrate && docker compose exec api python manage.py seed_demo`.
Every login below uses the password `Demo!2345`.

---

### 1. Portal registration

Open http://localhost:5173/portal/register. Register a new account — any name, any email not
already seeded (e.g. `demo@example.com`), any 8+ character password. Submitting logs you straight
in; there is no separate "now sign in" step. You land on `/portal` showing an empty ticket list (a
brand-new registration has no history).

### 2. Submit a request

Click **Submit a request**. Fill in a subject and description — there is deliberately no priority,
assignee, department, category or status field on this form; a customer does not set any of those.
Submitting shows the real ticket number and the target response date the backend computed
(`TK-01xx`, "We aim to respond by <date>").

### 3. The agent sees it, unassigned

Sign out (or open a private window) and sign in as `agent@demo`. Open `/app/tickets` and search for
the ticket number or subject from step 2. It appears in the queue, status **New**, with no assignee.

> **A real bug found here during rehearsal, fixed in the same commit.** The first time this script
> was run for real, the ticket from step 2 was **invisible to every agent and manager** — `PortalTicketViewSet.perform_create`
> never set a `department`, and `scope_tickets` shows an agent only work in their own department,
> assigned to them, or watched by them; a `department=None` ticket matches none of the three for
> anyone except an admin. Fixed by defaulting new portal tickets to the "general" department
> (`apps/portal/views.py`), with a regression test (`test_story10_department_routing.py`) asserting a
> fresh portal ticket is visible to at least one non-admin agent or manager. If you seeded before
> this fix landed, a portal ticket you cannot find in any agent's queue is why.

Open the ticket. Click **Assign to me**.

### 4. The AI panel

Click **Generate summary**. A one-paragraph mock summary appears (deterministic per ticket, drafted
from the ticket's own fields — no real AI backend is configured, see the README's mocked/deferred
statement). Nothing here sends anything to the customer on its own.

### 5. Insert a KB link, then reply

Click **Insert KB link** in the composer toolbar. Search or pick any article (e.g. "Ticket
priorities explained") — a Markdown link is inserted at the cursor. Type a sentence before or after
it and confirm the rest of your draft is untouched. Click **Send reply**.

### 6. An internal note, invisible to the portal

Switch the composer to **Internal note**, write anything, and save it. Switch to the **Internal
notes** tab and confirm it is there. Then sign back in as the *customer* from step 1–2 and open the
same ticket in the portal — the internal note does not appear anywhere in the conversation; only the
public reply from step 5 does. (`PortalMessageSerializer` never carries `is_internal`, and
`scope_ticket_messages` filters it server-side — there is no client-side hiding to bypass.)

### 7. Escalate, then resolve

Back as the agent, click **Escalate** (a reason is optional), confirm. The ticket moves to the
Escalated queue tab and the Activity log records it. Click **Resolve**, confirm. Status becomes
Resolved.

### 8. Portal CSAT — rate, then reload

As the customer, open the resolved ticket. A five-star rating input appears (only because the ticket
is Resolved or Closed — try it on a still-open ticket and there is no widget at all). Pick a rating.
It switches to a read-only display immediately. **Now hard-reload the page.** The read-only rating
is still there — this is the point of the test: the rating is read from `PortalTicketSerializer.csat`
on the GET response, not held in local component state that a reload would lose. Rating the same
ticket again returns a 409, which the UI treats as "already rated," not as an error toast.

### 9. Manager reports — a KPI tile that opens its own queue

Sign in as `manager@demo`, open `/app/reports`. Note the "Open" tile's count. Click it — it opens
`/app/tickets` pre-filtered to the open statuses within the report's window, and the queue's own "N
open" header matches the tile's number exactly. Switch the date range (7 / 30 / 90 days) and watch
the six tiles and four charts update.

### 10. Switch to Arabic mid-walkthrough

On any screen above — the reports page is a good one, since it has the most going on — click the
**ع** toggle. The whole page re-renders in Arabic: `<html dir="rtl">`, the chrome mirrors (nav
position, chevrons), the two chart Y-axes move to the right edge, ticket numbers and emails stay
left-to-right inside the Arabic text (`.mono-ltr`), and nothing shows a raw untranslated key or an
orphaned English word. Story 10's Arabic sweep found and fixed five real instances of the latter
before this script was written — see `docs/AI_USAGE.md`'s story 10 entry.

### 11. Django admin

Open http://localhost:8000/admin/, sign in as `admin@demo`. This is the back-office Django supplies
for free: every model — users, departments, branches, categories, SLA policies, canned replies, the
audit log — with working list, search and change views, none of it hand-built.

---

## What this script deliberately does not cover

- **Attachments** — both the portal submit form and ticket replies accept file uploads (validated
  client-side against the same 10 MB / sixteen-content-type limits the backend enforces); exercising
  this is a two-line addition to steps 2 and 5 if a reviewer wants to see it, omitted here to keep
  the script to one sitting.
- **The responsive breakpoints** (1280 / 1024 / 375px) and the twelve artboard screenshots are their
  own verification passes, documented in `docs/SUMMARY.md` rather than folded into this walkthrough.
- **The category picker on portal submission** does not exist — noted as a named limitation in the
  README and `docs/SUMMARY.md`, not a step this script pretends to demonstrate.
