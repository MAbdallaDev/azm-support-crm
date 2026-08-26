"""The status state machine.

Driven from `ALLOWED_TRANSITIONS` itself rather than a hand-written list, so the
test cannot drift from the implementation when a transition is added.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Branch, Department, User
from apps.customers.models import Customer
from apps.tickets.models import Status, Ticket, TicketEvent
from apps.tickets.services import ticket_service
from apps.tickets.services.ticket_service import (
    ALLOWED_TRANSITIONS,
    InvalidTransition,
)

ALL_PAIRS = [
    (current, target)
    for current in Status.values
    for target in Status.values
    if current != target
]
ALLOWED_PAIRS = [
    (current, target)
    for current, targets in ALLOWED_TRANSITIONS.items()
    for target in targets
]
FORBIDDEN_PAIRS = [pair for pair in ALL_PAIRS if pair not in ALLOWED_PAIRS]


@pytest.fixture
def agent(db):
    department = Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")
    Branch.objects.create(name_en="Riyadh", name_ar="الرياض", code="riyadh")
    return User.objects.create_user(
        username="agent1", password="x", role=User.Role.AGENT, department=department
    )


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="ops@acme.test")


def make_ticket(customer, status, **kwargs):
    ticket = Ticket.objects.create(customer=customer, subject="T", **kwargs)
    Ticket.objects.filter(pk=ticket.pk).update(status=status)
    ticket.refresh_from_db()
    return ticket


@pytest.mark.django_db
@pytest.mark.parametrize("current,target", ALLOWED_PAIRS, ids=lambda v: str(v))
def test_every_allowed_transition_succeeds(customer, agent, current, target):
    ticket = make_ticket(customer, current)
    ticket_service.transition_status(ticket, target, agent)
    ticket.refresh_from_db()
    assert ticket.status == target


@pytest.mark.django_db
@pytest.mark.parametrize("current,target", FORBIDDEN_PAIRS, ids=lambda v: str(v))
def test_every_forbidden_transition_raises(customer, agent, current, target):
    ticket = make_ticket(customer, current)
    with pytest.raises(InvalidTransition):
        ticket_service.transition_status(ticket, target, agent)
    ticket.refresh_from_db()
    assert ticket.status == current, "a refused transition must not mutate the ticket"


@pytest.mark.django_db
def test_transition_to_itself_is_refused(customer, agent):
    ticket = make_ticket(customer, Status.OPEN)
    with pytest.raises(InvalidTransition):
        ticket_service.transition_status(ticket, Status.OPEN, agent)


@pytest.mark.django_db
def test_resolved_stamps_resolved_at(customer, agent):
    ticket = make_ticket(customer, Status.OPEN)
    ticket_service.transition_status(ticket, Status.RESOLVED, agent)
    ticket.refresh_from_db()
    assert ticket.resolved_at is not None
    assert ticket.closed_at is None


@pytest.mark.django_db
def test_closed_stamps_closed_at(customer, agent):
    ticket = make_ticket(customer, Status.RESOLVED)
    ticket_service.transition_status(ticket, Status.CLOSED, agent)
    ticket.refresh_from_db()
    assert ticket.closed_at is not None


@pytest.mark.django_db
def test_reopen_clears_both_timestamps(customer, agent):
    """Story 05's SLA clock reads these. A reopened ticket that still claims a
    resolution time would report a resolution that did not hold.
    """
    ticket = make_ticket(customer, Status.OPEN)
    ticket_service.transition_status(ticket, Status.RESOLVED, agent)
    ticket_service.transition_status(ticket, Status.CLOSED, agent)
    ticket.refresh_from_db()
    assert ticket.resolved_at and ticket.closed_at

    ticket_service.transition_status(ticket, Status.REOPENED, agent)
    ticket.refresh_from_db()
    assert ticket.resolved_at is None
    assert ticket.closed_at is None


@pytest.mark.django_db
def test_each_transition_writes_exactly_one_status_changed_event(customer, agent):
    ticket = make_ticket(customer, Status.NEW)
    TicketEvent.objects.all().delete()
    ticket_service.transition_status(ticket, Status.OPEN, agent)

    events = TicketEvent.objects.filter(ticket=ticket, event_type="status_changed")
    assert events.count() == 1
    event = events.get()
    assert event.actor == agent
    assert (event.old_value, event.new_value) == (Status.NEW, Status.OPEN)


@pytest.mark.django_db
def test_resolve_logs_a_resolved_event_and_a_public_message(customer, agent):
    ticket = make_ticket(customer, Status.OPEN)
    ticket_service.resolve(ticket, agent, "Fixed by clearing the cache.")

    assert TicketEvent.objects.filter(ticket=ticket, event_type="resolved").count() == 1
    message = ticket.messages.get()
    assert message.is_internal is False
    assert message.body == "Fixed by clearing the cache."


@pytest.mark.django_db
def test_escalate_increments_the_level_and_stamps_the_time(customer, agent):
    ticket = make_ticket(customer, Status.OPEN)
    ticket_service.escalate(ticket, agent, "Customer threatening to churn")
    ticket.refresh_from_db()
    assert ticket.status == Status.ESCALATED
    assert ticket.escalation_level == 1
    assert ticket.escalated_at is not None

    # A second escalation is a real event; the level rises, and the status move
    # is skipped rather than raising on ESCALATED -> ESCALATED.
    ticket_service.escalate(ticket, agent, "Still unresolved")
    ticket.refresh_from_db()
    assert ticket.escalation_level == 2


@pytest.mark.django_db
def test_assign_picks_the_least_loaded_agent(customer, agent):
    department = agent.department
    busy = User.objects.create_user(
        username="busy", password="x", role=User.Role.AGENT, department=department
    )
    for _ in range(3):
        Ticket.objects.create(customer=customer, subject="load", assignee=busy, department=department)

    ticket = Ticket.objects.create(customer=customer, subject="new one", department=department)
    ticket_service.assign(ticket, None, agent)
    ticket.refresh_from_db()

    assert ticket.assignee == agent, "the idle agent should win over the busy one"
    assert "least loaded" in ticket.assignment_reason


# ---------------------------------------------------------------------------
# Over HTTP
# ---------------------------------------------------------------------------


@pytest.fixture
def api(agent):
    client = APIClient()
    client.force_authenticate(agent)
    return client


@pytest.fixture
def scoped_ticket(customer, agent):
    """A ticket inside the agent's scope.

    Without the department the agent's scope excludes it and every detail route
    correctly returns 404 — which is the behaviour story 03 built, not a bug to
    work around.
    """

    def build(status=Status.NEW):
        return make_ticket(customer, status, department=agent.department)

    return build


@pytest.mark.django_db
def test_invalid_transition_over_http_is_400_naming_both_states(api, scoped_ticket):
    ticket = scoped_ticket(Status.NEW)
    response = api.post(
        f"/api/v1/tickets/{ticket.pk}/status/", {"status": "closed"}, format="json"
    )
    assert response.status_code == 400
    detail = str(response.data)
    assert "new" in detail and "closed" in detail


@pytest.mark.django_db
def test_valid_transition_over_http_returns_200_and_adds_an_event(api, scoped_ticket):
    ticket = scoped_ticket(Status.NEW)
    before = ticket.events.count()

    response = api.post(
        f"/api/v1/tickets/{ticket.pk}/status/", {"status": "open"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["status"] == "open"

    events = api.get(f"/api/v1/tickets/{ticket.pk}/events/")
    assert len(events.data) == before + 1


@pytest.mark.django_db
def test_status_cannot_be_set_through_the_write_serializer(api, scoped_ticket):
    """The transition endpoints are the only way in. A PATCH that could set
    status would bypass validation, the timestamps and the Activity log.
    """
    ticket = scoped_ticket(Status.NEW)
    response = api.patch(
        f"/api/v1/tickets/{ticket.pk}/", {"status": "closed"}, format="json"
    )
    assert response.status_code == 200
    ticket.refresh_from_db()
    assert ticket.status == Status.NEW


@pytest.mark.django_db
def test_priority_change_logs_a_priority_changed_event(api, scoped_ticket):
    ticket = scoped_ticket(Status.OPEN)
    api.patch(f"/api/v1/tickets/{ticket.pk}/", {"priority": "urgent"}, format="json")
    assert ticket.events.filter(event_type="priority_changed").count() == 1
