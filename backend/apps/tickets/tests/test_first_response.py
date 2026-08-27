"""`first_response_at` — stamped exactly once, and only by a real response.

Story 05's SLA compliance number reads this field, so every rule here has a
downstream consequence in a manager's report.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.tickets.models import Status, Ticket
from apps.tickets.services import ticket_service


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")


@pytest.fixture
def agent(department):
    return User.objects.create_user(
        username="agent1", password="x", role=User.Role.AGENT, department=department
    )


@pytest.fixture
def portal_user(db):
    customer = Customer.objects.create(name="Acme", email="ops@acme.test")
    return User.objects.create_user(
        username="portal1", password="x", role=User.Role.CUSTOMER, customer=customer
    )


@pytest.fixture
def ticket(department, portal_user):
    return Ticket.objects.create(
        customer=portal_user.customer,
        subject="Needs a reply",
        department=department,
        status=Status.OPEN,
    )


def post_message(user, ticket, body, is_internal=False):
    client = APIClient()
    client.force_authenticate(user)
    return client.post(
        f"/api/v1/tickets/{ticket.pk}/messages/",
        {"body": body, "is_internal": is_internal},
        format="json",
    )


@pytest.mark.django_db
def test_first_public_agent_message_stamps_it(agent, ticket):
    assert ticket.first_response_at is None
    assert post_message(agent, ticket, "Looking into it now.").status_code == 201

    ticket.refresh_from_db()
    assert ticket.first_response_at is not None


@pytest.mark.django_db
def test_a_second_message_does_not_move_it(agent, ticket):
    post_message(agent, ticket, "First reply.")
    ticket.refresh_from_db()
    stamped = ticket.first_response_at

    post_message(agent, ticket, "Second reply.")
    ticket.refresh_from_db()
    assert ticket.first_response_at == stamped


@pytest.mark.django_db
def test_an_internal_note_does_not_stamp_it(agent, ticket):
    """The customer never saw it, so it is not a response to them."""
    assert post_message(agent, ticket, "Checking the logs.", is_internal=True).status_code == 201
    ticket.refresh_from_db()
    assert ticket.first_response_at is None


@pytest.mark.django_db
def test_record_first_response_is_idempotent_at_the_service_level(ticket):
    """The conditional UPDATE stamps once by construction.

    A read-then-write (`if ticket.first_response_at is None: save()`) races: two
    agents replying at the same moment both read None, and the second overwrites
    the first, moving the timestamp later and flattering the SLA number.
    """
    assert ticket_service.record_first_response(ticket) is True
    ticket.refresh_from_db()
    stamped = ticket.first_response_at

    assert ticket_service.record_first_response(ticket) is False
    ticket.refresh_from_db()
    assert ticket.first_response_at == stamped


@pytest.mark.django_db
def test_a_stale_in_memory_instance_cannot_overwrite_the_stamp(ticket):
    """The filtered UPDATE is evaluated by the database, not from the instance.

    This is the race the conditional UPDATE exists to prevent, simulated: two
    handles on the same row, both believing `first_response_at` is None.
    """
    other_handle = Ticket.objects.get(pk=ticket.pk)

    assert ticket_service.record_first_response(ticket) is True
    ticket.refresh_from_db()
    stamped = ticket.first_response_at

    assert other_handle.first_response_at is None  # genuinely stale
    assert ticket_service.record_first_response(other_handle) is False

    ticket.refresh_from_db()
    assert ticket.first_response_at == stamped


@pytest.mark.django_db
def test_message_endpoint_logs_the_right_event_type(agent, ticket):
    post_message(agent, ticket, "Public reply.")
    post_message(agent, ticket, "Private note.", is_internal=True)

    types = list(ticket.events.values_list("event_type", flat=True))
    assert "message_added" in types
    assert "note_added" in types
