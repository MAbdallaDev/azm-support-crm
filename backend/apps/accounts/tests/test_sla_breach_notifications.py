"""`notify_sla_breach` and the `check_sla_breaches` command it's called from.

See `Notification`'s docstring for why this is a real scheduled sweep rather
than a lossy check bolted onto an unrelated write, and `notify_sla_breach`'s
own docstring for why idempotency is per-ticket, not per-sweep.
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import Department, Notification, User
from apps.accounts.notifications import notify_sla_breach
from apps.customers.models import Customer
from apps.tickets.models import Ticket


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="breach-billing")


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="ops@acme-breach.test")


def agent(username, department=None):
    return User.objects.create_user(
        username=username, password="x", role=User.Role.AGENT, department=department,
    )


def breached_ticket(customer, department, assignee=None):
    return Ticket.objects.create(
        customer=customer,
        subject="Past due",
        department=department,
        assignee=assignee,
        sla_resolution_due_at=timezone.now() - timedelta(hours=2),
    )


def unbreached_ticket(customer, department, assignee=None):
    return Ticket.objects.create(
        customer=customer,
        subject="Still on track",
        department=department,
        assignee=assignee,
        sla_resolution_due_at=timezone.now() + timedelta(hours=2),
    )


# ---------------------------------------------------------------------------
# notify_sla_breach
# ---------------------------------------------------------------------------


def test_notifies_the_assignee(department, customer):
    engineer = agent("engineer-breach-a", department)
    ticket = breached_ticket(customer, department, engineer)

    sent = notify_sla_breach(ticket)

    assert sent is True
    notification = Notification.objects.get()
    assert notification.recipient == engineer
    assert notification.actor is None
    assert notification.verb == Notification.Verb.TICKET_SLA_BREACHED
    assert notification.ticket == ticket


def test_is_a_no_op_when_unassigned(department, customer):
    ticket = breached_ticket(customer, department, assignee=None)

    sent = notify_sla_breach(ticket)

    assert sent is False
    assert not Notification.objects.exists()


def test_does_not_notify_twice_for_the_same_ticket(department, customer):
    engineer = agent("engineer-breach-b", department)
    ticket = breached_ticket(customer, department, engineer)

    first = notify_sla_breach(ticket)
    second = notify_sla_breach(ticket)

    assert (first, second) == (True, False)
    assert Notification.objects.filter(ticket=ticket).count() == 1


# ---------------------------------------------------------------------------
# check_sla_breaches — the sweep
# ---------------------------------------------------------------------------


def test_the_sweep_notifies_every_breached_assigned_ticket(department, customer):
    engineer = agent("engineer-breach-c", department)
    breached_ticket(customer, department, engineer)
    breached_ticket(customer, department, engineer)

    call_command("check_sla_breaches")

    assert Notification.objects.filter(
        recipient=engineer, verb=Notification.Verb.TICKET_SLA_BREACHED
    ).count() == 2


def test_the_sweep_ignores_tickets_within_sla(department, customer):
    engineer = agent("engineer-breach-d", department)
    unbreached_ticket(customer, department, engineer)

    call_command("check_sla_breaches")

    assert not Notification.objects.exists()


def test_the_sweep_ignores_resolved_tickets_even_past_their_due_date(department, customer):
    engineer = agent("engineer-breach-e", department)
    ticket = breached_ticket(customer, department, engineer)
    ticket.resolved_at = timezone.now()
    ticket.save(update_fields=["resolved_at"])

    call_command("check_sla_breaches")

    assert not Notification.objects.exists()


def test_running_the_sweep_twice_does_not_duplicate(department, customer):
    engineer = agent("engineer-breach-f", department)
    breached_ticket(customer, department, engineer)

    call_command("check_sla_breaches")
    call_command("check_sla_breaches")

    assert Notification.objects.filter(recipient=engineer).count() == 1
