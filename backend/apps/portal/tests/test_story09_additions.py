"""Story 09's four backend additions: registration, attachments on a portal
ticket and a portal reply, and the CSAT field surviving a reload.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import transaction
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.tickets.models import CSATRating, Status, Ticket

TXT = lambda name="note.txt": SimpleUploadedFile(name, b"hello world", content_type="text/plain")


@pytest.fixture(scope="module")
def seeded(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock(), transaction.atomic():
        call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
        yield
        transaction.set_rollback(True)


@pytest.fixture
def customer_client(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        user = User.objects.get(username="customer@demo")
        client = APIClient()
        client.force_authenticate(user)
        yield client, user


# ---------------------------------------------------------------------------
# Task 1 — registration
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_registering_with_a_seeded_customers_email_links_to_that_customer(
    seeded, django_db_blocker
):
    with django_db_blocker.unblock():
        existing = Customer.objects.get(email__iexact="ops@gulftrading.sa")

        response = APIClient().post(
            "/api/v1/portal/register/",
            {
                "email": "ops@gulftrading.sa",
                "password": "SuperSecret1",
                "full_name": "Abdulaziz Al-Rashid",
            },
            format="json",
        )
        assert response.status_code == 201
        assert "access" in response.data and "refresh" in response.data

        user = User.objects.get(pk=response.data["user"]["id"])
        assert user.customer_id == existing.pk
        assert user.role == User.Role.CUSTOMER
        assert user.is_staff is False and user.is_superuser is False


@pytest.mark.django_db
def test_registering_with_a_fresh_email_creates_a_customer(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        assert not Customer.objects.filter(email__iexact="brand-new@example.com").exists()

        response = APIClient().post(
            "/api/v1/portal/register/",
            {
                "email": "brand-new@example.com",
                "password": "SuperSecret1",
                "full_name": "New Customer",
                "phone": "+966 50 000 0000",
            },
            format="json",
        )
        assert response.status_code == 201

        user = User.objects.get(pk=response.data["user"]["id"])
        assert user.customer is not None
        assert user.customer.email.lower() == "brand-new@example.com"
        assert user.customer.name == "New Customer"


@pytest.mark.django_db
def test_a_duplicate_email_is_rejected_without_revealing_why(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        first = APIClient().post(
            "/api/v1/portal/register/",
            {"email": "dupe@example.com", "password": "SuperSecret1", "full_name": "One"},
            format="json",
        )
        assert first.status_code == 201

        second = APIClient().post(
            "/api/v1/portal/register/",
            {"email": "dupe@example.com", "password": "AnotherSecret1", "full_name": "Two"},
            format="json",
        )
        assert second.status_code == 400
        body = str(second.data).lower()
        assert "taken" not in body and "already" not in body and "exists" not in body


@pytest.mark.django_db
def test_registration_is_reachable_without_authentication(seeded, django_db_blocker):
    with django_db_blocker.unblock():
        response = APIClient().post(
            "/api/v1/portal/register/",
            {"email": "anon@example.com", "password": "SuperSecret1", "full_name": "Anon"},
            format="json",
        )
        assert response.status_code == 201


# ---------------------------------------------------------------------------
# Task 3 — attachments on submission
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_portal_submission_accepts_attachments(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        response = client.post(
            "/api/v1/portal/tickets/",
            {"subject": "With a file", "description": "x", "attachments": [TXT()]},
            format="multipart",
        )
        assert response.status_code == 201
        ticket = Ticket.objects.get(number=response.data["number"])
        assert ticket.attachments.count() == 1
        assert ticket.attachments.first().uploaded_by_id == user.id


@pytest.mark.django_db
def test_a_portal_submission_rejects_an_oversized_or_disallowed_attachment(
    customer_client, django_db_blocker
):
    with django_db_blocker.unblock():
        client, _ = customer_client
        bad_type = SimpleUploadedFile("script.exe", b"x", content_type="application/octet-stream")
        response = client.post(
            "/api/v1/portal/tickets/",
            {"subject": "Bad file", "description": "x", "attachments": [bad_type]},
            format="multipart",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Task 4 — attachments on a reply
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_portal_reply_accepts_attachments(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()

        response = client.post(
            f"/api/v1/portal/tickets/{ticket.pk}/messages/",
            {"body": "See attached", "attachments": [TXT("reply.txt")]},
            format="multipart",
        )
        assert response.status_code == 201
        message_id = response.data["id"]
        attachment = ticket.attachments.get(message_id=message_id)
        assert attachment.filename == "reply.txt"


# ---------------------------------------------------------------------------
# Task 5 — csat survives a reload
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_csat_is_null_before_rating_and_present_after(customer_client, django_db_blocker):
    with django_db_blocker.unblock():
        client, user = customer_client
        ticket = Ticket.objects.filter(customer=user.customer).first()
        Ticket.objects.filter(pk=ticket.pk).update(status=Status.RESOLVED)

        before = client.get(f"/api/v1/portal/tickets/{ticket.pk}/").data
        assert before["csat"] is None

        CSATRating.objects.create(ticket=ticket, score=4, comment="Good")

        after = client.get(f"/api/v1/portal/tickets/{ticket.pk}/").data
        assert after["csat"] == {"score": 4, "comment": "Good"}
