"""The regression guard for the guard.

`compute_due_dates` refuses to recompute already-set timestamps. That refusal is
what stops `seed_demo`'s deliberate breach spread being overwritten with
policy-derived values.

**This is the one failure nothing else would catch.** If the guard were removed,
every other test in the suite would still pass, the API would still work, and the
only symptom would be that the demo quietly showed "everything comfortable" —
no exception, no failing assertion, no log line. So the property is tested
directly: seed, record the spread, save every ticket, re-check.
"""

import io

import pytest
from django.core.management import call_command
from django.db import transaction

from apps.tickets.models import Status, Ticket
from apps.tickets.services import sla_service


def spread():
    """The three states story 02's seed manufactures on purpose."""
    now = None
    open_statuses = (
        Status.NEW, Status.OPEN, Status.PENDING,
        Status.ON_HOLD, Status.ESCALATED, Status.REOPENED,
    )
    breached = Ticket.objects.filter(sla_service.breached_q(now)).count()
    escalated = Ticket.objects.filter(status=Status.ESCALATED).count()
    approaching = sum(
        1
        for ticket in Ticket.objects.filter(
            status__in=open_statuses, sla_policy__isnull=False
        ).select_related("sla_policy")
        if sla_service.sla_state(ticket, sla_service.RESOLUTION)["state"] == "approaching"
    )
    return {"breached": breached, "escalated": escalated, "approaching": approaching}


@pytest.fixture
def seeded(db):
    with transaction.atomic():
        call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
        yield
        transaction.set_rollback(True)


@pytest.mark.django_db
def test_seed_produces_a_real_breach_spread(seeded):
    before = spread()
    assert before["breached"] >= 3, before
    assert before["escalated"] >= 2, before


@pytest.mark.django_db
def test_saving_every_ticket_does_not_collapse_the_spread(seeded):
    """A plain `.save()` must not trigger recomputation.

    This is why the SLA hook lives in `perform_create` / `perform_update` rather
    than in a signal or a `save()` override — either of those would fire here.
    """
    before = spread()

    for ticket in Ticket.objects.all():
        ticket.save()

    after = spread()
    assert after == before, (
        f"the breach spread changed on a plain re-save: {before} -> {after}. "
        "Something is recomputing SLA due dates outside perform_create/"
        "perform_update — check for a new signal or save() override."
    )


@pytest.mark.django_db
def test_compute_due_dates_is_a_no_op_on_seeded_tickets(seeded):
    """Called directly, without force, it must change nothing."""
    changed = [
        ticket.number
        for ticket in Ticket.objects.select_related("customer").all()
        if sla_service.compute_due_dates(ticket)
    ]
    assert changed == [], f"compute_due_dates overwrote seeded SLA data on {changed[:5]}"


@pytest.mark.django_db
def test_reseeding_keeps_the_spread(seeded):
    """seed_demo is idempotent and recomputes timestamps against a fresh `now`,
    so the spread must survive a second run rather than degrading.
    """
    call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
    after = spread()
    assert after["breached"] >= 3
    assert after["escalated"] >= 2
