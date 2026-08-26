"""The audit trail: right actor, changed fields only, and no password material."""

import io
import json

import pytest
from django.contrib import admin
from django.core.management import call_command
from django.urls import reverse

from apps.accounts.audit import audit_disabled
from apps.accounts.middleware import get_current_actor
from apps.accounts.models import AuditLog, Branch, Department, User
from apps.customers.models import Customer
from apps.tickets.models import Priority, Ticket


@pytest.fixture
def staff(db):
    department = Department.objects.create(name_en="Billing", name_ar="الفوترة", code="billing")
    branch = Branch.objects.create(name_en="Riyadh", name_ar="الرياض", code="riyadh")
    with audit_disabled():
        user = User.objects.create_superuser(
            username="auditor@demo",
            email="auditor@demo.local",
            password="Demo!2345",
            role=User.Role.ADMIN,
            department=department,
            branch=branch,
        )
    return user


@pytest.fixture
def customer(db):
    with audit_disabled():
        return Customer.objects.create(name="Acme", email="ops@acme.test")


@pytest.fixture
def ticket(db, customer):
    with audit_disabled():
        return Ticket.objects.create(customer=customer, subject="Audited ticket")


@pytest.mark.django_db
def test_create_writes_one_row_with_the_right_action(customer):
    AuditLog.objects.all().delete()
    created = Ticket.objects.create(customer=customer, subject="Fresh")

    entry = AuditLog.objects.get(model_name="tickets.Ticket")
    assert entry.action == "created"
    assert entry.object_id == str(created.pk)
    assert entry.changes["subject"] == {"from": None, "to": "Fresh"}


@pytest.mark.django_db
def test_update_records_changed_fields_and_nothing_else(ticket):
    AuditLog.objects.all().delete()
    ticket.priority = Priority.URGENT
    ticket.save()

    entry = AuditLog.objects.get(model_name="tickets.Ticket", action="updated")
    assert set(entry.changes) == {"priority"}
    assert entry.changes["priority"]["from"] == "normal"
    assert entry.changes["priority"]["to"] == "urgent"


@pytest.mark.django_db
def test_a_save_that_changes_nothing_writes_no_row(ticket):
    AuditLog.objects.all().delete()
    ticket.save()
    assert AuditLog.objects.filter(model_name="tickets.Ticket").count() == 0


@pytest.mark.django_db
def test_delete_is_audited(ticket):
    AuditLog.objects.all().delete()
    reference = str(ticket)
    ticket.delete()

    entry = AuditLog.objects.get(action="deleted", model_name="tickets.Ticket")
    assert entry.changes["__str__"] == reference


@pytest.mark.django_db
def test_password_never_reaches_the_audit_log(staff):
    """Not masked, not hashed — absent. An audit trail that records password
    hashes is a credential store read by more people than the user table is.
    """
    AuditLog.objects.all().delete()
    raw = "a-brand-new-Password!99"
    staff.set_password(raw)
    staff.save()

    entries = AuditLog.objects.filter(model_name="accounts.User")
    serialised = json.dumps([entry.changes for entry in entries])
    assert raw not in serialised
    assert staff.password not in serialised
    assert "password" not in serialised
    assert "pbkdf2" not in serialised


@pytest.mark.django_db
def test_last_login_is_not_audited(staff):
    """UPDATE_LAST_LOGIN writes this on every login. Auditing it would bury the
    real changes under noise.
    """
    AuditLog.objects.all().delete()
    from django.utils import timezone

    staff.last_login = timezone.now()
    staff.save()
    assert AuditLog.objects.filter(model_name="accounts.User").count() == 0


@pytest.mark.django_db
def test_audit_disabled_suppresses_writes(customer):
    AuditLog.objects.all().delete()
    with audit_disabled():
        Ticket.objects.create(customer=customer, subject="Quiet")
    assert AuditLog.objects.count() == 0

    # And the flag is restored afterwards, not left on.
    Ticket.objects.create(customer=customer, subject="Loud")
    assert AuditLog.objects.count() == 1


@pytest.mark.django_db
def test_actor_is_recorded_from_the_request(client, staff, customer):
    """The thread-local middleware is what carries the user into the signal."""
    AuditLog.objects.all().delete()
    client.force_login(staff)

    response = client.post(
        reverse("admin:tickets_ticket_add"),
        {
            "subject": "Raised through the admin",
            "description": "",
            "customer": customer.pk,
            "priority": "normal",
            "status": "new",
            "channel": "web",
            "escalation_level": 0,
            "assignment_reason": "",
            "ai_summary": "",
            "messages-TOTAL_FORMS": "0", "messages-INITIAL_FORMS": "0",
            "messages-MIN_NUM_FORMS": "0", "messages-MAX_NUM_FORMS": "1000",
            "attachments-TOTAL_FORMS": "0", "attachments-INITIAL_FORMS": "0",
            "attachments-MIN_NUM_FORMS": "0", "attachments-MAX_NUM_FORMS": "1000",
        },
    )
    assert response.status_code in (200, 302)
    entry = AuditLog.objects.filter(model_name="tickets.Ticket", action="created").first()
    assert entry is not None, "no audit row written for an admin-created ticket"
    assert entry.actor == staff


@pytest.mark.django_db
def test_middleware_clears_the_actor_after_the_response(client, staff):
    """Without the `finally`, a pooled worker leaks the previous request's user
    into the next one's audit rows — silent, intermittent, concurrency-only.
    """
    client.force_login(staff)
    client.get(reverse("admin:index"))
    assert get_current_actor() is None


@pytest.mark.django_db
def test_seed_demo_writes_no_audit_rows():
    before = AuditLog.objects.count()
    call_command("seed_demo", stdout=io.StringIO(), stderr=io.StringIO())
    assert AuditLog.objects.count() == before


@pytest.mark.django_db
def test_audit_log_admin_is_immutable():
    """Story 02 implemented this; the test exists so a later refactor cannot
    silently loosen it. An audit trail that can be edited is not an audit trail.
    """
    model_admin = admin.site._registry[AuditLog]
    assert model_admin.has_add_permission(request=None) is False
    assert model_admin.has_change_permission(request=None) is False
    assert model_admin.has_change_permission(request=None, obj=None) is False
