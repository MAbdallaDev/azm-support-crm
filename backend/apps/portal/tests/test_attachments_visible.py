"""Attachments are created correctly by `_create_attachments` on both ticket
creation and replies, but nothing ever surfaced them to the portal before
this fix: `PortalTicketSerializer`/`PortalMessageSerializer` never listed
them, and there was no attachments endpoint at all. This covers the new
`GET /portal/tickets/{id}/attachments/` action and its trust boundary.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.tickets.models import Attachment, Ticket

PNG = lambda name="photo.png": SimpleUploadedFile(name, io.BytesIO(b"\x89PNG").read(), content_type="image/png")


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Attach Co", email="ops@attach.test")


@pytest.fixture
def portal_client(customer):
    user = User.objects.create_user(
        username="attach-customer", password="x", role=User.Role.CUSTOMER, customer=customer,
    )
    client = APIClient()
    client.force_authenticate(user)
    return client, user


@pytest.mark.django_db
def test_an_attachment_added_at_ticket_creation_is_returned(portal_client):
    client, _ = portal_client
    created = client.post(
        "/api/v1/portal/tickets/",
        {"subject": "With a file", "description": "x", "attachments": [PNG()]},
        format="multipart",
    )
    ticket_id = created.data["id"]

    response = client.get(f"/api/v1/portal/tickets/{ticket_id}/attachments/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["filename"] == "photo.png"
    assert response.data[0]["message"] is None
    assert response.data[0]["uploaded_by_kind"] == "you"


@pytest.mark.django_db
def test_an_attachment_added_on_a_reply_is_returned_and_linked_to_that_message(portal_client):
    client, _ = portal_client
    created = client.post("/api/v1/portal/tickets/", {"subject": "S", "description": "d"})
    ticket_id = created.data["id"]

    reply = client.post(
        f"/api/v1/portal/tickets/{ticket_id}/messages/",
        {"body": "See attached", "attachments": [PNG("invoice.png")]},
        format="multipart",
    )
    message_id = reply.data["id"]

    response = client.get(f"/api/v1/portal/tickets/{ticket_id}/attachments/")

    assert len(response.data) == 1
    assert response.data[0]["message"] == message_id


@pytest.mark.django_db
def test_the_file_field_is_a_real_resolvable_path(portal_client):
    """`request` IS in the serializer's context (unlike the agent-side bug this
    fix is a sibling of), so DRF's `FileField` builds an absolute URI rather
    than a root-relative one — resolvable regardless of the caller's origin.
    """
    client, _ = portal_client
    created = client.post(
        "/api/v1/portal/tickets/",
        {"subject": "With a file", "description": "x", "attachments": [PNG()]},
        format="multipart",
    )
    ticket_id = created.data["id"]

    response = client.get(f"/api/v1/portal/tickets/{ticket_id}/attachments/")

    assert "/media/attachments/" in response.data[0]["file"]
    assert response.data[0]["file"].startswith("http")


@pytest.mark.django_db
def test_a_customer_cannot_list_another_customers_ticket_attachments(customer):
    mine = User.objects.create_user(
        username="mine-attach", password="x", role=User.Role.CUSTOMER, customer=customer,
    )
    someone_else = Customer.objects.create(name="Someone Else", email="other@attach.test")
    theirs = Ticket.objects.create(customer=someone_else, subject="Not yours")
    Attachment.objects.create(ticket=theirs, filename="secret.pdf", size=1)

    client = APIClient()
    client.force_authenticate(mine)

    response = client.get(f"/api/v1/portal/tickets/{theirs.pk}/attachments/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_uploaded_by_kind_is_support_not_a_staff_name_when_an_agent_replies(portal_client):
    client, _ = portal_client
    created = client.post("/api/v1/portal/tickets/", {"subject": "S", "description": "d"})
    ticket = Ticket.objects.get(pk=created.data["id"])

    agent = User.objects.create_user(username="attach-agent", password="x", role=User.Role.AGENT)
    Attachment.objects.create(
        ticket=ticket, filename="policy.pdf", size=1, uploaded_by=agent,
    )

    response = client.get(f"/api/v1/portal/tickets/{ticket.pk}/attachments/")

    matching = next(row for row in response.data if row["filename"] == "policy.pdf")
    assert matching["uploaded_by_kind"] == "support"
    assert "uploaded_by" not in matching
    assert "uploaded_by_name" not in matching
