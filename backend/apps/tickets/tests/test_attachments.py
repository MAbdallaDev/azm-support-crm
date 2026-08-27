"""Attachment upload hardening.

The `filename` column is ours and story 07 echoes it back into the browser, so
an unsanitised value is a stored-XSS vector there — not merely an untidy string.
Django's `upload_to` protects the path on disk; it does not protect this column.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.customers.models import Customer
from apps.tickets.models import Attachment, Ticket
from apps.tickets.views import MAX_ATTACHMENT_BYTES, sanitise_filename


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")


@pytest.fixture
def agent(department):
    return User.objects.create_user(
        username="agent1", password="x", role=User.Role.AGENT, department=department
    )


@pytest.fixture
def ticket(department, db):
    customer = Customer.objects.create(name="Acme", email="ops@acme.test")
    return Ticket.objects.create(
        customer=customer, subject="With files", department=department
    )


@pytest.fixture
def api(agent):
    client = APIClient()
    client.force_authenticate(agent)
    return client


def upload(api, ticket, name, content=b"hello", content_type="text/plain", **extra):
    payload = {"file": SimpleUploadedFile(name, content, content_type=content_type)}
    payload.update(extra)
    return api.post(
        f"/api/v1/tickets/{ticket.pk}/attachments/", payload, format="multipart"
    )


# ---------------------------------------------------------------------------
# Filename sanitising
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("../../etc/passwd", "passwd"),
        ("../../../../../../etc/shadow", "shadow"),
        ("..\\..\\windows\\system32\\config", "config"),
        ("/absolute/path/report.pdf", "report.pdf"),
        ("...hidden.txt", "hidden.txt"),
        ("normal-file.csv", "normal-file.csv"),
        ("", "upload"),
        ("....", "upload"),
    ],
)
def test_sanitise_filename(raw, expected):
    assert sanitise_filename(raw) == expected


def test_sanitise_filename_strips_null_bytes():
    """A null byte can truncate a filename in C-level code further down."""
    assert "\x00" not in sanitise_filename("evil\x00.txt")


def test_sanitise_filename_respects_the_column_length():
    assert len(sanitise_filename("a" * 400 + ".pdf")) <= 255


@pytest.mark.django_db
def test_traversal_filename_is_stored_sanitised(api, ticket):
    response = upload(api, ticket, "../../etc/passwd", content_type="text/plain")
    assert response.status_code == 201
    assert Attachment.objects.get().filename == "passwd"


# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_oversize_upload_is_rejected_naming_the_limit(api, ticket):
    oversize = b"x" * (MAX_ATTACHMENT_BYTES + 1)
    response = upload(api, ticket, "big.txt", content=oversize)
    assert response.status_code == 400
    assert "10 MB" in str(response.data)
    assert Attachment.objects.count() == 0


@pytest.mark.django_db
def test_disallowed_content_type_is_rejected_naming_the_type(api, ticket):
    response = upload(
        api, ticket, "payload.sh", content=b"#!/bin/sh", content_type="application/x-sh"
    )
    assert response.status_code == 400
    assert "application/x-sh" in str(response.data)
    assert Attachment.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "content_type", ["application/pdf", "image/png", "text/csv", "text/plain"]
)
def test_allowed_types_are_accepted(api, ticket, content_type):
    assert upload(api, ticket, "file.bin", content_type=content_type).status_code == 201


@pytest.mark.django_db
def test_missing_file_is_a_400_not_a_500(api, ticket):
    response = api.post(f"/api/v1/tickets/{ticket.pk}/attachments/", {}, format="multipart")
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Server-side fields
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_size_and_uploader_are_set_server_side_not_from_the_payload(api, ticket, agent):
    """A client-supplied size would let an oversize upload declare itself small,
    and a client-supplied uploader would let anyone forge provenance.
    """
    other = User.objects.create_user(username="someone-else", password="x")
    content = b"exactly-twenty-chars"

    response = upload(
        api, ticket, "note.txt", content=content, size=1, uploaded_by=other.pk
    )
    assert response.status_code == 201

    attachment = Attachment.objects.get()
    assert attachment.size == len(content)
    assert attachment.uploaded_by == agent


@pytest.mark.django_db
def test_upload_logs_an_attachment_added_event(api, ticket):
    upload(api, ticket, "report.pdf", content_type="application/pdf")
    event = ticket.events.get(event_type="attachment_added")
    assert event.new_value == "report.pdf"


@pytest.mark.django_db
def test_attachments_can_be_listed(api, ticket):
    upload(api, ticket, "one.txt")
    upload(api, ticket, "two.txt")
    response = api.get(f"/api/v1/tickets/{ticket.pk}/attachments/")
    assert response.status_code == 200
    assert {row["filename"] for row in response.data} == {"one.txt", "two.txt"}
