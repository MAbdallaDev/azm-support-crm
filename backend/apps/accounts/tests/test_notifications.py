"""Notification centre: assignment, escalation, and SLA breach — plus the
`recipient=request.user` trust boundary, tested the same way the portal's
ticket scoping is: by trying to read or act on someone else's row and
asserting it fails, not just that the happy path succeeds.

The breach verb's own tests (idempotency, no-op when unassigned, the
`check_sla_breaches` sweep itself) live in `test_sla_breach_notifications.py`
— kept separate because they need a breached ticket's SLA fields set up,
which the assignment/escalation fixtures here have no reason to carry.
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Department, Notification, User
from apps.customers.models import Customer
from apps.tickets.models import Ticket
from apps.tickets.services import ticket_service


@pytest.fixture
def department(db):
    return Department.objects.create(name_en="Billing", name_ar="الفوترة", code="notif-billing")


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Acme", email="ops@acme.test")


def agent(username, department=None):
    return User.objects.create_user(
        username=username, password="x", role=User.Role.AGENT, department=department,
    )


def ticket_for(customer, department, **kwargs):
    return Ticket.objects.create(
        customer=customer, subject="Needs an owner", department=department, **kwargs
    )


def test_assigning_a_ticket_notifies_the_new_assignee(department, customer):
    manager = agent("manager-a", department)
    engineer = agent("engineer-a", department)
    ticket = ticket_for(customer, department)

    ticket_service.assign(ticket, engineer, manager)

    notification = Notification.objects.get()
    assert notification.recipient == engineer
    assert notification.actor == manager
    assert notification.verb == Notification.Verb.TICKET_ASSIGNED
    assert notification.ticket == ticket


def test_assigning_a_ticket_to_yourself_does_not_notify_yourself(department, customer):
    engineer = agent("engineer-b", department)
    ticket = ticket_for(customer, department)

    ticket_service.assign(ticket, engineer, engineer)

    assert not Notification.objects.exists()


def test_escalating_notifies_the_assignee_and_every_watcher_but_not_the_actor(department, customer):
    owner = agent("owner-c", department)
    watcher1 = agent("watcher1-c", department)
    watcher2 = agent("watcher2-c", department)
    manager = agent("manager-c", department)
    ticket = ticket_for(customer, department, assignee=owner)
    ticket.watchers.set([watcher1, watcher2, manager])

    ticket_service.escalate(ticket, manager, "Customer threatening to churn")

    recipients = set(Notification.objects.values_list("recipient", flat=True))
    assert recipients == {owner.pk, watcher1.pk, watcher2.pk}
    assert Notification.objects.filter(verb=Notification.Verb.TICKET_ESCALATED).count() == 3


def test_escalating_does_not_double_notify_a_watcher_who_is_also_the_assignee(department, customer):
    owner = agent("owner-d", department)
    manager = agent("manager-d", department)
    ticket = ticket_for(customer, department, assignee=owner)
    ticket.watchers.add(owner)

    ticket_service.escalate(ticket, manager, "")

    assert Notification.objects.filter(recipient=owner).count() == 1


@pytest.mark.django_db
class TestNotificationApi:
    def _client_for(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_a_user_only_ever_sees_their_own_notifications(self, department, customer):
        mine = agent("mine-e", department)
        someone_else = agent("someone-e", department)
        Notification.objects.create(recipient=mine, verb=Notification.Verb.TICKET_ASSIGNED)
        Notification.objects.create(recipient=someone_else, verb=Notification.Verb.TICKET_ASSIGNED)

        response = self._client_for(mine).get("/api/v1/notifications/")

        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["id"] == Notification.objects.get(recipient=mine).id

    def test_marking_read_stamps_read_at(self, department):
        mine = agent("mine-f", department)
        notification = Notification.objects.create(recipient=mine, verb=Notification.Verb.TICKET_ASSIGNED)

        response = self._client_for(mine).post(f"/api/v1/notifications/{notification.id}/read/")

        assert response.status_code == 200
        notification.refresh_from_db()
        assert notification.read_at is not None

    def test_a_user_cannot_mark_someone_elses_notification_read(self, department):
        mine = agent("mine-g", department)
        someone_else = agent("someone-g", department)
        theirs = Notification.objects.create(
            recipient=someone_else, verb=Notification.Verb.TICKET_ASSIGNED
        )

        response = self._client_for(mine).post(f"/api/v1/notifications/{theirs.id}/read/")

        assert response.status_code == 404
        theirs.refresh_from_db()
        assert theirs.read_at is None

    def test_unread_count_only_counts_unread_and_only_mine(self, department):
        mine = agent("mine-h", department)
        someone_else = agent("someone-h", department)
        Notification.objects.create(recipient=mine, verb=Notification.Verb.TICKET_ASSIGNED)
        Notification.objects.create(
            recipient=mine, verb=Notification.Verb.TICKET_ASSIGNED, read_at="2026-01-01T00:00:00Z"
        )
        Notification.objects.create(recipient=someone_else, verb=Notification.Verb.TICKET_ASSIGNED)

        response = self._client_for(mine).get("/api/v1/notifications/unread-count/")

        assert response.status_code == 200
        assert response.json() == {"count": 1}
