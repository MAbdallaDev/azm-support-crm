"""A portal ticket can be created as `channel: "chat"` — the one thing the
live-chat story needs from the backend. `PortalTicketCreateSerializer` already
lists `channel` as a writable field; this pins that it actually persists,
since nothing exercised it before this story (the portal frontend never sent
one, so every portal-created ticket fell through to the model's own
`Channel.WEB` default).
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.tickets.models import Channel, Ticket, TicketMessage


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Live Chat Co", email="ops@livechat.test")


@pytest.fixture
def portal_client(customer):
    user = User.objects.create_user(
        username="livechat-customer", password="x", role=User.Role.CUSTOMER, customer=customer,
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_a_portal_ticket_can_be_created_as_a_chat_channel_ticket(portal_client):
    response = portal_client.post(
        "/api/v1/portal/tickets/",
        {"subject": "Live chat", "description": "Live chat", "channel": "chat"},
    )

    assert response.status_code == 201
    ticket = Ticket.objects.get(pk=response.data["id"])
    assert ticket.channel == Channel.CHAT


@pytest.mark.django_db
def test_a_portal_ticket_defaults_to_web_when_no_channel_is_given(portal_client):
    """The existing "submit a request" flow must keep working unmodified."""
    response = portal_client.post(
        "/api/v1/portal/tickets/", {"subject": "A request", "description": "As usual"}
    )

    assert response.status_code == 201
    ticket = Ticket.objects.get(pk=response.data["id"])
    assert ticket.channel == Channel.WEB


@pytest.mark.django_db
def test_a_reply_on_a_chat_ticket_is_itself_channel_chat(portal_client):
    created = portal_client.post(
        "/api/v1/portal/tickets/",
        {"subject": "Live chat", "description": "Live chat", "channel": "chat"},
    )
    ticket_id = created.data["id"]

    response = portal_client.post(
        f"/api/v1/portal/tickets/{ticket_id}/messages/", {"body": "hello"}
    )

    # PortalMessageSerializer deliberately never exposes `channel` to the
    # client — check the stored row, not the response body.
    assert response.status_code == 201
    message = TicketMessage.objects.get(pk=response.data["id"])
    assert message.channel == Channel.CHAT
