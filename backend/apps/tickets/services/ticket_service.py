"""Ticket business logic — the single writer of `Ticket.status`.

Odoo mental map: this is `ir.actions.server`. Business logic lives beside the
model, not inside the view, so a management command, a DRF action and story 05's
SLA logic all reach the same rules.

**Nothing else may assign `Ticket.status`.** If a viewset sets it directly, the
Activity log develops holes and story 05's SLA numbers quietly go wrong, because
`first_response_at` and `resolved_at` are exactly what the SLA clock reads.

`TicketEvent` and `AuditLog` are both written and they are not the same thing:
`TicketEvent` is the user-facing Activity log tab, `AuditLog` (story 03, via
signals) is the security trail. Do not conflate them.
"""

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.tickets.models import Status, Ticket, TicketEvent, TicketMessage

# The state machine. A move not listed here is refused.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Status.NEW: {Status.OPEN, Status.ESCALATED},
    Status.OPEN: {Status.PENDING, Status.ON_HOLD, Status.ESCALATED, Status.RESOLVED},
    Status.PENDING: {Status.OPEN, Status.ESCALATED, Status.RESOLVED},
    Status.ON_HOLD: {Status.OPEN, Status.ESCALATED},
    Status.ESCALATED: {Status.OPEN, Status.RESOLVED},
    Status.RESOLVED: {Status.CLOSED, Status.REOPENED},
    Status.CLOSED: {Status.REOPENED},
    Status.REOPENED: {Status.OPEN, Status.ESCALATED, Status.RESOLVED},
}

# The Activity log vocabulary, matching the intake.
EVENT_CREATED = "created"
EVENT_ASSIGNED = "assigned"
EVENT_STATUS_CHANGED = "status_changed"
EVENT_PRIORITY_CHANGED = "priority_changed"
EVENT_ESCALATED = "escalated"
EVENT_MESSAGE_ADDED = "message_added"
EVENT_NOTE_ADDED = "note_added"
EVENT_ATTACHMENT_ADDED = "attachment_added"
EVENT_RESOLVED = "resolved"
EVENT_REOPENED = "reopened"

EVENT_TYPES = (
    EVENT_CREATED,
    EVENT_ASSIGNED,
    EVENT_STATUS_CHANGED,
    EVENT_PRIORITY_CHANGED,
    EVENT_ESCALATED,
    EVENT_MESSAGE_ADDED,
    EVENT_NOTE_ADDED,
    EVENT_ATTACHMENT_ADDED,
    EVENT_RESOLVED,
    EVENT_REOPENED,
)

OPEN_STATUSES = {
    Status.NEW,
    Status.OPEN,
    Status.PENDING,
    Status.ON_HOLD,
    Status.ESCALATED,
    Status.REOPENED,
}


class InvalidTransition(Exception):
    """Raised for a status change the map does not allow.

    Deliberately not a DRF exception. This module is also called by management
    commands and, in story 05, by the SLA and assignment logic; importing
    `rest_framework` here would drag HTTP concerns into business logic. The
    viewset catches this and re-raises as `ValidationError`.
    """

    def __init__(self, current: str, target: str):
        self.current, self.target = current, target
        super().__init__(f"Cannot move a ticket from '{current}' to '{target}'.")


def log_event(ticket, actor, event_type, field="", old="", new=""):
    """The single `TicketEvent` writer. Every mutation goes through here."""
    return TicketEvent.objects.create(
        ticket=ticket,
        actor=actor if actor is not None and actor.is_authenticated else None,
        event_type=event_type,
        field=field,
        old_value=str(old or "")[:160],
        new_value=str(new or "")[:160],
    )


@transaction.atomic
def transition_status(ticket, target, actor, note=""):
    """Move a ticket through the state machine, stamping the right timestamps."""
    current = ticket.status
    if target == current:
        raise InvalidTransition(current, target)
    if target not in ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidTransition(current, target)

    now = timezone.now()
    ticket.status = target
    updates = ["status", "updated_at"]

    if target == Status.RESOLVED:
        ticket.resolved_at = now
        updates.append("resolved_at")
    elif target == Status.CLOSED:
        ticket.closed_at = now
        updates.append("closed_at")
    elif target == Status.REOPENED:
        # Cleared, not left stale: story 05's SLA clock reads these, and a
        # reopened ticket that still claims a resolution time would report a
        # resolution that did not hold.
        ticket.resolved_at = None
        ticket.closed_at = None
        updates += ["resolved_at", "closed_at"]

    ticket.save(update_fields=updates)
    log_event(
        ticket, actor, EVENT_STATUS_CHANGED, field="status", old=current, new=target
    )
    if target == Status.RESOLVED:
        log_event(ticket, actor, EVENT_RESOLVED, new=note)
    elif target == Status.REOPENED:
        log_event(ticket, actor, EVENT_REOPENED, new=note)
    return ticket


def pick_least_loaded_agent(ticket):
    """The naive interim assignment the intake asks for.

    Fewest tickets still open, among available agents in the ticket's
    department. Proper round-robin with its own provenance string is story 05.
    Returns None when the department has nobody available — the caller leaves
    the ticket unassigned rather than guessing.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    candidates = User.objects.filter(role=User.Role.AGENT, is_available=True)
    if ticket.department_id:
        candidates = candidates.filter(department_id=ticket.department_id)

    return (
        candidates.annotate(
            load=Count(
                "assigned_tickets",
                filter=Q(assigned_tickets__status__in=OPEN_STATUSES),
            )
        )
        .order_by("load", "pk")
        .first()
    )


@transaction.atomic
def assign(ticket, assignee, actor, reason=""):
    """Set the assignee, or pick one when `assignee` is None."""
    previous = ticket.assignee

    if assignee is None:
        assignee = pick_least_loaded_agent(ticket)
        if assignee is not None and not reason:
            department = ticket.department.name_en if ticket.department_id else "unassigned queue"
            reason = f"auto-assigned (least loaded, {department})"

    ticket.assignee = assignee
    ticket.assignment_reason = reason[:160]
    ticket.save(update_fields=["assignee", "assignment_reason", "updated_at"])
    log_event(
        ticket,
        actor,
        EVENT_ASSIGNED,
        field="assignee",
        old=previous.get_username() if previous else "",
        new=assignee.get_username() if assignee else "",
    )
    return ticket


@transaction.atomic
def escalate(ticket, actor, reason=""):
    """Raise the escalation level and move to ESCALATED.

    The level is incremented even when the ticket is already escalated — a
    second escalation is a real event and story 07 renders the level. The
    status move is skipped in that case rather than raising, because
    ESCALATED → ESCALATED is not a transition.
    """
    if ticket.status != Status.ESCALATED:
        transition_status(ticket, Status.ESCALATED, actor)

    ticket.escalation_level = (ticket.escalation_level or 0) + 1
    ticket.escalated_at = timezone.now()
    ticket.save(update_fields=["escalation_level", "escalated_at", "updated_at"])
    log_event(
        ticket,
        actor,
        EVENT_ESCALATED,
        field="escalation_level",
        old=ticket.escalation_level - 1,
        new=ticket.escalation_level,
    )
    return ticket


@transaction.atomic
def resolve(ticket, actor, resolution_note=""):
    """Resolve, recording the note as a public reply the customer can read."""
    transition_status(ticket, Status.RESOLVED, actor, note=resolution_note)
    if resolution_note:
        TicketMessage.objects.create(
            ticket=ticket,
            author=actor if actor is not None and actor.is_authenticated else None,
            body=resolution_note,
            is_internal=False,
            channel=ticket.channel,
        )
        log_event(ticket, actor, EVENT_MESSAGE_ADDED, new="resolution note")
    return ticket


def record_first_response(ticket):
    """Stamp `first_response_at`, exactly once.

    A conditional UPDATE, not a read-then-write. The obvious version —
    `if ticket.first_response_at is None: ticket.save()` — has a race: two
    agents replying at the same moment both read None, and the second write
    overwrites the first, moving the timestamp later and flattering the SLA
    number. The filtered `update()` is atomic and stamps once by construction.
    This looks like a stylistic choice and is not.

    Returns True when this call was the one that stamped it.
    """
    stamped = Ticket.objects.filter(
        pk=ticket.pk, first_response_at__isnull=True
    ).update(first_response_at=timezone.now())
    if stamped:
        ticket.refresh_from_db(fields=["first_response_at"])
    return bool(stamped)
