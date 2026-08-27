"""SLA: policy selection, the compute guard, and derived state."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.tickets.models import Priority, SLAPolicy, Status, Ticket
from apps.tickets.services import sla_service
from apps.tickets.services.sla_service import (
    STATE_APPROACHING,
    STATE_BREACHED,
    STATE_OK,
)


@pytest.fixture
def policies(db):
    return {
        ("enterprise", "urgent"): SLAPolicy.objects.create(
            name="Ent-P1", customer_tier="enterprise", priority="urgent",
            first_response_minutes=30, resolution_minutes=480, escalate_at_percent=90,
        ),
        ("standard", "urgent"): SLAPolicy.objects.create(
            name="Std-P1", customer_tier="standard", priority="urgent",
            first_response_minutes=120, resolution_minutes=1440, escalate_at_percent=90,
        ),
        ("standard", "normal"): SLAPolicy.objects.create(
            name="Std-Normal", customer_tier="standard", priority="normal",
            first_response_minutes=480, resolution_minutes=4320, escalate_at_percent=80,
        ),
    }


@pytest.fixture
def enterprise(db):
    return Customer.objects.create(name="Big Co", email="big@test.dev", tier="enterprise")


@pytest.fixture
def standard(db):
    return Customer.objects.create(name="Small Co", email="small@test.dev", tier="standard")


def make(customer, **kwargs):
    return Ticket.objects.create(customer=customer, subject="SLA subject", **kwargs)


# ---------------------------------------------------------------------------
# Policy selection
# ---------------------------------------------------------------------------


def test_exact_tier_and_priority_match(policies, enterprise):
    ticket = make(enterprise, priority=Priority.URGENT)
    assert sla_service.select_policy(ticket) == policies[("enterprise", "urgent")]


def test_falls_back_to_the_most_generous_policy_for_that_priority(policies, standard):
    """A premium customer with no premium policy must not inherit the tightest
    deadline on the board — that would manufacture breaches nobody agreed to.
    """
    premium = Customer.objects.create(name="Mid Co", email="mid@test.dev", tier="premium")
    ticket = make(premium, priority=Priority.URGENT)
    chosen = sla_service.select_policy(ticket)
    assert chosen == policies[("standard", "urgent")]
    assert chosen.resolution_minutes == max(
        p.resolution_minutes for p in policies.values() if p.priority == "urgent"
    )


def test_no_policy_for_the_priority_returns_none(policies, standard):
    ticket = make(standard, priority=Priority.LOW)
    assert sla_service.select_policy(ticket) is None


# ---------------------------------------------------------------------------
# compute_due_dates and its guard
# ---------------------------------------------------------------------------


def test_compute_sets_policy_and_both_due_dates(policies, enterprise):
    ticket = make(enterprise, priority=Priority.URGENT)
    assert sla_service.compute_due_dates(ticket) is True
    ticket.refresh_from_db()

    assert ticket.sla_policy == policies[("enterprise", "urgent")]
    assert ticket.sla_response_due_at == ticket.created_at + timedelta(minutes=30)
    assert ticket.sla_resolution_due_at == ticket.created_at + timedelta(minutes=480)


def test_compute_does_not_overwrite_already_set_timestamps(policies, enterprise):
    """The guard that protects seed_demo's deliberate breach spread."""
    ticket = make(enterprise, priority=Priority.URGENT)
    manual = timezone.now() - timedelta(days=3)
    Ticket.objects.filter(pk=ticket.pk).update(
        sla_response_due_at=manual, sla_resolution_due_at=manual
    )
    ticket.refresh_from_db()

    assert sla_service.compute_due_dates(ticket) is False
    ticket.refresh_from_db()
    assert ticket.sla_response_due_at == manual
    assert ticket.sla_resolution_due_at == manual


def test_force_recomputes_after_a_priority_change(policies, enterprise):
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    ticket.refresh_from_db()
    original = ticket.sla_resolution_due_at

    ticket.priority = Priority.NORMAL
    ticket.save(update_fields=["priority"])
    assert sla_service.compute_due_dates(ticket, force=True) is True
    ticket.refresh_from_db()
    assert ticket.sla_resolution_due_at != original


def test_no_matching_policy_leaves_the_ticket_alone(policies, standard):
    ticket = make(standard, priority=Priority.LOW)
    assert sla_service.compute_due_dates(ticket) is False
    ticket.refresh_from_db()
    assert ticket.sla_policy is None
    assert ticket.sla_resolution_due_at is None


# ---------------------------------------------------------------------------
# sla_state
# ---------------------------------------------------------------------------


def test_state_is_ok_well_inside_the_window(policies, enterprise):
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    ticket.refresh_from_db()

    state = sla_service.sla_state(ticket, sla_service.RESOLUTION)
    assert state["state"] == STATE_OK
    assert state["seconds_remaining"] > 0
    assert state["target_minutes"] == 480
    assert state["policy_name"] == "Ent-P1"


def test_state_is_approaching_at_the_escalation_threshold(policies, enterprise):
    """`escalate_at_percent` is 90 — the design's 'escalates to Tier 3 at 90%'."""
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    ticket.refresh_from_db()

    now = ticket.created_at + timedelta(minutes=int(480 * 0.91))
    state = sla_service.sla_state(ticket, sla_service.RESOLUTION, now=now)
    assert state["state"] == STATE_APPROACHING
    assert state["seconds_remaining"] > 0

    just_under = ticket.created_at + timedelta(minutes=int(480 * 0.5))
    assert sla_service.sla_state(ticket, sla_service.RESOLUTION, now=just_under)["state"] == STATE_OK


def test_state_is_breached_with_negative_seconds(policies, enterprise):
    """One signed number renders both '2h left' and 'Breached 14m'."""
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    ticket.refresh_from_db()

    now = ticket.created_at + timedelta(minutes=600)
    state = sla_service.sla_state(ticket, sla_service.RESOLUTION, now=now)
    assert state["state"] == STATE_BREACHED
    assert state["seconds_remaining"] < 0


def test_first_response_freezes_the_response_clock(policies, enterprise):
    """Answered inside the target reads ok forever, not 'breached' an hour later."""
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    ticket.refresh_from_db()

    Ticket.objects.filter(pk=ticket.pk).update(
        first_response_at=ticket.created_at + timedelta(minutes=10)
    )
    ticket.refresh_from_db()

    much_later = ticket.created_at + timedelta(days=5)
    state = sla_service.sla_state(ticket, sla_service.RESPONSE, now=much_later)
    assert state["state"] == STATE_OK
    assert state["seconds_remaining"] > 0


def test_a_late_response_stays_breached_forever(policies, enterprise):
    """The compliance report needs the honest history, not a clock that resets."""
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    ticket.refresh_from_db()

    Ticket.objects.filter(pk=ticket.pk).update(
        first_response_at=ticket.created_at + timedelta(minutes=90)
    )
    ticket.refresh_from_db()
    assert sla_service.sla_state(ticket, sla_service.RESPONSE)["state"] == STATE_BREACHED


def test_a_resolved_ticket_is_never_in_the_breaching_queue(policies, enterprise):
    """The queue filter and sla_state answer different questions on purpose.

    `sla_state` reports what happened to a finished ticket; `breached_q` reports
    what needs attention now. A Breaching tab full of closed work is the easiest
    mistake to make here.
    """
    ticket = make(enterprise, priority=Priority.URGENT)
    sla_service.compute_due_dates(ticket)
    Ticket.objects.filter(pk=ticket.pk).update(
        sla_response_due_at=timezone.now() - timedelta(days=2),
        sla_resolution_due_at=timezone.now() - timedelta(days=1),
        first_response_at=timezone.now() - timedelta(days=2),
        resolved_at=timezone.now() - timedelta(hours=1),
        status=Status.RESOLVED,
    )
    ticket.refresh_from_db()

    assert Ticket.objects.filter(sla_service.breached_q()).filter(pk=ticket.pk).count() == 0
    assert sla_service.is_breached(ticket) is False


def test_no_policy_yields_a_null_countdown_not_a_crash(standard):
    ticket = make(standard, priority=Priority.LOW)
    state = sla_service.sla_state(ticket, sla_service.RESOLUTION)
    assert state["seconds_remaining"] is None
    assert state["policy_name"] == ""


def test_unknown_kind_raises(policies, enterprise):
    with pytest.raises(ValueError):
        sla_service.sla_state(make(enterprise), "nonsense")


# ---------------------------------------------------------------------------
# The hook points
# ---------------------------------------------------------------------------


@pytest.fixture
def api_agent(db):
    from rest_framework.test import APIClient

    department = Department.objects.create(
        name_en="SLA QA", name_ar="اختبار", code="sla-qa"
    )
    agent = User.objects.create_user(
        username="sla-agent", password="x", role=User.Role.AGENT, department=department
    )
    client = APIClient()
    client.force_authenticate(agent)
    return client, department


def test_create_through_the_api_computes_due_dates(policies, enterprise, api_agent):
    client, department = api_agent
    response = client.post(
        "/api/v1/tickets/",
        {
            "subject": "Created via API",
            "customer": enterprise.pk,
            "priority": Priority.URGENT,
            "department": department.pk,
        },
        format="json",
    )
    assert response.status_code == 201
    ticket = Ticket.objects.get(pk=response.data["id"])
    assert ticket.sla_policy is not None
    assert ticket.sla_resolution_due_at is not None


def test_priority_change_through_the_api_recomputes(policies, enterprise, api_agent):
    client, department = api_agent
    created = client.post(
        "/api/v1/tickets/",
        {
            "subject": "Repriced",
            "customer": enterprise.pk,
            "priority": Priority.URGENT,
            "department": department.pk,
        },
        format="json",
    )
    ticket = Ticket.objects.get(pk=created.data["id"])
    before = ticket.sla_resolution_due_at

    client.patch(f"/api/v1/tickets/{ticket.pk}/", {"priority": "normal"}, format="json")
    ticket.refresh_from_db()
    assert ticket.sla_resolution_due_at != before
