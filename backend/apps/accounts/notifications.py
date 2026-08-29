"""Notification writers for ticket assignment and escalation.

Explicit calls from `apps.tickets.services.ticket_service`, mirroring
`accounts.audit`'s explicit-event style (`audit_login_success`,
`audit_password_changed`) rather than a generic post_save signal — a
notification is a specific, recipient-facing event ("you were assigned this
ticket"), not a change worth diffing field by field.

No disabled-flag context manager, unlike `audit.audit_disabled`: `seed_demo`
sets `Ticket.assignee` / `escalation_level` directly rather than calling
`ticket_service.assign()` / `.escalate()`, so seeding never reaches these
functions and never needs suppressing.
"""

from .models import Notification


def notify_ticket_assigned(ticket, actor):
    """One notification to the new assignee, unless they assigned it to
    themselves — "you assigned yourself a ticket" is not news.
    """
    assignee = ticket.assignee
    if assignee is None or (actor is not None and assignee.pk == actor.pk):
        return
    Notification.objects.create(
        recipient=assignee,
        actor=actor if actor is not None and actor.is_authenticated else None,
        verb=Notification.Verb.TICKET_ASSIGNED,
        ticket=ticket,
    )


def notify_ticket_escalated(ticket, actor):
    """One notification each to the assignee and every watcher, minus whoever
    triggered the escalation — the person who clicked Escalate does not need
    to be told they just did it.
    """
    actor_id = actor.pk if actor is not None and actor.is_authenticated else None
    recipients = {u.pk: u for u in ticket.watchers.all()}
    if ticket.assignee is not None:
        recipients[ticket.assignee.pk] = ticket.assignee
    recipients.pop(actor_id, None)

    Notification.objects.bulk_create(
        Notification(
            recipient=recipient,
            actor=actor if actor_id is not None else None,
            verb=Notification.Verb.TICKET_ESCALATED,
            ticket=ticket,
        )
        for recipient in recipients.values()
    )
