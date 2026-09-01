"""`GET /tickets/live-chat/` — the agent Live Chat inbox.

A dedicated, narrower list than the ticket queue: only open chat-channel
conversations, with a last-message preview and an `awaiting_reply` flag
instead of any priority/SLA/category chrome — this list backs a messaging-app
style screen, not the ticket queue.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.tickets.models import Status, Ticket, TicketMessage


@pytest.fixture
def admin(db):
    return User.objects.create_user(username="livechat-admin", password="x", role=User.Role.ADMIN)


@pytest.fixture
def api(admin):
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Najd Logistics", email="ops@najd.test")


def inbox(api):
    return api.get("/api/v1/tickets/live-chat/").data


@pytest.mark.django_db
def test_only_open_chat_channel_tickets_are_listed(api, customer):
    chat_open = Ticket.objects.create(customer=customer, subject="Live chat", channel="chat", status=Status.OPEN)
    Ticket.objects.create(customer=customer, subject="Email ticket", channel="email", status=Status.OPEN)
    Ticket.objects.create(customer=customer, subject="Closed chat", channel="chat", status=Status.CLOSED)
    Ticket.objects.create(customer=customer, subject="Resolved chat", channel="chat", status=Status.RESOLVED)

    rows = inbox(api)

    assert [row["id"] for row in rows] == [chat_open.pk]


@pytest.mark.django_db
def test_no_case_management_fields_appear_on_a_row(api, customer):
    """The whole point of this list: no priority, SLA, or category chrome."""
    Ticket.objects.create(customer=customer, subject="Live chat", channel="chat", status=Status.NEW)

    row = inbox(api)[0]

    for forbidden in ("priority", "sla_resolution_due_at", "is_breached", "category_name", "resolution_sla"):
        assert forbidden not in row


@pytest.mark.django_db
def test_last_message_and_timestamp_come_from_the_most_recent_message(api, customer):
    ticket = Ticket.objects.create(customer=customer, subject="Live chat", channel="chat", status=Status.OPEN)
    TicketMessage.objects.create(ticket=ticket, body="First message")
    latest = TicketMessage.objects.create(ticket=ticket, body="Second, more recent message")

    row = inbox(api)[0]

    assert row["last_message"] == "Second, more recent message"
    assert row["last_message_at"] == latest.created_at


@pytest.mark.django_db
def test_a_ticket_with_no_messages_yet_falls_back_to_the_ticket_created_at(api, customer):
    ticket = Ticket.objects.create(customer=customer, subject="Live chat", channel="chat", status=Status.NEW)

    row = inbox(api)[0]

    assert row["last_message"] == ""
    assert row["last_message_at"] == ticket.created_at


@pytest.mark.django_db
def test_an_internal_note_is_never_the_last_message_shown(api, customer):
    """Live chat has no internal-note concept in its UI — a note must not leak
    into the one thing this list shows about the conversation."""
    ticket = Ticket.objects.create(customer=customer, subject="Live chat", channel="chat", status=Status.OPEN)
    TicketMessage.objects.create(ticket=ticket, body="Public reply", is_internal=False)
    TicketMessage.objects.create(ticket=ticket, body="Internal-only note", is_internal=True)

    row = inbox(api)[0]

    assert row["last_message"] == "Public reply"


@pytest.mark.django_db
def test_awaiting_reply_is_true_only_when_the_customer_sent_the_last_message(api, customer):
    agent = User.objects.create_user(username="livechat-agent", password="x", role=User.Role.AGENT)
    customer_user = User.objects.create_user(
        username="livechat-customer", password="x", role=User.Role.CUSTOMER, customer=customer,
    )

    waiting = Ticket.objects.create(customer=customer, subject="Waiting", channel="chat", status=Status.OPEN)
    TicketMessage.objects.create(ticket=waiting, body="Please help", author=customer_user)

    answered = Ticket.objects.create(customer=customer, subject="Answered", channel="chat", status=Status.OPEN)
    TicketMessage.objects.create(ticket=answered, body="On it", author=agent)

    rows = {row["id"]: row["awaiting_reply"] for row in inbox(api)}

    assert rows[waiting.pk] is True
    assert rows[answered.pk] is False


@pytest.mark.django_db
def test_a_chat_ticket_with_no_messages_is_not_awaiting_reply(api, customer):
    ticket = Ticket.objects.create(customer=customer, subject="Live chat", channel="chat", status=Status.NEW)

    row = inbox(api)[0]

    assert row["awaiting_reply"] is False


@pytest.mark.django_db
def test_the_endpoint_is_scoped_like_every_other_agent_list(customer):
    """Reuses `get_queryset()`'s scoping — an agent outside the ticket's
    department must not see it, the same rule the ticket queue itself enforces.
    """
    from apps.accounts.models import Department

    dept_a = Department.objects.create(code="dept-a-livechat", name_en="A", name_ar="A")
    dept_b = Department.objects.create(code="dept-b-livechat", name_en="B", name_ar="B")
    agent_a = User.objects.create_user(
        username="livechat-scope-agent", password="x", role=User.Role.AGENT, department=dept_a,
    )
    Ticket.objects.create(
        customer=customer, subject="Someone else's department",
        channel="chat", status=Status.OPEN, department=dept_b,
    )

    client = APIClient()
    client.force_authenticate(agent_a)

    assert client.get("/api/v1/tickets/live-chat/").data == []
