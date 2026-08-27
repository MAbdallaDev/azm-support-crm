"""Auto-assignment: least-loaded first, rotation as the tiebreak."""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.tickets.models import Status, Ticket
from apps.tickets.services import ticket_service
from apps.tickets.services.ticket_service import NoEligibleAgent, pick_next_agent


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="assign-billing")


@pytest.fixture
def other_department(db):
    return Department.objects.create(name_en="Technical", name_ar="فني", code="assign-tech")


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="ops@acme.test")


def agent(username, department, available=True, last_assigned=None):
    return User.objects.create_user(
        username=username, password="x", role=User.Role.AGENT,
        department=department, is_available=available, last_assigned_at=last_assigned,
    )


def ticket_for(customer, department, **kwargs):
    return Ticket.objects.create(
        customer=customer, subject="Needs an owner", department=department, **kwargs
    )


def load(user, customer, department, count, status=Status.OPEN):
    for _ in range(count):
        Ticket.objects.create(
            customer=customer, subject="load", assignee=user,
            department=department, status=status,
        )


def test_least_loaded_agent_wins(department, customer):
    busy = agent("busy", department)
    idle = agent("idle", department)
    load(busy, customer, department, 3)
    load(idle, customer, department, 1)

    assert pick_next_agent(ticket_for(customer, department)) == idle


def test_resolved_and_closed_tickets_do_not_count_as_load(department, customer):
    """Load means work in hand, not work ever done."""
    veteran = agent("veteran", department)
    newcomer = agent("newcomer", department)
    load(veteran, customer, department, 10, status=Status.CLOSED)
    load(newcomer, customer, department, 1)

    assert pick_next_agent(ticket_for(customer, department)) == veteran


def test_rotation_breaks_a_tie_on_equal_load(department, customer):
    """At equal load the agent who waited longest wins, not the lowest id."""
    now = timezone.now()
    first = agent("aaa-recent", department, last_assigned=now)
    second = agent("zzz-stale", department, last_assigned=now - timezone.timedelta(hours=5))
    load(first, customer, department, 2)
    load(second, customer, department, 2)

    assert pick_next_agent(ticket_for(customer, department)) == second


def test_an_agent_who_has_never_been_assigned_goes_first(department, customer):
    """Nulls sort first — a new joiner is picked before anyone already working."""
    established = agent("established", department, last_assigned=timezone.now())
    fresh = agent("fresh", department, last_assigned=None)

    assert pick_next_agent(ticket_for(customer, department)) == fresh
    assert established is not None


def test_unavailable_agents_are_skipped(department, customer):
    away = agent("away", department, available=False)
    here = agent("here", department)
    load(here, customer, department, 5)

    assert pick_next_agent(ticket_for(customer, department)) == here
    assert away.is_available is False


def test_agents_in_another_department_are_skipped(department, other_department, customer):
    elsewhere = agent("elsewhere", other_department)
    ours = agent("ours", department)
    load(ours, customer, department, 4)

    assert pick_next_agent(ticket_for(customer, department)) == ours
    assert elsewhere.department == other_department


def test_non_agents_are_never_picked(department, customer):
    User.objects.create_user(
        username="the-manager", password="x", role=User.Role.MANAGER, department=department
    )
    only_agent = agent("the-agent", department)
    assert pick_next_agent(ticket_for(customer, department)) == only_agent


# ---------------------------------------------------------------------------
# assign()
# ---------------------------------------------------------------------------


def test_assign_writes_a_human_readable_reason(department, customer):
    """The design renders this string verbatim beside the owner."""
    agent("solo", department)
    ticket = ticket_for(customer, department)
    ticket_service.assign(ticket, None, None)
    ticket.refresh_from_db()

    assert ticket.assignee is not None
    assert ticket.assignment_reason == "auto-assigned (least loaded, Billing)"


def test_assign_stamps_last_assigned_at(department, customer):
    chosen = agent("solo", department)
    assert chosen.last_assigned_at is None

    ticket_service.assign(ticket_for(customer, department), None, None)
    chosen.refresh_from_db()
    assert chosen.last_assigned_at is not None


def test_manual_assignment_also_stamps_the_rotation_clock(department, customer):
    """Otherwise rotation would only count auto-assignments and drift."""
    manual = agent("manual", department)
    ticket_service.assign(ticket_for(customer, department), manual, None, "picked by hand")
    manual.refresh_from_db()

    assert manual.last_assigned_at is not None


def test_no_eligible_agent_raises(department, customer):
    agent("away", department, available=False)
    with pytest.raises(NoEligibleAgent):
        ticket_service.assign(ticket_for(customer, department), None, None)


def test_a_failed_assignment_leaves_the_ticket_untouched(department, customer):
    agent("away", department, available=False)
    ticket = ticket_for(customer, department)
    with pytest.raises(NoEligibleAgent):
        ticket_service.assign(ticket, None, None)

    ticket.refresh_from_db()
    assert ticket.assignee is None
    assert ticket.assignment_reason == ""


def test_assignment_logs_an_assigned_event(department, customer):
    agent("solo", department)
    ticket = ticket_for(customer, department)
    ticket_service.assign(ticket, None, None)
    assert ticket.events.filter(event_type="assigned").count() == 1


# ---------------------------------------------------------------------------
# Over HTTP
# ---------------------------------------------------------------------------


def test_no_eligible_agent_is_409_over_http(department, customer):
    """A 200 with no assignee would read as a completed assignment."""
    caller = agent("caller", department, available=False)
    client = APIClient()
    client.force_authenticate(caller)
    ticket = ticket_for(customer, department)

    response = client.post(f"/api/v1/tickets/{ticket.pk}/assign/", {}, format="json")
    assert response.status_code == 409
    assert "No available agent" in str(response.data)

    ticket.refresh_from_db()
    assert ticket.assignee is None


def test_successful_auto_assign_over_http(department, customer):
    caller = agent("caller", department)
    client = APIClient()
    client.force_authenticate(caller)
    ticket = ticket_for(customer, department)

    response = client.post(f"/api/v1/tickets/{ticket.pk}/assign/", {}, format="json")
    assert response.status_code == 200
    assert response.data["assignee"]["username"] == "caller"
    assert "least loaded" in response.data["assignment_reason"]
